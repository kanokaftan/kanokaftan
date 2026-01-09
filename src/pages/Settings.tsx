import { useState, useEffect } from "react";
import { Bell, Globe, Trash2, Save, Loader2 } from "lucide-react";
import { MobileLayout } from "@/components/layout/MobileLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { useNotifications } from "@/hooks/useNotifications";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";

export default function Settings() {
  const { user } = useAuth();
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [notifications, setNotifications] = useState(true);
  const [orderUpdates, setOrderUpdates] = useState(true);
  const [promotions, setPromotions] = useState(false);
  const [language, setLanguage] = useState("en");
  const [currency, setCurrency] = useState("NGN");
  const { clearAll, unreadCount } = useNotifications();
  const { toast } = useToast();

  // Load preferences from database
  useEffect(() => {
    const loadPreferences = async () => {
      if (!user) {
        setIsLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from("profiles")
        .select("notification_push, notification_orders, notification_promotions, preferred_language, preferred_currency")
        .eq("id", user.id)
        .single();

      if (!error && data) {
        setNotifications(data.notification_push ?? true);
        setOrderUpdates(data.notification_orders ?? true);
        setPromotions(data.notification_promotions ?? false);
        setLanguage(data.preferred_language ?? "en");
        setCurrency(data.preferred_currency ?? "NGN");
      }
      setIsLoading(false);
    };

    loadPreferences();
  }, [user]);

  const handleSavePreferences = async () => {
    if (!user) {
      toast({
        title: "Sign in required",
        description: "Please sign in to save your preferences.",
        variant: "destructive",
      });
      return;
    }

    setIsSaving(true);
    const { error } = await supabase
      .from("profiles")
      .update({
        notification_push: notifications,
        notification_orders: orderUpdates,
        notification_promotions: promotions,
        preferred_language: language,
        preferred_currency: currency,
      })
      .eq("id", user.id);

    setIsSaving(false);

    if (error) {
      toast({
        title: "Failed to save",
        description: "Could not save your preferences. Please try again.",
        variant: "destructive",
      });
    } else {
      toast({
        title: "Preferences saved",
        description: "Your settings have been updated successfully.",
      });
    }
  };

  const handleClearNotifications = () => {
    clearAll.mutate(undefined, {
      onSuccess: () => {
        toast({
          title: "Notifications cleared",
          description: "All notifications have been removed.",
        });
      },
    });
  };

  if (isLoading) {
    return (
      <MobileLayout>
        <div className="container max-w-2xl py-6 flex items-center justify-center min-h-[50vh]">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </MobileLayout>
    );
  }

  return (
    <MobileLayout>
      <div className="container max-w-2xl py-6 space-y-6 pb-24">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Preferences</h1>
            <p className="text-muted-foreground">Customize your app experience</p>
          </div>
          <Button 
            onClick={handleSavePreferences} 
            disabled={isSaving || !user}
            className="gap-2"
          >
            {isSaving ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            Save
          </Button>
        </div>

        {/* Notifications */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Bell className="h-5 w-5" />
              Notifications
            </CardTitle>
            <CardDescription>
              Manage your notification preferences
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex items-center justify-between gap-4">
              <div className="space-y-0.5 flex-1">
                <Label htmlFor="notifications" className="text-sm font-medium">Push Notifications</Label>
                <p className="text-xs text-muted-foreground">Receive in-app notifications</p>
              </div>
              <Switch
                id="notifications"
                checked={notifications}
                onCheckedChange={setNotifications}
              />
            </div>

            <div className="flex items-center justify-between gap-4">
              <div className="space-y-0.5 flex-1">
                <Label htmlFor="order-updates" className="text-sm font-medium">Order Updates</Label>
                <p className="text-xs text-muted-foreground">Get notified about your orders</p>
              </div>
              <Switch
                id="order-updates"
                checked={orderUpdates}
                onCheckedChange={setOrderUpdates}
              />
            </div>

            <div className="flex items-center justify-between gap-4">
              <div className="space-y-0.5 flex-1">
                <Label htmlFor="promotions" className="text-sm font-medium">Promotions & Deals</Label>
                <p className="text-xs text-muted-foreground">Receive deals and special offers</p>
              </div>
              <Switch
                id="promotions"
                checked={promotions}
                onCheckedChange={setPromotions}
              />
            </div>

            <div className="pt-4 border-t">
              <div className="flex items-center justify-between gap-4">
                <div className="space-y-0.5 flex-1">
                  <Label className="text-sm font-medium">Clear All Notifications</Label>
                  <p className="text-xs text-muted-foreground">
                    {unreadCount > 0 ? `${unreadCount} unread notification${unreadCount > 1 ? 's' : ''}` : "No unread notifications"}
                  </p>
                </div>
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={handleClearNotifications}
                  disabled={clearAll.isPending}
                  className="gap-2"
                >
                  <Trash2 className="h-4 w-4" />
                  Clear
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Language & Region */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Globe className="h-5 w-5" />
              Language & Region
            </CardTitle>
            <CardDescription>
              Set your preferred language and currency
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex items-center justify-between gap-4">
              <div className="space-y-0.5 flex-1">
                <Label className="text-sm font-medium">Language</Label>
                <p className="text-xs text-muted-foreground">Select your preferred language</p>
              </div>
              <Select value={language} onValueChange={setLanguage}>
                <SelectTrigger className="w-[140px]">
                  <SelectValue placeholder="Language" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="en">English</SelectItem>
                  <SelectItem value="ha">Hausa</SelectItem>
                  <SelectItem value="yo">Yoruba</SelectItem>
                  <SelectItem value="ig">Igbo</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center justify-between gap-4">
              <div className="space-y-0.5 flex-1">
                <Label className="text-sm font-medium">Currency</Label>
                <p className="text-xs text-muted-foreground">Display currency for prices</p>
              </div>
              <Select value={currency} onValueChange={setCurrency}>
                <SelectTrigger className="w-[140px]">
                  <SelectValue placeholder="Currency" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="NGN">₦ Nigerian Naira</SelectItem>
                  <SelectItem value="USD">$ US Dollar</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>
      </div>
    </MobileLayout>
  );
}
