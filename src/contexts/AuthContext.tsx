import type { Session, User } from '@supabase/supabase-js';
import { useQueryClient } from '@tanstack/react-query';
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { isSupabaseConfigured, supabase } from '../lib/supabase';

interface AuthState {
  session: Session | null;
  user: User | null;
  loading: boolean;
  /** true right after the user opened a password-reset link */
  recovering: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, fullName: string) => Promise<{ needsConfirmation: boolean }>;
  signOut: () => Promise<void>;
  sendPasswordReset: (email: string) => Promise<void>;
  updatePassword: (password: string) => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

function friendlyAuthError(message: string): Error {
  if (/invalid login credentials/i.test(message)) return new Error('Incorrect e-mail or password.');
  if (/email not confirmed/i.test(message)) return new Error('Please confirm your e-mail address first — check your inbox for the link.');
  if (/user already registered/i.test(message)) return new Error('An account with this e-mail already exists. Try signing in.');
  if (/rate limit|too many/i.test(message)) return new Error('Too many attempts. Please wait a minute and try again.');
  if (/password should be|weak password/i.test(message)) return new Error('Password is too weak. Use at least 8 characters with letters and numbers.');
  if (/failed to fetch|network/i.test(message)) return new Error('Could not reach the authentication server. Check your connection.');
  return new Error(message);
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(isSupabaseConfigured);
  const [recovering, setRecovering] = useState(false);
  const qc = useQueryClient();

  useEffect(() => {
    if (!isSupabaseConfigured) return;
    let active = true;
    supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      setSession(data.session);
      setLoading(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((event, s) => {
      setSession(s);
      if (event === 'PASSWORD_RECOVERY') setRecovering(true);
      if (event === 'SIGNED_OUT') qc.clear();
    });
    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, [qc]);

  const value = useMemo<AuthState>(
    () => ({
      session,
      user: session?.user ?? null,
      loading,
      recovering,
      async signIn(email, password) {
        const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
        if (error) throw friendlyAuthError(error.message);
      },
      async signUp(email, password, fullName) {
        const { data, error } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: { data: { full_name: fullName.trim() }, emailRedirectTo: `${window.location.origin}/app` },
        });
        if (error) throw friendlyAuthError(error.message);
        return { needsConfirmation: !data.session };
      },
      async signOut() {
        await supabase.auth.signOut();
        qc.clear();
      },
      async sendPasswordReset(email) {
        const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
          redirectTo: `${window.location.origin}/reset-password`,
        });
        if (error) throw friendlyAuthError(error.message);
      },
      async updatePassword(password) {
        const { error } = await supabase.auth.updateUser({ password });
        if (error) throw friendlyAuthError(error.message);
        setRecovering(false);
      },
    }),
    [session, loading, recovering, qc],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}
