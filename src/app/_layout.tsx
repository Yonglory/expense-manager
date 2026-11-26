import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider, useAuth } from '../context/AuthContext';
import { Animal } from '../components/Animal';
import { Bob } from '../components/Motion';
import { colors } from '../lib/theme';

function Gate() {
  const { session, profile, loading } = useAuth();
  return (
    <>
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg } }}>
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
        <View style={s.splash}>
          <Bob>
            <Animal animal="bunny" size={96} />
          </Bob>
          <Text style={s.splashText}>Fluffing things up…</Text>
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

const s = StyleSheet.create({
  splash: {
    ...StyleSheet.absoluteFill, backgroundColor: colors.bg,
    alignItems: 'center', justifyContent: 'center', gap: 12,
  },
  splashText: { color: colors.sub, fontSize: 14 },
});
