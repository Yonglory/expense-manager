import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useAuth } from '../context/AuthContext';
import { colors } from '../lib/theme';
import {
  daysInMonth,
  dueDateFor,
  fmt,
  MONTH_NAMES,
  MONTHS,
  parseAmount,
  parseKey,
  shiftKey,
  currentKey,
} from '../lib/format';
import { useBills, BillInput } from '../lib/useBills';
import {
  PermissionState,
  getPermission,
  getReminderTime,
  getRemindersEnabled,
  requestPermission,
  setReminderTime,
  setRemindersEnabled,
  syncReminders,
} from '../lib/reminders';
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

const REMIND_OPTIONS = [
  { days: 3, label: '3 days before' },
  { days: 1, label: '1 day before' },
  { days: 0, label: 'On the day' },
];

const DAY_GRID = Array.from({ length: 31 }, (_, i) => i + 1);
const WEEKDAYS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

function timeLabel(hour: number, minute: number) {
  const suffix = hour >= 12 ? 'PM' : 'AM';
  const hh = hour % 12 === 0 ? 12 : hour % 12;
  return `${hh}:${String(minute).padStart(2, '0')} ${suffix}`;
}

function remindLabel(days: number) {
  if (days <= 0) return 'Reminder on the day';
  if (days === 1) return 'Reminder 1 day before';
  return `Reminder ${days} days before`;
}

function relativeIn(due: Date, now: Date) {
  const startOf = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const diff = Math.round((startOf(due) - startOf(now)) / 86400000);
  if (diff < 0) return `${Math.abs(diff)} ${Math.abs(diff) === 1 ? 'day' : 'days'} ago`;
  if (diff === 0) return 'today';
  if (diff === 1) return 'in 1 day';
  return `in ${diff} days`;
}

