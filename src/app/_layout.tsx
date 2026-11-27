import React, { useEffect } from 'react';
import { NotoSansMyanmar_400Regular, NotoSansMyanmar_700Bold, useFonts } from '@expo-google-fonts/noto-sans-myanmar';
import { StyleSheet, View } from 'react-native';
import { Stack, usePathname, useRootNavigationState, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider, useAuth } from '../context/AuthContext';
import { Loading } from '../components/Loading';
import { initNotifications } from '../lib/reminders';
import { initOffline } from '../lib/offline';
import { I18nProvider, useI18n } from '../i18n/I18nContext';
import { LanguagePicker } from '../components/LanguagePicker';
import { colors } from '../lib/theme';

initNotifications();

function Gate() {
  const { session, profile, loading } = useAuth();
  const { t, ready, chosen } = useI18n();
  const [fontsLoaded, fontError] = useFonts({ NotoSansMyanmar_400Regular, NotoSansMyanmar_700Bold });
  useEffect(() => {
    initOffline();
  }, []);
  const starting = loading || !ready || !(fontsLoaded || fontError);
  const router = useRouter();
  const pathname = usePathname();
  const navReady = !!useRootNavigationState()?.key;

  // Belt and braces: always land on the screen that matches the sign-in state (fixes sign out sticking).
  useEffect(() => {
    if (!navReady || starting) return;
    if (!session) {
      if (pathname !== '/auth') router.replace('/auth');
    } else if (!profile) {
      if (pathname !== '/setup') router.replace('/setup');
    } else if (pathname === '/auth' || pathname === '/setup') {
      router.replace('/');
    }
  }, [navReady, starting, session, profile, pathname, router]);

  return (
    <>
      <Stack screenOptions={{ headerShown: false, animation: 'fade_from_bottom', contentStyle: { backgroundColor: colors.bg } }}>
        <Stack.Protected guard={!session}>
          <Stack.Screen name="auth" />
        </Stack.Protected>
        <Stack.Protected guard={!!session && !profile}>
          <Stack.Screen name="setup" />
        </Stack.Protected>
        <Stack.Protected guard={!!session && !!profile}>
          <Stack.Screen name="index" />
          <Stack.Screen name="chart" />
          <Stack.Screen name="household" />
          <Stack.Screen name="bills" />
          <Stack.Screen name="shopping" />
        </Stack.Protected>
      </Stack>
      {ready && !chosen && fontsLoaded && <LanguagePicker />}
      {starting && (
        <View style={StyleSheet.absoluteFill}>
          <Loading message={t.fluffing} />
        </View>
      )}
    </>
  );
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <StatusBar style="dark" />
      <I18nProvider>
        <AuthProvider>
          <Gate />
        </AuthProvider>
      </I18nProvider>
    </SafeAreaProvider>
  );
}
