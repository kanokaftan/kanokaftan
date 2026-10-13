import { createContext, useContext, useEffect, useRef, useState, ReactNode } from "react";
import { User, Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { signOutThisDevice } from "@/lib/signOut";

interface AuthContextType {
  user: User | null;
  session: Session | null;
  isLoading: boolean;
  isVendor: boolean;
  isAdmin: boolean;
  rolesLoading: boolean;
  refreshRoles: () => Promise<void>;
  signOut: (redirectTo?: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isVendor, setIsVendor] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [rolesLoading, setRolesLoading] = useState(true);
  const mounted = useRef(true);
  // Only the latest role check may write state, so a slow earlier check can't
  // overwrite the roles of whoever signed in after it.
  const roleCheckId = useRef(0);

  const loadRoles = async (userId: string) => {
    const currentId = ++roleCheckId.current;
    setRolesLoading(true);
    const check = async (role: "vendor" | "admin") => {
      try {
        const { data } = await supabase.rpc("has_role", { _user_id: userId, _role: role });
        return !!data;
      } catch (e) {
        console.error(`Error checking ${role} role:`, e);
        return false;
      }
    };
    const [vendor, admin] = await Promise.all([check("vendor"), check("admin")]);
    if (mounted.current && currentId === roleCheckId.current) {
      setIsVendor(vendor);
      setIsAdmin(admin);
      setRolesLoading(false);
    }
  };

  useEffect(() => {
    mounted.current = true;

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!mounted.current) return;
      setSession(session);
      setUser(session?.user ?? null);
      setIsLoading(false);

      if (session?.user) {
        // Defer the RPC so it doesn't run inside the auth callback (supabase-js deadlock).
        const userId = session.user.id;
        setRolesLoading(true);
        setTimeout(() => loadRoles(userId), 0);
      } else {
        roleCheckId.current++;
        setIsVendor(false);
        setIsAdmin(false);
        setRolesLoading(false);
      }
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!mounted.current) return;
      setSession(session);
      setUser(session?.user ?? null);
      setIsLoading(false);
      if (session?.user) loadRoles(session.user.id);
      else setRolesLoading(false);
    });

    return () => {
      mounted.current = false;
      subscription.unsubscribe();
    };
  }, []);

  const refreshRoles = async () => {
    const { data } = await supabase.auth.getUser();
    if (data.user) await loadRoles(data.user.id);
  };

  const signOut = (redirectTo = "/") => signOutThisDevice({ redirectTo });

  return (
    <AuthContext.Provider value={{ user, session, isLoading, isVendor, isAdmin, rolesLoading, refreshRoles, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
