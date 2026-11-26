import React from 'react';
import { ActivityIndicator, Pressable, StyleProp, StyleSheet, Text, TextInput, TextInputProps, View, ViewStyle } from 'react-native';
import { colors } from '../lib/theme';

export function Button({
  label, onPress, tone = 'primary', busy, style,
}: { label: string; onPress: () => void; tone?: 'primary' | 'soft' | 'green' | 'danger'; busy?: boolean; style?: StyleProp<ViewStyle> }) {
  const bg = { primary: colors.blue, soft: colors.blueSoft, green: colors.greenSoft, danger: colors.peach }[tone];
  const fg = { primary: '#FFFFFF', soft: colors.blueText, green: colors.greenText, danger: colors.peachText }[tone];
  return (
    <Pressable
      onPress={busy ? undefined : onPress}
      style={({ pressed }) => [s.btn, { backgroundColor: bg, opacity: pressed ? 0.85 : 1 }, style]}
    >
      {busy ? <ActivityIndicator color={fg} /> : <Text style={[s.btnText, { color: fg }]}>{label}</Text>}
    </Pressable>
  );
}

export function Field(props: TextInputProps & { icon?: React.ReactNode }) {
  const { icon, style, ...rest } = props;
  return (
    <View style={s.field}>
      {icon}
      <TextInput placeholderTextColor={colors.muted} style={[s.input, style]} {...rest} />
    </View>
  );
}

export function Segmented<T extends string>({
  value, onChange, options,
}: { value: T; onChange: (v: T) => void; options: { id: T; label: string; bg: string; fg: string }[] }) {
  return (
    <View style={s.seg}>
      {options.map((o) => {
        const on = o.id === value;
        return (
          <Pressable key={o.id} onPress={() => onChange(o.id)} style={[s.segItem, on && { backgroundColor: o.bg }]}>
            <Text style={[s.segText, { color: on ? o.fg : colors.sub }]}>{o.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function Bubble({ text }: { text: string }) {
  return (
    <View style={s.bubble}>
      <Text style={s.bubbleText}>{text}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  btn: { borderRadius: 16, paddingVertical: 13, alignItems: 'center', justifyContent: 'center', minHeight: 48 },
  btnText: { fontSize: 15, fontWeight: '600' },
  field: {
    flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12,
    borderRadius: 14, borderWidth: 1, borderColor: colors.line, backgroundColor: '#fff',
  },
  input: { flex: 1, paddingVertical: 12, fontSize: 15, color: colors.text },
  seg: { flexDirection: 'row', backgroundColor: colors.row, borderRadius: 16, padding: 3 },
  segItem: { flex: 1, paddingVertical: 9, borderRadius: 13, alignItems: 'center' },
  segText: { fontSize: 14, fontWeight: '600' },
  bubble: { flex: 1, backgroundColor: colors.peach, borderRadius: 14, paddingVertical: 8, paddingHorizontal: 12 },
  bubbleText: { color: colors.peachText, fontSize: 13 },
});
