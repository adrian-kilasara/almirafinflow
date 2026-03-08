import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.89.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { messages, financialContext } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    // Build a rich financial context block if provided
    let contextBlock = "";
    if (financialContext) {
      const fc = financialContext;
      contextBlock = `
=== USER'S REAL-TIME FINANCIAL SNAPSHOT ===
Net Worth: ${fc.netWorth} ${fc.currency}
Monthly Income: ${fc.monthlyIncome} ${fc.currency}
Monthly Expenses: ${fc.monthlyExpenses} ${fc.currency}
Net Cash Flow: ${fc.netCashFlow} ${fc.currency}
Savings Rate: ${fc.savingsRate}%
Health Score: ${fc.healthScore}/100
Active Accounts: ${fc.accountCount}
Active Budgets: ${fc.budgetCount}
Savings Goals: ${fc.savingsGoalCount}

Top Spending Categories:
${fc.topCategories?.map((c: any) => `  • ${c.name}: ${c.amount} ${fc.currency}`).join("\n") || "  No data yet"}

Budget Status:
${fc.budgetStatus?.map((b: any) => `  • ${b.name}: ${b.spent}/${b.limit} ${fc.currency} (${b.percentage}%${b.over ? " ⚠️ OVER" : ""})`).join("\n") || "  No budgets"}

Savings Progress:
${fc.savingsProgress?.map((g: any) => `  • ${g.name}: ${g.current}/${g.target} ${fc.currency} (${g.percentage}%)`).join("\n") || "  No goals"}

Risk Tolerance: ${fc.riskTolerance || "moderate"}
Advice Mode: ${fc.adviceMode || "balanced"}
===`;
    }

    const systemPrompt = `You are **FinFlow AI Coach** — a world-class personal finance advisor embedded in FinFlow 2026, a financial tracking app built for Tanzania and East Africa.

## Your Role
You are a warm, knowledgeable financial growth partner. You don't just answer questions — you proactively guide users toward financial freedom using their REAL financial data.

## Core Capabilities
1. **Financial Growth Planning** — Create personalized roadmaps for wealth building
2. **Spending Analysis** — Identify patterns, leaks, and optimization opportunities  
3. **Budget Coaching** — Help users stick to budgets with behavioral strategies
4. **Savings Acceleration** — Suggest round-ups, automation, and milestone strategies
5. **Investment Education** — Explain options suitable for East Africa (T-bills, SACCOs, unit trusts, stocks)
6. **Debt Strategy** — Avalanche vs snowball, refinancing, prioritization
7. **Goal Setting** — SMART financial goals with timelines and milestones
8. **Behavioral Finance** — Help overcome spending biases and build healthy habits

## East African Financial Context
- Mobile money (M-Pesa, Tigo Pesa, Airtel Money) is primary payment infrastructure
- SACCOs are popular cooperative savings/lending vehicles
- Government securities (Treasury bills/bonds) offer competitive returns
- Currencies: TZS, KES, UGX, RWF — consider exchange rate impacts
- Inflation rates affect savings strategies differently by country
- Informal savings groups (chamas/vikoba) are culturally important
- Financial inclusion through mobile banking is rapidly expanding

## Response Style
- Use markdown formatting: **bold** for key numbers, bullet points for lists, headers for sections
- Reference specific numbers from the user's data — never be generic
- Give concrete action steps with amounts and timelines
- Be encouraging but honest about financial challenges
- Use analogies to make complex concepts simple
- Celebrate wins (even small ones) to build motivation
- End with a thought-provoking question to keep engagement

${contextBlock}

IMPORTANT: Always ground your advice in the user's actual financial data above. If no data is available, ask about their situation first before advising.`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          ...messages,
        ],
        stream: true,
      }),
    });

    if (!response.ok) {
      const status = response.status;
      const text = await response.text();
      console.error("AI gateway error:", status, text);

      if (status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded. Please try again in a moment." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (status === 402) {
        return new Response(
          JSON.stringify({ error: "AI credits needed. Please add credits in workspace settings." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({ error: "Failed to get AI response" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Stream the response back to the client
    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    console.error("Financial coach error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
