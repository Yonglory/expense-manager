import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Text } from './Text';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../lib/theme';
import { fmt } from '../lib/format';
import { canSync, useSyncState } from '../lib/offline';
import { useI18n } from '../i18n/I18nContext';
import type { Item } from '../lib/types';
import { FadeIn, Pop } from './Motion';

export function ItemRow({
  item, index, onToggle, onEdit,
}: { item: Item; index: number; onToggle: () => void; onEdit: () => void }) {
  const { t } = useI18n();
  const sync = useSyncState();
  const waiting = !canSync(sync) && sync.pendingIds.includes(item.id);
  const isOut = item.kind === 'out';
  const done = isOut && item.paid;
  const hasActual = isOut && item.actual != null;
  const diff = hasActual ? (item.actual as number) - item.amount : 0;
  return (
    <FadeIn delay={Math.min(index, 10) * 45}>
      <View style={[s.row, done && s.rowDone]}>
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
          <View style={{ flex: 1 }}>
            <Text style={[s.name, done && s.done]} numberOfLines={1}>{item.name}</Text>
            {item.due_day != null && isOut && (
              <Text style={s.sub}>
                <Ionicons name="alarm-outline" size={11} color={colors.blueText} /> {t.dueOn(item.due_day)}
              </Text>
            )}
          </View>
          <View style={s.right}>
            <View style={s.amountRow}>
              {waiting && <Ionicons name="time-outline" size={13} color={colors.sub} />}
              <Text style={[s.amount, done && s.done]}>{fmt(item.amount)}</Text>
            </View>
            {hasActual && (
              <View style={s.actualRow}>
                <Text style={s.sub}>{t.spentLabel(fmt(item.actual as number))}</Text>
                {diff !== 0 && (
                  <View style={[s.diff, { backgroundColor: diff > 0 ? colors.peach : colors.greenSoft }]}>
                    <Text style={[s.diffText, { color: diff > 0 ? colors.peachText : colors.greenText }]}>
                      {diff > 0 ? '+' : '-'}{fmt(Math.abs(diff))}
                    </Text>
                  </View>
                )}
              </View>
            )}
          </View>
        </Pressable>
      </View>
    </FadeIn>
  );
}

const s = StyleSheet.create({
  row: {
    flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, paddingHorizontal: 14,
    borderRadius: 16, backgroundColor: colors.row, marginBottom: 6,
  },
  rowDone: { backgroundColor: colors.greenSoft },
  cb: {
    width: 24, height: 24, borderRadius: 12, borderWidth: 1.5, borderColor: '#B9C8D8',
    backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center',
  },
  cbOn: { backgroundColor: colors.green, borderColor: colors.green },
  body: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8 },
  name: { fontSize: 16, color: colors.text },
  sub: { fontSize: 11, color: colors.sub, marginTop: 1 },
  right: { alignItems: 'flex-end' },
  amountRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  amount: { fontSize: 15, color: colors.sub },
  actualRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 1 },
  diff: { borderRadius: 8, paddingHorizontal: 6, paddingVertical: 1 },
  diffText: { fontSize: 11, fontWeight: '600' },
  done: { textDecorationLine: 'line-through', color: colors.muted },
});
