import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { User, Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

interface AuthContextType {
  user: User | null;
  session: Session | null;
  isLoading: boolean;
  isVendor: boolean;
  isAdmin: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isVendor, setIsVendor] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    let mounted = true;
    let roleCheckId = 0;

    const checkRoles = async (userId: string) => {
      const currentId = ++roleCheckId;
      let adminResult = false;
      let vendorResult = false;

      try {
        const { data } = await supabase.rpc("has_role", {
          _user_id: userId,
          _role: "admin",
        });
        adminResult = !!data;
      } catch (e) {
        console.error("Admin role check error:", e);
      }

      try {
        const { data } = await supabase.rpc("has_role", {
          _user_id: userId,
          _role: "vendor",
        });
        vendorResult = !!data;
      } catch (e) {
        console.error("Vendor role check error:", e);
      }

      if (mounted && currentId === roleCheckId) {
        setIsAdmin(adminResult);
        setIsVendor(vendorResult);
        setIsLoading(false);
      }
    };

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (!mounted) return;
        setSession(session);
        setUser(session?.user ?? null);
        if (session?.user) {
          setIsLoading(true);
          checkRoles(session.user.id);
        } else {
          setIsAdmin(false);
          setIsVendor(false);
          setIsLoading(false);
        }
      }
    );

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!mounted) return;
      if (!session) {
        setIsLoading(false);
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider value={{ user, session, isLoading, isVendor, isAdmin, signOut }}>
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
