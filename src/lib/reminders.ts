import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import { currentKey, dueDateFor, shiftKey } from './format';
import { loadBills, loadMonthItems } from './itemsData';
import { getCurrentDict } from '../i18n/strings';
import type { Bill } from './types';

const HOUR_KEY = 'reminder_hour';
const ENABLED_KEY = 'reminders_enabled';
const supported = Platform.OS !== 'web';

export type PermissionState = 'granted' | 'denied' | 'undetermined' | 'unsupported';

export function initNotifications() {
  if (!supported) return;
  try {
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowBanner: true,
        shouldShowList: true,
        shouldPlaySound: false,
        shouldSetBadge: false,
      }),
    });
  } catch {
    // Notifications may not be available (for example in some Expo Go versions).
  }
}

export async function getReminderHour(): Promise<number> {
  const raw = await AsyncStorage.getItem(HOUR_KEY);
  if (raw === null) return 9;
  const v = Number(raw);
  return Number.isInteger(v) && v >= 0 && v <= 23 ? v : 9;
}

export async function getRemindersEnabled(): Promise<boolean> {
  return (await AsyncStorage.getItem(ENABLED_KEY)) !== '0';
}
export async function setRemindersEnabled(on: boolean): Promise<void> {
  await AsyncStorage.setItem(ENABLED_KEY, on ? '1' : '0');
}

export async function setReminderHour(hour: number): Promise<void> {
  await AsyncStorage.setItem(HOUR_KEY, String(Math.max(0, Math.min(23, hour))));
}

export async function getPermission(): Promise<PermissionState> {
  if (!supported) return 'unsupported';
  try {
    const p = await Notifications.getPermissionsAsync();
    if (p.granted) return 'granted';
    return p.canAskAgain ? 'undetermined' : 'denied';
  } catch {
    return 'unsupported';
  }
}

export async function requestPermission(): Promise<PermissionState> {
  if (!supported) return 'unsupported';
  try {
    const p = await Notifications.requestPermissionsAsync();
    return p.granted ? 'granted' : 'denied';
  } catch {
    return 'unsupported';
  }
}

async function schedule(date: Date, title: string, body: string) {
  if (date.getTime() <= Date.now() + 5000) return;
  await Notifications.scheduleNotificationAsync({
    content: { title, body, sound: false },
    trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date, channelId: 'bills' },
  });
}

// Re-plans every bill reminder for this month and next month, skipping bills that are already paid.
export async function syncReminders(householdId: string): Promise<void> {
  if (!supported) return;
  try {
    if ((await getPermission()) !== 'granted') return;
    await Notifications.cancelAllScheduledNotificationsAsync();
    if (!(await getRemindersEnabled())) return;
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('bills', {
        name: 'Bill reminders',
        importance: Notifications.AndroidImportance.DEFAULT,
      });
    }
    const hour = await getReminderHour();
    const cur = currentKey();
    const months = [cur, shiftKey(cur, 1)];
    const { bills } = await loadBills(householdId);
    const paid = new Set<string>();
    for (const m of months) {
      const { items } = await loadMonthItems(householdId, m);
      for (const i of items) if (i.bill_id && i.paid) paid.add(`${i.bill_id}|${m}`);
    }
    const d = getCurrentDict();
    for (const b of bills) {
      if (!b.active) continue;
      for (const month of months) {
        if (month < b.start_month || paid.has(`${b.id}|${month}`)) continue;
        const dueAt = dueDateFor(month, b.due_day, hour);
        if (b.remind_days_before > 0) {
          const remindAt = new Date(dueAt);
          remindAt.setDate(dueAt.getDate() - b.remind_days_before);
          await schedule(remindAt, d.notifComingTitle(b.name), d.notifComingBody(b.remind_days_before));
        }
        await schedule(dueAt, d.notifDueTitle(b.name), d.notifDueBody);
      }
    }
  } catch {
    // Reminders are a bonus. The app keeps working if scheduling fails.
  }
}
