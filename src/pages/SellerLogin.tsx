import { useEffect, useState } from "react";
import { BrandLogo } from "@/components/brand/BrandLogo";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

/** Seller sign-in: separate from the customer sign-in, email + password only. */
export default function SellerLogin() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user, isVendor, isLoading, rolesLoading } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [resetSent, setResetSent] = useState(false);

  const target = searchParams.get("redirect")?.startsWith("/vendor/") ? searchParams.get("redirect")! : "/vendor/dashboard";

  // Once signed in: sellers go to their dashboard, everyone else to their application.
  useEffect(() => {
    if (isLoading || !user || rolesLoading) return;
    navigate(isVendor ? target : "/sell", { replace: true });
  }, [isLoading, user, rolesLoading, isVendor, target, navigate]);

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
      if (error) {
        if (/email not confirmed/i.test(error.message)) {
          throw new Error("Please confirm your email first. Check your inbox for the link we sent.");
        }
        if (/invalid login credentials/i.test(error.message)) throw new Error("Wrong email or password");
        throw error;
      }
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : "Could not sign in");
    } finally {
      setBusy(false);
    }
  };

  const handleForgot = async () => {
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) return toast.error("Enter your email above first");
    setBusy(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: `${window.location.origin}/auth?mode=reset`,
      });
      if (error) throw error;
      setResetSent(true);
      toast.success("Check your email for a link to reset your password");
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : "Could not send the reset email");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/30 px-4 py-10">
      <div className="w-full max-w-md space-y-6">
        <Link to="/" className="flex items-center justify-center gap-2">
          <BrandLogo alt="" className="h-10 w-10" />
          <span className="font-display text-xl font-bold text-primary">Kano Kaftan</span>
          <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">Sellers</span>
        </Link>

        <Card>
          <CardHeader>
            <CardTitle>Seller sign in</CardTitle>
            <CardDescription>Manage your shop, products, orders and payouts.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSignIn} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input id="email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="password">Password</Label>
                  <button type="button" onClick={handleForgot} className="text-xs text-muted-foreground hover:text-primary hover:underline">
                    {resetSent ? "Reset link sent" : "Forgot password?"}
                  </button>
                </div>
                <div className="relative">
                  <Input id="password" type={showPassword ? "text" : "password"} autoComplete="current-password"
                    value={password} onChange={(e) => setPassword(e.target.value)} required />
                  <Button type="button" variant="ghost" size="icon" className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                    onClick={() => setShowPassword((s) => !s)} aria-label={showPassword ? "Hide password" : "Show password"}>
                    {showPassword ? <EyeOff className="h-4 w-4 text-muted-foreground" /> : <Eye className="h-4 w-4 text-muted-foreground" />}
                  </Button>
                </div>
              </div>
              <Button type="submit" className="w-full" disabled={busy || (!!user && rolesLoading)}>
                {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Sign in
              </Button>
            </form>
          </CardContent>
        </Card>

        <p className="text-center text-sm text-muted-foreground">
          New seller? <Link to="/sell" className="font-medium text-primary hover:underline">Apply to sell</Link>
          {" · "}
          <Link to="/auth" className="hover:underline">Customer sign in</Link>
        </p>
      </div>
    </div>
  );
}
