import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Easing, Pressable, StyleProp, Text, TextStyle, View, ViewStyle } from 'react-native';

// Gentle floating, like the little friends on the inspiration page.
export function Bob({
  children, amp = 4, duration = 1500, style,
}: { children: React.ReactNode; amp?: number; duration?: number; style?: StyleProp<ViewStyle> }) {
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(v, { toValue: 1, duration, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(v, { toValue: 0, duration, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [v, duration]);
  return (
    <Animated.View style={[{ transform: [{ translateY: v.interpolate({ inputRange: [0, 1], outputRange: [0, -amp] }) }] }, style]}>
      {children}
    </Animated.View>
  );
}

// Springs from small to full size whenever `trigger` flips to true.
export function Pop({
  trigger, children, style,
}: { trigger: boolean; children: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  const s = useRef(new Animated.Value(1)).current;
  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    if (trigger) {
      s.setValue(0.6);
      Animated.spring(s, { toValue: 1, friction: 4, tension: 160, useNativeDriver: true }).start();
    }
  }, [trigger, s]);
  return <Animated.View style={[{ transform: [{ scale: s }] }, style]}>{children}</Animated.View>;
}

// Slides up and fades in. Give each list row a growing `delay` for a staggered entrance.
export function FadeIn({
  children, delay = 0, style,
}: { children: React.ReactNode; delay?: number; style?: StyleProp<ViewStyle> }) {
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(v, { toValue: 1, duration: 380, delay, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
  }, [v, delay]);
  return (
    <Animated.View
      style={[{ opacity: v, transform: [{ translateY: v.interpolate({ inputRange: [0, 1], outputRange: [16, 0] }) }] }, style]}
    >
      {children}
    </Animated.View>
  );
}

// Numbers roll up or down to their new value.
export function CountUp({
  value, format, style,
}: { value: number; format: (n: number) => string; style?: StyleProp<TextStyle> }) {
  const v = useRef(new Animated.Value(value)).current;
  const [shown, setShown] = useState(value);
  useEffect(() => {
    const id = v.addListener(({ value: x }) => setShown(x));
    return () => v.removeListener(id);
  }, [v]);
  useEffect(() => {
    Animated.timing(v, { toValue: value, duration: 600, easing: Easing.out(Easing.cubic), useNativeDriver: false }).start();
  }, [value, v]);
  return <Text style={style}>{format(shown)}</Text>;
}

// Three bouncing dots for loading screens.
export function Dots({ color }: { color: string }) {
  const vals = useMemo(() => [0, 1, 2].map(() => new Animated.Value(0)), []);
  useEffect(() => {
    const loops = vals.map((v, i) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(i * 160),
          Animated.timing(v, { toValue: 1, duration: 320, useNativeDriver: true }),
          Animated.timing(v, { toValue: 0, duration: 320, useNativeDriver: true }),
          Animated.delay((2 - i) * 160),
        ]),
      ),
    );
    loops.forEach((l) => l.start());
    return () => loops.forEach((l) => l.stop());
  }, [vals]);
  return (
    <View style={{ flexDirection: 'row', gap: 8, height: 22, alignItems: 'flex-end' }}>
      {vals.map((v, i) => (
        <Animated.View
          key={i}
          style={{
            width: 10, height: 10, borderRadius: 5, backgroundColor: color,
            opacity: v.interpolate({ inputRange: [0, 1], outputRange: [0.4, 1] }),
            transform: [{ translateY: v.interpolate({ inputRange: [0, 1], outputRange: [0, -10] }) }],
          }}
        />
      ))}
    </View>
  );
}

// Squishes a little when pressed.
export function PressScale({
  children, onPress, style, accessibilityLabel,
}: { children: React.ReactNode; onPress?: () => void; style?: StyleProp<ViewStyle>; accessibilityLabel?: string }) {
  const s = useRef(new Animated.Value(1)).current;
  const to = (x: number) => Animated.spring(s, { toValue: x, friction: 5, tension: 220, useNativeDriver: true }).start();
  return (
    <Pressable onPress={onPress} onPressIn={() => to(0.94)} onPressOut={() => to(1)} accessibilityLabel={accessibilityLabel}>
      <Animated.View style={[{ transform: [{ scale: s }] }, style]}>{children}</Animated.View>
    </Pressable>
  );
}

// A little burst of sparkles when `active` turns true (used when everything is paid).
export function Sparkles({ active }: { active: boolean }) {
  const items = useMemo(
    () => [0, 1, 2, 3, 4, 5].map((i) => ({ v: new Animated.Value(0), x: 8 + i * 17 + (i % 2) * 6, d: i * 90 })),
    [],
  );
  useEffect(() => {
    if (!active) return;
    items.forEach((it) => {
      it.v.setValue(0);
      Animated.timing(it.v, { toValue: 1, duration: 1300, delay: it.d, easing: Easing.out(Easing.quad), useNativeDriver: true }).start();
    });
  }, [active, items]);
  return (
    <View pointerEvents="none" style={{ position: 'absolute', left: 0, right: 0, top: 0, height: 60 }}>
      {items.map((it, i) => (
        <Animated.Text
          key={i}
          style={{
            position: 'absolute', left: `${it.x}%`, top: 36, fontSize: 18,
            opacity: it.v.interpolate({ inputRange: [0, 0.2, 1], outputRange: [0, 1, 0] }),
            transform: [{ translateY: it.v.interpolate({ inputRange: [0, 1], outputRange: [0, -46] }) }],
          }}
        >
          {i % 2 ? '✨' : '💖'}
        </Animated.Text>
      ))}
    </View>
  );
}

export function GrowBar({ ratio, color, track }: { ratio: number; color: string; track: string }) {
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(v, {
      toValue: Math.max(0, Math.min(1, ratio)),
      duration: 700,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
  }, [ratio, v]);
  return (
    <Animated.View style={{ height: 10, borderRadius: 5, backgroundColor: track, overflow: 'hidden' }}>
      <Animated.View
        style={{
          height: 10, borderRadius: 5, backgroundColor: color,
          width: v.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }),
        }}
      />
    </Animated.View>
  );
}
