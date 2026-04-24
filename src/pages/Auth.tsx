import { useState, useEffect } from "react";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useTranslation } from "react-i18next";

const authSchema = z.object({
  email: z.string().email("Please enter a valid email"),
  password: z.string().min(6, "Password must be at least 6 characters"),
  full_name: z.string().optional(),
});

type AuthFormData = z.infer<typeof authSchema>;
type AuthMode = "login" | "register" | "forgot" | "reset";

export default function AuthPage() {
  const { t } = useTranslation();
  const [searchParams] = useSearchParams();
  const [mode, setMode] = useState<AuthMode>(() => {
    if (searchParams.get("mode") === "register") return "register";
    if (typeof window !== "undefined" && window.location.hash.includes("type=recovery")) return "reset";
    return "login";
  });
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [forgotEmail, setForgotEmail] = useState("");
  const [forgotSent, setForgotSent] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const navigate = useNavigate();
  const { toast } = useToast();
  const redirectTo = searchParams.get("redirect") || "/";

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<AuthFormData>({
    resolver: zodResolver(authSchema),
  });

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) navigate(redirectTo);
    };
    checkAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (event === "SIGNED_IN" && session) navigate(redirectTo);
      }
    );

    return () => subscription.unsubscribe();
  }, [navigate, redirectTo]);

  const onSubmit = async (data: AuthFormData) => {
    setIsLoading(true);
    try {
      if (mode === "register") {
        const { error } = await supabase.auth.signUp({
          email: data.email,
          password: data.password,
          options: {
            emailRedirectTo: `${window.location.origin}/`,
            data: { full_name: data.full_name || "" },
          },
        });

        if (error) {
          if (error.message.includes("already registered")) {
            toast({
              title: "Account exists",
              description: "This email is already registered. Please sign in.",
              variant: "destructive",
            });
            setMode("login");
          } else throw error;
        } else {
          toast({
            title: "Account created!",
            description: "Welcome to Kano Kaftan!",
          });
          navigate("/");
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email: data.email,
          password: data.password,
        });

        if (error) {
          toast({
            title: "Invalid credentials",
            description: "Please check your email and password.",
            variant: "destructive",
          });
        } else {
          toast({
            title: "Welcome back!",
            description: "You're now signed in.",
          });
        }
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Something went wrong. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!forgotEmail) return;
    setIsLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(forgotEmail, {
        redirectTo: `${window.location.origin}/auth?mode=reset`,
      });
      if (error) throw error;
      setForgotSent(true);
    } catch (error: any) {
      toast({ title: "Error", description: error.message || "Could not send reset email.", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPassword || newPassword.length < 6) return;
    setIsLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
      toast({ title: "Password updated!", description: "You can now sign in with your new password." });
      setMode("login");
      setNewPassword("");
    } catch (error: any) {
      toast({ title: "Error", description: error.message || "Could not update password.", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen">
      {/* Left Panel - Form */}
      <div className="flex w-full flex-col justify-center px-6 py-12 lg:w-1/2 lg:px-16">
        <div className="mx-auto w-full max-w-md">
          {/* Logo */}
          <Link to="/" className="mb-8 flex items-center gap-3">
            <img src="/logo.png" alt="Kano Kaftan" className="h-12 w-12 object-contain" />
            <div>
              <span className="font-display text-2xl font-bold text-primary">Kano Kaftan</span>
            </div>
          </Link>

          <h1 className="font-display text-2xl font-bold text-primary">
            {mode === "login" ? t("auth.welcomeBack") :
             mode === "register" ? t("auth.createAccount") :
             mode === "forgot" ? t("auth.resetPassword") :
             t("auth.setNewPassword")}
          </h1>
          <p className="mt-2 text-muted-foreground">
            {mode === "login" ? t("auth.signInSubtitle") :
             mode === "register" ? t("auth.registerSubtitle") :
             mode === "forgot" ? t("auth.forgotSubtitle") :
             t("auth.resetSubtitle")}
          </p>

          {/* Forgot password form */}
          {mode === "forgot" && (
            <div className="mt-8">
              {forgotSent ? (
                <div className="rounded-xl bg-green-50 border border-green-200 p-4 text-center">
                  <p className="font-medium text-green-800 mb-1">{t("auth.checkEmail")}</p>
                  <p className="text-sm text-green-700">{t("auth.resetEmailSent")} <strong>{forgotEmail}</strong>.</p>
                  <button
                    type="button"
                    onClick={() => { setMode("login"); setForgotSent(false); }}
                    className="mt-4 text-sm font-medium text-primary hover:underline"
                  >
                    {t("auth.backToSignIn")}
                  </button>
                </div>
              ) : (
                <form onSubmit={handleForgotPassword} className="space-y-6">
                  <div className="space-y-2">
                    <Label htmlFor="forgot-email">{t("auth.email")}</Label>
                    <Input
                      id="forgot-email"
                      type="email"
                      placeholder="you@example.com"
                      value={forgotEmail}
                      onChange={(e) => setForgotEmail(e.target.value)}
                      required
                    />
                  </div>
                  <Button type="submit" className="w-full" disabled={isLoading}>
                    {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    {t("auth.sendResetLink")}
                  </Button>
                  <p className="text-center text-sm text-muted-foreground">
                    <button type="button" className="font-medium text-primary hover:underline" onClick={() => setMode("login")}>
                      {t("auth.backToSignIn")}
                    </button>
                  </p>
                </form>
              )}
            </div>
          )}

          {/* Reset password form */}
          {mode === "reset" && (
            <form onSubmit={handleResetPassword} className="mt-8 space-y-6">
              <div className="space-y-2">
                <Label htmlFor="new-password">{t("auth.newPassword")}</Label>
                <div className="relative">
                  <Input
                    id="new-password"
                    type={showPassword ? "text" : "password"}
                    placeholder="Min. 6 characters"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    required
                    minLength={6}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4 text-muted-foreground" /> : <Eye className="h-4 w-4 text-muted-foreground" />}
                  </Button>
                </div>
              </div>
              <Button type="submit" className="w-full" disabled={isLoading || newPassword.length < 6}>
                {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {t("auth.setPassword")}
              </Button>
            </form>
          )}

          {/* Login / Register form */}
          {(mode === "login" || mode === "register") && (
          <>
          <form onSubmit={handleSubmit(onSubmit)} className="mt-8 space-y-6">
            {mode === "register" && (
              <div className="space-y-2">
                <Label htmlFor="full_name">{t("auth.fullName")}</Label>
                <Input
                  id="full_name"
                  placeholder="Enter your full name"
                  {...register("full_name")}
                />
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="email">{t("auth.email")}</Label>
              <Input
                id="email"
                type="email"
                placeholder="you@example.com"
                {...register("email")}
              />
              {errors.email && (
                <p className="text-sm text-destructive">{errors.email.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">{t("auth.password")}</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••"
                  {...register("password")}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <Eye className="h-4 w-4 text-muted-foreground" />
                  )}
                </Button>
              </div>
              {errors.password && (
                <p className="text-sm text-destructive">{errors.password.message}</p>
              )}
            </div>

            {mode === "login" && (
              <div className="text-right -mt-2">
                <button
                  type="button"
                  className="text-sm text-muted-foreground hover:text-primary hover:underline"
                  onClick={() => setMode("forgot")}
                >
                  {t("auth.forgotPassword")}
                </button>
              </div>
            )}

            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {mode === "login" ? t("auth.signIn") : t("auth.signUp")}
            </Button>
          </form>

          <p className="mt-6 text-center text-sm text-muted-foreground">
            {mode === "login" ? (
              <>
                {t("auth.noAccount")}{" "}
                <button
                  type="button"
                  className="font-medium text-primary hover:underline"
                  onClick={() => setMode("register")}
                >
                  {t("auth.signUpLink")}
                </button>
              </>
            ) : (
              <>
                {t("auth.hasAccount")}{" "}
                <button
                  type="button"
                  className="font-medium text-primary hover:underline"
                  onClick={() => setMode("login")}
                >
                  {t("auth.signInLink")}
                </button>
              </>
            )}
          </p>
          </>
          )}
        </div>
      </div>

      {/* Right Panel - Decorative */}
      <div className="hidden bg-primary lg:flex lg:w-1/2 lg:items-center lg:justify-center">
        <div className="max-w-md px-8 text-center text-primary-foreground">
          <h2 className="font-display text-4xl font-bold">
            {t("home.traditionalExcellence")}<br />{t("home.modernConvenience")}
          </h2>
          <p className="mt-4 text-lg text-primary-foreground/80">
            {t("home.authDescription")}
          </p>
        </div>
      </div>
    </div>
  );
}
