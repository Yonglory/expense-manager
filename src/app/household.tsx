import React, { useState } from 'react';
import { Pressable, ScrollView, Share, StyleSheet, Switch, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Text } from '../components/Text';
import { useAuth } from '../context/AuthContext';
import { useI18n } from '../i18n/I18nContext';
import { colors } from '../lib/theme';
import { canSync, setSyncMobile, syncNow, useSyncState } from '../lib/offline';
import { ANIMALS, Animal, animalLabel } from '../components/Animal';
import { Bob, Pop } from '../components/Motion';
import { SyncBanner } from '../components/SyncBanner';
import { Button, Segmented } from '../components/ui';

export default function HouseholdScreen() {
  const { profile, household, members, setAnimal, signOut } = useAuth();
  const { t, lang, setLang } = useI18n();
  const sync = useSyncState();
  const router = useRouter();
  const [err, setErr] = useState<string | null>(null);
  if (!profile || !household) return null;

  const invite = () => Share.share({ message: t.inviteMessage(household.code) });

  // "Synced 2 minutes ago" and friends.
  let syncedText = t.neverSynced;
  if (sync.lastSynced) {
    const mins = Math.floor((Date.now() - sync.lastSynced) / 60000);
    syncedText = mins < 1 ? t.justSynced : mins < 60 ? t.syncedMin(mins) : mins < 1440 ? t.syncedHour(Math.floor(mins / 60)) : t.syncedDay(Math.floor(mins / 1440));
  }
  const waiting = sync.pending > 0;
  const offline = !sync.online;

  return (
    <SafeAreaView style={s.safe}>
      <View style={s.header}>
        <Pressable onPress={() => router.back()} hitSlop={10}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </Pressable>
        <Text style={s.title}>{t.ourHousehold}</Text>
      </View>
      <SyncBanner />
      <ScrollView contentContainerStyle={s.body}>
        <View style={s.codeCard}>
          <Text style={s.codeLabel}>{t.familyCode}</Text>
          <Text style={s.code} selectable>{household.code}</Text>
        </View>
        <Button label={t.inviteFamily} tone="soft" onPress={invite} />

        <Text style={s.section}>{t.language}</Text>
        <Segmented
          value={lang}
          onChange={setLang}
          options={[
            { id: 'en', label: 'English', bg: colors.blueSoft, fg: colors.blueText },
            { id: 'my', label: 'မြန်မာ', bg: colors.blueSoft, fg: colors.blueText },
          ]}
        />
        <Text style={s.note}>{t.languageNote}</Text>

        <Text style={s.section}>{t.syncSection}</Text>
        <View style={[s.syncCard, { backgroundColor: offline ? colors.peach : waiting ? colors.blueTint : colors.greenSoft }]}>
          <Ionicons
            name={offline ? 'cloud-offline-outline' : waiting ? 'sync-outline' : 'cloud-done-outline'}
            size={24}
            color={offline ? colors.peachText : waiting ? colors.blueText : colors.greenText}
          />
          <View style={{ flex: 1 }}>
            <Text style={[s.syncTitle, { color: offline ? colors.peachText : waiting ? colors.blueText : colors.greenText }]}>
              {offline ? t.offlineTitle : sync.syncing ? t.syncing : waiting ? t.waitingSync(sync.pending) : t.allSaved}
            </Text>
            <Text style={s.note}>{syncedText}</Text>
          </View>
          {(waiting || !canSync(sync)) && sync.online && (
            <Pressable onPress={() => syncNow()} style={s.syncBtn}>
              <Text style={s.syncBtnText}>{t.syncNow}</Text>
            </Pressable>
          )}
        </View>
        <View style={s.toggleRow}>
          <Ionicons name="wifi-outline" size={18} color={colors.sub} />
          <Text style={{ flex: 1, color: colors.text }}>{t.syncMobile}</Text>
          <Switch value={sync.syncMobile} onValueChange={(v) => setSyncMobile(v)} trackColor={{ true: colors.green, false: colors.track }} />
        </View>

        <Text style={s.section}>{t.members}</Text>
        {members.map((m) => (
          <View key={m.id} style={s.member}>
            <View style={s.av}><Animal animal={m.animal} size={36} /></View>
            <Text style={s.name}>{m.display_name}{m.id === profile.id ? t.you : ''}</Text>
          </View>
        ))}

        <Text style={s.section}>{t.yourAnimal}</Text>
        <View style={s.tiles}>
          {ANIMALS.map((a) => {
            const on = a.id === profile.animal;
            return (
              <Pressable key={a.id} style={[s.tile, on && s.tileOn]} onPress={async () => setErr(await setAnimal(a.id))}>
                <Pop trigger={on}>{on ? <Bob amp={3}><Animal animal={a.id} size={48} /></Bob> : <Animal animal={a.id} size={48} />}</Pop>
                <Text style={[s.tileText, on && { color: colors.blueText }]}>{animalLabel(t, a.id)}</Text>
              </Pressable>
            );
          })}
        </View>
        {err && <Text style={s.err}>{err}</Text>}

        <Button label={t.signOut} tone="danger" onPress={signOut} style={{ marginTop: 16 }} />
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
  note: { color: colors.sub, fontSize: 12 },
  syncCard: { flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 16, padding: 12 },
  syncTitle: { fontSize: 14, fontWeight: '600' },
  syncBtn: { backgroundColor: '#fff', borderRadius: 10, paddingHorizontal: 10, paddingVertical: 7 },
  syncBtnText: { color: colors.blueText, fontSize: 12, fontWeight: '600' },
  toggleRow: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 10, borderRadius: 14, backgroundColor: colors.row },
  member: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 10, borderRadius: 16, backgroundColor: colors.row },
  av: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' },
  name: { fontSize: 16, color: colors.text },
  tiles: { flexDirection: 'row', gap: 8 },
  tile: { flex: 1, alignItems: 'center', paddingVertical: 8, borderRadius: 16, borderWidth: 1.5, borderColor: colors.track, backgroundColor: '#fff' },
  tileOn: { borderColor: colors.blue, backgroundColor: colors.blueTint },
  tileText: { fontSize: 12, color: colors.sub, marginTop: 2 },
  err: { color: colors.peachText, backgroundColor: colors.peach, padding: 8, borderRadius: 10, fontSize: 13 },
});
