import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../lib/theme';
import { fmt } from '../lib/format';
import type { Item } from '../lib/types';
import { Pop } from './Motion';

export function ItemRow({ item, onToggle, onEdit }: { item: Item; onToggle: () => void; onEdit: () => void }) {
  const isOut = item.kind === 'out';
  const done = isOut && item.paid;
  return (
    <View style={s.row}>
      {isOut ? (
        <Pressable onPress={onToggle} hitSlop={10} accessibilityRole="checkbox" accessibilityState={{ checked: item.paid }}>
          <Pop trigger={item.paid} style={[s.cb, item.paid && s.cbOn]}>
            {item.paid && <Ionicons name="checkmark" size={14} color="#fff" />}
          </Pop>
        </Pressable>
      ) : (
        <Ionicons name="cash-outline" size={20} color={colors.greenText} />
      )}
      <Pressable style={s.body} onPress={onEdit}>
        <Text style={[s.name, done && s.done]} numberOfLines={1}>{item.name}</Text>
        <Text style={[s.amount, done && s.done]}>{fmt(item.amount)}</Text>
      </Pressable>
    </View>
  );
}

const s = StyleSheet.create({
  row: {
    flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, paddingHorizontal: 14,
    borderRadius: 16, backgroundColor: colors.row, marginBottom: 6,
  },
  cb: {
    width: 24, height: 24, borderRadius: 12, borderWidth: 1.5, borderColor: '#B9C8D8',
    backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center',
  },
  cbOn: { backgroundColor: colors.green, borderColor: colors.green },
  body: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8 },
  name: { flex: 1, fontSize: 16, color: colors.text },
  amount: { fontSize: 15, color: colors.sub },
  done: { textDecorationLine: 'line-through', color: colors.muted },
});
