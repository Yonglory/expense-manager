import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Switch, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Text } from '../components/Text';
import { useAuth } from '../context/AuthContext';
import { useI18n } from '../i18n/I18nContext';
import { colors } from '../lib/theme';
import { currentKey, dueDateFor, fmt, parseAmount, parseKey } from '../lib/format';
import { BillInput, useBills } from '../lib/useBills';
import { canSync, useSyncState } from '../lib/offline';
import {
  PermissionState, getPermission, getReminderHour, getRemindersEnabled, requestPermission,
  setReminderHour, setRemindersEnabled, syncReminders,
} from '../lib/reminders';
import type { Bill } from '../lib/types';
import { Animal } from '../components/Animal';
import { Bob, FadeIn, Pop, PressScale } from '../components/Motion';
import { Sheet, sheetTitle } from '../components/Sheet';
import { SyncBanner } from '../components/SyncBanner';
import { Button, Field } from '../components/ui';

export default function BillsScreen() {
  const { household } = useAuth();
  if (!household) return null;
  return <Bills householdId={household.id} />;
}

const REMIND_OPTIONS = [0, 1, 2, 3, 5, 7];
const DAY = 86400000;

function hourLabel(h: number) {
  const suffix = h >= 12 ? 'PM' : 'AM';
  return `${h % 12 === 0 ? 12 : h % 12}:00 ${suffix}`;
}

type Row = { bill: Bill; due: Date; itemId: string | null; paid: boolean };

function Bills({ householdId }: { householdId: string }) {
  const router = useRouter();
  const { t } = useI18n();
  const sync = useSyncState();
  const { bills, thisMonth, loading, error, save, remove, markPaid } = useBills(householdId);
  const [editing, setEditing] = useState<{ open: boolean; bill: Bill | null }>({ open: false, bill: null });
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const month = currentKey();
  const { month0 } = parseKey(month);

  const groups = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const rows: Row[] = bills.map((b) => ({
      bill: b,
      due: dueDateFor(month, b.due_day),
      itemId: thisMonth[b.id]?.id ?? null,
      paid: !!thisMonth[b.id]?.paid,
    }));
    const byDue = (a: Row, b: Row) => a.due.getTime() - b.due.getTime();
    const active = rows.filter((r) => r.bill.active);
    return {
      waiting: active.filter((r) => !r.paid && r.due < today).sort(byDue),
      week: active.filter((r) => !r.paid && r.due >= today && (r.due.getTime() - today.getTime()) / DAY <= 7).sort(byDue),
      later: active.filter((r) => !r.paid && (r.due.getTime() - today.getTime()) / DAY > 7).sort(byDue),
      paid: active.filter((r) => r.paid).sort(byDue),
      paused: rows.filter((r) => !r.bill.active).sort(byDue),
      today,
    };
  }, [bills, thisMonth, month]);

  const subtitle = (r: Row) => {
    const days = Math.round((r.due.getTime() - groups.today.getTime()) / DAY);
    if (r.paid || !r.bill.active) return t.dueOnDay(r.bill.due_day);
    if (days < 0) return t.daysAgo(-days);
    if (days === 0) return t.dueToday;
    if (days <= 7) return t.dueIn(days);
    return t.dueOnDay(r.bill.due_day);
  };

  const onSave = async (id: string | null, input: BillInput) => {
    const err = await save(id, input);
    if (err) setNotice(err);
    else setEditing({ open: false, bill: null });
  };

  const renderGroup = (title: string, rows: Row[], tone: 'peach' | 'blue' | 'green' | 'grey', startDelay: number) => {
    if (rows.length === 0) return null;
    const color = tone === 'peach' ? colors.peachText : tone === 'green' ? colors.greenText : colors.sub;
    return (
      <View key={title} style={{ gap: 6 }}>
        <Text style={[s.groupTitle, { color }]}>{title}</Text>
        {rows.map((r, i) => (
          <BillRow
            key={r.bill.id}
            row={r}
            tone={tone}
            delay={startDelay + i * 45}
            monthLabel={t.monthShort[month0]}
            subtitle={subtitle(r)}
            waiting={!canSync(sync) && sync.pendingIds.includes(r.bill.id)}
            onOpen={() => setEditing({ open: true, bill: r.bill })}
            onTick={() => r.itemId && markPaid(r.itemId, !r.paid)}
          />
        ))}
      </View>
    );
  };

  return (
    <SafeAreaView style={s.safe}>
      <View style={s.header}>
        <Pressable onPress={() => router.back()} hitSlop={10}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </Pressable>
        <Text style={[s.title, { flex: 1 }]}>{t.billsTitle}</Text>
        <Pressable onPress={() => setSettingsOpen(true)} hitSlop={10} accessibilityLabel={t.reminders}>
          <Ionicons name="notifications-outline" size={24} color={colors.text} />
        </Pressable>
      </View>
      <SyncBanner />

      <ScrollView contentContainerStyle={s.body}>
        {(error || notice) && <Text style={s.err}>{error ? t.billsLoadError(error) : notice}</Text>}

        {!loading && bills.length === 0 && (
          <View style={s.empty}>
            <Bob><Animal animal="bunny" size={84} /></Bob>
            <Text style={s.emptyTitle}>{t.noBillsTitle}</Text>
            <Text style={s.emptyText}>{t.noBillsText}</Text>
          </View>
        )}

        {renderGroup(t.waitingToBePaid, groups.waiting, 'peach', 0)}
        {renderGroup(t.thisWeek, groups.week, 'blue', 60)}
        {renderGroup(t.laterThisMonth, groups.later, 'grey', 120)}
        {renderGroup(t.paidGroup, groups.paid, 'green', 180)}
        {renderGroup(t.pausedGroup, groups.paused, 'grey', 240)}
      </ScrollView>

      <View style={s.fabWrap} pointerEvents="box-none">
        <Bob amp={3} duration={1200}>
          <PressScale onPress={() => setEditing({ open: true, bill: null })} style={s.fab} accessibilityLabel={t.newBill}>
            <Ionicons name="add" size={28} color="#fff" />
          </PressScale>
        </Bob>
      </View>

      <BillSheet
        visible={editing.open}
        bill={editing.bill}
        onClose={() => setEditing({ open: false, bill: null })}
        onSave={onSave}
        onDelete={async (id) => {
          const err = await remove(id);
          if (err) setNotice(err);
          setEditing({ open: false, bill: null });
        }}
      />
      <ReminderSheet visible={settingsOpen} householdId={householdId} onClose={() => setSettingsOpen(false)} />
    </SafeAreaView>
  );
}

