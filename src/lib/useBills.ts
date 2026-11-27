import { useCallback, useEffect, useState } from 'react';
import { supabase } from './supabase';
import { currentKey } from './format';
import { cacheSet, enqueue, useSyncState, uuid } from './offline';
import { billsKey, loadBills, loadMonthItems, makeItem, patchMonthItems, queueItemInsert, queueItemUpdate } from './itemsData';
import type { Bill } from './types';
import { syncReminders } from './reminders';

export type BillInput = { name: string; amount: number; due_day: number; remind_days_before: number; active: boolean };
export type BillItemInfo = { id: string; paid: boolean };

export function useBills(householdId: string) {
  const [bills, setBills] = useState<Bill[]>([]);
  const [thisMonth, setThisMonth] = useState<Record<string, BillItemInfo>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { version } = useSyncState();

  const load = useCallback(async () => {
    const [b, i] = await Promise.all([loadBills(householdId), loadMonthItems(householdId, currentKey())]);
    setBills(b.bills);
    setError(b.error ?? i.error);
    const map: Record<string, BillItemInfo> = {};
    for (const it of i.items) if (it.bill_id) map[it.bill_id] = { id: it.id, paid: it.paid };
    setThisMonth(map);
    setLoading(false);
  }, [householdId]);

  useEffect(() => {
    load();
  }, [load, version]);

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

  const applyBills = useCallback(
    (fn: (cur: Bill[]) => Bill[]) => {
      setBills((cur) => {
        const next = fn(cur);
        void cacheSet(billsKey(householdId), next);
        return next;
      });
    },
    [householdId],
  );

  const save = useCallback(
    async (id: string | null, input: BillInput) => {
      const month = currentKey();
      if (id) {
        applyBills((cur) => cur.map((b) => (b.id === id ? { ...b, ...input } : b)));
        void enqueue({ table: 'bills', kind: 'update', rowId: id, data: { ...input } });
        // The unpaid item for this month follows the edit.
        const item = thisMonth[id];
        if (item && !item.paid) {
          const fields = { name: input.name, amount: input.amount, due_day: input.due_day };
          await patchMonthItems(householdId, month, (items) => items.map((i) => (i.id === item.id ? { ...i, ...fields } : i)));
          queueItemUpdate(item.id, fields);
        }
      } else {
        const bill: Bill = { id: uuid(), household_id: householdId, ...input, start_month: month };
        applyBills((cur) => [...cur, bill].sort((a, b) => a.due_day - b.due_day));
        void enqueue({
          table: 'bills',
          kind: 'insert',
          rowId: bill.id,
          data: { household_id: householdId, ...input, start_month: month },
        });
        if (input.active) {
          // Show it in this month's budget right away, even while offline.
          const item = makeItem(householdId, month, { kind: 'out', name: input.name, amount: input.amount, bill_id: bill.id, due_day: input.due_day });
          await patchMonthItems(householdId, month, (items) => [...items, item]);
          queueItemInsert(item);
          setThisMonth((cur) => ({ ...cur, [bill.id]: { id: item.id, paid: false } }));
        }
      }
      await syncReminders(householdId);
      return null as string | null;
    },
    [householdId, thisMonth, applyBills],
  );

  const remove = useCallback(
    async (id: string) => {
      applyBills((cur) => cur.filter((b) => b.id !== id));
      void enqueue({ table: 'bills', kind: 'delete', rowId: id });
      await patchMonthItems(householdId, currentKey(), (items) => items.map((i) => (i.bill_id === id ? { ...i, bill_id: null } : i)));
      setThisMonth((cur) => {
        const next = { ...cur };
        delete next[id];
        return next;
      });
      await syncReminders(householdId);
      return null as string | null;
    },
    [householdId, applyBills],
  );

  const markPaid = useCallback(
    async (itemId: string, paid: boolean) => {
      setThisMonth((cur) => {
        const next = { ...cur };
        for (const k of Object.keys(next)) if (next[k].id === itemId) next[k] = { ...next[k], paid };
        return next;
      });
      await patchMonthItems(householdId, currentKey(), (items) => items.map((i) => (i.id === itemId ? { ...i, paid } : i)));
      queueItemUpdate(itemId, { paid });
      await syncReminders(householdId);
    },
    [householdId],
  );

  return { bills, thisMonth, loading, error, save, remove, markPaid, reload: load };
}
