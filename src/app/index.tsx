import React, { useEffect, useMemo, useRef, useState } from 'react';
import { FlatList, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useAuth } from '../context/AuthContext';
import { colors } from '../lib/theme';
import { MONTHS, MONTH_NAMES, currentKey, monthKey, parseKey, shiftKey } from '../lib/format';
import { useItems } from '../lib/useItems';
import type { AnimalId, Item, Kind } from '../lib/types';
import { Animal } from '../components/Animal';
import { ItemModal } from '../components/ItemModal';
import { ItemRow } from '../components/ItemRow';
import { TotalsBar } from '../components/TotalsBar';
import { Button, Segmented } from '../components/ui';

export default function BudgetScreen() {
  const { profile, household } = useAuth();
  if (!profile || !household) return null;
  return <Budget householdId={household.id} name={profile.display_name} animal={profile.animal} />;
}

function Budget({ householdId, name, animal }: { householdId: string; name: string; animal: AnimalId }) {
  const router = useRouter();
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

  const { totalIn, totalOut, paid } = useMemo(() => {
    let tIn = 0, tOut = 0, p = 0;
    for (const i of items) {
      if (i.kind === 'in') tIn += i.amount;
      else {
        tOut += i.amount;
        if (i.paid) p += i.amount;
      }
    }
    return { totalIn: tIn, totalOut: tOut, paid: p };
  }, [items]);

  const shown = items.filter((i) => i.kind === tab);

  const save = async (n: string, amount: number) => {
    const err = modal.item ? await update(modal.item.id, { name: n, amount }) : await add(tab, n, amount);
    if (err) setNotice(err);
    setModal({ open: false, item: null });
  };

  const copy = async () => {
    const err = await copyFromPrevious();
    setNotice(err);
  };

  return (
    <SafeAreaView style={s.safe}>
      <View style={s.header}>
        <Pressable onPress={() => router.push('/household')} style={s.avatar} accessibilityLabel="Open household">
          <Animal animal={animal} size={34} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={s.hi}>Hi, {name}</Text>
          <View style={s.titleRow}>
            <Pressable onPress={() => setMonth(shiftKey(month, -1))} hitSlop={10}>
              <Ionicons name="chevron-back" size={18} color={colors.sub} />
            </Pressable>
            <Text style={s.title}>{MONTH_NAMES[month0]} {year}</Text>
            <Pressable onPress={() => setMonth(shiftKey(month, 1))} hitSlop={10}>
              <Ionicons name="chevron-forward" size={18} color={colors.sub} />
            </Pressable>
          </View>
        </View>
        <Pressable onPress={() => router.push({ pathname: '/chart', params: { month } })} hitSlop={8} accessibilityLabel="Spending chart">
          <Ionicons name="pie-chart-outline" size={24} color={colors.text} />
        </Pressable>
        <Pressable onPress={() => router.push('/household')} hitSlop={8} accessibilityLabel="Household">
          <Ionicons name="people-outline" size={24} color={colors.text} />
        </Pressable>
      </View>

      <ScrollView ref={chips} horizontal showsHorizontalScrollIndicator={false} style={s.chipScroll} contentContainerStyle={s.chipRow}>
        {MONTHS.map((m, i) => {
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
            { id: 'out', label: 'Money out', bg: colors.pinkSoft, fg: colors.pinkText },
            { id: 'in', label: 'Money in', bg: colors.greenSoft, fg: colors.greenText },
          ]}
        />
      </View>

      {(error || notice) && <Text style={s.notice}>{error ? `Couldn't load your list. ${error}` : notice}</Text>}

      <View style={{ flex: 1 }}>
        <FlatList
          data={shown}
          keyExtractor={(i) => i.id}
          contentContainerStyle={s.list}
          refreshing={loading}
          onRefresh={reload}
          renderItem={({ item }) => (
            <ItemRow
              item={item}
              onToggle={() => update(item.id, { paid: !item.paid })}
              onEdit={() => setModal({ open: true, item })}
            />
          )}
          ListEmptyComponent={
            loading ? undefined : (
              <View style={s.empty}>
                <Text style={s.emptyTitle}>{tab === 'out' ? 'Nothing planned to spend yet' : 'No money in yet'}</Text>
                <Text style={s.emptyText}>
                  {tab === 'out' ? 'Add what you plan to spend this month.' : 'Add your paycheck and other income.'}
                </Text>
                <Button label={`Copy from ${MONTH_NAMES[parseKey(shiftKey(month, -1)).month0]}`} tone="soft" onPress={copy} style={{ alignSelf: 'stretch' }} />
              </View>
            )
          }
        />
        <Pressable style={s.fab} onPress={() => setModal({ open: true, item: null })} accessibilityLabel="Add item">
          <Ionicons name="add" size={28} color="#fff" />
        </Pressable>
      </View>

      <View style={s.pad}>
        <TotalsBar totalIn={totalIn} totalOut={totalOut} paid={paid} />
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
  fab: {
    position: 'absolute', right: 20, bottom: 14, width: 52, height: 52, borderRadius: 26,
    backgroundColor: colors.blue, alignItems: 'center', justifyContent: 'center',
    shadowColor: '#6BB3F0', shadowOpacity: 0.4, shadowRadius: 8, shadowOffset: { width: 0, height: 4 }, elevation: 4,
  },
});
