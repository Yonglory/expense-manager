import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import { isConfigured } from '../lib/supabase';
import { colors } from '../lib/theme';
import type { AnimalId } from '../lib/types';
import { ANIMALS, Animal } from '../components/Animal';
import { Bob, Pop } from '../components/Motion';
import { Logo } from '../components/Logo';
import { Button, Field, Segmented } from '../components/ui';

export default function AuthScreen() {
  const { signIn, signUp } = useAuth();
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
    if (!email.includes('@')) return setMsg({ ok: false, text: 'Enter a valid email address.' });
    if (password.length < 6) return setMsg({ ok: false, text: 'Use a password with at least 6 characters.' });
    if (mode === 'up' && !name.trim()) return setMsg({ ok: false, text: 'Tell us your name.' });
    if (mode === 'up' && house === 'join' && !code.trim()) return setMsg({ ok: false, text: 'Enter your family code.' });
    setBusy(true);
    if (mode === 'in') {
      const err = await signIn(email, password);
      if (err) setMsg({ ok: false, text: err });
    } else {
      const res = await signUp({ name, email, password, animal, joinCode: house === 'join' ? code : undefined });
      if (res.error) setMsg({ ok: false, text: res.error });
      else if (res.needsConfirm) {
        setMsg({ ok: true, text: 'Almost there! Confirm your email, then sign in.' });
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
          <View style={{ alignItems: 'center', gap: 8 }}>
            <Logo size={up ? 56 : 72} />
            <Text style={s.title}>{up ? 'Create your account' : 'Welcome back'}</Text>
            {!up && <Text style={s.sub}>Plan the month together with your family</Text>}
          </View>

          {!isConfigured && (
            <Text style={s.warn}>
              Supabase isn't connected yet. Copy .env.example to .env and add your key, then restart the app.
            </Text>
          )}

          {up && <Field placeholder="Your name" value={name} onChangeText={setName} icon={<Ionicons name="person-outline" size={18} color={colors.muted} />} />}
          <Field
            placeholder="name@email.com" value={email} onChangeText={setEmail}
            autoCapitalize="none" keyboardType="email-address" autoComplete="email"
            icon={<Ionicons name="mail-outline" size={18} color={colors.muted} />}
          />
          <Field
            placeholder="Password" value={password} onChangeText={setPassword} secureTextEntry
            icon={<Ionicons name="lock-closed-outline" size={18} color={colors.muted} />}
          />

          {up && (
            <>
              <Text style={s.label}>Pick your animal</Text>
              <View style={s.tiles}>
                {ANIMALS.map((a) => {
                  const on = a.id === animal;
                  return (
                    <Pressable key={a.id} style={[s.tile, on && s.tileOn]} onPress={() => setAnimal(a.id)}>
                      <Pop trigger={on}>{on ? <Bob amp={3}><Animal animal={a.id} size={52} /></Bob> : <Animal animal={a.id} size={52} />}</Pop>
                      <Text style={[s.tileText, on && { color: colors.blueText }]}>{a.label}</Text>
                    </Pressable>
                  );
                })}
              </View>
              <Segmented
                value={house}
                onChange={setHouse}
                options={[
                  { id: 'new', label: 'Start a household', bg: colors.blueSoft, fg: colors.blueText },
                  { id: 'join', label: 'Join with code', bg: colors.blueSoft, fg: colors.blueText },
                ]}
              />
              {house === 'join' && (
                <Field placeholder="Family code, for example HOME-4821" value={code} onChangeText={setCode} autoCapitalize="characters" />
              )}
            </>
          )}

          {msg && <Text style={[s.msg, msg.ok ? s.ok : s.err]}>{msg.text}</Text>}
          <Button label={up ? 'Create account' : 'Sign in'} onPress={submit} busy={busy} />
          <Pressable onPress={() => { setMode(up ? 'in' : 'up'); setMsg(null); }}>
            <Text style={s.switch}>
              {up ? 'Already have an account? ' : 'New here? '}
              <Text style={{ color: colors.blueText, fontWeight: '600' }}>{up ? 'Sign in' : 'Create account'}</Text>
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
  switch: { textAlign: 'center', color: colors.sub, fontSize: 14, marginTop: 4 },
});
