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
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useToast } from "@/hooks/use-toast";

const authSchema = z.object({
  email: z.string().email("Please enter a valid email"),
  password: z.string().min(6, "Password must be at least 6 characters"),
  full_name: z.string().optional(),
  role: z.enum(["customer", "vendor"]).optional(),
});

type AuthFormData = z.infer<typeof authSchema>;

export default function AuthPage() {
  const [searchParams] = useSearchParams();
  const [mode, setMode] = useState<"login" | "register">(
    searchParams.get("mode") === "register" ? "register" : "login"
  );
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();
  
  const defaultRole = searchParams.get("role") === "vendor" ? "vendor" : "customer";

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<AuthFormData>({
    resolver: zodResolver(authSchema),
    defaultValues: {
      role: defaultRole as "customer" | "vendor",
    },
  });

  const selectedRole = watch("role");

  // Check vendor role and redirect appropriately
  const checkVendorAndRedirect = async (userId: string) => {
    const { data } = await supabase.rpc("has_role", {
      _user_id: userId,
      _role: "vendor",
    });
    if (data) {
      navigate("/vendor/dashboard");
    } else {
      navigate("/");
    }
  };

  // Check if user is already logged in
  useEffect(() => {
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        await checkVendorAndRedirect(session.user.id);
      }
    };
    checkAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (session) {
          setTimeout(() => {
            checkVendorAndRedirect(session.user.id);
          }, 0);
        }
      }
    );

    return () => subscription.unsubscribe();
  }, [navigate]);

  const onSubmit = async (data: AuthFormData) => {
    setIsLoading(true);

    try {
      if (mode === "register") {
        const redirectUrl = `${window.location.origin}/`;
        
        const { error } = await supabase.auth.signUp({
          email: data.email,
          password: data.password,
          options: {
            emailRedirectTo: redirectUrl,
            data: {
              full_name: data.full_name || "",
              role: data.role || "customer",
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
          // Redirect based on selected role
          if (data.role === "vendor") {
            navigate("/vendor/dashboard");
          } else {
            navigate("/");
          }
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

  return (
    <div className="flex min-h-screen">
      {/* Left Panel - Form */}
      <div className="flex w-full flex-col justify-center px-8 py-12 lg:w-1/2 lg:px-16">
        <div className="mx-auto w-full max-w-md">
          {/* Logo */}
          <Link to="/" className="mb-8 inline-flex items-center gap-2">
            <span className="font-display text-3xl font-bold text-primary">
              K<sup className="text-sm">2</sup>
            </span>
            <span className="font-display text-xl">Kano Kaftan</span>
          </Link>

          <h1 className="font-display text-2xl font-bold text-primary">
            {mode === "login" ? "Welcome back" : "Create your account"}
          </h1>
          <p className="mt-2 text-muted-foreground">
            {mode === "login"
              ? "Sign in to access your account"
              : "Join K² to shop or sell traditional attire"}
          </p>

          <form onSubmit={handleSubmit(onSubmit)} className="mt-8 space-y-6">
            {mode === "register" && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="full_name">Full Name</Label>
                  <Input
                    id="full_name"
                    placeholder="Enter your full name"
                    {...register("full_name")}
                  />
                </div>

                <div className="space-y-3">
                  <Label>I want to</Label>
                  <RadioGroup
                    value={selectedRole}
                    onValueChange={(value) => setValue("role", value as "customer" | "vendor")}
                    className="flex gap-4"
                  >
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="customer" id="customer" />
                      <Label htmlFor="customer" className="cursor-pointer font-normal">
                        Shop for attire
                      </Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="vendor" id="vendor" />
                      <Label htmlFor="vendor" className="cursor-pointer font-normal">
                        Sell my products
                      </Label>
                    </div>
                  </RadioGroup>
                </div>
              </>
            )}

            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
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
              <Label htmlFor="password">Password</Label>
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

            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {mode === "login" ? "Sign In" : "Create Account"}
            </Button>
          </form>

          <p className="mt-6 text-center text-sm text-muted-foreground">
            {mode === "login" ? (
              <>
                Don't have an account?{" "}
                <button
                  type="button"
                  className="font-medium text-primary hover:underline"
                  onClick={() => setMode("register")}
                >
                  Sign up
                </button>
              </>
            ) : (
              <>
                Already have an account?{" "}
                <button
                  type="button"
                  className="font-medium text-primary hover:underline"
                  onClick={() => setMode("login")}
                >
                  Sign in
                </button>
              </>
            )}
          </p>
        </div>
      </div>

      {/* Right Panel - Decorative */}
      <div className="hidden bg-primary lg:flex lg:w-1/2 lg:items-center lg:justify-center">
        <div className="max-w-md px-8 text-center text-primary-foreground">
          <h2 className="font-display text-4xl font-bold">
            Traditional Excellence,<br />Modern Convenience
          </h2>
          <p className="mt-4 text-lg text-primary-foreground/80">
            Discover authentic Nigerian attire from master craftsmen in Kano, 
            delivered right to your doorstep.
          </p>
        </div>
      </div>
    </div>
  );
}
