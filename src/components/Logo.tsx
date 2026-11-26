import React from 'react';
import { Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../lib/theme';

// Placeholder. Replace the body with <Image source={require('../../assets/logo.png')} /> when the real logo is ready.
export function Logo({ size = 64 }: { size?: number }) {
  return (
    <View
      style={{
        width: size, height: size, borderRadius: size * 0.28, backgroundColor: colors.blueSoft,
        borderWidth: 1.5, borderStyle: 'dashed', borderColor: colors.blue,
        alignItems: 'center', justifyContent: 'center', gap: 2,
      }}
    >
      <Ionicons name="wallet-outline" size={size * 0.38} color={colors.blueText} />
      <Text style={{ fontSize: Math.max(9, size * 0.16), color: colors.blueText }}>App logo</Text>
    </View>
  );
}
