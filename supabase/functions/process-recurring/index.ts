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

  // Auth: require shared secret OR service-role JWT. This function uses the
  // service role key and must never be callable anonymously from the internet.
  const internalSecret = Deno.env.get("INTERNAL_CRON_SECRET");
  const providedSecret = req.headers.get("x-internal-secret");
  const authHeader = req.headers.get("authorization") ?? "";
  const expectedServiceJwt = `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""}`;
  const secretOk = !!internalSecret && providedSecret === internalSecret;
  const jwtOk = authHeader === expectedServiceJwt;
  if (!secretOk && !jwtOk) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);


    // Find all active recurring schedules that are due
    const today = new Date().toISOString().split("T")[0];
    const { data: schedules, error: fetchErr } = await supabase
      .from("recurring_schedules")
      .select("*")
      .eq("is_active", true)
      .lte("next_run_date", today);

    if (fetchErr) throw fetchErr;

    let processed = 0;
    let errors = 0;

    for (const schedule of schedules || []) {
      try {
        // Check max_runs
        if (schedule.max_runs && schedule.total_runs >= schedule.max_runs) {
          await supabase
            .from("recurring_schedules")
            .update({ is_active: false })
            .eq("id", schedule.id);
          continue;
        }

        const template = schedule.template_data;
        
        if (schedule.type === "transaction" && template) {
          // Create the transaction
          const { error: txnErr } = await supabase.from("transactions").insert({
            user_id: schedule.user_id,
            type: template.type,
            amount: template.amount,
            account_id: template.account_id,
            category_id: template.category_id || null,
            description: template.description || null,
            merchant: template.merchant || null,
            currency: template.currency || "KES",
            payment_method: template.payment_method || "cash",
            date: today,
            status: "completed",
            is_recurring: true,
            recurring_interval: schedule.frequency,
            tags: template.tags || [],
          });

          if (txnErr) throw txnErr;

          // Update account balance
          const balanceChange = template.type === "income" ? template.amount : -template.amount;
          const { data: account } = await supabase
            .from("accounts")
            .select("balance")
            .eq("id", template.account_id)
            .single();

          if (account) {
            const newBalance = Number(account.balance) + balanceChange;
            await supabase
              .from("accounts")
              .update({ balance: newBalance })
              .eq("id", template.account_id);

            // Audit log
            await supabase.from("account_audit_log").insert({
              user_id: schedule.user_id,
              account_id: template.account_id,
              action: "recurring_transaction",
              amount: balanceChange,
              balance_before: account.balance,
              balance_after: newBalance,
              notes: `Recurring ${template.type}: ${template.description || template.merchant || "Auto"}`,
            });
          }

          // Create notification
          await supabase.from("notifications").insert({
            user_id: schedule.user_id,
            type: "info",
            title: "Recurring Transaction Processed",
            message: `${template.type === "income" ? "+" : "-"}${template.amount} ${template.currency || ""} — ${template.description || template.merchant || "Recurring payment"}`,
            module: "transactions",
          });
        }

        if (schedule.type === "savings" && template) {
          // Auto-save to goal
          const { data: account } = await supabase
            .from("accounts")
            .select("balance")
            .eq("id", template.account_id)
            .single();

          if (account && Number(account.balance) >= template.amount) {
            await supabase.from("savings_allocations").insert({
              user_id: schedule.user_id,
              savings_goal_id: template.savings_goal_id,
              account_id: template.account_id,
              amount: template.amount,
              currency: template.currency || "KES",
              notes: "Automated savings",
            });

            await supabase
              .from("accounts")
              .update({ balance: Number(account.balance) - template.amount })
              .eq("id", template.account_id);

            await supabase.from("notifications").insert({
              user_id: schedule.user_id,
              type: "success",
              title: "Automated Savings",
              message: `${template.amount} ${template.currency || ""} saved to ${template.goal_name || "savings goal"}`,
              module: "savings",
            });
          } else {
            await supabase.from("notifications").insert({
              user_id: schedule.user_id,
              type: "warning",
              title: "Savings Skipped",
              message: `Insufficient balance to auto-save ${template.amount} ${template.currency || ""}`,
              module: "savings",
            });
          }
        }

        // Calculate next run date
        const nextDate = new Date(schedule.next_run_date);
        switch (schedule.frequency) {
          case "daily": nextDate.setDate(nextDate.getDate() + 1); break;
          case "weekly": nextDate.setDate(nextDate.getDate() + 7); break;
          case "monthly": nextDate.setMonth(nextDate.getMonth() + 1); break;
          case "yearly": nextDate.setFullYear(nextDate.getFullYear() + 1); break;
        }

        await supabase
          .from("recurring_schedules")
          .update({
            next_run_date: nextDate.toISOString().split("T")[0],
            last_run_date: today,
            total_runs: schedule.total_runs + 1,
          })
          .eq("id", schedule.id);

        processed++;
      } catch (e) {
        console.error(`Error processing schedule ${schedule.id}:`, e);
        errors++;
      }
    }

    return new Response(
      JSON.stringify({ processed, errors, total: schedules?.length || 0 }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("process-recurring error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
