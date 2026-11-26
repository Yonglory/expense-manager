import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Animated, Pressable, StyleProp, StyleSheet, Text, TextInput, TextInputProps, View, ViewStyle } from 'react-native';
import { colors } from '../lib/theme';
import { PressScale } from './Motion';

export function Button({
  label, onPress, tone = 'primary', busy, style,
}: { label: string; onPress: () => void; tone?: 'primary' | 'soft' | 'green' | 'danger'; busy?: boolean; style?: StyleProp<ViewStyle> }) {
  const bg = { primary: colors.blue, soft: colors.blueSoft, green: colors.greenSoft, danger: colors.peach }[tone];
  const fg = { primary: '#FFFFFF', soft: colors.blueText, green: colors.greenText, danger: colors.peachText }[tone];
  return (
    <PressScale onPress={busy ? undefined : onPress} style={[s.btn, { backgroundColor: bg }, style]}>
      {busy ? <ActivityIndicator color={fg} /> : <Text style={[s.btnText, { color: fg }]}>{label}</Text>}
    </PressScale>
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

// Segmented switch with a pill that slides to the chosen option.
export function Segmented<T extends string>({
  value, onChange, options,
}: { value: T; onChange: (v: T) => void; options: { id: T; label: string; bg: string; fg: string }[] }) {
  const [w, setW] = useState(0);
  const idx = Math.max(0, options.findIndex((o) => o.id === value));
  const x = useRef(new Animated.Value(idx)).current;
  useEffect(() => {
    Animated.spring(x, { toValue: idx, friction: 8, tension: 120, useNativeDriver: true }).start();
  }, [idx, x]);
  const pillW = w > 0 ? (w - 6) / options.length : 0;
  return (
    <View style={s.seg} onLayout={(e) => setW(e.nativeEvent.layout.width)}>
      {w > 0 && (
        <Animated.View
          style={[
            s.pill,
            { width: pillW, backgroundColor: options[idx].bg, transform: [{ translateX: x.interpolate({ inputRange: [0, options.length - 1 || 1], outputRange: [0, pillW * (options.length - 1)] }) }] },
          ]}
        />
      )}
      {options.map((o) => (
        <Pressable key={o.id} onPress={() => onChange(o.id)} style={s.segItem}>
          <Text style={[s.segText, { color: o.id === value ? o.fg : colors.sub }]}>{o.label}</Text>
        </Pressable>
      ))}
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
  pill: { position: 'absolute', top: 3, bottom: 3, left: 3, borderRadius: 13 },
  segItem: { flex: 1, paddingVertical: 9, alignItems: 'center' },
  segText: { fontSize: 14, fontWeight: '600' },
  bubble: { flex: 1, backgroundColor: colors.peach, borderRadius: 14, paddingVertical: 8, paddingHorizontal: 12 },
  bubbleText: { color: colors.peachText, fontSize: 13 },
});
