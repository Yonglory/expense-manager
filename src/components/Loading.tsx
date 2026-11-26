import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors } from '../lib/theme';
import { Animal } from './Animal';
import { Logo } from './Logo';
import { Bob, Dots, FadeIn } from './Motion';

export function Loading({ message }: { message: string }) {
  return (
    <View style={s.wrap}>
      <FadeIn>
        <Logo size={64} />
      </FadeIn>
      <Bob amp={10} duration={650}>
        <Animal animal="bunny" size={110} />
      </Bob>
      <Dots color={colors.blue} />
      <Text style={s.text}>{message}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 18, backgroundColor: colors.bg },
  text: { color: colors.sub, fontSize: 14, textAlign: 'center' },
});
