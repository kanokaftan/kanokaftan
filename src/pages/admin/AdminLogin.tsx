import { useEffect, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { KeyRound, Loader2, Shield } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { GoogleSignInButton, OrDivider } from "@/components/auth/GoogleSignInButton";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

/** /admin: sign in with an account, then unlock admin access with the admin secret key. */
export default function AdminLogin() {
  const { user, isLoading, rolesLoading, isAdmin, refreshRoles, signOut } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [adminKey, setAdminKey] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    document.title = "Admin - Kano Kaftan";
    const robots = document.createElement("meta");
    robots.name = "robots";
    robots.content = "noindex";
    document.head.appendChild(robots);
    return () => robots.remove();
  }, []);

  if (isLoading || (user && rolesLoading)) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  if (user && isAdmin) {
    return <Navigate to="/admin/dashboard" replace />;
  }

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    setBusy(false);
    if (error) toast.error(error.message);
  };

  const handleUnlock = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      const { data, error } = await supabase.functions.invoke("admin-unlock", {
        body: { action: "unlock", key: adminKey },
      });
      // Non-2xx responses carry the reason in the body.
      let message = data?.error as string | undefined;
      if (error && "context" in error && error.context instanceof Response) {
        message = (await error.context.json().catch(() => null))?.error ?? message;
      }
      if (error || !data?.success) throw new Error(message || "Could not unlock admin access");

      setAdminKey("");
      await refreshRoles();
      toast.success("Admin access unlocked for 12 hours");
      navigate("/admin/dashboard", { replace: true });
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Could not unlock admin access");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/40 px-4">
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center">
          <Shield className="mx-auto mb-2 h-8 w-8 text-primary" />
          <CardTitle>Kano Kaftan Admin</CardTitle>
          <CardDescription>
            {user ? `Signed in as ${user.email}. Enter the admin key to continue.` : "Sign in with your account."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!user ? (
            <>
            <GoogleSignInButton returnPath="/admin" />
            <OrDivider />
            <form onSubmit={handleSignIn} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="admin-email">Email</Label>
                <Input id="admin-email" type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="admin-password">Password</Label>
                <Input id="admin-password" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
              </div>
              <Button type="submit" className="w-full" disabled={busy}>
                {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Sign in
              </Button>
            </form>
            </>
          ) : (
            <form onSubmit={handleUnlock} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="admin-key">Admin key</Label>
                <Input
                  id="admin-key"
                  type="password"
                  autoComplete="off"
                  value={adminKey}
                  onChange={(e) => setAdminKey(e.target.value)}
                  required
                />
              </div>
              <Button type="submit" className="w-full" disabled={busy || !adminKey}>
                {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <KeyRound className="mr-2 h-4 w-4" />}
                Unlock admin
              </Button>
              <Button type="button" variant="ghost" className="w-full" onClick={() => signOut("/admin")}>
                Use a different account
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
