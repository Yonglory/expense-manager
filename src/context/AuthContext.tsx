import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { AppState } from 'react-native';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import type { AnimalId, Household, Profile } from '../lib/types';

type SignUpArgs = { name: string; email: string; password: string; animal: AnimalId; joinCode?: string };

type Ctx = {
  session: Session | null;
  profile: Profile | null;
  household: Household | null;
  members: Profile[];
  loading: boolean;
  setupError: string | null;
  signIn: (email: string, password: string) => Promise<string | null>;
  signUp: (a: SignUpArgs) => Promise<{ error?: string; needsConfirm?: boolean }>;
  signOut: () => Promise<void>;
  reload: () => Promise<void>;
  retrySetup: (joinCode: string | null) => Promise<void>;
  setAnimal: (animal: AnimalId) => Promise<string | null>;
};

const AuthCtx = createContext<Ctx | null>(null);

export function useAuth(): Ctx {
  const c = useContext(AuthCtx);
  if (!c) throw new Error('useAuth must be used inside AuthProvider');
  return c;
}

function friendly(msg: string): string {
  if (/invalid login/i.test(msg)) return "That email and password don't match. Try again.";
  if (/already registered/i.test(msg)) return 'That email already has an account. Try signing in.';
  if (/password/i.test(msg) && /characters/i.test(msg)) return 'Use a password with at least 6 characters.';
  if (/email not confirmed/i.test(msg)) return 'Confirm your email first, then sign in.';
  return msg;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [household, setHousehold] = useState<Household | null>(null);
  const [members, setMembers] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [setupError, setSetupError] = useState<string | null>(null);

  const loadTicket = useRef(0);

  const loadProfile = useCallback(async (sess: Session | null) => {
    const ticket = ++loadTicket.current;
    const stale = () => ticket !== loadTicket.current;
    try {
      if (!sess) {
        setProfile(null);
        setHousehold(null);
        setMembers([]);
        setSetupError(null);
        return;
      }
      const first = await supabase.from('profiles').select('*').eq('id', sess.user.id).maybeSingle();
      if (first.error) throw first.error;
      let p = first.data;
      if (!p) {
        // First sign-in after sign-up: create the profile + household (or join by code).
        const m = (sess.user.user_metadata ?? {}) as Record<string, any>;
        const { error } = await supabase.rpc('setup_profile', {
          p_name: m.display_name ?? '',
          p_animal: m.animal ?? 'bunny',
          p_join_code: m.join_code ?? null,
        });
        if (error) throw error;
        const res = await supabase.from('profiles').select('*').eq('id', sess.user.id).maybeSingle();
        if (res.error) throw res.error;
        p = res.data;
      }
      if (!p) throw new Error('Your profile could not be created. Tap Try again.');
      const [h, ms] = await Promise.all([
        supabase.from('households').select('*').eq('id', p.household_id).maybeSingle(),
        supabase.from('profiles').select('*').eq('household_id', p.household_id).order('created_at'),
      ]);
      if (h.error) throw h.error;
      if (ms.error) throw ms.error;
      if (stale()) return;
      setSetupError(null);
      setHousehold((h.data as Household) ?? null);
      setMembers((ms.data ?? []) as Profile[]);
      setProfile(p as Profile);
    } catch (err: any) {
      if (stale()) return;
      const raw = String(err?.message ?? err);
      const denied = err?.code === '42501' || /permission denied/i.test(raw);
      setSetupError(
        denied
          ? 'Your database needs permission to share its tables with the app. Run supabase/fix-grants.sql in the Supabase SQL Editor, then tap Try again.'
          : raw,
      );
      setProfile(null);
    }
  }, []);

  useEffect(() => {
    let alive = true;
    supabase.auth.getSession().then(async ({ data }) => {
      if (!alive) return;
      setSession(data.session);
      await loadProfile(data.session);
      if (alive) setLoading(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
      // Not awaited inside the callback, per Supabase guidance.
      setTimeout(() => {
        loadProfile(s);
      }, 0);
    });
    return () => {
      alive = false;
      sub.subscription.unsubscribe();
    };
  }, [loadProfile]);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active') supabase.auth.startAutoRefresh();
      else supabase.auth.stopAutoRefresh();
    });
    return () => sub.remove();
  }, []);

  const value = useMemo<Ctx>(
    () => ({
      session,
      profile,
      household,
      members,
      loading,
      setupError,
      signIn: async (email, password) => {
        const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
        return error ? friendly(error.message) : null;
      },
      signUp: async ({ name, email, password, animal, joinCode }) => {
        const { data, error } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: { data: { display_name: name.trim(), animal, join_code: joinCode?.trim() || null } },
        });
        if (error) return { error: friendly(error.message) };
        return { needsConfirm: !data.session };
      },
      signOut: async () => {
        // Clear everything right away so the screen switches instantly, even if the network is slow.
        loadTicket.current++;
        setSession(null);
        setProfile(null);
        setHousehold(null);
        setMembers([]);
        setSetupError(null);
        try {
          await supabase.auth.signOut();
        } catch {
          await supabase.auth.signOut({ scope: 'local' });
        }
      },
      reload: async () => {
        await loadProfile(session);
      },
      retrySetup: async (joinCode) => {
        await supabase.auth.updateUser({ data: { join_code: joinCode } });
        const { data } = await supabase.auth.getSession();
        await loadProfile(data.session);
      },
      setAnimal: async (animal) => {
        if (!profile) return null;
        const { error } = await supabase.from('profiles').update({ animal }).eq('id', profile.id);
        if (error) return error.message;
        await loadProfile(session);
        return null;
      },
    }),
    [session, profile, household, members, loading, setupError, loadProfile],
  );

  return <AuthCtx.Provider value={value}>{children}</AuthCtx.Provider>;
}
