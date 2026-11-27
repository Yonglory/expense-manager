import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Easing, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Text } from '../components/Text';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Circle } from 'react-native-svg';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useAuth } from '../context/AuthContext';
import { colors, sliceColors } from '../lib/theme';
import { currentKey, fmt, parseKey } from '../lib/format';
import { useI18n } from '../i18n/I18nContext';
import { useItems } from '../lib/useItems';
import { Animal } from '../components/Animal';
import { Bob, FadeIn } from '../components/Motion';
import { Bubble } from '../components/ui';
import { MonthSummary } from '../components/MonthSummary';

type Slice = { name: string; amount: number };

export default function ChartScreen() {
  const { household } = useAuth();
  const { month: param } = useLocalSearchParams<{ month?: string }>();
  if (!household) return null;
  return <Chart householdId={household.id} month={param ?? currentKey()} />;
}

function Chart({ householdId, month }: { householdId: string; month: string }) {
  const router = useRouter();
  const { t } = useI18n();
  const { items } = useItems(householdId, month);
  const { month0 } = parseKey(month);

  const { slices, total } = useMemo(() => {
    const out = items.filter((i) => i.kind === 'out' && i.amount > 0).sort((a, b) => b.amount - a.amount);
    const top: Slice[] = out.slice(0, 5).map((i) => ({ name: i.name, amount: i.amount }));
    const rest = out.slice(5).reduce((sum, i) => sum + i.amount, 0);
    if (rest > 0) top.push({ name: t.catOthers, amount: rest });
    return { slices: top, total: top.reduce((sum, s) => sum + s.amount, 0) };
  }, [items, t]);

  // The ring sweeps around once when the screen opens (or the numbers change).
  const sweep = useRef(new Animated.Value(0)).current;
  const [prog, setProg] = useState(0);
  useEffect(() => {
    const id = sweep.addListener(({ value }) => setProg(value));
    return () => sweep.removeListener(id);
  }, [sweep]);
  useEffect(() => {
    sweep.setValue(0);
    Animated.timing(sweep, { toValue: 1, duration: 1100, easing: Easing.out(Easing.cubic), useNativeDriver: false }).start();
  }, [total, sweep]);

  const size = 240, c = size / 2, stroke = 38, rm = size / 2 - 4 - stroke / 2;
  const circ = 2 * Math.PI * rm;
  let acc = 0;
  const rings = slices.map((sl, i) => {
    const start = acc / total;
    acc += sl.amount;
    const end = acc / total;
    const gap = slices.length > 1 ? 0.006 : 0;
    const vis = Math.max(0, Math.min(end, prog) - start - (prog >= end ? gap : 0));
    if (vis * circ < 0.5) return null;
    return (
      <Circle
        key={i}
        cx={c}
        cy={c}
        r={rm}
        fill="none"
        stroke={sliceColors[i % sliceColors.length]}
        strokeWidth={stroke}
        strokeDasharray={[vis * circ, circ]}
        strokeDashoffset={-start * circ}
        rotation={-90}
        origin={`${c}, ${c}`}
      />
    );
  });

  const biggest = slices[0];
  return (
    <SafeAreaView style={s.safe}>
      <View style={s.header}>
        <Pressable onPress={() => router.back()} hitSlop={10}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </Pressable>
        <Text style={s.title}>{t.spendingTitle(t.monthNames[month0])}</Text>
      </View>
      <ScrollView contentContainerStyle={s.body}>
        {slices.length === 0 ? (
          <View style={s.center}>
            <Animal animal="bunny" size={90} />
            <Text style={s.empty}>{t.chartEmpty}</Text>
          </View>
        ) : (
          <>
            <View style={s.row}>
              <Bob><Animal animal="bunny" size={46} /></Bob>
              <Bubble text={t.biggestIs(biggest.name, Math.round((biggest.amount / total) * 100))} />
            </View>
            <View style={s.donut}>
              <Svg width={size} height={size}>
                <Circle cx={c} cy={c} r={rm} fill="none" stroke={colors.track} strokeWidth={stroke} />
                {rings}
              </Svg>
              <View style={s.hole} pointerEvents="none">
                <Text style={s.holeLabel}>{t.planned}</Text>
                <Text style={s.holeValue}>{fmt(total)}</Text>
              </View>
            </View>
            {slices.map((sl, i) => (
              <FadeIn key={`${sl.name}-${i}`} delay={500 + i * 110}>
              <View style={s.legend}>
                <View style={[s.dot, { backgroundColor: sliceColors[i % sliceColors.length] }]} />
                <Text style={s.name} numberOfLines={1}>{sl.name}</Text>
                <Text style={s.pct}>{Math.round((sl.amount / total) * 100)}%</Text>
                <Text style={s.amount}>{fmt(sl.amount)}</Text>
              </View>
              </FadeIn>
            ))}
            <MonthSummary householdId={householdId} month={month} items={items} />
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16 },
  title: { fontSize: 18, fontWeight: '600', color: colors.text },
  body: { padding: 16, gap: 8 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  center: { alignItems: 'center', gap: 12, paddingTop: 60 },
  donut: { alignSelf: 'center', marginVertical: 12, width: 240, height: 240, alignItems: 'center', justifyContent: 'center' },
  hole: { position: 'absolute', alignItems: 'center' },
  holeLabel: { color: colors.sub, fontSize: 12 },
  holeValue: { color: colors.text, fontSize: 20, fontWeight: '700' },
  empty: { color: colors.sub, textAlign: 'center' },
  legend: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, paddingHorizontal: 14, backgroundColor: colors.row, borderRadius: 14 },
  dot: { width: 12, height: 12, borderRadius: 6 },
  name: { flex: 1, color: colors.text, fontSize: 15 },
  pct: { color: colors.sub, width: 44, textAlign: 'right' },
  amount: { color: colors.text, fontWeight: '600', minWidth: 84, textAlign: 'right' },
});
