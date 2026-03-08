import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { financialData, tipType, aiSettings } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    const currentDate = new Date().toISOString().split('T')[0];
    const adviceMode = aiSettings?.adviceMode || 'balanced';
    const riskTolerance = aiSettings?.riskTolerance || 'moderate';
    const currency = aiSettings?.currency || 'KES';

    const modeInstructions: Record<string, string> = {
      conservative: 'Focus on capital preservation, emergency fund building, and minimizing risk. Recommend safe investments like government bonds and SACCOs. Prioritize debt elimination and insurance.',
      balanced: 'Balance growth with security. Recommend a mix of savings, moderate investments, and debt management. Suggest both safe and moderate-risk opportunities.',
      aggressive: 'Focus on growth, investment opportunities, and wealth building. Recommend higher-return investments, business opportunities, and aggressive savings targets. Accept higher risk for potential returns.',
    };

    const riskInstructions: Record<string, string> = {
      low: 'User has LOW risk tolerance. Never recommend risky investments. Focus on guaranteed returns and safe vehicles.',
      moderate: 'User has MODERATE risk tolerance. Can suggest some diversified investments alongside safe options.',
      high: 'User has HIGH risk tolerance. Can suggest growth stocks, crypto awareness, business investments, and aggressive strategies.',
    };
    
    const systemPrompt = `You are a personal financial advisor for an East African user using FinFlow 2026.
Current date: ${currentDate}
User's currency: ${currency}

ADVICE MODE: ${adviceMode.toUpperCase()}
${modeInstructions[adviceMode]}

RISK PROFILE: ${riskTolerance.toUpperCase()}
${riskInstructions[riskTolerance]}

IMPORTANT: Base ALL advice on the actual numbers provided. Reference specific amounts, categories, and percentages. Never give generic advice.

Context about East Africa:
- Mobile money (M-Pesa, Airtel Money) is widely used
- SACCOs and government bonds are popular investment vehicles  
- Inflation and currency fluctuations affect savings strategies
- Emergency funds of 3-6 months expenses are recommended

Format your response as 3 numbered tips. Each tip should:
1. Reference a specific number from their data
2. Give a concrete, actionable step with amounts in ${currency}
3. Be encouraging but honest
4. Align with their ${adviceMode} advice mode and ${riskTolerance} risk tolerance`;

    let userPrompt = `Here is my complete financial data from FinFlow:\n\n`;
    
    const data = financialData;
    
    userPrompt += `📊 OVERVIEW:
- Total Net Worth (all accounts): ${data.totalBalance || 0} ${currency}
- Number of accounts: ${data.accountCount || 0}
- Total transactions tracked: ${data.transactionCount || 0}
- Financial Health Score: ${data.healthScore || 0}/100
- Current tracking streak: ${data.currentStreak || 0} days

💰 CASH FLOW (This Month):
- Total Income: ${data.totalIncome || 0} ${currency}
- Total Expenses: ${data.totalExpenses || 0} ${currency}
- Net Cash Flow: ${data.netCashFlow || 0} ${currency}
- Savings Rate: ${data.savingsRate || 0}%

📂 SPENDING BY CATEGORY:
${data.categorySpending ? Object.entries(data.categorySpending).map(([cat, amt]) => `- ${cat}: ${amt} ${currency}`).join('\n') : 'No category data'}

📋 BUDGET PERFORMANCE:
${data.budgetPerformance ? data.budgetPerformance.map((b: any) => `- ${b.name}: Spent ${b.spent} of ${b.budgeted} ${currency}${b.overBudget ? ' ⚠️ OVER BUDGET' : ''}`).join('\n') : 'No budgets set'}

🎯 SAVINGS GOALS:
${data.goalsProgress ? data.goalsProgress.map((g: any) => `- ${g.name}: ${g.currentAmount} / ${g.targetAmount} ${currency} (${g.percentage.toFixed(1)}%)`).join('\n') : 'No savings goals'}
`;

    if (tipType === 'budget') {
      userPrompt += `\nFocus specifically on my budget performance. Which budgets need attention? How can I optimize?`;
    } else if (tipType === 'savings') {
      userPrompt += `\nFocus specifically on my savings goals. How can I accelerate progress? What strategies should I use?`;
    } else if (tipType === 'spending') {
      userPrompt += `\nFocus specifically on my spending patterns. Where am I overspending? What can I cut?`;
    } else {
      userPrompt += `\nGive me a holistic financial health assessment with personalized advice aligned to my ${adviceMode} preference.`;
    }

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt }
        ],
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded. Please try again later." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted. Please add credits." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      throw new Error("Failed to get AI response");
    }

    const aiData = await response.json();
    const tips = aiData.choices[0].message.content;

    return new Response(JSON.stringify({ tips }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error in financial-tips function:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