function BillRow({
  row, tone, delay, monthLabel, subtitle, waiting, onOpen, onTick,
}: {
  row: Row; tone: 'peach' | 'blue' | 'green' | 'grey'; delay: number; monthLabel: string; subtitle: string;
  waiting: boolean; onOpen: () => void; onTick: () => void;
}) {
  const bg = tone === 'peach' ? colors.peach : tone === 'green' ? colors.greenSoft : colors.row;
  const subColor = tone === 'peach' ? colors.peachText : tone === 'blue' ? colors.blueText : colors.sub;
  return (
    <FadeIn delay={delay}>
      <Pressable style={[s.row, { backgroundColor: bg }, !row.bill.active && { opacity: 0.6 }]} onPress={onOpen}>
        <View style={s.date}>
          <Text style={[s.dateNum, tone === 'peach' && { color: colors.peachText }]}>{row.bill.due_day}</Text>
          <Text style={s.dateMonth}>{monthLabel}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[s.name, row.paid && s.done]} numberOfLines={1}>{row.bill.name}</Text>
          <Text style={[s.sub, { color: subColor }]}>{subtitle}</Text>
        </View>
        <View style={{ alignItems: 'flex-end', gap: 2 }}>
          {waiting && <Ionicons name="time-outline" size={13} color={colors.sub} />}
          <Text style={[s.amount, row.paid && s.done]}>{fmt(row.bill.amount)}</Text>
        </View>
        {row.bill.active && (
          <Pressable onPress={onTick} hitSlop={10} disabled={!row.itemId} accessibilityRole="checkbox" accessibilityState={{ checked: row.paid }}>
            <Pop trigger={row.paid} style={[s.pay, row.paid && s.payOn, !row.itemId && { opacity: 0.4 }]}>
              <Ionicons name="checkmark" size={16} color={row.paid ? '#fff' : colors.muted} />
            </Pop>
          </Pressable>
        )}
      </Pressable>
    </FadeIn>
  );
}

