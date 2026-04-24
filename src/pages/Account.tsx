import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import {
  Mail, Save, Loader2, LogOut, ShieldCheck, Camera, ChevronRight, MapPin, Bell, CheckCircle2
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { MobileLayout } from "@/components/layout/MobileLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Link } from "react-router-dom";
import { Skeleton } from "@/components/ui/skeleton";
import { useTranslation } from "react-i18next";

const accountSchema = z.object({
  full_name: z.string().min(2, "Name must be at least 2 characters"),
  phone: z.string().optional(),
});

type AccountFormData = z.infer<typeof accountSchema>;

export default function Account() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user, isLoading: authLoading, signOut } = useAuth();
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const [passwordResetSent, setPasswordResetSent] = useState(false);
  const [isSendingReset, setIsSendingReset] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const form = useForm<AccountFormData>({
    resolver: zodResolver(accountSchema),
    defaultValues: { full_name: "", phone: "" },
  });

  useEffect(() => {
    if (authLoading) return;
    if (!user) { navigate("/auth"); return; }

    const loadProfile = async () => {
      const { data: profile } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .single();

      if (profile) {
        form.reset({
          full_name: profile.full_name || "",
          phone: profile.phone || "",
        });
        setAvatarUrl(profile.avatar_url);
      }
      setIsLoading(false);
    };
    loadProfile();
  }, [user, authLoading, form, navigate]);

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    if (file.size > 5 * 1024 * 1024) {
      toast({ title: "Image too large", description: "Please choose an image under 5 MB.", variant: "destructive" });
      return;
    }

    setIsUploadingAvatar(true);
    try {
      const fileExt = file.name.split(".").pop();
      const fileName = `avatars/${user.id}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from("product-images")
        .upload(fileName, file, { upsert: true });

      if (uploadError) throw uploadError;

      const { data } = supabase.storage
        .from("product-images")
        .getPublicUrl(fileName);

      const newAvatarUrl = `${data.publicUrl}?t=${Date.now()}`;

      await supabase.from("profiles").update({ avatar_url: newAvatarUrl }).eq("id", user.id);

      setAvatarUrl(newAvatarUrl);
      toast({ title: t("profile.updateSuccess") });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Failed to upload";
      toast({ title: "Upload failed", description: message, variant: "destructive" });
    } finally {
      setIsUploadingAvatar(false);
    }
  };

  const onSubmit = async (data: AccountFormData) => {
    if (!user) return;
    setIsSaving(true);
    try {
      const { error } = await supabase
        .from("profiles")
        .update({ full_name: data.full_name, phone: data.phone })
        .eq("id", user.id);
      if (error) throw error;
      toast({ title: t("profile.updateSuccess") });
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  };

  const handlePasswordReset = async () => {
    if (!user?.email) return;
    setIsSendingReset(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(user.email, {
        redirectTo: `${window.location.origin}/auth?mode=reset`,
      });
      if (error) throw error;
      setPasswordResetSent(true);
      toast({ title: "Reset email sent", description: `Check ${user.email} for a password reset link.` });
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setIsSendingReset(false);
    }
  };

  const handleLogout = async () => {
    await signOut();
    navigate("/");
  };

  if (isLoading) {
    return (
      <MobileLayout>
        <div className="px-4 py-6 space-y-4 max-w-2xl mx-auto">
          <Skeleton className="h-8 w-48" />
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center gap-4 mb-6">
                <Skeleton className="h-20 w-20 rounded-full" />
                <div className="space-y-2 flex-1">
                  <Skeleton className="h-6 w-40" />
                  <Skeleton className="h-4 w-32" />
                </div>
              </div>
              <Skeleton className="h-10 w-full mb-3" />
              <Skeleton className="h-10 w-full mb-3" />
              <Skeleton className="h-10 w-full" />
            </CardContent>
          </Card>
        </div>
      </MobileLayout>
    );
  }

  const initials = form.watch("full_name")?.charAt(0) || user?.email?.charAt(0)?.toUpperCase() || "?";

  return (
    <MobileLayout>
      <div className="px-4 py-6 pb-24 space-y-5 max-w-2xl mx-auto">

        <div>
          <h1 className="text-xl font-bold">{t("profile.accountSettings")}</h1>
          <p className="text-sm text-muted-foreground">{t("profile.accountSettingsDesc")}</p>
        </div>

        {/* Profile Card */}
        <Card className="overflow-hidden">
          <div className="h-14 bg-gradient-to-r from-primary to-primary/60" />
          <CardContent className="pt-0 -mt-8 px-5 pb-5">
            <div className="flex items-end gap-4 mb-5">
              <div className="relative">
                <Avatar className="h-20 w-20 border-4 border-background shadow">
                  <AvatarImage src={avatarUrl || undefined} />
                  <AvatarFallback className="text-2xl bg-primary text-primary-foreground font-bold">
                    {initials}
                  </AvatarFallback>
                </Avatar>
                <button
                  className="absolute bottom-0 right-0 p-1.5 rounded-full bg-card border shadow-md hover:bg-muted transition-colors disabled:opacity-50"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isUploadingAvatar}
                  title="Change photo"
                >
                  {isUploadingAvatar
                    ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    : <Camera className="h-3.5 w-3.5" />}
                </button>
                <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarUpload} />
              </div>
              <div className="flex-1 pb-1 min-w-0">
                <p className="font-semibold text-lg truncate">{form.watch("full_name") || "Set your name"}</p>
                <p className="text-sm text-muted-foreground truncate">{user?.email}</p>
              </div>
            </div>

            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="full_name">{t("profile.fullName")}</Label>
                  <Input id="full_name" {...form.register("full_name")} placeholder="Enter your full name" />
                  {form.formState.errors.full_name && (
                    <p className="text-xs text-destructive">{form.formState.errors.full_name.message}</p>
                  )}
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="phone">{t("profile.phone")}</Label>
                  <Input id="phone" {...form.register("phone")} placeholder="+234 xxx xxx xxxx" type="tel" />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label>{t("profile.email")}</Label>
                <div className="flex items-center gap-3 px-3 py-2.5 rounded-lg bg-muted/50 border">
                  <Mail className="h-4 w-4 text-muted-foreground shrink-0" />
                  <span className="text-sm flex-1 truncate">{user?.email}</span>
                  <Badge variant="secondary" className="text-xs shrink-0">
                    <CheckCircle2 className="h-3 w-3 mr-1 text-green-600" />
                    Verified
                  </Badge>
                </div>
              </div>

              <Button type="submit" disabled={isSaving} className="w-full">
                {isSaving ? (
                  <><Loader2 className="mr-2 h-4 w-4 animate-spin" />{t("profile.saving")}</>
                ) : (
                  <><Save className="mr-2 h-4 w-4" />{t("profile.save")}</>
                )}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Quick Links */}
        <Card className="divide-y overflow-hidden">
          {[
            { icon: MapPin, label: "Delivery Addresses", description: "Manage your saved addresses", href: "/addresses" },
            { icon: Bell, label: t("settings.notifications"), description: t("profile.notificationsDesc"), href: "/settings" },
          ].map((link) => (
            <Link
              key={link.href}
              to={link.href}
              className="flex items-center gap-4 p-4 hover:bg-muted/50 transition-colors"
            >
              <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center shrink-0">
                <link.icon className="h-5 w-5 text-muted-foreground" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium">{link.label}</p>
                <p className="text-sm text-muted-foreground">{link.description}</p>
              </div>
              <ChevronRight className="h-5 w-5 text-muted-foreground shrink-0" />
            </Link>
          ))}
        </Card>

        {/* Security */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <ShieldCheck className="h-5 w-5" />
              Security
            </CardTitle>
            <CardDescription>Manage your account security</CardDescription>
          </CardHeader>
          <CardContent>
            {passwordResetSent ? (
              <div className="flex items-center gap-2 p-3 rounded-lg bg-green-50 dark:bg-green-950/30 border border-green-200 text-green-700 dark:text-green-400 text-sm">
                <CheckCircle2 className="h-4 w-4 shrink-0" />
                Reset link sent to {user?.email}. Check your inbox.
              </div>
            ) : (
              <Button
                variant="outline"
                className="w-full"
                onClick={handlePasswordReset}
                disabled={isSendingReset}
              >
                {isSendingReset
                  ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Sending...</>
                  : "Send Password Reset Email"
                }
              </Button>
            )}
          </CardContent>
        </Card>

        {/* Danger Zone */}
        <Button
          variant="outline"
          className="w-full text-destructive border-destructive/30 hover:bg-destructive/10 hover:text-destructive"
          onClick={handleLogout}
        >
          <LogOut className="mr-2 h-4 w-4" />
          {t("profile.signOut")}
        </Button>

      </div>
    </MobileLayout>
  );
}
