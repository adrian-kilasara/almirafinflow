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
    const { financialData, tipType } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    const currentDate = new Date().toISOString().split('T')[0];
    
    let systemPrompt = `You are a professional financial advisor specializing in East African markets and personal finance for 2026. 
Current date: ${currentDate}

You provide actionable, specific financial advice based on:
- 2026 economic trends in East Africa (Kenya, Tanzania, Uganda, Rwanda, Burundi, Ethiopia)
- Current inflation rates and interest rates
- Mobile money trends (M-Pesa, Airtel Money, MTN Mobile Money)
- Investment opportunities (government bonds, SACCOs, stock markets)
- Savings strategies and emergency fund recommendations
- Budgeting best practices for the region

Keep advice practical, culturally relevant, and specific to the user's financial situation.
Always provide 2-3 actionable tips. Be encouraging but realistic.`;

    let userPrompt = "";
    
    if (tipType === 'budget') {
      userPrompt = `Based on this budget data: ${JSON.stringify(financialData)}
      
Provide 3 specific tips to optimize this budget for 2026. Consider:
- Category spending patterns
- Potential savings opportunities
- Emergency fund recommendations`;
    } else if (tipType === 'savings') {
      userPrompt = `Based on these savings goals: ${JSON.stringify(financialData)}
      
Provide 3 specific tips to accelerate savings in 2026. Consider:
- High-yield savings options in East Africa
- Inflation protection strategies
- Timeline optimization`;
    } else if (tipType === 'spending') {
      userPrompt = `Based on this spending pattern: ${JSON.stringify(financialData)}
      
Provide 3 specific tips to reduce unnecessary spending in 2026. Consider:
- Common overspending categories
- Smart shopping strategies
- Subscription and recurring cost optimization`;
    } else {
      userPrompt = `Based on this financial overview: ${JSON.stringify(financialData)}
      
Provide 3 personalized financial tips for 2026. Consider:
- Income vs expense ratio
- Account health
- Overall financial wellness`;
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

    const data = await response.json();
    const tips = data.choices[0].message.content;

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