function Bills({ householdId }: { householdId: string }) {
  const router = useRouter();
  const today = useMemo(() => new Date(), []);
  const [viewKey, setViewKey] = useState(currentKey);
  const [selectedDay, setSelectedDay] = useState(() => today.getDate());
  const { bills, thisMonth, loading, error, save, remove, markPaid } = useBills(householdId, viewKey);

  const [editing, setEditing] = useState<{ open: boolean; bill: Bill | null }>({ open: false, bill: null });
  const [remindersOpen, setRemindersOpen] = useState(false);
  const [hour, setHour] = useState(9);
  const [minute, setMinute] = useState(0);
  const [enabled, setEnabled] = useState(true);
  const [perm, setPerm] = useState<PermissionState>('undetermined');
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    getReminderTime().then(({ hour: h, minute: m }) => {
      setHour(h);
      setMinute(m);
    });
    getRemindersEnabled().then(setEnabled);
    getPermission().then(setPerm);
  }, []);

  const { year, month0 } = parseKey(viewKey);
  const dim = daysInMonth(year, month0);

  useEffect(() => {
    setSelectedDay((d) => Math.min(d, dim));
  }, [dim]);

  const saveTime = async (h: number, m: number) => {
    setHour(h);
    setMinute(m);
    await setReminderTime(h, m);
    if (enabled) syncReminders(householdId);
  };

  const bumpHour = (delta: number) => saveTime((hour + delta + 24) % 24, minute);
  const bumpMinute = (delta: number) => {
    let m = minute + delta;
    let h = hour;
    if (m >= 60) { m = 0; h = (h + 1) % 24; }
    if (m < 0) { m = 45; h = (h + 23) % 24; }
    saveTime(h, m);
  };

  const toggleEnabled = async (on: boolean) => {
    setEnabled(on);
    await setRemindersEnabled(on);
    if (on) {
      if (perm !== 'granted') {
        const p = await requestPermission();
        setPerm(p);
      }
      syncReminders(householdId);
    }
  };

  const allow = async () => {
    const p = await requestPermission();
    setPerm(p);
    if (p === 'granted') syncReminders(householdId);
  };

  const onSave = async (id: string | null, input: BillInput) => {
    if (perm === 'undetermined' && enabled) allow();
    const err = await save(id, input);
    if (err) setNotice(err);
    else {
      setEditing({ open: false, bill: null });
      setSelectedDay(input.due_day);
      setViewKey(currentKey());
    }
  };

  const activeBills = useMemo(
    () => bills.filter((b) => b.active && b.start_month <= viewKey),
    [bills, viewKey],
  );

  const dueDays = useMemo(() => {
    const set = new Set<number>();
    for (const b of activeBills) set.add(Math.min(b.due_day, dim));
    return set;
  }, [activeBills, dim]);

  const selectedBills = useMemo(
    () => activeBills.filter((b) => Math.min(b.due_day, dim) === selectedDay),
    [activeBills, selectedDay, dim],
  );

  const nextUp = useMemo(() => {
    const now = new Date();
    return activeBills
      .map((b) => {
        const due = dueDateFor(viewKey, b.due_day);
        const item = thisMonth[b.id];
        return { bill: b, due, paid: !!item?.paid, itemId: item?.id };
      })
      .filter((x) => !x.paid && x.due.getDate() !== selectedDay && x.due.getTime() >= new Date(year, month0, selectedDay).getTime())
      .sort((a, b) => a.due.getTime() - b.due.getTime())
      .slice(0, 3)
      .map((x) => ({ ...x, label: relativeIn(x.due, now) }));
  }, [activeBills, thisMonth, viewKey, selectedDay, year, month0]);

  // Monday-first calendar cells (null = empty)
  const cells = useMemo(() => {
    const first = new Date(year, month0, 1);
    const mondayIndex = (first.getDay() + 6) % 7; // Sun=0 → 6, Mon=1 → 0
    const out: (number | null)[] = [];
    for (let i = 0; i < mondayIndex; i++) out.push(null);
    for (let d = 1; d <= dim; d++) out.push(d);
    while (out.length % 7 !== 0) out.push(null);
    return out;
  }, [year, month0, dim]);

  const shiftMonth = (delta: number) => {
    const next = shiftKey(viewKey, delta);
    setViewKey(next);
    const { year: y, month0: m } = parseKey(next);
    const todayKey = currentKey();
    if (next === todayKey) setSelectedDay(Math.min(today.getDate(), daysInMonth(y, m)));
    else setSelectedDay(1);
  };

  return (
    <SafeAreaView style={s.safe}>
      <View style={s.header}>
        <View style={s.headerLeft}>
          <Pressable onPress={() => router.back()} hitSlop={10} accessibilityLabel="Back">
            <Ionicons name="arrow-back" size={24} color={colors.text} />
          </Pressable>
          <Text style={s.title}>Bills</Text>
        </View>
        <Pressable onPress={() => setRemindersOpen(true)} hitSlop={10} accessibilityLabel="Reminders">
          <Ionicons name="notifications-outline" size={24} color={colors.text} />
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={s.body}>
        {(error || notice) && <Text style={s.err}>{error ? `Couldn't load bills. ${error}` : notice}</Text>}

        <View style={s.calCard}>
          <View style={s.calNav}>
            <Pressable onPress={() => shiftMonth(-1)} hitSlop={10} style={s.navBtn}>
              <Ionicons name="chevron-back" size={20} color={colors.text} />
            </Pressable>
            <Text style={s.calMonth}>{MONTH_NAMES[month0]} {year}</Text>
            <Pressable onPress={() => shiftMonth(1)} hitSlop={10} style={s.navBtn}>
              <Ionicons name="chevron-forward" size={20} color={colors.text} />
            </Pressable>
          </View>

          <View style={s.weekRow}>
            {WEEKDAYS.map((w, i) => (
              <Text key={`${w}-${i}`} style={s.weekLabel}>{w}</Text>
            ))}
          </View>

          <View style={s.grid}>
            {cells.map((d, i) => {
              if (d == null) return <View key={`e-${i}`} style={s.dayCell} />;
              const selected = d === selectedDay;
              const hasDot = dueDays.has(d);
              const isToday = viewKey === currentKey() && d === today.getDate();
              return (
                <Pressable key={d} onPress={() => setSelectedDay(d)} style={s.dayCell}>
                  <View style={[s.dayInner, selected && s.daySelected, isToday && !selected && s.dayToday]}>
                    <Text style={[s.dayNum, selected && s.dayNumOn]}>{d}</Text>
                    {hasDot && <View style={[s.dot, selected && s.dotOn]} />}
                  </View>
                </Pressable>
              );
            })}
          </View>
        </View>

        <Text style={s.sectionTitle}>Due on {selectedDay} {MONTH_NAMES[month0]}</Text>

        {!loading && bills.length === 0 && (
          <View style={s.empty}>
            <Bob><Animal animal="bunny" size={72} /></Bob>
            <Text style={s.emptyTitle}>No bills yet</Text>
            <Text style={s.emptyText}>Add monthly bills with the + button. Pick a due day and when to get notified.</Text>
          </View>
        )}

        {selectedBills.length === 0 && bills.length > 0 && (
          <Text style={s.muted}>Nothing due on this day.</Text>
        )}

        {selectedBills.map((b, i) => {
          const item = thisMonth[b.id];
          const paid = !!item?.paid;
          return (
            <FadeIn key={b.id} delay={i * 40}>
              <View style={[s.billCard, paid && s.billPaid]}>
                <View style={s.dateBlock}>
                  <Text style={s.dateDay}>{selectedDay}</Text>
                  <Text style={s.dateMonth}>{MONTHS[month0]}</Text>
                </View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={[s.name, paid && s.strike]} numberOfLines={1}>{b.name}</Text>
                  <Text style={s.sub}>
                    {remindLabel(b.remind_days_before)} · {timeLabel(hour, minute)}
                  </Text>
                </View>
                <Text style={[s.amount, paid && s.strike]}>{fmt(b.amount)}</Text>
              </View>
              <View style={s.actionRow}>
                {item && (
                  <PressScale
                    onPress={() => markPaid(item.id, !paid)}
                    style={[s.actionBtn, paid ? s.markUnpaid : s.markPaid]}
                  >
                    <Text style={[s.markText, paid ? { color: colors.blueText } : { color: '#fff' }]}>
                      {paid ? 'Mark unpaid' : 'Mark paid'}
                    </Text>
                  </PressScale>
                )}
                <PressScale
                  onPress={() => setEditing({ open: true, bill: b })}
                  style={[s.actionBtn, s.editBtn]}
                >
                  <Text style={[s.markText, { color: colors.blueText }]}>Edit bill</Text>
                </PressScale>
              </View>
            </FadeIn>
          );
        })}

        {nextUp.length > 0 && (
          <View style={{ gap: 8, marginTop: 8 }}>
            <Text style={s.sectionTitle}>Next up</Text>
            {nextUp.map(({ bill: b, due, label }) => (
              <Pressable
                key={b.id}
                style={s.nextCard}
                onPress={() => setSelectedDay(due.getDate())}
              >
                <View style={s.nextBadge}>
                  <Text style={s.nextDay}>{due.getDate()}</Text>
                </View>
                <Text style={[s.name, { flex: 1 }]} numberOfLines={1}>{b.name}</Text>
                <Text style={s.nextLabel}>{label}</Text>
              </Pressable>
            ))}
          </View>
        )}
      </ScrollView>

      <View style={s.fabWrap} pointerEvents="box-none">
        <Bob amp={3} duration={1200}>
          <PressScale
            onPress={() => setEditing({ open: true, bill: null })}
            style={s.fab}
            accessibilityLabel="Add bill"
          >
            <Ionicons name="add" size={28} color="#fff" />
          </PressScale>
        </Bob>
      </View>

      <BillSheet
        visible={editing.open}
        bill={editing.bill}
        defaultDay={selectedDay}
        hour={hour}
        minute={minute}
        onChangeTime={saveTime}
        onClose={() => setEditing({ open: false, bill: null })}
        onSave={onSave}
        onDelete={async (id) => {
          const err = await remove(id);
          if (err) setNotice(err);
          setEditing({ open: false, bill: null });
        }}
      />

      <RemindersSheet
        visible={remindersOpen}
        hour={hour}
        minute={minute}
        enabled={enabled}
        perm={perm}
        onClose={() => setRemindersOpen(false)}
        onBumpHour={bumpHour}
        onBumpMinute={bumpMinute}
        onToggle={toggleEnabled}
        onAllow={allow}
      />
    </SafeAreaView>
  );
}

