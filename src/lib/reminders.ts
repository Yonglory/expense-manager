import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import { supabase } from './supabase';
import { currentKey, dueDateFor, shiftKey } from './format';
import type { Bill } from './types';

const HOUR_KEY = 'reminder_hour';
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
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('bills', {
        name: 'Bill reminders',
        importance: Notifications.AndroidImportance.DEFAULT,
      });
    }
    const hour = await getReminderHour();
    const cur = currentKey();
    const months = [cur, shiftKey(cur, 1)];
    const { data: bills } = await supabase.from('bills').select('*').eq('household_id', householdId).eq('active', true);
    const { data: items } = await supabase
      .from('items')
      .select('bill_id,month,paid')
      .eq('household_id', householdId)
      .in('month', months)
      .not('bill_id', 'is', null);
    const paid = new Set((items ?? []).filter((i: any) => i.paid).map((i: any) => `${i.bill_id}|${i.month}`));

    await Notifications.cancelAllScheduledNotificationsAsync();
    for (const raw of bills ?? []) {
      const b = raw as Bill;
      for (const month of months) {
        if (month < b.start_month || paid.has(`${b.id}|${month}`)) continue;
        const dueAt = dueDateFor(month, b.due_day, hour);
        if (b.remind_days_before > 0) {
          const remindAt = new Date(dueAt);
          remindAt.setDate(dueAt.getDate() - b.remind_days_before);
          const n = b.remind_days_before;
          await schedule(remindAt, `${b.name} is coming up`, `Due in ${n} ${n === 1 ? 'day' : 'days'}.`);
        }
        await schedule(dueAt, `${b.name} is due today`, 'Tap to open your budget and mark it paid.');
      }
    }
  } catch {
    // Reminders are a bonus. The app keeps working if scheduling fails.
  }
}
