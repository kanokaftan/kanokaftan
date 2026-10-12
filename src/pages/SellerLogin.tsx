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
import { useTranslation } from "react-i18next";
import { LanguageToggle } from "@/components/LanguageToggle";

/** Seller sign-in: separate from the customer sign-in, email + password only. */
export default function SellerLogin() {
  const { t } = useTranslation();
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
          throw new Error(t("seller.login.confirmEmail"));
        }
        if (/invalid login credentials/i.test(error.message)) throw new Error(t("seller.login.wrongPassword"));
        throw error;
      }
    } catch (error: unknown) {
      console.error("[SellerLogin] sign in failed", error);
      toast.error(error instanceof Error ? error.message : t("seller.login.failed"));
    } finally {
      setBusy(false);
    }
  };

  const handleForgot = async () => {
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) return toast.error(t("seller.login.enterEmailFirst"));
    setBusy(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: `${window.location.origin}/auth?mode=reset`,
      });
      if (error) throw error;
      setResetSent(true);
      toast.success(t("seller.login.resetEmailSent"));
    } catch (error: unknown) {
      console.error("[SellerLogin] reset email failed", error);
      toast.error(error instanceof Error ? error.message : t("seller.login.resetFailed"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/30 px-4 py-10">
      <div className="w-full max-w-md space-y-6">
        <div className="flex justify-end">
          <LanguageToggle />
        </div>
        <Link to="/" className="flex items-center justify-center gap-2">
          <BrandLogo alt="" className="h-10 w-10" />
          <span className="font-display text-xl font-bold text-primary">Kano Kaftan</span>
          <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium">{t("seller.sellers")}</span>
        </Link>

        <Card>
          <CardHeader>
            <CardTitle>{t("seller.login.title")}</CardTitle>
            <CardDescription>{t("seller.login.subtitle")}</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSignIn} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">{t("seller.login.email")}</Label>
                <Input id="email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="password">{t("seller.login.password")}</Label>
                  <button type="button" onClick={handleForgot} className="text-xs text-muted-foreground hover:text-primary hover:underline">
                    {resetSent ? t("seller.login.resetSent") : t("seller.login.forgot")}
                  </button>
                </div>
                <div className="relative">
                  <Input id="password" type={showPassword ? "text" : "password"} autoComplete="current-password"
                    value={password} onChange={(e) => setPassword(e.target.value)} required />
                  <Button type="button" variant="ghost" size="icon" className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                    onClick={() => setShowPassword((s) => !s)} aria-label={showPassword ? t("seller.apply.hidePassword") : t("seller.apply.showPassword")}>
                    {showPassword ? <EyeOff className="h-4 w-4 text-muted-foreground" /> : <Eye className="h-4 w-4 text-muted-foreground" />}
                  </Button>
                </div>
              </div>
              <Button type="submit" className="w-full" disabled={busy || (!!user && rolesLoading)}>
                {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {t("seller.login.submit")}
              </Button>
            </form>
          </CardContent>
        </Card>

        <p className="text-center text-sm text-muted-foreground">
          {t("seller.login.newSeller")} <Link to="/sell" className="font-medium text-primary hover:underline">{t("seller.login.applyLink")}</Link>
          {" · "}
          <Link to="/auth" className="hover:underline">{t("seller.login.customerSignIn")}</Link>
        </p>
      </div>
    </div>
  );
}
