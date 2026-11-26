import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';
import { colors } from '../lib/theme';
import { fmt } from '../lib/format';
import { Animal } from './Animal';
import { Bob, CountUp, GrowBar, Sparkles } from './Motion';
import { Bubble } from './ui';

export function TotalsBar({
  totalIn, totalOut, paid, toPay: toPayProp, allPaid: allPaidProp,
}: { totalIn: number; totalOut: number; paid: number; toPay?: number; allPaid?: boolean }) {
  const left = totalIn - totalOut;
  const toPay = toPayProp ?? Math.max(0, totalOut - paid);
  const allPaid = allPaidProp ?? (totalOut > 0 && toPay === 0);

  let message: string;
  if (allPaid) message = 'Everything is paid. Great job!';
  else if (totalIn === 0 && totalOut === 0) message = "Add your first items and I'll do the math.";
  else if (left < 0) message = `Tight month. Needs ${fmt(-left)} more. You've got this.`;
  else if (left === 0) message = 'Perfectly balanced.';
  else message = `Nice! ${fmt(left)} left over this month.`;

  // The bunny hops twice when the last item gets paid.
  const hop = useRef(new Animated.Value(0)).current;
  const wasAllPaid = useRef(allPaid);
  useEffect(() => {
    if (allPaid && !wasAllPaid.current) {
      Animated.sequence([
        Animated.spring(hop, { toValue: -22, friction: 4, tension: 180, useNativeDriver: true }),
        Animated.spring(hop, { toValue: 0, friction: 4, tension: 180, useNativeDriver: true }),
        Animated.spring(hop, { toValue: -14, friction: 4, tension: 180, useNativeDriver: true }),
        Animated.spring(hop, { toValue: 0, friction: 4, tension: 180, useNativeDriver: true }),
      ]).start();
    }
    wasAllPaid.current = allPaid;
  }, [allPaid, hop]);

  return (
    <View style={s.bar}>
      <Sparkles active={allPaid} />
      <View style={s.top}>
        <Animated.View style={{ transform: [{ translateY: hop }] }}>
          <Bob>
            <Animal animal="bunny" size={46} />
          </Bob>
        </Animated.View>
        <Bubble text={message} />
      </View>
      <GrowBar ratio={totalOut > 0 ? paid / totalOut : 0} color={colors.green} track={colors.track} />
      <View style={s.stats}>
        <View style={[s.stat, { backgroundColor: colors.greenSoft }]}>
          <Text style={[s.label, { color: colors.greenText }]}>Paid</Text>
          <CountUp value={paid} format={fmt} style={s.value} />
        </View>
        <View style={[s.stat, s.main]}>
          <Text style={[s.label, { color: colors.pinkText }]}>Left to pay</Text>
          <CountUp value={toPay} format={fmt} style={[s.value, s.mainValue]} />
        </View>
        <View style={[s.stat, { backgroundColor: '#fff' }]}>
          <Text style={[s.label, { color: colors.sub }]}>Planned</Text>
          <CountUp value={totalOut} format={fmt} style={s.value} />
        </View>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  bar: {
    backgroundColor: colors.blueTint, borderRadius: 22, padding: 12, gap: 10,
    borderWidth: 1, borderColor: colors.line, overflow: 'visible',
  },
  top: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  stats: { flexDirection: 'row', gap: 8 },
  stat: { flex: 1, borderRadius: 14, paddingVertical: 7, paddingHorizontal: 10 },
  main: { flex: 1.3, backgroundColor: colors.pinkSoft },
  label: { fontSize: 11 },
  value: { fontSize: 14, fontWeight: '600', color: colors.text },
  mainValue: { fontSize: 17 },
});
