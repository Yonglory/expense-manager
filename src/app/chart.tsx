import React, { useEffect, useMemo, useRef } from 'react';
import { Animated, Easing, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Circle, Path } from 'react-native-svg';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useAuth } from '../context/AuthContext';
import { colors, sliceColors } from '../lib/theme';
import { MONTH_NAMES, currentKey, fmt, parseKey } from '../lib/format';
import { useItems } from '../lib/useItems';
import { Animal } from '../components/Animal';
import { Bob } from '../components/Motion';
import { Bubble } from '../components/ui';

type Slice = { name: string; amount: number };

function arcPath(cx: number, cy: number, r: number, a0: number, a1: number) {
  const x0 = cx + r * Math.cos(a0), y0 = cy + r * Math.sin(a0);
  const x1 = cx + r * Math.cos(a1), y1 = cy + r * Math.sin(a1);
  const large = a1 - a0 > Math.PI ? 1 : 0;
  return `M${cx} ${cy} L${x0} ${y0} A${r} ${r} 0 ${large} 1 ${x1} ${y1} Z`;
}

export default function ChartScreen() {
  const { household } = useAuth();
  const { month: param } = useLocalSearchParams<{ month?: string }>();
  if (!household) return null;
  return <Chart householdId={household.id} month={param ?? currentKey()} />;
}

function Chart({ householdId, month }: { householdId: string; month: string }) {
  const router = useRouter();
  const { items } = useItems(householdId, month);
  const { month0 } = parseKey(month);

  const { slices, total } = useMemo(() => {
    const out = items.filter((i) => i.kind === 'out' && i.amount > 0).sort((a, b) => b.amount - a.amount);
    const top: Slice[] = out.slice(0, 5).map((i) => ({ name: i.name, amount: i.amount }));
    const rest = out.slice(5).reduce((sum, i) => sum + i.amount, 0);
    if (rest > 0) top.push({ name: 'Others', amount: rest });
    return { slices: top, total: top.reduce((sum, s) => sum + s.amount, 0) };
  }, [items]);

  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    v.setValue(0);
    Animated.spring(v, { toValue: 1, friction: 6, tension: 60, useNativeDriver: true }).start();
  }, [total, v]);

  const size = 230, c = size / 2, r = size / 2 - 4;
  let angle = -Math.PI / 2;
  const paths = slices.map((sl, i) => {
    const sweep = (sl.amount / total) * Math.PI * 2;
    const p = arcPath(c, c, r, angle, angle + sweep);
    angle += sweep;
    return <Path key={i} d={p} fill={sliceColors[i % sliceColors.length]} stroke="#fff" strokeWidth={2} />;
  });

  const biggest = slices[0];
  return (
    <SafeAreaView style={s.safe}>
      <View style={s.header}>
        <Pressable onPress={() => router.back()} hitSlop={10}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </Pressable>
        <Text style={s.title}>{MONTH_NAMES[month0]} spending</Text>
      </View>
      <ScrollView contentContainerStyle={s.body}>
        {slices.length === 0 ? (
          <View style={s.center}>
            <Animal animal="bunny" size={90} />
            <Text style={s.empty}>Nothing to chart yet. Add some Money out items first.</Text>
          </View>
        ) : (
          <>
            <View style={s.row}>
              <Bob><Animal animal="bunny" size={46} /></Bob>
              <Bubble text={`${biggest.name} is the biggest at ${Math.round((biggest.amount / total) * 100)}%.`} />
            </View>
            <Animated.View
              style={{
                alignSelf: 'center', marginVertical: 12, opacity: v,
                transform: [
                  { scale: v.interpolate({ inputRange: [0, 1], outputRange: [0.6, 1] }) },
                  { rotate: v.interpolate({ inputRange: [0, 1], outputRange: ['-40deg', '0deg'] }) },
                ],
              }}
            >
              <Svg width={size} height={size}>
                {slices.length === 1 ? <Circle cx={c} cy={c} r={r} fill={sliceColors[0]} /> : paths}
              </Svg>
            </Animated.View>
            {slices.map((sl, i) => (
              <View key={`${sl.name}-${i}`} style={s.legend}>
                <View style={[s.dot, { backgroundColor: sliceColors[i % sliceColors.length] }]} />
                <Text style={s.name} numberOfLines={1}>{sl.name}</Text>
                <Text style={s.pct}>{Math.round((sl.amount / total) * 100)}%</Text>
                <Text style={s.amount}>{fmt(sl.amount)}</Text>
              </View>
            ))}
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
  empty: { color: colors.sub, textAlign: 'center' },
  legend: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, paddingHorizontal: 14, backgroundColor: colors.row, borderRadius: 14 },
  dot: { width: 12, height: 12, borderRadius: 6 },
  name: { flex: 1, color: colors.text, fontSize: 15 },
  pct: { color: colors.sub, width: 44, textAlign: 'right' },
  amount: { color: colors.text, fontWeight: '600', minWidth: 84, textAlign: 'right' },
});