function BillSheet({
  visible, bill, onClose, onSave, onDelete,
}: {
  visible: boolean; bill: Bill | null; onClose: () => void;
  onSave: (id: string | null, input: BillInput) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}) {
  const { t } = useI18n();
  const [name, setName] = useState('');
  const [amount, setAmount] = useState('');
  const [day, setDay] = useState<number | null>(null);
  const [remind, setRemind] = useState(3);
  const [active, setActive] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!visible) return;
    setName(bill?.name ?? '');
    setAmount(bill ? String(bill.amount) : '');
    setDay(bill?.due_day ?? null);
    setRemind(bill?.remind_days_before ?? 3);
    setActive(bill?.active ?? true);
    setError(null);
  }, [visible, bill]);

  const submit = useCallback(async () => {
    if (!name.trim()) return setError(t.billNameRequired);
    if (!day) return setError(t.billDayRequired);
    await onSave(bill?.id ?? null, { name: name.trim(), amount: parseAmount(amount), due_day: day, remind_days_before: remind, active });
  }, [name, amount, day, remind, active, bill, onSave, t]);

  return (
    <Sheet visible={visible} onClose={onClose}>
      <Text style={sheetTitle}>{bill ? t.editBill : t.newBill}</Text>
      <Field placeholder={t.billNamePh} value={name} onChangeText={setName} autoFocus={!bill} />
      <Field placeholder={t.amount} value={amount} onChangeText={setAmount} keyboardType="numeric" />
      <Text style={s.label}>{t.dueDayLabel}</Text>
      <View style={s.dayGrid}>
        {Array.from({ length: 31 }, (_, i) => i + 1).map((d) => (
          <Pressable key={d} onPress={() => setDay(d)} style={[s.dayCell, day === d && s.dayOn]}>
            <Text style={[s.dayText, day === d && { color: '#fff', fontWeight: '600' }]}>{d}</Text>
          </Pressable>
        ))}
      </View>
      <Text style={s.label}>{t.remindMe}</Text>
      <View style={s.optRow}>
        {REMIND_OPTIONS.map((n) => (
          <Pressable key={n} onPress={() => setRemind(n)} style={[s.opt, remind === n && s.optOn]}>
            <Text style={[s.optText, remind === n && { color: colors.blueText, fontWeight: '600' }]}>{n === 0 ? t.onTheDay : t.daysBefore(n)}</Text>
          </Pressable>
        ))}
      </View>
      {bill && (
        <View style={s.switchRow}>
          <Text style={{ flex: 1, color: colors.text }}>{t.activeSwitch}</Text>
          <Switch value={active} onValueChange={setActive} trackColor={{ true: colors.blue, false: colors.track }} />
        </View>
      )}
      {error && <Text style={s.err}>{error}</Text>}
      <Button label={t.saveBill} onPress={submit} />
      {bill && <Button label={t.deleteBill} tone="danger" onPress={() => onDelete(bill.id)} />}
      <Button label={t.cancel} tone="soft" onPress={onClose} />
    </Sheet>
  );
}

