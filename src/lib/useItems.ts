import { useCallback, useEffect, useState } from 'react';
import { supabase } from './supabase';
import { shiftKey } from './format';
import type { Item, Kind } from './types';

const norm = (r: any): Item => ({
  ...r,
  amount: Number(r.amount),
  actual: r.actual == null ? null : Number(r.actual),
  due_day: r.due_day ?? null,
  bill_id: r.bill_id ?? null,
});

// Months where this session already created the recurring bills' items.
const ensured = new Set<string>();

export function useItems(householdId: string, month: string) {
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const key = `${householdId}|${month}`;
    if (!ensured.has(key)) {
      ensured.add(key);
      const { error: e0 } = await supabase.rpc('ensure_month_bills', { p_month: month });
      if (e0) ensured.delete(key);
    }
    const { data, error: e } = await supabase
      .from('items')
      .select('*')
      .eq('household_id', householdId)
      .eq('month', month)
      .order('created_at', { ascending: true });
    if (e) setError(e.message);
    else {
      setError(null);
      setItems((data ?? []).map(norm));
    }
    setLoading(false);
  }, [householdId, month]);

  useEffect(() => {
    setLoading(true);
    load();
  }, [load]);

  // Family members' changes show up live.
  useEffect(() => {
    const channel = supabase
      .channel(`items-${householdId}-${month}-${Math.random().toString(36).slice(2, 7)}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'items', filter: `household_id=eq.${householdId}` },
        () => load(),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [householdId, month, load]);

  const add = useCallback(
    async (kind: Kind, name: string, amount: number, actual?: number | null) => {
      const row: Record<string, unknown> = { household_id: householdId, month, kind, name, amount };
      if (kind === 'out' && actual != null) row.actual = actual;
      const { data, error: e } = await supabase
        .from('items')
        .insert(row)
        .select()
        .single();
      if (e) return e.message;
      setItems((cur) => (cur.some((i) => i.id === data.id) ? cur : [...cur, norm(data)]));
      return null;
    },
    [householdId, month],
  );

  const update = useCallback(
    async (id: string, patch: Partial<Pick<Item, 'name' | 'amount' | 'paid' | 'actual'>>) => {
      setItems((cur) => cur.map((i) => (i.id === id ? { ...i, ...patch } : i)));
      const { error: e } = await supabase.from('items').update(patch).eq('id', id);
      if (e) {
        setError(e.message);
        load();
        return e.message;
      }
      return null;
    },
    [load],
  );

  const remove = useCallback(
    async (id: string) => {
      setItems((cur) => cur.filter((i) => i.id !== id));
      const { error: e } = await supabase.from('items').delete().eq('id', id);
      if (e) {
        setError(e.message);
        load();
      }
    },
    [load],
  );

  // Copies last month's list (everything unpaid again) so you don't retype it.
  const copyFromPrevious = useCallback(async () => {
    const { data, error: e } = await supabase
      .from('items')
      .select('kind,name,amount,bill_id')
      .eq('household_id', householdId)
      .eq('month', shiftKey(month, -1))
      .order('created_at', { ascending: true });
    if (e) return e.message;
    // Recurring bills create themselves, so only copy the other items.
    const copyable = (data ?? []).filter((r: any) => !r.bill_id);
    if (copyable.length === 0) return 'Last month has no other items to copy.';
    const rows = copyable.map((r: any) => ({
      household_id: householdId,
      month,
      kind: r.kind,
      name: r.name,
      amount: r.amount,
      paid: false,
    }));
    const { error: e2 } = await supabase.from('items').insert(rows);
    if (e2) return e2.message;
    await load();
    return null;
  }, [householdId, month, load]);

  return { items, loading, error, add, update, remove, copyFromPrevious, reload: load };
}