function BillSheet({
  visible, bill, defaultDay, hour, minute, onChangeTime, onClose, onSave, onDelete,
}: {
  visible: boolean;
  bill: Bill | null;
  defaultDay: number;
  hour: number;
  minute: number;
  onChangeTime: (h: number, m: number) => void;
  onClose: () => void;
  onSave: (id: string | null, input: BillInput) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}) {
  const [name, setName] = useState('');
  const [amount, setAmount] = useState('');
  const [day, setDay] = useState(5);
  const [remind, setRemind] = useState(3);
  const [active, setActive] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!visible) return;
    setName(bill?.name ?? '');
    setAmount(bill ? String(bill.amount) : '');
    setDay(bill?.due_day ?? defaultDay);
    setRemind(bill?.remind_days_before ?? 3);
    setActive(bill?.active ?? true);
    setError(null);
  }, [visible, bill, defaultDay]);

  const submit = useCallback(async () => {
    if (!name.trim()) return setError('Give this bill a name.');
    if (day < 1 || day > 31) return setError('Pick a due day between 1 and 31.');
    await onSave(bill?.id ?? null, {
      name: name.trim(),
      amount: parseAmount(amount),
      due_day: day,
      remind_days_before: remind,
      active,
    });
  }, [name, amount, day, remind, active, bill, onSave]);

  return (
    <Sheet visible={visible} onClose={onClose}>
      <Text style={sheetTitle}>{bill ? 'Edit bill' : 'New monthly bill'}</Text>
      <Field placeholder="Name, for example Home loan" value={name} onChangeText={setName} autoFocus={!bill} containerStyle={s.pillField} />
      <Field placeholder="Amount" value={amount} onChangeText={setAmount} keyboardType="numeric" containerStyle={s.pillField} />

      <Text style={s.label}>Due day of the month</Text>
      <View style={s.dayGrid}>
        {DAY_GRID.map((d) => (
          <Pressable key={d} onPress={() => setDay(d)} style={[s.pickDay, day === d && s.pickDayOn]}>
            <Text style={[s.pickDayText, day === d && s.pickDayTextOn]}>{d}</Text>
          </Pressable>
        ))}
      </View>

      <Text style={s.label}>Remind me</Text>
      <View style={s.remindRow}>
        {REMIND_OPTIONS.map((o) => (
          <Pressable key={o.days} onPress={() => setRemind(o.days)} style={[s.remindPill, remind === o.days && s.remindPillOn]}>
            <Text style={[s.remindPillText, remind === o.days && s.remindPillTextOn]}>{o.label}</Text>
          </Pressable>
        ))}
      </View>

      <Text style={s.label}>Notification time</Text>
      <View style={s.timeCard}>
        <View style={s.timeCol}>
          <Text style={s.timeHint}>Hour</Text>
          <View style={s.timeCtrl}>
            <Pressable onPress={() => onChangeTime((hour + 23) % 24, minute)} style={s.step}>
              <Ionicons name="remove" size={16} color={colors.blueText} />
            </Pressable>
            <Text style={s.timeValue}>{hour % 12 === 0 ? 12 : hour % 12}</Text>
            <Pressable onPress={() => onChangeTime((hour + 1) % 24, minute)} style={s.step}>
              <Ionicons name="add" size={16} color={colors.blueText} />
            </Pressable>
          </View>
        </View>
        <Text style={s.timeColon}>:</Text>
        <View style={s.timeCol}>
          <Text style={s.timeHint}>Min</Text>
          <View style={s.timeCtrl}>
            <Pressable onPress={() => onChangeTime(hour, (minute + 45) % 60)} style={s.step}>
              <Ionicons name="remove" size={16} color={colors.blueText} />
            </Pressable>
            <Text style={s.timeValue}>{String(minute).padStart(2, '0')}</Text>
            <Pressable onPress={() => onChangeTime(hour, (minute + 15) % 60)} style={s.step}>
              <Ionicons name="add" size={16} color={colors.blueText} />
            </Pressable>
          </View>
        </View>
        <Pressable
          onPress={() => onChangeTime((hour + 12) % 24, minute)}
          style={s.ampm}
        >
          <Text style={s.ampmText}>{hour >= 12 ? 'PM' : 'AM'}</Text>
        </Pressable>
      </View>
      <Text style={s.help}>You'll get a phone notification at {timeLabel(hour, minute)}.</Text>

      {bill && (
        <View style={s.switchRow}>
          <Text style={{ flex: 1, color: colors.text }}>Active (turn off to pause this bill)</Text>
          <Switch value={active} onValueChange={setActive} trackColor={{ true: colors.blue, false: colors.track }} />
        </View>
      )}
      {error && <Text style={s.err}>{error}</Text>}
      <Button label="Save bill" onPress={submit} style={s.saveBtn} />
      {bill && <Button label="Delete bill" tone="danger" onPress={() => onDelete(bill.id)} />}
    </Sheet>
  );
}