function ReminderSheet({ visible, householdId, onClose }: { visible: boolean; householdId: string; onClose: () => void }) {
  const { t } = useI18n();
  const [enabled, setEnabled] = useState(true);
  const [hour, setHour] = useState(9);
  const [perm, setPerm] = useState<PermissionState>('undetermined');

  useEffect(() => {
    if (!visible) return;
    getRemindersEnabled().then(setEnabled);
    getReminderHour().then(setHour);
    getPermission().then(setPerm);
  }, [visible]);

  const toggle = async (on: boolean) => {
    setEnabled(on);
    await setRemindersEnabled(on);
    if (on && perm === 'undetermined') setPerm(await requestPermission());
    syncReminders(householdId);
  };
  const changeHour = async (delta: number) => {
    const next = (hour + delta + 24) % 24;
    setHour(next);
    await setReminderHour(next);
    syncReminders(householdId);
  };
  const allow = async () => {
    const p = await requestPermission();
    setPerm(p);
    if (p === 'granted') syncReminders(householdId);
  };

  return (
    <Sheet visible={visible} onClose={onClose}>
      <Text style={sheetTitle}>{t.reminders}</Text>
      <View style={s.setRow}>
        <Ionicons name="notifications-outline" size={20} color={colors.text} />
        <Text style={{ flex: 1, color: colors.text }}>{t.billReminders}</Text>
        <Switch value={enabled} onValueChange={toggle} trackColor={{ true: colors.green, false: colors.track }} />
      </View>
      <View style={[s.setRow, !enabled && { opacity: 0.5 }]}>
        <Ionicons name="time-outline" size={20} color={colors.text} />
        <Text style={{ flex: 1, color: colors.text }}>{t.remindMeAt}</Text>
        <Pressable onPress={() => enabled && changeHour(-1)} hitSlop={8} style={s.step}><Ionicons name="remove" size={18} color={colors.blueText} /></Pressable>
        <Text style={s.hour}>{hourLabel(hour)}</Text>
        <Pressable onPress={() => enabled && changeHour(1)} hitSlop={8} style={s.step}><Ionicons name="add" size={18} color={colors.blueText} /></Pressable>
      </View>
      {perm === 'granted' && (
        <View style={[s.setRow, { backgroundColor: colors.greenSoft }]}>
          <Ionicons name="checkmark-circle-outline" size={20} color={colors.greenText} />
          <Text style={{ flex: 1, color: colors.greenText }}>{t.notifAllowed}</Text>
        </View>
      )}
      {perm === 'denied' && <Text style={s.err}>{t.notifDenied}</Text>}
      {perm === 'unsupported' && <Text style={s.small}>{t.notifUnsupported}</Text>}
      {perm === 'undetermined' && <Button label={t.allowReminders} tone="soft" onPress={allow} />}
      <Text style={s.small}>{t.remindersNote}</Text>
      <Button label={t.done} tone="soft" onPress={onClose} />
    </Sheet>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16, paddingBottom: 8 },
  title: { fontSize: 18, fontWeight: '600', color: colors.text },
  body: { padding: 16, gap: 14, paddingBottom: 110 },
  groupTitle: { fontSize: 12, fontWeight: '600', marginTop: 2 },
  err: { backgroundColor: colors.peach, color: colors.peachText, padding: 10, borderRadius: 12, fontSize: 13 },
  small: { fontSize: 12, color: colors.sub },
  empty: { alignItems: 'center', gap: 8, paddingTop: 30, paddingHorizontal: 16 },
  emptyTitle: { fontSize: 16, fontWeight: '600', color: colors.text },
  emptyText: { color: colors.sub, textAlign: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 10, borderRadius: 16 },
  date: { width: 46, height: 46, borderRadius: 13, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.line },
  dateNum: { fontSize: 17, fontWeight: '700', color: colors.blueText },
  dateMonth: { fontSize: 9, color: colors.sub, marginTop: -2 },
  name: { fontSize: 16, color: colors.text },
  sub: { fontSize: 12, marginTop: 1 },
  amount: { fontSize: 15, fontWeight: '600', color: colors.text },
  done: { textDecorationLine: 'line-through', color: colors.muted },
  pay: { width: 30, height: 30, borderRadius: 15, borderWidth: 1.5, borderColor: '#B9C8D8', backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' },
  payOn: { backgroundColor: colors.green, borderColor: colors.green },
  fabWrap: { position: 'absolute', right: 20, bottom: 24 },
  fab: {
    width: 52, height: 52, borderRadius: 26, backgroundColor: colors.blue, alignItems: 'center', justifyContent: 'center',
    shadowColor: '#6BB3F0', shadowOpacity: 0.4, shadowRadius: 8, shadowOffset: { width: 0, height: 4 }, elevation: 4,
  },
  label: { fontSize: 14, fontWeight: '600', color: colors.text, marginTop: 4 },
  dayGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 5 },
  dayCell: { width: '12.6%', paddingVertical: 8, borderRadius: 10, backgroundColor: colors.row, alignItems: 'center' },
  dayOn: { backgroundColor: colors.blue },
  dayText: { fontSize: 13, color: colors.sub },
  optRow: { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
  opt: { paddingVertical: 8, paddingHorizontal: 12, borderRadius: 14, backgroundColor: colors.row },
  optOn: { backgroundColor: colors.blueSoft },
  optText: { color: colors.sub, fontSize: 13 },
  switchRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 4 },
  setRow: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, borderRadius: 14, backgroundColor: colors.row },
  step: { width: 28, height: 28, borderRadius: 14, backgroundColor: colors.blueSoft, alignItems: 'center', justifyContent: 'center' },
  hour: { fontSize: 14, fontWeight: '600', color: colors.blueText, minWidth: 72, textAlign: 'center' },
});
