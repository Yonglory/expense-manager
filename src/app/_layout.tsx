import React, { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import { Stack, usePathname, useRootNavigationState, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider, useAuth } from '../context/AuthContext';
import { Loading } from '../components/Loading';
import { colors } from '../lib/theme';

function Gate() {
  const { session, profile, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const navReady = !!useRootNavigationState()?.key;

  // Belt and braces: always land on the screen that matches the sign-in state (fixes sign out sticking).
  useEffect(() => {
    if (!navReady || loading) return;
    if (!session) {
      if (pathname !== '/auth') router.replace('/auth');
    } else if (!profile) {
      if (pathname !== '/setup') router.replace('/setup');
    } else if (pathname === '/auth' || pathname === '/setup') {
      router.replace('/');
    }
  }, [navReady, loading, session, profile, pathname, router]);

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
        </Stack.Protected>
      </Stack>
      {loading && (
        <View style={StyleSheet.absoluteFill}>
          <Loading message="Fluffing things up…" />
        </View>
      )}
    </>
  );
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <StatusBar style="dark" />
      <AuthProvider>
        <Gate />
      </AuthProvider>
    </SafeAreaProvider>
  );
}
