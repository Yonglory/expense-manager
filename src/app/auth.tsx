import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Text } from '../components/Text';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import { isConfigured } from '../lib/supabase';
import { colors } from '../lib/theme';
import type { AnimalId } from '../lib/types';
import { ANIMALS, Animal, animalLabel } from '../components/Animal';
import { useI18n } from '../i18n/I18nContext';
import { Bob, Pop } from '../components/Motion';
import { Logo } from '../components/Logo';
import { Button, Field, Segmented } from '../components/ui';

export default function AuthScreen() {
  const { signIn, signUp } = useAuth();
  const { t, lang, setLang } = useI18n();
  const [mode, setMode] = useState<'in' | 'up'>('in');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [animal, setAnimal] = useState<AnimalId>('bunny');
  const [house, setHouse] = useState<'new' | 'join'>('new');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const submit = async () => {
    setMsg(null);
    if (!email.includes('@')) return setMsg({ ok: false, text: t.errEmail });
    if (password.length < 6) return setMsg({ ok: false, text: t.errPassword });
    if (mode === 'up' && !name.trim()) return setMsg({ ok: false, text: t.errName });
    if (mode === 'up' && house === 'join' && !code.trim()) return setMsg({ ok: false, text: t.errCode });
    setBusy(true);
    if (mode === 'in') {
      const err = await signIn(email, password);
      if (err) setMsg({ ok: false, text: err });
    } else {
      const res = await signUp({ name, email, password, animal, joinCode: house === 'join' ? code : undefined });
      if (res.error) setMsg({ ok: false, text: res.error });
      else if (res.needsConfirm) {
        setMsg({ ok: true, text: t.confirmEmail });
        setMode('in');
      }
    }
    setBusy(false);
  };

  const up = mode === 'up';
  return (
    <SafeAreaView style={s.safe}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled">
          <View style={s.langRow}>
            {(['en', 'my'] as const).map((l) => (
              <Pressable key={l} onPress={() => setLang(l)} style={[s.langChip, lang === l && s.langOn]}>
                <Text style={[s.langText, lang === l && { color: colors.blueText, fontWeight: '600' }]}>{l === 'en' ? 'English' : 'မြန်မာ'}</Text>
              </Pressable>
            ))}
          </View>
          <View style={{ alignItems: 'center', gap: 8 }}>
            <Logo size={up ? 56 : 72} />
            <Text style={s.title}>{up ? t.createAccount : t.welcomeBack}</Text>
            {!up && <Text style={s.sub}>{t.planTogether}</Text>}
          </View>

          {!isConfigured && (
            <Text style={s.warn}>
              {t.notConfigured}
            </Text>
          )}

          {up && <Field placeholder={t.yourName} value={name} onChangeText={setName} icon={<Ionicons name="person-outline" size={18} color={colors.muted} />} />}
          <Field
            placeholder={t.emailPh} value={email} onChangeText={setEmail}
            autoCapitalize="none" keyboardType="email-address" autoComplete="email"
            icon={<Ionicons name="mail-outline" size={18} color={colors.muted} />}
          />
          <Field
            placeholder={t.password} value={password} onChangeText={setPassword} secureTextEntry
            icon={<Ionicons name="lock-closed-outline" size={18} color={colors.muted} />}
          />

          {up && (
            <>
              <Text style={s.label}>{t.pickAnimal}</Text>
              <View style={s.tiles}>
                {ANIMALS.map((a) => {
                  const on = a.id === animal;
                  return (
                    <Pressable key={a.id} style={[s.tile, on && s.tileOn]} onPress={() => setAnimal(a.id)}>
                      <Pop trigger={on}>{on ? <Bob amp={3}><Animal animal={a.id} size={52} /></Bob> : <Animal animal={a.id} size={52} />}</Pop>
                      <Text style={[s.tileText, on && { color: colors.blueText }]}>{animalLabel(t, a.id)}</Text>
                    </Pressable>
                  );
                })}
              </View>
              <Segmented
                value={house}
                onChange={setHouse}
                options={[
                  { id: 'new', label: t.startHousehold, bg: colors.blueSoft, fg: colors.blueText },
                  { id: 'join', label: t.joinWithCode, bg: colors.blueSoft, fg: colors.blueText },
                ]}
              />
              {house === 'join' && (
                <Field placeholder={t.familyCodePh} value={code} onChangeText={setCode} autoCapitalize="characters" />
              )}
            </>
          )}

          {msg && <Text style={[s.msg, msg.ok ? s.ok : s.err]}>{msg.text}</Text>}
          <Button label={up ? t.createAccountBtn : t.signIn} onPress={submit} busy={busy} />
          <Pressable onPress={() => { setMode(up ? 'in' : 'up'); setMsg(null); }}>
            <Text style={s.switch}>
              {up ? t.alreadyHave : t.newHere}
              <Text style={{ color: colors.blueText, fontWeight: '600' }}>{up ? t.signIn : t.createAccountBtn}</Text>
            </Text>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  scroll: { padding: 24, gap: 12, flexGrow: 1, justifyContent: 'center' },
  title: { fontSize: 22, fontWeight: '600', color: colors.text },
  sub: { color: colors.sub, fontSize: 14 },
  label: { fontSize: 14, fontWeight: '600', color: colors.text, marginTop: 4 },
  tiles: { flexDirection: 'row', gap: 8 },
  tile: {
    flex: 1, alignItems: 'center', paddingVertical: 8, borderRadius: 16,
    borderWidth: 1.5, borderColor: colors.track, backgroundColor: '#fff',
  },
  tileOn: { borderColor: colors.blue, backgroundColor: colors.blueTint },
  tileText: { fontSize: 12, color: colors.sub, marginTop: 2 },
  msg: { padding: 10, borderRadius: 12, fontSize: 13 },
  ok: { backgroundColor: colors.greenSoft, color: colors.greenText },
  err: { backgroundColor: colors.peach, color: colors.peachText },
  warn: { backgroundColor: colors.peach, color: colors.peachText, padding: 10, borderRadius: 12, fontSize: 13 },
  langRow: { flexDirection: 'row', justifyContent: 'flex-end', gap: 6 },
  langChip: { paddingVertical: 5, paddingHorizontal: 10, borderRadius: 12, backgroundColor: colors.row },
  langOn: { backgroundColor: colors.blueSoft },
  langText: { fontSize: 12, color: colors.sub },
  switch: { textAlign: 'center', color: colors.sub, fontSize: 14, marginTop: 4 },
});
