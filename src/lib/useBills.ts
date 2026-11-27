import { useCallback, useEffect, useState } from 'react';
import { supabase } from './supabase';
import { currentKey } from './format';
import type { Bill, Item } from './types';
import { syncReminders } from './reminders';

export type BillInput = { name: string; amount: number; due_day: number; remind_days_before: number; active: boolean };

export function useBills(householdId: string, month = currentKey()) {
  const [bills, setBills] = useState<Bill[]>([]);
  const [thisMonth, setThisMonth] = useState<Record<string, Pick<Item, 'id' | 'paid'>>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    // Make sure this month's items exist so "Mark paid" works right away.
    await supabase.rpc('ensure_month_bills', { p_month: month });
    const [b, i] = await Promise.all([
      supabase.from('bills').select('*').eq('household_id', householdId).order('due_day', { ascending: true }),
      supabase.from('items').select('id,paid,bill_id').eq('household_id', householdId).eq('month', month).not('bill_id', 'is', null),
    ]);
    if (b.error) setError(b.error.message);
    else {
      setError(null);
      setBills((b.data ?? []).map((r: any) => ({ ...r, amount: Number(r.amount) })));
    }
    const map: Record<string, Pick<Item, 'id' | 'paid'>> = {};
    for (const r of i.data ?? []) map[(r as any).bill_id] = { id: (r as any).id, paid: (r as any).paid };
    setThisMonth(map);
    setLoading(false);
  }, [householdId, month]);

  useEffect(() => {
    setLoading(true);
    load();
  }, [load]);

  useEffect(() => {
    const ch = supabase
      .channel(`bills-${householdId}-${Math.random().toString(36).slice(2, 7)}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'bills', filter: `household_id=eq.${householdId}` }, () => load())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'items', filter: `household_id=eq.${householdId}` }, () => load())
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [householdId, load]);

  const afterChange = useCallback(async () => {
    await load();
    await syncReminders(householdId);
  }, [load, householdId]);

  const save = useCallback(
    async (id: string | null, input: BillInput) => {
      const res = id
        ? await supabase.from('bills').update(input).eq('id', id)
        : await supabase.from('bills').insert({ ...input, household_id: householdId, start_month: currentKey() });
      if (res.error) return res.error.message;
      await afterChange();
      return null;
    },
    [householdId, afterChange],
  );

  const remove = useCallback(
    async (id: string) => {
      const { error: e } = await supabase.from('bills').delete().eq('id', id);
      if (e) return e.message;
      await afterChange();
      return null;
    },
    [afterChange],
  );

  const markPaid = useCallback(
    async (itemId: string, paid: boolean) => {
      setThisMonth((cur) => {
        const next = { ...cur };
        for (const k of Object.keys(next)) if (next[k].id === itemId) next[k] = { ...next[k], paid };
        return next;
      });
      const { error: e } = await supabase.from('items').update({ paid }).eq('id', itemId);
      if (e) setError(e.message);
      await afterChange();
    },
    [afterChange],
  );

  return { bills, thisMonth, loading, error, save, remove, markPaid, reload: load };
}
