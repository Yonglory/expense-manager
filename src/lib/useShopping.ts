import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from './supabase';
import { currentKey } from './format';
import { BUILTIN_CATEGORIES, categoryColors } from './theme';
import { cacheGet, cacheSet, canSync, enqueue, flushQueue, getSyncState, isNetworkError, markSynced, useSyncState, uuid } from './offline';
import { loadMonthItems, makeItem, patchMonthItems, queueItemInsert, queueItemUpdate } from './itemsData';
import type { ShopCat, ShopItem } from './types';

type CatRow = { id: string; name: string; color: string };
const normShop = (r: any): ShopItem => ({ ...r, est_price: Number(r.est_price), category: r.category === 'Other' ? 'Others' : r.category });

export type BudgetLine = { id: string; name: string; amount: number; actual: number | null };

export function useShopping(householdId: string) {
  const [items, setItems] = useState<ShopItem[]>([]);
  const [custom, setCustom] = useState<CatRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { version } = useSyncState();
  const itemsKey = `shop:${householdId}`;
  const catsKey = `shopcats:${householdId}`;

  const load = useCallback(async () => {
    await flushQueue();
    const st = getSyncState();
    if (canSync(st) && st.pending === 0) {
      const [a, c] = await Promise.all([
        supabase.from('shopping_items').select('*').eq('household_id', householdId).eq('archived', false).order('created_at', { ascending: true }),
        supabase.from('shopping_categories').select('*').eq('household_id', householdId).order('created_at', { ascending: true }),
      ]);
      if (!a.error) {
        const rows = (a.data ?? []).map(normShop);
        setItems(rows);
        void cacheSet(itemsKey, rows);
        setError(null);
        if (!c.error) {
          const cats = (c.data ?? []) as CatRow[];
          setCustom(cats);
          void cacheSet(catsKey, cats);
        }
        markSynced();
        setLoading(false);
        return;
      }
      if (!isNetworkError(a.error)) setError(a.error.message);
    }
    setItems((await cacheGet<ShopItem[]>(itemsKey)) ?? []);
    setCustom((await cacheGet<CatRow[]>(catsKey)) ?? []);
    setLoading(false);
  }, [householdId, itemsKey, catsKey]);

  useEffect(() => {
    load();
  }, [load, version]);

  useEffect(() => {
    const ch = supabase
      .channel(`shop-${householdId}-${Math.random().toString(36).slice(2, 7)}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'shopping_items', filter: `household_id=eq.${householdId}` }, () => load())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'shopping_categories', filter: `household_id=eq.${householdId}` }, () => load())
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [householdId, load]);

  const applyItems = useCallback(
    (fn: (cur: ShopItem[]) => ShopItem[]) => {
      setItems((cur) => {
        const next = fn(cur);
        void cacheSet(itemsKey, next);
        return next;
      });
    },
    [itemsKey],
  );
  const applyCats = useCallback(
    (fn: (cur: CatRow[]) => CatRow[]) => {
      setCustom((cur) => {
        const next = fn(cur);
        void cacheSet(catsKey, next);
        return next;
      });
    },
    [catsKey],
  );

  // Built-in categories first, then the household's own. Items with an unknown category get their own group.
  const categories = useMemo<ShopCat[]>(() => {
    const list: ShopCat[] = BUILTIN_CATEGORIES.map((c) => ({ name: c.name, color: c.color, builtin: true }));
    for (const c of custom) list.push({ id: c.id, name: c.name, color: c.color, builtin: false });
    const known = new Set(list.map((c) => c.name));
    for (const i of items) {
      if (!known.has(i.category)) {
        known.add(i.category);
        list.push({ name: i.category, color: '#B4B2A9', builtin: false });
      }
    }
    return list;
  }, [custom, items]);

  const add = useCallback(
    async (name: string, category: string, est_price = 0) => {
      const row: ShopItem = {
        id: uuid(), household_id: householdId, name, category, est_price, done: false, archived: false, created_at: new Date().toISOString(),
      };
      applyItems((cur) => [...cur, row]);
      void enqueue({ table: 'shopping_items', kind: 'insert', rowId: row.id, data: { household_id: householdId, name, category, est_price } });
    },
    [householdId, applyItems],
  );

  const update = useCallback(
    async (id: string, patch: Partial<Pick<ShopItem, 'name' | 'category' | 'est_price' | 'done'>>) => {
      applyItems((cur) => cur.map((i) => (i.id === id ? { ...i, ...patch } : i)));
      void enqueue({ table: 'shopping_items', kind: 'update', rowId: id, data: { ...patch } });
    },
    [applyItems],
  );

  const remove = useCallback(
    async (id: string) => {
      applyItems((cur) => cur.filter((i) => i.id !== id));
      void enqueue({ table: 'shopping_items', kind: 'delete', rowId: id });
    },
    [applyItems],
  );

  const addCategory = useCallback(
    async (name: string, color: string) => {
      const clean = name.trim();
      if (!clean || categories.some((c) => c.name.toLowerCase() === clean.toLowerCase())) return;
      const row: CatRow = { id: uuid(), name: clean, color: color || categoryColors[0] };
      applyCats((cur) => [...cur, row]);
      void enqueue({ table: 'shopping_categories', kind: 'insert', rowId: row.id, data: { household_id: householdId, name: row.name, color: row.color } });
    },
    [householdId, categories, applyCats],
  );

  // Items from a removed category move to Others.
  const removeCategory = useCallback(
    async (cat: ShopCat) => {
      if (cat.builtin) return;
      const moving = items.filter((i) => i.category === cat.name);
      applyItems((cur) => cur.map((i) => (i.category === cat.name ? { ...i, category: 'Others' } : i)));
      moving.forEach((i) => void enqueue({ table: 'shopping_items', kind: 'update', rowId: i.id, data: { category: 'Others' } }));
      if (cat.id) {
        applyCats((cur) => cur.filter((c) => c.id !== cat.id));
        void enqueue({ table: 'shopping_categories', kind: 'delete', rowId: cat.id });
      }
    },
    [items, applyItems, applyCats],
  );

  const loadBudgetLines = useCallback(async (): Promise<BudgetLine[]> => {
    const { items: all } = await loadMonthItems(householdId, currentKey());
    return all.filter((i) => i.kind === 'out').map((i) => ({ id: i.id, name: i.name, amount: i.amount, actual: i.actual }));
  }, [householdId]);

  // Adds what you really spent to a budget line (or creates one), then clears the ticked items.
  const finishShopping = useCallback(
    async (spent: number, line: BudgetLine | null, newLineName: string) => {
      const month = currentKey();
      if (spent > 0) {
        if (line) {
          const actual = (line.actual ?? 0) + spent;
          await patchMonthItems(householdId, month, (all) => all.map((i) => (i.id === line.id ? { ...i, actual } : i)));
          queueItemUpdate(line.id, { actual });
        } else {
          const item = makeItem(householdId, month, { kind: 'out', name: newLineName, amount: spent, actual: spent });
          await patchMonthItems(householdId, month, (all) => [...all, item]);
          queueItemInsert(item);
        }
      }
      const ticked = items.filter((i) => i.done);
      applyItems((cur) => cur.filter((i) => !i.done));
      ticked.forEach((i) => void enqueue({ table: 'shopping_items', kind: 'update', rowId: i.id, data: { archived: true } }));
      return null as string | null;
    },
    [householdId, items, applyItems],
  );

  return { items, categories, loading, error, add, update, remove, addCategory, removeCategory, loadBudgetLines, finishShopping, reload: load };
}
