import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../context/AuthContext';
import { colors } from '../lib/theme';
import { Animal } from '../components/Animal';
import { Loading } from '../components/Loading';
import { Button, Field } from '../components/ui';

// Shown only when a signed-in user has no household yet (for example, a wrong family code).
export default function SetupScreen() {
  const { setupError, retrySetup, signOut, reload } = useAuth();
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);

  const run = async (c: string | null) => {
    setBusy(true);
    await retrySetup(c);
    setBusy(false);
  };

  if (!setupError) {
    return (
      <SafeAreaView style={s.safe}>
        <Loading message="Getting your household ready…" />
        <View style={s.signOutRow}>
          <Button label="Sign out" tone="soft" onPress={signOut} />
        </View>
      </SafeAreaView>
    );
  }
  return (
    <SafeAreaView style={s.safe}>
      <View style={s.center}>
        <Animal animal="bunny" size={80} />
        <Text style={s.title}>Let's finish setting up</Text>
        <Text style={s.err}>{setupError}</Text>
        <Button label="Try again" onPress={async () => { setBusy(true); await reload(); setBusy(false); }} busy={busy} style={s.full} />
        <Text style={s.sub}>Or use a family code:</Text>
        <Field placeholder="Family code, for example HOME-4821" value={code} onChangeText={setCode} autoCapitalize="characters" />
        <Button label="Join with this code" onPress={() => run(code)} busy={busy} style={s.full} />
        <Button label="Start a new household" tone="green" onPress={() => run(null)} style={s.full} />
        <Button label="Sign out" tone="soft" onPress={signOut} style={s.full} />
      </View>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, padding: 24, gap: 12, alignItems: 'stretch', justifyContent: 'center' },
  wait: { flex: 1, padding: 24, gap: 12, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 20, fontWeight: '600', color: colors.text, textAlign: 'center' },
  sub: { color: colors.sub, textAlign: 'center' },
  err: { backgroundColor: colors.peach, color: colors.peachText, padding: 10, borderRadius: 12, fontSize: 13 },
  full: { alignSelf: 'stretch' },
  signOutRow: { padding: 24 },
});
