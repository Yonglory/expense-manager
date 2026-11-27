import React from 'react';
import { StyleSheet, Text as RNText, TextProps } from 'react-native';
import { useI18n } from '../i18n/I18nContext';

// Same as React Native's Text. In Burmese it uses a bundled Unicode font, so the letters
// look right on every phone (some older phones in Myanmar use a different encoding, Zawgyi).
export const BURMESE_REGULAR = 'NotoSansMyanmar_400Regular';
export const BURMESE_BOLD = 'NotoSansMyanmar_700Bold';

export function Text({ style, ...rest }: TextProps) {
  const { lang } = useI18n();
  if (lang !== 'my') return <RNText style={style} {...rest} />;
  const flat = StyleSheet.flatten(style) ?? {};
  const w = String(flat.fontWeight ?? '400');
  const bold = w === 'bold' || Number(w) >= 600;
  const size = (flat.fontSize as number | undefined) ?? 14;
  return (
    <RNText
      {...rest}
      style={[style, { fontFamily: bold ? BURMESE_BOLD : BURMESE_REGULAR, fontWeight: 'normal', lineHeight: Math.round(size * 1.6) }]}
    />
  );
}
