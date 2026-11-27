import { supabase } from './supabase';
import { cacheGet, cacheSet, canSync, enqueue, flushQueue, getSyncState, isNetworkError, markSynced, uuid } from './offline';
import type { Bill, Item, Kind } from './types';

export const itemsKey = (hh: string, month: string) => `items:${hh}:${month}`;
export const billsKey = (hh: string) => `bills:${hh}`;

export const normItem = (r: any): Item => ({
  ...r,
  amount: Number(r.amount),
  actual: r.actual == null ? null : Number(r.actual),
  due_day: r.due_day ?? null,
  bill_id: r.bill_id ?? null,
});

// Months where this session already created the recurring bills' items.
const ensured = new Set<string>();

// Reads a month from the server when we can, otherwise from the copy on this phone.
export async function loadMonthItems(hh: string, month: string): Promise<{ items: Item[]; error: string | null }> {
  await flushQueue();
  const st = getSyncState();
  if (canSync(st) && st.pending === 0) {
    const key = `${hh}|${month}`;
    if (!ensured.has(key)) {
      ensured.add(key);
      const { error: e0 } = await supabase.rpc('ensure_month_bills', { p_month: month });
      if (e0) ensured.delete(key);
    }
    const { data, error } = await supabase
      .from('items')
      .select('*')
      .eq('household_id', hh)
      .eq('month', month)
      .order('created_at', { ascending: true });
    if (!error) {
      const items = (data ?? []).map(normItem);
      await cacheSet(itemsKey(hh, month), items);
      markSynced();
      return { items, error: null };
    }
    const cached = await cacheGet<Item[]>(itemsKey(hh, month));
    return { items: cached ?? [], error: isNetworkError(error) ? null : error.message };
  }
  return { items: (await cacheGet<Item[]>(itemsKey(hh, month))) ?? [], error: null };
}

export async function loadBills(hh: string): Promise<{ bills: Bill[]; error: string | null }> {
  await flushQueue();
  const st = getSyncState();
  if (canSync(st) && st.pending === 0) {
    const { data, error } = await supabase.from('bills').select('*').eq('household_id', hh).order('due_day', { ascending: true });
    if (!error) {
      const bills = (data ?? []).map((r: any) => ({ ...r, amount: Number(r.amount) })) as Bill[];
      await cacheSet(billsKey(hh), bills);
      markSynced();
      return { bills, error: null };
    }
    return { bills: (await cacheGet<Bill[]>(billsKey(hh))) ?? [], error: isNetworkError(error) ? null : error.message };
  }
  return { bills: (await cacheGet<Bill[]>(billsKey(hh))) ?? [], error: null };
}

// Changes the copy kept on the phone for one month (used when another screen edits items).
export async function patchMonthItems(hh: string, month: string, fn: (items: Item[]) => Item[]): Promise<void> {
  const cur = (await cacheGet<Item[]>(itemsKey(hh, month))) ?? [];
  await cacheSet(itemsKey(hh, month), fn(cur));
}

export function makeItem(hh: string, month: string, p: Partial<Item> & { kind: Kind; name: string; amount: number }): Item {
  return {
    id: uuid(),
    household_id: hh,
    month,
    paid: false,
    actual: null,
    due_day: null,
    bill_id: null,
    created_at: new Date().toISOString(),
    ...p,
  };
}

export function queueItemInsert(item: Item) {
  const data: Record<string, unknown> = {
    household_id: item.household_id,
    month: item.month,
    kind: item.kind,
    name: item.name,
    amount: item.amount,
    paid: item.paid,
  };
  if (item.actual != null) data.actual = item.actual;
  if (item.due_day != null) data.due_day = item.due_day;
  if (item.bill_id != null) data.bill_id = item.bill_id;
  void enqueue({ table: 'items', kind: 'insert', rowId: item.id, data });
}

export function queueItemUpdate(id: string, data: Record<string, unknown>) {
  void enqueue({ table: 'items', kind: 'update', rowId: id, data });
}
