import React from 'react';
import { Pressable, StyleSheet, Text as RNText, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors } from '../lib/theme';
import { useI18n } from '../i18n/I18nContext';
import { Animal } from './Animal';
import { Bob } from './Motion';
import { BURMESE_BOLD, BURMESE_REGULAR } from './Text';

// First launch only: pick English or Burmese.
export function LanguagePicker() {
  const { setLang } = useI18n();
  return (
    <SafeAreaView style={[StyleSheet.absoluteFill, s.safe]}>
      <View style={s.center}>
        <Bob amp={8} duration={900}>
          <Animal animal="bunny" size={96} />
        </Bob>
        <RNText style={s.title}>Choose your language</RNText>
        <RNText style={[s.title, { fontFamily: BURMESE_BOLD, lineHeight: 34, marginTop: -6 }]}>ဘာသာစကား ရွေးပါ</RNText>
        <Pressable style={s.btn} onPress={() => setLang('en')}>
          <RNText style={s.btnText}>English</RNText>
        </Pressable>
        <Pressable style={s.btn} onPress={() => setLang('my')}>
          <RNText style={[s.btnText, { fontFamily: BURMESE_REGULAR, lineHeight: 28 }]}>မြန်မာ</RNText>
        </Pressable>
        <RNText style={s.note}>You can change this later in settings.</RNText>
      </View>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { backgroundColor: colors.bg },
  center: { flex: 1, alignItems: 'stretch', justifyContent: 'center', padding: 28, gap: 14 },
  title: { fontSize: 20, fontWeight: '600', color: colors.text, textAlign: 'center' },
  btn: { backgroundColor: colors.blueSoft, borderRadius: 18, paddingVertical: 16, alignItems: 'center' },
  btnText: { fontSize: 18, fontWeight: '600', color: colors.blueText },
  note: { textAlign: 'center', color: colors.sub, fontSize: 12 },
});
