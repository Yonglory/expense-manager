import { useSyncExternalStore } from 'react';
import { AppState } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import { supabase } from './supabase';

// Offline use: reads come from a copy kept on the phone, and changes wait in a queue until they can be uploaded.

export type TableName = 'items' | 'bills' | 'shopping_items' | 'shopping_categories';
export type Op = {
  qid: string;
  table: TableName;
  kind: 'insert' | 'update' | 'delete';
  rowId: string;
  data?: Record<string, unknown>;
  ts: number;
};

export type SyncState = {
  online: boolean;
  cellular: boolean;
  syncMobile: boolean;
  pending: number;
  pendingIds: string[];
  syncing: boolean;
  lastSynced: number | null;
  version: number; // goes up whenever fresh data may be available, so screens reload
};

let state: SyncState = {
  online: true, cellular: false, syncMobile: true, pending: 0, pendingIds: [], syncing: false, lastSynced: null, version: 0,
};
const listeners = new Set<() => void>();
function set(patch: Partial<SyncState>) {
  state = { ...state, ...patch };
  listeners.forEach((l) => l());
}
export const getSyncState = () => state;
export function subscribe(l: () => void) {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
}
export function useSyncState(): SyncState {
  return useSyncExternalStore(subscribe, getSyncState, getSyncState);
}
export const canSync = (s: SyncState = state) => s.online && (!s.cellular || s.syncMobile);

// ---------- small helpers ----------
export function uuid(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}
export async function cacheGet<T>(key: string): Promise<T | null> {
  try {
    const v = await AsyncStorage.getItem('cache:' + key);
    return v ? (JSON.parse(v) as T) : null;
  } catch {
    return null;
  }
}
export async function cacheSet(key: string, value: unknown): Promise<void> {
  try {
    await AsyncStorage.setItem('cache:' + key, JSON.stringify(value));
  } catch {
    // The cache is a convenience.
  }
}
export function isNetworkError(e: any): boolean {
  if (!e) return false;
  const msg = String(e.message ?? e);
  return !e.code || e.status === 0 || e.code === 'PGRST301' || /(network|fetch|timed? ?out|offline|connection|jwt)/i.test(msg);
}

// ---------- queue ----------
const QUEUE_KEY = 'offline_queue';
const LAST_KEY = 'offline_last_synced';
const MOBILE_KEY = 'offline_sync_mobile';
let queue: Op[] = [];

async function persist() {
  await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
}
function refreshPending() {
  set({ pending: queue.length, pendingIds: queue.map((o) => o.rowId) });
}

const ready = (async () => {
  try {
    const [q, last, mobile] = await Promise.all([
      AsyncStorage.getItem(QUEUE_KEY),
      AsyncStorage.getItem(LAST_KEY),
      AsyncStorage.getItem(MOBILE_KEY),
    ]);
    queue = q ? (JSON.parse(q) as Op[]) : [];
    set({
      pending: queue.length,
      pendingIds: queue.map((o) => o.rowId),
      lastSynced: last ? Number(last) : null,
      syncMobile: mobile === null ? true : mobile === '1',
    });
  } catch {
    // start with an empty queue
  }
})();

export async function enqueue(op: Omit<Op, 'qid' | 'ts'>): Promise<void> {
  await ready;
  queue.push({ ...op, qid: uuid(), ts: Date.now() });
  refreshPending();
  await persist();
  void flushQueue();
}

async function execute(op: Op): Promise<'ok' | 'network' | 'drop'> {
  try {
    let res;
    if (op.kind === 'insert') res = await supabase.from(op.table).insert({ id: op.rowId, ...(op.data ?? {}) });
    else if (op.kind === 'update') res = await supabase.from(op.table).update(op.data ?? {}).eq('id', op.rowId);
    else res = await supabase.from(op.table).delete().eq('id', op.rowId);
    if (!res.error) return 'ok';
    const e = res.error as any;
    if (op.kind === 'insert' && e.code === '23505') return 'ok'; // already there
    return isNetworkError(e) ? 'network' : 'drop';
  } catch {
    return 'network';
  }
}

let flushing: Promise<void> | null = null;
export function flushQueue(force = false): Promise<void> {
  if (flushing) return flushing;
  flushing = (async () => {
    await ready;
    if (queue.length === 0 || !(force ? state.online : canSync())) return;
    set({ syncing: true });
    let did = false;
    try {
      while (queue.length > 0) {
        const r = await execute(queue[0]);
        if (r === 'network') break;
        if (r === 'ok') did = true;
        queue.shift(); // 'drop' (a change the server refuses) is skipped so it can't block the rest
        await persist();
        refreshPending();
      }
    } finally {
      if (did) {
        const now = Date.now();
        await AsyncStorage.setItem(LAST_KEY, String(now));
        set({ syncing: false, lastSynced: now, version: state.version + 1 });
      } else {
        set({ syncing: false });
      }
    }
  })().finally(() => {
    flushing = null;
  });
  return flushing;
}

// Called by screens after they successfully read from the server.
export function markSynced() {
  const now = Date.now();
  AsyncStorage.setItem(LAST_KEY, String(now)).catch(() => {});
  set({ lastSynced: now });
}

export async function syncNow(): Promise<void> {
  await flushQueue(true);
  set({ version: state.version + 1 });
}

export async function setSyncMobile(on: boolean): Promise<void> {
  await AsyncStorage.setItem(MOBILE_KEY, on ? '1' : '0');
  set({ syncMobile: on });
  if (canSync()) {
    await flushQueue();
    set({ version: state.version + 1 });
  }
}

// Forget everything stored on this phone (used when signing out).
export async function resetOffline(): Promise<void> {
  const keys = await AsyncStorage.getAllKeys();
  const mine = keys.filter((k) => k.startsWith('cache:') || k === QUEUE_KEY || k === LAST_KEY || k === 'auth_snapshot');
  await AsyncStorage.multiRemove(mine);
  queue = [];
  set({ pending: 0, pendingIds: [], lastSynced: null });
}

let started = false;
export function initOffline() {
  if (started) return;
  started = true;
  NetInfo.addEventListener((s) => {
    const online = s.isConnected === true && s.isInternetReachable !== false;
    const before = canSync();
    set({ online, cellular: s.type === 'cellular' });
    if (canSync()) {
      void flushQueue();
      if (!before) set({ version: state.version + 1 });
    }
  });
  AppState.addEventListener('change', (st) => {
    if (st === 'active' && canSync()) void flushQueue();
  });
}
