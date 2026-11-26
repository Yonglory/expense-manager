import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors } from '../lib/theme';
import { fmt } from '../lib/format';
import { Animal } from './Animal';
import { Bob, GrowBar } from './Motion';
import { Bubble } from './ui';

export function TotalsBar({ totalIn, totalOut, paid }: { totalIn: number; totalOut: number; paid: number }) {
  const left = totalIn - totalOut;
  let message: string;
  if (totalIn === 0 && totalOut === 0) message = "Add your first items and I'll do the math.";
  else if (left < 0) message = `Tight month. Needs ${fmt(-left)} more. You've got this.`;
  else if (left === 0) message = 'Perfectly balanced.';
  else message = `Nice! ${fmt(left)} left over this month.`;

  return (
    <View style={s.bar}>
      <View style={s.top}>
        <Bob>
          <Animal animal="bunny" size={44} />
        </Bob>
        <Bubble text={message} />
      </View>
      <GrowBar ratio={totalOut > 0 ? paid / totalOut : 0} color={colors.green} track={colors.track} />
      <View style={s.between}>
        <Text style={s.sub}>Paid {fmt(paid)}</Text>
        <Text style={s.sub}>Planned {fmt(totalOut)}</Text>
      </View>
      <View style={s.chips}>
        <View style={[s.chip, { backgroundColor: colors.greenSoft }]}>
          <Text style={[s.chipLabel, { color: colors.greenText }]}>In</Text>
          <Text style={s.chipValue}>{fmt(totalIn)}</Text>
        </View>
        <View style={[s.chip, { backgroundColor: colors.pinkSoft }]}>
          <Text style={[s.chipLabel, { color: colors.pinkText }]}>Out</Text>
          <Text style={s.chipValue}>{fmt(totalOut)}</Text>
        </View>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  bar: {
    backgroundColor: colors.blueTint, borderRadius: 22, padding: 12, gap: 8,
    borderWidth: 1, borderColor: colors.line,
  },
  top: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  between: { flexDirection: 'row', justifyContent: 'space-between' },
  sub: { color: colors.sub, fontSize: 12 },
  chips: { flexDirection: 'row', gap: 8 },
  chip: { flex: 1, borderRadius: 12, paddingVertical: 6, paddingHorizontal: 10 },
  chipLabel: { fontSize: 11 },
  chipValue: { fontSize: 15, fontWeight: '600', color: colors.text },
});
