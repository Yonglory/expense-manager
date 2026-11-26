import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from './supabase';
import { currentKey } from './format';
import type { ShopCategory, ShopItem } from './types';

const norm = (r: any): ShopItem => ({ ...r, est_price: Number(r.est_price) });

export type BudgetLine = { id: string; name: string; amount: number; actual: number | null };
export type BuyAgain = { name: string; category: ShopCategory; est_price: number };

export function useShopping(householdId: string) {
  const [items, setItems] = useState<ShopItem[]>([]);
  const [archived, setArchived] = useState<ShopItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const [a, b] = await Promise.all([
      supabase.from('shopping_items').select('*').eq('household_id', householdId).eq('archived', false).order('created_at', { ascending: true }),
      supabase.from('shopping_items').select('*').eq('household_id', householdId).eq('archived', true).order('created_at', { ascending: false }).limit(200),
    ]);
    if (a.error) setError(a.error.message);
    else {
      setError(null);
      setItems((a.data ?? []).map(norm));
    }
    if (!b.error) setArchived((b.data ?? []).map(norm));
    setLoading(false);
  }, [householdId]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const ch = supabase
      .channel(`shop-${householdId}-${Math.random().toString(36).slice(2, 7)}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'shopping_items', filter: `household_id=eq.${householdId}` }, () => load())
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [householdId, load]);

  const add = useCallback(
    async (name: string, category: ShopCategory, est_price = 0) => {
      const { data, error: e } = await supabase
        .from('shopping_items')
        .insert({ household_id: householdId, name, category, est_price })
        .select()
        .single();
      if (e) return e.message;
      setItems((cur) => (cur.some((i) => i.id === data.id) ? cur : [...cur, norm(data)]));
      return null;
    },
    [householdId],
  );

  const update = useCallback(
    async (id: string, patch: Partial<Pick<ShopItem, 'name' | 'category' | 'est_price' | 'done'>>) => {
      setItems((cur) => cur.map((i) => (i.id === id ? { ...i, ...patch } : i)));
      const { error: e } = await supabase.from('shopping_items').update(patch).eq('id', id);
      if (e) {
        setError(e.message);
        load();
      }
    },
    [load],
  );

  const remove = useCallback(
    async (id: string) => {
      setItems((cur) => cur.filter((i) => i.id !== id));
      const { error: e } = await supabase.from('shopping_items').delete().eq('id', id);
      if (e) {
        setError(e.message);
        load();
      }
    },
    [load],
  );

  // Ticked items leave the list but stay in history for "Buy again".
  const clearTicked = useCallback(async () => {
    const ids = items.filter((i) => i.done).map((i) => i.id);
    if (ids.length === 0) return;
    setItems((cur) => cur.filter((i) => !i.done));
    const { error: e } = await supabase.from('shopping_items').update({ archived: true }).in('id', ids);
    if (e) setError(e.message);
    await load();
  }, [items, load]);

  const loadBudgetLines = useCallback(async (): Promise<BudgetLine[]> => {
    const { data } = await supabase
      .from('items')
      .select('id,name,amount,actual')
      .eq('household_id', householdId)
      .eq('month', currentKey())
      .eq('kind', 'out')
      .order('created_at', { ascending: true });
    return (data ?? []).map((r: any) => ({ id: r.id, name: r.name, amount: Number(r.amount), actual: r.actual == null ? null : Number(r.actual) }));
  }, [householdId]);

  // Adds what you really spent to a budget line (or creates one), then clears the ticked items.
  const finishShopping = useCallback(
    async (spent: number, line: BudgetLine | null, newLineName: string) => {
      if (spent > 0) {
        if (line) {
          const { error: e } = await supabase.from('items').update({ actual: (line.actual ?? 0) + spent }).eq('id', line.id);
          if (e) return e.message;
        } else {
          const { error: e } = await supabase
            .from('items')
            .insert({ household_id: householdId, month: currentKey(), kind: 'out', name: newLineName, amount: spent, actual: spent });
          if (e) return e.message;
        }
      }
      await clearTicked();
      return null;
    },
    [householdId, clearTicked],
  );

  const buyAgain = useMemo<BuyAgain[]>(() => {
    const active = new Set(items.map((i) => i.name.trim().toLowerCase()));
    const seen = new Map<string, { item: ShopItem; count: number }>();
    for (const a of archived) {
      const k = a.name.trim().toLowerCase();
      const cur = seen.get(k);
      if (cur) cur.count += 1;
      else seen.set(k, { item: a, count: 1 });
    }
    return [...seen.entries()]
      .filter(([k]) => !active.has(k))
      .sort((x, y) => y[1].count - x[1].count)
      .slice(0, 10)
      .map(([, v]) => ({ name: v.item.name, category: v.item.category, est_price: v.item.est_price }));
  }, [items, archived]);

  return { items, loading, error, add, update, remove, clearTicked, loadBudgetLines, finishShopping, buyAgain, reload: load };
}
