import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import { supabase } from './supabase';
import { currentKey, dueDateFor, shiftKey } from './format';
import type { Bill } from './types';

const HOUR_KEY = 'reminder_hour';
const MINUTE_KEY = 'reminder_minute';
const ENABLED_KEY = 'reminders_enabled';
const supported = Platform.OS !== 'web';

export type PermissionState = 'granted' | 'denied' | 'undetermined' | 'unsupported';
export type ReminderTime = { hour: number; minute: number };

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

export async function getReminderMinute(): Promise<number> {
  const raw = await AsyncStorage.getItem(MINUTE_KEY);
  if (raw === null) return 0;
  const v = Number(raw);
  return Number.isInteger(v) && v >= 0 && v <= 59 ? v : 0;
}

export async function setReminderMinute(minute: number): Promise<void> {
  await AsyncStorage.setItem(MINUTE_KEY, String(Math.max(0, Math.min(59, minute))));
}

export async function getReminderTime(): Promise<ReminderTime> {
  const [hour, minute] = await Promise.all([getReminderHour(), getReminderMinute()]);
  return { hour, minute };
}

export async function setReminderTime(hour: number, minute: number): Promise<void> {
  await setReminderHour(hour);
  await setReminderMinute(minute);
}

export async function getRemindersEnabled(): Promise<boolean> {
  const raw = await AsyncStorage.getItem(ENABLED_KEY);
  return raw !== '0';
}

export async function setRemindersEnabled(on: boolean): Promise<void> {
  await AsyncStorage.setItem(ENABLED_KEY, on ? '1' : '0');
  if (!on && supported) {
    try {
      await Notifications.cancelAllScheduledNotificationsAsync();
    } catch {
      // ignore
    }
  }
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

function dayStart(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

async function schedule(date: Date, title: string, body: string) {
  // Only schedule for today or later — never for times already in the past.
  if (date.getTime() <= Date.now() + 5000) return;
  await Notifications.scheduleNotificationAsync({
    content: { title, body, sound: false },
    trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date, channelId: 'bills' },
  });
}

// Re-plans reminders for today and upcoming due dates only (current + next month).
export async function syncReminders(householdId: string): Promise<void> {
  if (!supported) return;
  try {
    if (!(await getRemindersEnabled())) {
      await Notifications.cancelAllScheduledNotificationsAsync();
      return;
    }
    if ((await getPermission()) !== 'granted') return;
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('bills', {
        name: 'Bill reminders',
        importance: Notifications.AndroidImportance.DEFAULT,
      });
    }
    const { hour, minute } = await getReminderTime();
    const cur = currentKey();
    const months = [cur, shiftKey(cur, 1)];
    const today = dayStart(new Date());
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
        const dueAt = dueDateFor(month, b.due_day, hour, minute);
        // Skip overdue / past due dates — reminders are only for today and upcoming.
        if (dayStart(dueAt) < today) continue;

        if (b.remind_days_before > 0) {
          const remindAt = new Date(dueAt);
          remindAt.setDate(dueAt.getDate() - b.remind_days_before);
          // Early reminder only if that day is still today or upcoming.
          if (dayStart(remindAt) >= today) {
            const n = b.remind_days_before;
            await schedule(remindAt, `${b.name} is coming up`, `Due in ${n} ${n === 1 ? 'day' : 'days'}.`);
          }
        }
        await schedule(dueAt, `${b.name} is due today`, 'Tap to open your budget and mark it paid.');
      }
    }
  } catch {
    // Reminders are a bonus. The app keeps working if scheduling fails.
  }
}
