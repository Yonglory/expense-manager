import React, { useCallback, useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useAuth } from '../context/AuthContext';
import { colors } from '../lib/theme';
import { fmt, ordinal, parseAmount } from '../lib/format';
import { useBills, BillInput } from '../lib/useBills';
import { PermissionState, getPermission, getReminderHour, requestPermission, setReminderHour, syncReminders } from '../lib/reminders';
import type { Bill } from '../lib/types';
import { Animal } from '../components/Animal';
import { Bob, FadeIn, PressScale } from '../components/Motion';
import { Sheet, sheetTitle } from '../components/Sheet';
import { Button, Field } from '../components/ui';

export default function BillsScreen() {
  const { household } = useAuth();
  if (!household) return null;
  return <Bills householdId={household.id} />;
}

const REMIND_OPTIONS = [0, 1, 2, 3, 5, 7];

function hourLabel(h: number) {
  const suffix = h >= 12 ? 'PM' : 'AM';
  const hh = h % 12 === 0 ? 12 : h % 12;
  return `${hh}:00 ${suffix}`;
}

function Bills({ householdId }: { householdId: string }) {
  const router = useRouter();
  const { bills, thisMonth, loading, error, save, remove, markPaid } = useBills(householdId);
  const [editing, setEditing] = useState<{ open: boolean; bill: Bill | null }>({ open: false, bill: null });
  const [hour, setHour] = useState(9);
  const [perm, setPerm] = useState<PermissionState>('undetermined');
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    getReminderHour().then(setHour);
    getPermission().then(setPerm);
  }, []);

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

  const onSave = async (id: string | null, input: BillInput) => {
    if (perm === 'undetermined') allow();
    const err = await save(id, input);
    if (err) setNotice(err);
    else setEditing({ open: false, bill: null });
  };

  return (
    <SafeAreaView style={s.safe}>
      <View style={s.header}>
        <Pressable onPress={() => router.back()} hitSlop={10}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </Pressable>
        <Text style={s.title}>Bills and reminders</Text>
      </View>

      <ScrollView contentContainerStyle={s.body}>
        <View style={s.remindCard}>
          <View style={{ flex: 1 }}>
            <Text style={s.remindTitle}>Remind me at</Text>
            {perm === 'unsupported' && <Text style={s.small}>Phone reminders work in the installed app on iOS and Android.</Text>}
            {perm === 'denied' && <Text style={s.small}>Notifications are off for this app. Turn them on in your phone settings.</Text>}
          </View>
          <Pressable onPress={() => changeHour(-1)} hitSlop={8} style={s.step}><Ionicons name="remove" size={18} color={colors.blueText} /></Pressable>
          <Text style={s.hour}>{hourLabel(hour)}</Text>
          <Pressable onPress={() => changeHour(1)} hitSlop={8} style={s.step}><Ionicons name="add" size={18} color={colors.blueText} /></Pressable>
        </View>
        {perm === 'undetermined' && <Button label="Allow reminders" tone="soft" onPress={allow} />}

        {(error || notice) && <Text style={s.err}>{error ? `Couldn't load bills. ${error}` : notice}</Text>}

        {!loading && bills.length === 0 && (
          <View style={s.empty}>
            <Bob><Animal animal="bunny" size={84} /></Bob>
            <Text style={s.emptyTitle}>No bills yet</Text>
            <Text style={s.emptyText}>Add the ones that repeat every month, like the home loan, meter or internet. They appear in your budget automatically.</Text>
          </View>
        )}

        {bills.map((b, i) => {
          const item = thisMonth[b.id];
          return (
            <FadeIn key={b.id} delay={Math.min(i, 8) * 50}>
              <Pressable style={[s.row, !b.active && { opacity: 0.55 }]} onPress={() => setEditing({ open: true, bill: b })}>
                <View style={s.dueBadge}>
                  <Text style={s.dueNum}>{b.due_day}</Text>
                  <Text style={s.dueLabel}>day</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.name} numberOfLines={1}>{b.name}</Text>
                  <Text style={s.small}>
                    Due on the {ordinal(b.due_day)}{b.remind_days_before > 0 ? `, reminder ${b.remind_days_before} ${b.remind_days_before === 1 ? 'day' : 'days'} before` : ''}
                    {!b.active ? ' (paused)' : ''}
                  </Text>
                </View>
                <View style={{ alignItems: 'flex-end', gap: 4 }}>
                  <Text style={s.amount}>{fmt(b.amount)}</Text>
                  {b.active && item && (
                    item.paid ? (
                      <Pressable onPress={() => markPaid(item.id, false)} style={[s.chip, { backgroundColor: colors.greenSoft }]}>
                        <Text style={[s.chipText, { color: colors.greenText }]}>Paid this month</Text>
                      </Pressable>
                    ) : (
                      <PressScale onPress={() => markPaid(item.id, true)} style={[s.chip, { backgroundColor: colors.blueSoft }]}>
                        <Text style={[s.chipText, { color: colors.blueText }]}>Mark paid</Text>
                      </PressScale>
                    )
                  )}
                </View>
              </Pressable>
            </FadeIn>
          );
        })}
      </ScrollView>

      <View style={s.fabWrap} pointerEvents="box-none">
        <Bob amp={3} duration={1200}>
          <PressScale onPress={() => setEditing({ open: true, bill: null })} style={s.fab} accessibilityLabel="Add bill">
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
    </SafeAreaView>
  );
}

