import React, { useEffect, useMemo, useRef, useState } from 'react';
import { FlatList, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Text } from '../components/Text';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useAuth } from '../context/AuthContext';
import { colors } from '../lib/theme';
import { currentKey, dueDateFor, monthKey, parseKey, shiftKey } from '../lib/format';
import { useI18n } from '../i18n/I18nContext';
import { SyncBanner } from '../components/SyncBanner';
import { syncReminders } from '../lib/reminders';
import { useItems } from '../lib/useItems';
import type { AnimalId, Item, Kind } from '../lib/types';
import { Animal } from '../components/Animal';
import { ItemModal } from '../components/ItemModal';
import { ItemRow } from '../components/ItemRow';
import { TotalsBar } from '../components/TotalsBar';
import { Bob, CountUp, FadeIn, PressScale } from '../components/Motion';
import { Button, Segmented } from '../components/ui';
import { fmt } from '../lib/format';

export default function BudgetScreen() {
  const { profile, household } = useAuth();
  if (!profile || !household) return null;
  return <Budget householdId={household.id} name={profile.display_name} animal={profile.animal} />;
}

function Budget({ householdId, name, animal }: { householdId: string; name: string; animal: AnimalId }) {
  const router = useRouter();
  const { t } = useI18n();
  const [month, setMonth] = useState(currentKey());
  const [tab, setTab] = useState<Kind>('out');
  const [modal, setModal] = useState<{ open: boolean; item: Item | null }>({ open: false, item: null });
  const [notice, setNotice] = useState<string | null>(null);
  const { items, loading, error, add, update, remove, copyFromPrevious, reload } = useItems(householdId, month);
  const chips = useRef<React.ComponentRef<typeof ScrollView>>(null);
  const { year, month0 } = parseKey(month);

  useEffect(() => {
    chips.current?.scrollTo({ x: Math.max(0, month0 * 66 - 110), animated: true });
  }, [month0]);

  const { totalIn, totalOut, paid, toPay, allPaid } = useMemo(() => {
    let tIn = 0, tOut = 0, p = 0, left = 0, outCount = 0, paidCount = 0;
    for (const i of items) {
      if (i.kind === 'in') tIn += i.amount;
      else {
        tOut += i.amount;
        outCount += 1;
        if (i.paid) {
          paidCount += 1;
          p += i.actual ?? i.amount; // what you really paid
        } else {
          left += Math.max(i.amount - (i.actual ?? 0), 0); // planned minus what's already spent
        }
      }
    }
    return { totalIn: tIn, totalOut: tOut, paid: p, toPay: left, allPaid: outCount > 0 && paidCount === outCount };
  }, [items]);

  // Friendly heads-up for bills that are due soon or still waiting.
  const banner = useMemo(() => {
    if (month !== currentKey()) return null;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const list = items
      .filter((i) => i.kind === 'out' && !i.paid && i.due_day != null)
      .map((i) => ({ i, due: dueDateFor(month, i.due_day as number) }))
      .sort((a, b) => a.due.getTime() - b.due.getTime());
    const overdue = list.filter((x) => x.due < today);
    if (overdue.length > 0) {
      const names = overdue.slice(0, 2).map((x) => x.i.name).join(', ');
      return { tone: 'peach' as const, text: t.waitingPaid(names, Math.max(0, overdue.length - 2)) };
    }
    const soon = list.filter((x) => (x.due.getTime() - today.getTime()) / 86400000 <= 7);
    if (soon.length > 0) {
      const first = soon[0];
      return {
        tone: 'blue' as const,
        text: t.comingUp(first.i.name, first.i.due_day as number, soon.length - 1),
      };
    }
    return null;
  }, [items, month, t]);

  // Keep phone reminders in step with what's paid.
  const billSig = items.filter((i) => i.bill_id).map((i) => `${i.id}${i.paid ? 1 : 0}`).join(',');
  useEffect(() => {
    if (month === currentKey()) syncReminders(householdId);
  }, [householdId, month, billSig]);

  const shown = items.filter((i) => i.kind === tab);

  const save = async (n: string, amount: number, actual: number | null) => {
    const err = modal.item
      ? await update(modal.item.id, tab === 'out' ? { name: n, amount, actual } : { name: n, amount })
      : await add(tab, n, amount, actual);
    if (err) setNotice(err);
    setModal({ open: false, item: null });
  };

  const copy = async () => {
    const err = await copyFromPrevious();
    setNotice(err === 'nothing' ? t.nothingToCopy : err);
  };

  return (
    <SafeAreaView style={s.safe}>
      <View style={s.header}>
        <Pressable onPress={() => router.push('/household')} style={s.avatar} accessibilityLabel={t.ourHousehold}>
          <Animal animal={animal} size={34} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={s.hi}>{t.hi(name)}</Text>
          <View style={s.titleRow}>
            <Pressable onPress={() => setMonth(shiftKey(month, -1))} hitSlop={10}>
              <Ionicons name="chevron-back" size={18} color={colors.sub} />
            </Pressable>
            <Text style={s.title}>{t.monthNames[month0]} {year}</Text>
            <Pressable onPress={() => setMonth(shiftKey(month, 1))} hitSlop={10}>
              <Ionicons name="chevron-forward" size={18} color={colors.sub} />
            </Pressable>
          </View>
        </View>
        <Pressable onPress={() => router.push({ pathname: '/chart', params: { month } })} hitSlop={8} accessibilityLabel={t.monthSummary}>
          <Ionicons name="pie-chart-outline" size={24} color={colors.text} />
        </Pressable>
        <Pressable onPress={() => router.push('/shopping')} hitSlop={8} accessibilityLabel={t.shoppingTitle}>
          <Ionicons name="cart-outline" size={24} color={colors.text} />
        </Pressable>
        <Pressable onPress={() => router.push('/bills')} hitSlop={8} accessibilityLabel={t.billsTitle}>
          <Ionicons name="notifications-outline" size={24} color={colors.text} />
        </Pressable>
      </View>

      <ScrollView ref={chips} horizontal showsHorizontalScrollIndicator={false} style={s.chipScroll} contentContainerStyle={s.chipRow}>
        {t.monthShort.map((m, i) => {
          const on = i === month0;
          return (
            <Pressable key={m} onPress={() => setMonth(monthKey(year, i))} style={[s.chip, on && s.chipOn]}>
              <Text style={[s.chipText, on && { color: colors.blueText, fontWeight: '600' }]}>{m}</Text>
            </Pressable>
          );
        })}
      </ScrollView>

      <View style={s.pad}>
        <Segmented
          value={tab}
          onChange={setTab}
          options={[
            { id: 'out', label: t.moneyOut, bg: colors.pinkSoft, fg: colors.pinkText },
            { id: 'in', label: t.moneyIn, bg: colors.greenSoft, fg: colors.greenText },
          ]}
        />
        <View style={s.tabTotal}>
          <Text style={s.tabTotalLabel}>{tab === 'out' ? t.totalMoneyOut : t.totalMoneyIn}</Text>
          <CountUp
            value={tab === 'out' ? totalOut : totalIn}
            format={fmt}
            style={[s.tabTotalValue, { color: tab === 'out' ? colors.pinkText : colors.greenText }]}
          />
        </View>
      </View>

      <SyncBanner />

      {banner && (
        <FadeIn style={s.bannerWrap}>
          <Pressable
            onPress={() => router.push('/bills')}
            style={[s.banner, { backgroundColor: banner.tone === 'peach' ? colors.peach : colors.blueSoft }]}
          >
            <Ionicons name="alarm-outline" size={16} color={banner.tone === 'peach' ? colors.peachText : colors.blueText} />
            <Text style={{ flex: 1, fontSize: 13, color: banner.tone === 'peach' ? colors.peachText : colors.blueText }}>{banner.text}</Text>
            <Ionicons name="chevron-forward" size={14} color={colors.sub} />
          </Pressable>
        </FadeIn>
      )}

      {(error || notice) && <Text style={s.notice}>{error ? t.loadError(error) : notice}</Text>}

      <View style={{ flex: 1 }}>
        <FlatList
          key={`${month}-${tab}`}
          data={shown}
          keyExtractor={(i) => i.id}
          contentContainerStyle={s.list}
          refreshing={loading}
          onRefresh={reload}
          renderItem={({ item, index }) => (
            <ItemRow
              item={item}
              index={index}
              onToggle={() => update(item.id, { paid: !item.paid })}
              onEdit={() => setModal({ open: true, item })}
            />
          )}
          ListEmptyComponent={
            loading ? undefined : (
              <View style={s.empty}>
                <Text style={s.emptyTitle}>{tab === 'out' ? t.nothingPlanned : t.noMoneyIn}</Text>
                <Text style={s.emptyText}>
                  {tab === 'out' ? t.addPlanned : t.addIncome}
                </Text>
                <Button label={t.copyFrom(t.monthNames[parseKey(shiftKey(month, -1)).month0])} tone="soft" onPress={copy} style={{ alignSelf: 'stretch' }} />
              </View>
            )
          }
        />
        <View style={s.fabWrap} pointerEvents="box-none">
          <Bob amp={3} duration={1200}>
            <PressScale onPress={() => setModal({ open: true, item: null })} style={s.fab} accessibilityLabel={t.addToOut}>
              <Ionicons name="add" size={28} color="#fff" />
            </PressScale>
          </Bob>
        </View>
      </View>

      <View style={s.pad}>
        <TotalsBar totalIn={totalIn} totalOut={totalOut} paid={paid} toPay={toPay} allPaid={allPaid} />
      </View>

      <ItemModal
        visible={modal.open}
        kind={tab}
        item={modal.item}
        onClose={() => setModal({ open: false, item: null })}
        onSave={save}
        onDelete={async () => {
          if (modal.item) await remove(modal.item.id);
          setModal({ open: false, item: null });
        }}
      />
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg, paddingBottom: 6 },
  pad: { paddingHorizontal: 16, paddingVertical: 6 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 16, paddingTop: 8, paddingBottom: 4 },
  avatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.blueTint, alignItems: 'center', justifyContent: 'center' },
  hi: { color: colors.sub, fontSize: 12 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  title: { fontSize: 18, fontWeight: '600', color: colors.text },
  chipScroll: { flexGrow: 0 },
  chipRow: { paddingHorizontal: 16, gap: 8, paddingVertical: 8 },
  chip: { width: 58, paddingVertical: 7, borderRadius: 16, backgroundColor: colors.row, alignItems: 'center' },
  chipOn: { backgroundColor: colors.blueSoft },
  chipText: { color: colors.sub, fontSize: 13 },
  list: { paddingHorizontal: 16, paddingTop: 4, paddingBottom: 80, flexGrow: 1 },
  notice: { marginHorizontal: 16, backgroundColor: colors.peach, color: colors.peachText, padding: 10, borderRadius: 12, fontSize: 13 },
  empty: { alignItems: 'center', gap: 8, paddingTop: 28, paddingHorizontal: 12 },
  emptyTitle: { fontSize: 16, fontWeight: '600', color: colors.text },
  emptyText: { color: colors.sub, textAlign: 'center', marginBottom: 6 },
  tabTotal: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', paddingHorizontal: 6, paddingTop: 10 },
  tabTotalLabel: { color: colors.sub, fontSize: 13 },
  tabTotalValue: { fontSize: 18, fontWeight: '700' },
  bannerWrap: { paddingHorizontal: 16, paddingTop: 6 },
  banner: { flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 14, paddingVertical: 9, paddingHorizontal: 12 },
  fabWrap: { position: 'absolute', right: 20, bottom: 14 },
  fab: {
    width: 52, height: 52, borderRadius: 26,
    backgroundColor: colors.blue, alignItems: 'center', justifyContent: 'center',
    shadowColor: '#6BB3F0', shadowOpacity: 0.4, shadowRadius: 8, shadowOffset: { width: 0, height: 4 }, elevation: 4,
  },
});
