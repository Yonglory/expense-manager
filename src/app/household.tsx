import React, { useState } from 'react';
import { Pressable, ScrollView, Share, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useAuth } from '../context/AuthContext';
import { colors } from '../lib/theme';
import { ANIMALS, Animal } from '../components/Animal';
import { Bob, Pop } from '../components/Motion';
import { Button } from '../components/ui';

export default function HouseholdScreen() {
  const { profile, household, members, setAnimal, signOut } = useAuth();
  const router = useRouter();
  const [err, setErr] = useState<string | null>(null);
  if (!profile || !household) return null;

  const invite = () =>
    Share.share({ message: `Join our household on Expense Manager. Sign up, choose "Join with code", and enter ${household.code}.` });

  return (
    <SafeAreaView style={s.safe}>
      <View style={s.header}>
        <Pressable onPress={() => router.back()} hitSlop={10}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </Pressable>
        <Text style={s.title}>Our household</Text>
      </View>
      <ScrollView contentContainerStyle={s.body}>
        <View style={s.codeCard}>
          <Text style={s.codeLabel}>Family code</Text>
          <Text style={s.code} selectable>{household.code}</Text>
        </View>
        <Button label="Invite family" tone="soft" onPress={invite} />

        <Text style={s.section}>Members</Text>
        {members.map((m) => (
          <View key={m.id} style={s.member}>
            <View style={s.av}><Animal animal={m.animal} size={36} /></View>
            <Text style={s.name}>{m.display_name}{m.id === profile.id ? ' (you)' : ''}</Text>
          </View>
        ))}

        <Text style={s.section}>Your animal</Text>
        <View style={s.tiles}>
          {ANIMALS.map((a) => {
            const on = a.id === profile.animal;
            return (
              <Pressable
                key={a.id}
                style={[s.tile, on && s.tileOn]}
                onPress={async () => setErr(await setAnimal(a.id))}
              >
                <Pop trigger={on}>{on ? <Bob amp={3}><Animal animal={a.id} size={48} /></Bob> : <Animal animal={a.id} size={48} />}</Pop>
                <Text style={[s.tileText, on && { color: colors.blueText }]}>{a.label}</Text>
              </Pressable>
            );
          })}
        </View>
        {err && <Text style={s.err}>{err}</Text>}

        <Button label="Sign out" tone="danger" onPress={signOut} style={{ marginTop: 16 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16 },
  title: { fontSize: 18, fontWeight: '600', color: colors.text },
  body: { padding: 16, gap: 10 },
  codeCard: { backgroundColor: colors.blueTint, borderRadius: 18, padding: 16, alignItems: 'center', borderWidth: 1, borderColor: colors.line },
  codeLabel: { color: colors.sub, fontSize: 12 },
  code: { fontSize: 26, fontWeight: '600', color: colors.blueText, letterSpacing: 1 },
  section: { fontSize: 14, fontWeight: '600', color: colors.text, marginTop: 8 },
  member: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 10, borderRadius: 16, backgroundColor: colors.row },
  av: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' },
  name: { fontSize: 16, color: colors.text },
  tiles: { flexDirection: 'row', gap: 8 },
  tile: { flex: 1, alignItems: 'center', paddingVertical: 8, borderRadius: 16, borderWidth: 1.5, borderColor: colors.track, backgroundColor: '#fff' },
  tileOn: { borderColor: colors.blue, backgroundColor: colors.blueTint },
  tileText: { fontSize: 12, color: colors.sub, marginTop: 2 },
  err: { color: colors.peachText, backgroundColor: colors.peach, padding: 8, borderRadius: 10, fontSize: 13 },
});
