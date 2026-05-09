import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Rate } from "@/lib/currency";

let cache: { ts: number; rates: Rate[] } | null = null;
const TTL = 60 * 60 * 1000; // 1h

/**
 * Fetches the latest exchange_rates rows once per hour, cached in-memory.
 * Display-only — never used to write back to the DB.
 */
export function useExchangeRates(): { rates: Rate[]; loading: boolean } {
  const [rates, setRates] = useState<Rate[]>(cache?.rates ?? []);
  const [loading, setLoading] = useState(!cache);

  useEffect(() => {
    if (cache && Date.now() - cache.ts < TTL) {
      setRates(cache.rates);
      setLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("exchange_rates")
        .select("from_currency,to_currency,rate,effective_date")
        .order("effective_date", { ascending: false })
        .limit(500);
      if (cancelled) return;
      const list = (data ?? []) as Rate[];
      // Keep only most recent rate per pair
      const seen = new Set<string>();
      const dedup: Rate[] = [];
      for (const r of list) {
        const k = `${r.from_currency}->${r.to_currency}`;
        if (seen.has(k)) continue;
        seen.add(k);
        dedup.push(r);
      }
      cache = { ts: Date.now(), rates: dedup };
      setRates(dedup);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, []);

  return { rates, loading };
}