function RemindersSheet({
  visible, hour, minute, enabled, perm, onClose, onBumpHour, onBumpMinute, onToggle, onAllow,
}: {
  visible: boolean;
  hour: number;
  minute: number;
  enabled: boolean;
  perm: PermissionState;
  onClose: () => void;
  onBumpHour: (delta: number) => void;
  onBumpMinute: (delta: number) => void;
  onToggle: (on: boolean) => void;
  onAllow: () => void;
}) {
  return (
    <Sheet visible={visible} onClose={onClose}>
      <Text style={sheetTitle}>Reminders</Text>

      <View style={s.remRow}>
        <Ionicons name="notifications-outline" size={20} color={colors.blueText} />
        <Text style={s.remLabel}>Bill reminders</Text>
        <Switch
          value={enabled}
          onValueChange={onToggle}
          trackColor={{ true: colors.green, false: colors.track }}
          thumbColor="#fff"
        />
      </View>

      <View style={[s.remRow, { flexDirection: 'column', alignItems: 'stretch', gap: 12 }]}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <Ionicons name="time-outline" size={20} color={colors.blueText} />
          <Text style={s.remLabel}>Remind me at</Text>
        </View>
        <View style={s.timeCardInner}>
          <View style={s.timeCtrl}>
            <Pressable onPress={() => onBumpHour(-1)} style={s.step}>
              <Ionicons name="remove" size={16} color={colors.blueText} />
            </Pressable>
            <Text style={s.hourBig}>{timeLabel(hour, minute)}</Text>
            <Pressable onPress={() => onBumpHour(1)} style={s.step}>
              <Ionicons name="add" size={16} color={colors.blueText} />
            </Pressable>
          </View>
          <View style={s.timeCtrl}>
            <Pressable onPress={() => onBumpMinute(-15)} style={s.step}>
              <Text style={s.minBtn}>−15m</Text>
            </Pressable>
            <Pressable onPress={() => onBumpMinute(15)} style={s.step}>
              <Text style={s.minBtn}>+15m</Text>
            </Pressable>
          </View>
        </View>
      </View>

      {perm === 'granted' && (
        <View style={[s.remRow, s.remOk]}>
          <Ionicons name="checkmark-circle-outline" size={20} color={colors.greenText} />
          <Text style={[s.remLabel, { color: colors.greenText }]}>Notifications are allowed</Text>
        </View>
      )}
      {perm === 'undetermined' && (
        <Button label="Allow notifications" tone="soft" onPress={onAllow} />
      )}
      {perm === 'denied' && (
        <View style={[s.remRow, { backgroundColor: colors.peach }]}>
          <Ionicons name="alert-circle-outline" size={20} color={colors.peachText} />
          <Text style={[s.remLabel, { color: colors.peachText, flex: 1 }]}>
            Notifications are off. Turn them on in your phone settings.
          </Text>
        </View>
      )}
      {perm === 'unsupported' && (
        <Text style={s.help}>Phone reminders work in the installed app on iOS and Android.</Text>
      )}

      <Text style={s.help}>
        You get one reminder on the due day at {timeLabel(hour, minute)}. Each bill can add an earlier one when you set it up.
      </Text>

      <Button label="Done" tone="soft" onPress={onClose} style={s.doneBtn} />
    </Sheet>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 12,
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  title: { fontSize: 20, fontWeight: '700', color: colors.text },
  body: { paddingHorizontal: 16, paddingBottom: 110, gap: 12 },

  calCard: {
    backgroundColor: colors.card, borderRadius: 20, padding: 14,
    borderWidth: 1, borderColor: colors.line, gap: 10,
  },
  calNav: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  navBtn: {
    width: 36, height: 36, borderRadius: 18, backgroundColor: colors.row,
    alignItems: 'center', justifyContent: 'center',
  },
  calMonth: { fontSize: 16, fontWeight: '700', color: colors.text },
  weekRow: { flexDirection: 'row' },
  weekLabel: { flex: 1, textAlign: 'center', fontSize: 12, fontWeight: '600', color: colors.muted },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  dayCell: { width: `${100 / 7}%` as any, aspectRatio: 1, alignItems: 'center', justifyContent: 'center', padding: 2 },
  dayInner: {
    width: '100%', height: '100%', borderRadius: 12,
    alignItems: 'center', justifyContent: 'center',
  },
  daySelected: { backgroundColor: colors.blueSoft },
  dayToday: { borderWidth: 1.5, borderColor: colors.blue },
  dayNum: { fontSize: 15, fontWeight: '600', color: colors.text },
  dayNumOn: { color: colors.blueText },
  dot: { width: 5, height: 5, borderRadius: 2.5, backgroundColor: colors.blue, marginTop: 2 },
  dotOn: { backgroundColor: colors.blueText },

  sectionTitle: { fontSize: 14, fontWeight: '600', color: colors.sub, marginTop: 4 },
  muted: { color: colors.muted, fontSize: 13 },
  billCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: colors.blueTint, borderRadius: 16, padding: 12,
  },
  billPaid: { backgroundColor: colors.greenSoft },
  dateBlock: {
    width: 48, height: 48, borderRadius: 12, backgroundColor: '#fff',
    alignItems: 'center', justifyContent: 'center',
  },
  dateDay: { fontSize: 17, fontWeight: '700', color: colors.blueText, lineHeight: 20 },
  dateMonth: { fontSize: 11, color: colors.sub },
  name: { fontSize: 16, fontWeight: '600', color: colors.text },
  strike: { color: colors.muted, textDecorationLine: 'line-through' },
  sub: { fontSize: 12, color: colors.sub, marginTop: 2 },
  amount: { fontSize: 15, fontWeight: '600', color: colors.text },
  actionRow: { flexDirection: 'row', gap: 8, marginTop: 8 },
  actionBtn: { borderRadius: 15, paddingHorizontal: 15, paddingVertical: 15, alignItems: 'center' },
  markPaid: { backgroundColor: colors.green },
  markUnpaid: { backgroundColor: colors.blueSoft },
  editBtn: { backgroundColor: colors.blueSoft },
  markText: { fontSize: 15, fontWeight: '700' },

  nextCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: colors.blueTint, borderRadius: 16, padding: 12,
  },
  nextBadge: {
    width: 40, height: 40, borderRadius: 12, backgroundColor: '#fff',
    alignItems: 'center', justifyContent: 'center',
  },
  nextDay: { fontSize: 16, fontWeight: '700', color: colors.blueText },
  nextLabel: { fontSize: 13, color: colors.sub, fontWeight: '500' },

  empty: { alignItems: 'center', gap: 8, paddingVertical: 20 },
  emptyTitle: { fontSize: 16, fontWeight: '600', color: colors.text },
  emptyText: { color: colors.sub, textAlign: 'center' },
  err: { backgroundColor: colors.peach, color: colors.peachText, padding: 10, borderRadius: 12, fontSize: 13 },

  fabWrap: { position: 'absolute', right: 20, bottom: 24 },
  fab: {
    width: 56, height: 56, borderRadius: 28, backgroundColor: colors.blue,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#6BB3F0', shadowOpacity: 0.4, shadowRadius: 8, shadowOffset: { width: 0, height: 4 }, elevation: 4,
  },

  label: { fontSize: 13, fontWeight: '500', color: colors.sub, marginTop: 6 },
  pillField: { borderRadius: 22 },
  dayGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  pickDay: {
    width: 40, height: 40, borderRadius: 12, backgroundColor: colors.row,
    alignItems: 'center', justifyContent: 'center',
  },
  pickDayOn: { backgroundColor: colors.blue },
  pickDayText: { fontSize: 14, fontWeight: '600', color: colors.text },
  pickDayTextOn: { color: '#fff' },
  remindRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  remindPill: {
    paddingVertical: 10, paddingHorizontal: 14, borderRadius: 20,
    backgroundColor: colors.row, borderWidth: 1.5, borderColor: 'transparent',
  },
  remindPillOn: { backgroundColor: colors.blueSoft, borderColor: colors.blue },
  remindPillText: { fontSize: 13, color: colors.sub, fontWeight: '500' },
  remindPillTextOn: { color: colors.blueText, fontWeight: '600' },

  timeCard: {
    flexDirection: 'row', alignItems: 'flex-end', gap: 8,
    backgroundColor: colors.blueTint, borderRadius: 16, padding: 14,
  },
  timeCardInner: { gap: 10, alignItems: 'center' },
  timeCol: { alignItems: 'center', gap: 6 },
  timeHint: { fontSize: 11, color: colors.sub, fontWeight: '600' },
  timeCtrl: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  timeColon: { fontSize: 22, fontWeight: '700', color: colors.text, paddingBottom: 6 },
  timeValue: { fontSize: 20, fontWeight: '700', color: colors.text, minWidth: 36, textAlign: 'center' },
  ampm: {
    marginLeft: 4, paddingHorizontal: 12, paddingVertical: 10, borderRadius: 12,
    backgroundColor: colors.blueSoft, marginBottom: 2,
  },
  ampmText: { fontSize: 14, fontWeight: '700', color: colors.blueText },
  step: {
    minWidth: 30, height: 30, paddingHorizontal: 8, borderRadius: 15, backgroundColor: colors.blueSoft,
    alignItems: 'center', justifyContent: 'center',
  },
  hourBig: { fontSize: 18, fontWeight: '700', color: colors.text, minWidth: 96, textAlign: 'center' },
  minBtn: { fontSize: 12, fontWeight: '700', color: colors.blueText },

  switchRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 4 },
  saveBtn: { borderRadius: 24, marginTop: 4 },
  remRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: colors.blueTint, borderRadius: 16, paddingVertical: 14, paddingHorizontal: 14,
  },
  remOk: { backgroundColor: colors.greenSoft },
  remLabel: { flex: 1, fontSize: 15, fontWeight: '600', color: colors.text },
  help: { fontSize: 13, color: colors.sub, lineHeight: 19, marginTop: 4 },
  doneBtn: { borderRadius: 24, marginTop: 8 },
});
