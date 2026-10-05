import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";

import { supabase } from "@/integrations/supabase/client";

interface AuthContextValue {
  session: Session | null;
  user: User | null;
  loading: boolean;
}

const AuthContext = createContext<AuthContextValue>({
  session: null,
  user: null,
  loading: true,
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    let subscription: { subscription: { unsubscribe: () => void } } | null = null;

    try {
      const auth = supabase.auth;
      const result = auth.onAuthStateChange((_event, nextSession) => {
        if (!active) return;
        setSession(nextSession);
        setLoading(false);
      });
      subscription = result.data;

      void auth.getSession()
        .then(({ data }) => {
          if (!active) return;
          setSession(data.session);
        })
        .catch((error) => {
          // Authentication must not be able to take down the public shell.
          // The auth screen will surface actionable errors when an operation
          // actually requires Supabase.
          console.error("[Supabase] Could not restore session", error);
        })
        .finally(() => {
          if (active) setLoading(false);
        });
    } catch (error) {
      console.error("[Supabase] Could not initialize auth", error);
      if (active) setLoading(false);
    }

    return () => {
      active = false;
      subscription?.subscription.unsubscribe();
    };
  }, []);

  const value = useMemo(
    () => ({ session, user: session?.user ?? null, loading }),
    [session, loading],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}