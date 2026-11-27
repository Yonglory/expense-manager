import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Text } from './Text';
import { colors } from '../lib/theme';
import { useI18n } from '../i18n/I18nContext';
import { syncNow, useSyncState } from '../lib/offline';
import { FadeIn } from './Motion';

// Shown only when you're offline, or when sync is paused on mobile data.
export function SyncBanner() {
  const { t } = useI18n();
  const s = useSyncState();
  const paused = s.online && s.cellular && !s.syncMobile && s.pending > 0;
  if (s.online && !paused) return null;
  return (
    <FadeIn style={st.wrap}>
      <View style={st.box}>
        <Ionicons name={paused ? 'pause-circle-outline' : 'cloud-offline-outline'} size={20} color={colors.peachText} />
        <View style={{ flex: 1 }}>
          <Text style={st.title}>{paused ? t.pausedTitle : t.offlineTitle}</Text>
          <Text style={st.body}>{paused ? t.pausedBody(s.pending) : t.offlineBody}</Text>
          {!paused && s.pending > 0 && <Text style={st.count}>{t.waitingSync(s.pending)}</Text>}
        </View>
        {paused && (
          <Pressable onPress={() => syncNow()} style={st.btn}>
            <Text style={st.btnText}>{t.syncNow}</Text>
          </Pressable>
        )}
      </View>
    </FadeIn>
  );
}

const st = StyleSheet.create({
  wrap: { paddingHorizontal: 16, paddingTop: 6 },
  box: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: colors.peach, borderRadius: 14, padding: 10 },
  title: { color: colors.peachText, fontWeight: '600', fontSize: 13 },
  body: { color: colors.peachText, fontSize: 12 },
  count: { color: colors.blueText, fontSize: 12, marginTop: 2 },
  btn: { backgroundColor: '#fff', borderRadius: 10, paddingHorizontal: 10, paddingVertical: 6 },
  btnText: { color: colors.blueText, fontSize: 12, fontWeight: '600' },
});