function BillSheet({
  visible, bill, onClose, onSave, onDelete,
}: {
  visible: boolean;
  bill: Bill | null;
  onClose: () => void;
  onSave: (id: string | null, input: BillInput) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}) {
  const [name, setName] = useState('');
  const [amount, setAmount] = useState('');
  const [day, setDay] = useState('');
  const [remind, setRemind] = useState(3);
  const [active, setActive] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!visible) return;
    setName(bill?.name ?? '');
    setAmount(bill ? String(bill.amount) : '');
    setDay(bill ? String(bill.due_day) : '');
    setRemind(bill?.remind_days_before ?? 3);
    setActive(bill?.active ?? true);
    setError(null);
  }, [visible, bill]);

  const submit = useCallback(async () => {
    const d = Math.round(parseAmount(day));
    if (!name.trim()) return setError('Give this bill a name.');
    if (d < 1 || d > 31) return setError('Pick a due day between 1 and 31.');
    await onSave(bill?.id ?? null, { name: name.trim(), amount: parseAmount(amount), due_day: d, remind_days_before: remind, active });
  }, [name, amount, day, remind, active, bill, onSave]);

  return (
    <Sheet visible={visible} onClose={onClose}>
      <Text style={sheetTitle}>{bill ? 'Edit bill' : 'Add a monthly bill'}</Text>
      <Field placeholder="Name, for example Home loan" value={name} onChangeText={setName} autoFocus={!bill} />
      <Field placeholder="Amount" value={amount} onChangeText={setAmount} keyboardType="numeric" />
      <Field placeholder="Due day of the month (1 to 31)" value={day} onChangeText={setDay} keyboardType="numeric" />
      <Text style={s.label}>Remind me</Text>
      <View style={s.optRow}>
        {REMIND_OPTIONS.map((n) => (
          <Pressable key={n} onPress={() => setRemind(n)} style={[s.opt, remind === n && s.optOn]}>
            <Text style={[s.optText, remind === n && { color: colors.blueText, fontWeight: '600' }]}>{n === 0 ? 'Due day' : `${n}d`}</Text>
          </Pressable>
        ))}
      </View>
      <Text style={s.small}>You always get a reminder on the due day. This adds an earlier one.</Text>
      {bill && (
        <View style={s.switchRow}>
          <Text style={{ flex: 1, color: colors.text }}>Active (turn off to pause this bill)</Text>
          <Switch value={active} onValueChange={setActive} trackColor={{ true: colors.blue, false: colors.track }} />
        </View>
      )}
      {error && <Text style={s.err}>{error}</Text>}
      <Button label="Save" onPress={submit} />
      {bill && <Button label="Delete bill" tone="danger" onPress={() => onDelete(bill.id)} />}
      <Button label="Cancel" tone="soft" onPress={onClose} />
    </Sheet>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16 },
  title: { fontSize: 18, fontWeight: '600', color: colors.text },
  body: { padding: 16, gap: 10, paddingBottom: 100 },
  remindCard: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: colors.blueTint, borderRadius: 18, padding: 14, borderWidth: 1, borderColor: colors.line },
  remindTitle: { fontSize: 15, fontWeight: '600', color: colors.text },
  step: { width: 30, height: 30, borderRadius: 15, backgroundColor: colors.blueSoft, alignItems: 'center', justifyContent: 'center' },
  hour: { fontSize: 15, fontWeight: '600', color: colors.blueText, minWidth: 74, textAlign: 'center' },
  small: { fontSize: 12, color: colors.sub },
  err: { backgroundColor: colors.peach, color: colors.peachText, padding: 10, borderRadius: 12, fontSize: 13 },
  empty: { alignItems: 'center', gap: 8, paddingTop: 30, paddingHorizontal: 16 },
  emptyTitle: { fontSize: 16, fontWeight: '600', color: colors.text },
  emptyText: { color: colors.sub, textAlign: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderRadius: 18, backgroundColor: colors.row },
  dueBadge: { width: 46, height: 46, borderRadius: 14, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.line },
  dueNum: { fontSize: 17, fontWeight: '700', color: colors.blueText },
  dueLabel: { fontSize: 9, color: colors.sub, marginTop: -2 },
  name: { fontSize: 16, color: colors.text },
  amount: { fontSize: 15, fontWeight: '600', color: colors.text },
  chip: { borderRadius: 10, paddingHorizontal: 9, paddingVertical: 4 },
  chipText: { fontSize: 11, fontWeight: '600' },
  fabWrap: { position: 'absolute', right: 20, bottom: 24 },
  fab: {
    width: 52, height: 52, borderRadius: 26, backgroundColor: colors.blue, alignItems: 'center', justifyContent: 'center',
    shadowColor: '#6BB3F0', shadowOpacity: 0.4, shadowRadius: 8, shadowOffset: { width: 0, height: 4 }, elevation: 4,
  },
  label: { fontSize: 14, fontWeight: '600', color: colors.text, marginTop: 4 },
  optRow: { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
  opt: { paddingVertical: 8, paddingHorizontal: 12, borderRadius: 14, backgroundColor: colors.row },
  optOn: { backgroundColor: colors.blueSoft },
  optText: { color: colors.sub, fontSize: 13 },
  switchRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 4 },
});
