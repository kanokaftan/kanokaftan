import { useState, useEffect, useRef } from "react";
import { BrandLogo } from "@/components/brand/BrandLogo";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { CheckCircle2, Eye, EyeOff, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { GoogleSignInButton, OrDivider } from "@/components/auth/GoogleSignInButton";
import { AccountTypeSwitch, ACCOUNT_TYPES, type AccountType } from "@/components/auth/AccountTypeSwitch";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useCart } from "@/hooks/useCart";
import { useTranslation } from "react-i18next";

const authSchema = z.object({
  email: z.string().email("Please enter a valid email"),
  password: z.string().min(6, "Password must be at least 6 characters"),
  full_name: z.string().optional(),
  phone: z.string().optional(),
});

const PHONE_PATTERN = /^(\+?234|0)[789][01]\d{8}$/;

type AuthFormData = z.infer<typeof authSchema>;
type AuthMode = "login" | "register" | "forgot" | "reset";

/** Ambassadors use a normal account, then fill in the ambassador form. */
const AMBASSADOR_JOIN_PATH = "/ambassadors/join";
/** The last "I'm here to" choice on this phone, so a returning seller lands on Sell. */
const ACCOUNT_TYPE_KEY = "kk_account_type";

function rememberedAccountType(): AccountType | null {
  try {
    const saved = localStorage.getItem(ACCOUNT_TYPE_KEY);
    return ACCOUNT_TYPES.includes(saved as AccountType) ? (saved as AccountType) : null;
  } catch {
    return null; // storage blocked (private mode)
  }
}

function rememberAccountType(value: AccountType) {
  try {
    localStorage.setItem(ACCOUNT_TYPE_KEY, value);
  } catch {
    // storage blocked: the choice just isn't remembered
  }
}

function isRecoveryLink() {
  return typeof window !== "undefined" && window.location.hash.includes("type=recovery");
}

