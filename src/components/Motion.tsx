import React, { useEffect, useRef } from 'react';
import { Animated, Easing, StyleProp, ViewStyle } from 'react-native';

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
    <Animated.View style={{ height: 8, borderRadius: 4, backgroundColor: track, overflow: 'hidden' }}>
      <Animated.View
        style={{
          height: 8, borderRadius: 4, backgroundColor: color,
          width: v.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }),
        }}
      />
    </Animated.View>
  );
}
