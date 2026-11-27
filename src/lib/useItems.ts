import { useCallback, useEffect, useState } from 'react';
import { supabase } from './supabase';
import { shiftKey } from './format';
import { cacheSet, useSyncState } from './offline';
import { itemsKey, loadMonthItems, makeItem, queueItemInsert, queueItemUpdate } from './itemsData';
import { enqueue } from './offline';
import type { Item, Kind } from './types';

export function useItems(householdId: string, month: string) {
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { version } = useSyncState();
  const key = itemsKey(householdId, month);

  const load = useCallback(async () => {
    const res = await loadMonthItems(householdId, month);
    setItems(res.items);
    setError(res.error);
    setLoading(false);
  }, [householdId, month]);

  useEffect(() => {
    setLoading(true);
    load();
  }, [load, version]);

  // Family members' changes show up live.
  useEffect(() => {
    const channel = supabase
      .channel(`items-${householdId}-${month}-${Math.random().toString(36).slice(2, 7)}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'items', filter: `household_id=eq.${householdId}` }, () => load())
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [householdId, month, load]);

  // Update the screen and the copy on the phone at once.
  const apply = useCallback(
    (fn: (cur: Item[]) => Item[]) => {
      setItems((cur) => {
        const next = fn(cur);
        void cacheSet(key, next);
        return next;
      });
    },
    [key],
  );

  const add = useCallback(
    async (kind: Kind, name: string, amount: number, actual?: number | null) => {
      const item = makeItem(householdId, month, { kind, name, amount, actual: kind === 'out' ? actual ?? null : null });
      apply((cur) => [...cur, item]);
      queueItemInsert(item);
      return null as string | null;
    },
    [householdId, month, apply],
  );

  const update = useCallback(
    async (id: string, patch: Partial<Pick<Item, 'name' | 'amount' | 'paid' | 'actual'>>) => {
      apply((cur) => cur.map((i) => (i.id === id ? { ...i, ...patch } : i)));
      queueItemUpdate(id, patch);
      return null as string | null;
    },
    [apply],
  );

  const remove = useCallback(
    async (id: string) => {
      apply((cur) => cur.filter((i) => i.id !== id));
      void enqueue({ table: 'items', kind: 'delete', rowId: id });
    },
    [apply],
  );

  // Copies last month's list (everything unpaid again). Recurring bills create themselves, so they're skipped.
  const copyFromPrevious = useCallback(async () => {
    const prev = await loadMonthItems(householdId, shiftKey(month, -1));
    const copyable = prev.items.filter((i) => !i.bill_id);
    if (copyable.length === 0) return 'nothing';
    const rows = copyable.map((i) => makeItem(householdId, month, { kind: i.kind, name: i.name, amount: i.amount }));
    apply((cur) => [...cur, ...rows]);
    rows.forEach(queueItemInsert);
    return null as string | null;
  }, [householdId, month, apply]);

  return { items, loading, error, add, update, remove, copyFromPrevious, reload: load };
}