export default function AuthPage() {
  const { t } = useTranslation();
  const [searchParams] = useSearchParams();
  const [mode, setMode] = useState<AuthMode>(() => {
    if (isRecoveryLink() || searchParams.get("mode") === "reset") return "reset";
    if (searchParams.get("mode") === "register") return "register";
    return "login";
  });
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [forgotEmail, setForgotEmail] = useState("");
  const [forgotSent, setForgotSent] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const navigate = useNavigate();
  const { toast } = useToast();
  const { mergeSessionCart } = useCart();

  // While the user is setting a new password from a recovery link they already
  // have a session, so we must not redirect them away from this page.
  const modeRef = useRef(mode);
  modeRef.current = mode;

  // Only same-site paths: "/orders" is fine, "//evil.com" or "https://…" is not.
  const requestedRedirect = searchParams.get("redirect");
  const safeRedirect = requestedRedirect && requestedRedirect.startsWith("/") && !requestedRedirect.startsWith("//") && !requestedRedirect.startsWith("/\\")
    ? requestedRedirect
    : "/";

  // Who the account is for (?as=sell|ambassador). Coming from the ambassador page means ambassador.
  const [accountType, setAccountTypeState] = useState<AccountType>(() => {
    const as = searchParams.get("as");
    if (ACCOUNT_TYPES.includes(as as AccountType)) return as as AccountType;
    if (safeRedirect.startsWith(AMBASSADOR_JOIN_PATH)) return "ambassador";
    // Someone sent here to finish something (checkout, a shop) is shopping.
    if (safeRedirect !== "/") return "shop";
    return rememberedAccountType() ?? "shop";
  });
  const setAccountType = (value: AccountType) => {
    setAccountTypeState(value);
    rememberAccountType(value);
  };
  const redirectTo = accountType === "ambassador" ? AMBASSADOR_JOIN_PATH : safeRedirect;

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<AuthFormData>({
    resolver: zodResolver(authSchema),
  });

  useEffect(() => {
    // Check vendor role and redirect appropriately
    const checkVendorAndRedirect = async (userId: string) => {
      const { data } = await supabase.rpc("has_role", {
        _user_id: userId,
        _role: "vendor",
      });
      if (data) {
        navigate("/vendor/dashboard");
      } else {
        navigate(redirectTo);
      }
    };

    // Check if user is already logged in
    const checkAuth = async () => {
      const isResetting = () => modeRef.current === "reset";
      if (isResetting()) return;
      const { data: { session } } = await supabase.auth.getSession();
      // Mode may have switched to "reset" while we were waiting
      if (session && !isResetting()) {
        await mergeSessionCart(session.user.id);
        await checkVendorAndRedirect(session.user.id);
      }
    };
    checkAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (event === "PASSWORD_RECOVERY") {
          setMode("reset");
          return;
        }
        if (event === "SIGNED_IN" && session && modeRef.current !== "reset") {
          // Merge cart then redirect
          setTimeout(async () => {
            await mergeSessionCart(session.user.id);
            await checkVendorAndRedirect(session.user.id);
          }, 0);
        }
      }
    );

    return () => subscription.unsubscribe();
  }, [navigate, mergeSessionCart, redirectTo]);

  const onSubmit = async (data: AuthFormData) => {
    setIsLoading(true);

    try {
      if (mode === "register") {
        const phone = (data.phone ?? "").replace(/[\s-]/g, "");
        if (!data.full_name?.trim()) {
          setError("full_name", { message: "Enter your full name" });
          return;
        }
        if (!PHONE_PATTERN.test(phone)) {
          setError("phone", { message: "Enter a valid Nigerian phone number, e.g. 0803 123 4567" });
          return;
        }
        const redirectUrl = `${window.location.origin}${redirectTo}`;

        const { error } = await supabase.auth.signUp({
          email: data.email,
          password: data.password,
          options: {
            emailRedirectTo: redirectUrl,
            data: {
              full_name: data.full_name.trim(),
              phone,
            },
          },
        });

        if (error) {
          if (error.message.includes("already registered")) {
            toast({
              title: "Account exists",
              description: "This email is already registered. Please sign in instead.",
              variant: "destructive",
            });
            setMode("login");
          } else {
            throw error;
          }
        } else {
          toast({
            title: "Account created!",
            description: "Welcome to K² - you're now signed in.",
          });
          navigate(redirectTo);
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email: data.email,
          password: data.password,
        });

        if (error) {
          if (error.message.includes("Invalid login credentials")) {
            toast({
              title: "Invalid credentials",
              description: "Please check your email and password.",
              variant: "destructive",
            });
          } else {
            throw error;
          }
        } else {
          toast({
            title: "Welcome back!",
            description: "You've successfully signed in.",
          });
          // Auth state change listener will handle the redirect
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
      toast({ title: "Password updated!", description: "You're signed in with your new password." });
      setNewPassword("");
      // The recovery session is a normal session: continue as a signed-in user.
      const { data: { session } } = await supabase.auth.getSession();
      setMode("login");
      if (session) {
        await mergeSessionCart(session.user.id);
        const { data: isVendor } = await supabase.rpc("has_role", {
          _user_id: session.user.id,
          _role: "vendor",
        });
        navigate(isVendor ? "/vendor/dashboard" : redirectTo);
      }
    } catch (error: any) {
      toast({ title: "Error", description: error.message || "Could not update password.", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  const showLoginRegister = mode === "login" || mode === "register";

  return (
    <div className="flex min-h-screen">
      {/* Left Panel - Form */}
      <div className="flex w-full flex-col justify-start px-6 py-8 lg:w-1/2 lg:justify-center lg:px-16">
        <div className="mx-auto w-full max-w-md">
          {/* Logo */}
          <Link to="/" className="mb-6 flex items-center gap-3">
            <BrandLogo alt="K² Kano Kaftan" className="h-12 w-12" />
            <div>
              <span className="font-display text-2xl font-bold text-primary">K²</span>
              <span className="font-display text-lg ml-1">Kano Kaftan</span>
            </div>
          </Link>

          {showLoginRegister && (
            <div className="mb-6">
              <p className="mb-2 text-sm font-medium text-muted-foreground">{t("auth.typeQuestion", "I'm here to")}</p>
              <AccountTypeSwitch value={accountType} onChange={setAccountType} />
            </div>
          )}

          <h1 className="font-display text-2xl font-bold text-primary">
            {showLoginRegister && accountType === "sell" ? t("auth.sellTitle", "Sell on Kano Kaftan") :
             showLoginRegister && accountType === "ambassador" ? t("auth.ambassadorTitle", "Become an ambassador") :
             mode === "login" ? t("auth.welcomeBack") :
             mode === "register" ? t("auth.createAccount") :
             mode === "forgot" ? t("auth.resetPassword") :
             t("auth.setNewPassword")}
          </h1>
          <p className="mt-2 text-muted-foreground">
            {showLoginRegister && accountType === "sell" ? t("auth.sellSubtitle") :
             showLoginRegister && accountType === "ambassador"
               ? (mode === "register" ? t("auth.ambassadorRegisterSubtitle") : t("auth.ambassadorLoginSubtitle")) :
             mode === "login" ? t("auth.signInSubtitle") :
             mode === "register" ? t("auth.registerSubtitle") :
             mode === "forgot" ? t("auth.forgotSubtitle") :
             t("auth.resetSubtitle")}
          </p>

          {/* Sellers have their own application and sign-in */}
          {showLoginRegister && accountType === "sell" && (
            <div className="mt-6 space-y-4">
              <ul className="space-y-2">
                {(["sellPoint1", "sellPoint2", "sellPoint3"] as const).map((key) => (
                  <li key={key} className="flex items-start gap-2 text-sm">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                    {t(`auth.${key}`)}
                  </li>
                ))}
              </ul>
              <Button asChild className="h-12 w-full rounded-xl text-base">
                <Link to="/sell">{t("auth.sellApply", "Apply to open a shop")}</Link>
              </Button>
              <Button asChild variant="outline" className="h-12 w-full rounded-xl text-base">
                <Link to="/vendor/login">{t("auth.sellSignIn", "I already have a shop: sign in")}</Link>
              </Button>
            </div>
          )}

          {/* Google sign-in (login / register only) */}
          {showLoginRegister && accountType !== "sell" && (
            <>
              <div className="mt-8">
                <GoogleSignInButton
                  returnPath={`/auth?redirect=${encodeURIComponent(redirectTo)}`}
                  label={mode === "register" ? t("auth.signUpWithGoogle") : t("auth.continueWithGoogle")}
                />
              </div>
              <OrDivider />
            </>
          )}

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
          {showLoginRegister && accountType !== "sell" && (
          <>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            {mode === "register" && (
              <div className="space-y-2">
                <Label htmlFor="full_name">{t("auth.fullName")}</Label>
                <Input id="full_name" placeholder="Enter your full name" autoComplete="name" {...register("full_name")} />
                {errors.full_name && <p className="text-sm text-destructive">{errors.full_name.message}</p>}
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

            {mode === "register" && (
              <div className="space-y-2">
                <Label htmlFor="phone">{t("auth.phone", "Phone number")}</Label>
                <Input
                  id="phone"
                  type="tel"
                  inputMode="tel"
                  placeholder="0803 123 4567"
                  autoComplete="tel"
                  {...register("phone")}
                />
                {errors.phone && <p className="text-sm text-destructive">{errors.phone.message}</p>}
              </div>
            )}

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
          <p className="mt-6 text-center text-xs text-muted-foreground">
            By continuing you agree to our{" "}
            <Link to="/terms" className="underline hover:text-primary">Terms of Service</Link> and{" "}
            <Link to="/privacy" className="underline hover:text-primary">Privacy Policy</Link>.
          </p>
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
