import React, { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import { Text } from './Text';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../lib/theme';
import { fmt, parseKey, shiftKey } from '../lib/format';
import { useI18n } from '../i18n/I18nContext';
import { useItems } from '../lib/useItems';
import type { Item } from '../lib/types';
import { Animal } from './Animal';
import { Bob, FadeIn } from './Motion';

const effective = (i: Item) => i.actual ?? i.amount;
const keyOf = (name: string) => name.trim().toLowerCase();

function totals(items: Item[]) {
  const out = items.filter((i) => i.kind === 'out');
  return {
    out,
    planned: out.reduce((s, i) => s + i.amount, 0),
    paid: out.filter((i) => i.paid).reduce((s, i) => s + effective(i), 0),
    expected: out.reduce((s, i) => s + effective(i), 0),
  };
}

export function MonthSummary({ householdId, month, items }: { householdId: string; month: string; items: Item[] }) {
  const { t } = useI18n();
  const prev = useItems(householdId, shiftKey(month, -1)).items;
  const cur = useMemo(() => totals(items), [items]);
  const last = useMemo(() => totals(prev), [prev]);
  const prevName = t.monthNames[parseKey(shiftKey(month, -1)).month0];

  const withActual = cur.out.filter((i) => i.actual != null);
  const delta = withActual.reduce((s, i) => s + ((i.actual as number) - i.amount), 0);
  const biggest = [...cur.out].sort((a, b) => effective(b) - effective(a))[0];
  const paidPct = cur.planned > 0 ? Math.round((cur.paid / cur.planned) * 100) : 0;

  // Compare items that appear in both months by name.
  const changes = useMemo(() => {
    const before = new Map<string, number>();
    for (const i of last.out) before.set(keyOf(i.name), (before.get(keyOf(i.name)) ?? 0) + effective(i));
    const now = new Map<string, { name: string; value: number }>();
    for (const i of cur.out) {
      const k = keyOf(i.name);
      now.set(k, { name: i.name, value: (now.get(k)?.value ?? 0) + effective(i) });
    }
    const rows: { name: string; pct: number }[] = [];
    now.forEach((v, k) => {
      const b = before.get(k);
      if (b && b > 0) {
        const pct = Math.round(((v.value - b) / b) * 100);
        if (Math.abs(pct) >= 5) rows.push({ name: v.name, pct });
      }
    });
    return rows.sort((a, b) => Math.abs(b.pct) - Math.abs(a.pct)).slice(0, 4);
  }, [cur.out, last.out]);

  if (cur.out.length === 0) return null;

  const overallPct = last.expected > 0 ? Math.round(((cur.expected - last.expected) / last.expected) * 100) : null;

  return (
    <FadeIn delay={700}>
      <View style={s.card}>
        <View style={s.head}>
          <Bob><Animal animal="bunny" size={40} /></Bob>
          <Text style={s.title}>{t.monthSummary}</Text>
        </View>

        <Text style={s.line}>
          {paidPct >= 100 ? t.allPlannedPaid : t.paidPct(paidPct)}
          <Text style={s.sub}>{t.paidOf(fmt(cur.paid), fmt(cur.planned))}</Text>
        </Text>
        {withActual.length > 0 && (
          <Text style={[s.pill, { backgroundColor: delta > 0 ? colors.peach : colors.greenSoft, color: delta > 0 ? colors.peachText : colors.greenText }]}>
            {delta > 0 ? t.moreThanPlanned(fmt(delta)) : delta < 0 ? t.lessThanPlanned(fmt(-delta)) : t.matchedPlan}
          </Text>
        )}
        {biggest && <Text style={s.line}>{t.biggestItem}<Text style={s.bold}>{biggest.name}</Text> ({fmt(effective(biggest))})</Text>}

        {last.out.length > 0 && (
          <View style={s.compare}>
            <Text style={s.sectionTitle}>{t.comparedWith(prevName)}</Text>
            {overallPct !== null && (
              <Text style={s.line}>
                {overallPct === 0
                  ? t.spendingSame(fmt(last.expected), fmt(cur.expected))
                  : overallPct > 0
                    ? t.spendingUp(overallPct, fmt(last.expected), fmt(cur.expected))
                    : t.spendingDown(Math.abs(overallPct), fmt(last.expected), fmt(cur.expected))}
              </Text>
            )}
            {changes.map((c) => (
              <View key={c.name} style={s.change}>
                <Ionicons name={c.pct > 0 ? 'trending-up' : 'trending-down'} size={16} color={c.pct > 0 ? colors.peachText : colors.greenText} />
                <Text style={s.changeName} numberOfLines={1}>{c.name}</Text>
                <View style={[s.badge, { backgroundColor: c.pct > 0 ? colors.peach : colors.greenSoft }]}>
                  <Text style={{ fontSize: 12, fontWeight: '600', color: c.pct > 0 ? colors.peachText : colors.greenText }}>
                    {c.pct > 0 ? '+' : ''}{c.pct}%
                  </Text>
                </View>
              </View>
            ))}
            {changes.length === 0 && <Text style={s.sub}>{t.steady}</Text>}
          </View>
        )}
      </View>
    </FadeIn>
  );
}

const s = StyleSheet.create({
  card: { marginTop: 10, backgroundColor: colors.blueTint, borderRadius: 20, padding: 14, gap: 8, borderWidth: 1, borderColor: colors.line },
  head: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  title: { fontSize: 16, fontWeight: '600', color: colors.text },
  line: { fontSize: 14, color: colors.text },
  sub: { fontSize: 13, color: colors.sub },
  bold: { fontWeight: '600' },
  pill: { alignSelf: 'flex-start', fontSize: 13, paddingVertical: 5, paddingHorizontal: 10, borderRadius: 12, overflow: 'hidden' },
  compare: { gap: 6, marginTop: 4, paddingTop: 10, borderTopWidth: 1, borderTopColor: colors.line },
  sectionTitle: { fontSize: 13, fontWeight: '600', color: colors.sub },
  change: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#fff', borderRadius: 12, paddingVertical: 8, paddingHorizontal: 10 },
  changeName: { flex: 1, fontSize: 14, color: colors.text },
  badge: { borderRadius: 9, paddingHorizontal: 8, paddingVertical: 2 },
});
