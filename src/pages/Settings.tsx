import { useState, useEffect } from "react";
import { Bell, Globe, Trash2 } from "lucide-react";
import { MobileLayout } from "@/components/layout/MobileLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { useNotifications } from "@/hooks/useNotifications";
import { useToast } from "@/hooks/use-toast";

export default function Settings() {
  const [notifications, setNotifications] = useState(true);
  const [orderUpdates, setOrderUpdates] = useState(true);
  const [promotions, setPromotions] = useState(false);
  const { clearAll, unreadCount } = useNotifications();
  const { toast } = useToast();

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

  return (
    <MobileLayout>
      <div className="container max-w-2xl py-6 space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Preferences</h1>
          <p className="text-muted-foreground">Customize your app experience</p>
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
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="notifications">Push Notifications</Label>
                <p className="text-sm text-muted-foreground">Receive in-app notifications</p>
              </div>
              <Switch
                id="notifications"
                checked={notifications}
                onCheckedChange={setNotifications}
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="order-updates">Order Updates</Label>
                <p className="text-sm text-muted-foreground">Get notified about your orders</p>
              </div>
              <Switch
                id="order-updates"
                checked={orderUpdates}
                onCheckedChange={setOrderUpdates}
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="promotions">Promotional Notifications</Label>
                <p className="text-sm text-muted-foreground">Receive deals and offers</p>
              </div>
              <Switch
                id="promotions"
                checked={promotions}
                onCheckedChange={setPromotions}
              />
            </div>

            <div className="pt-2 border-t">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Clear All Notifications</Label>
                  <p className="text-sm text-muted-foreground">
                    {unreadCount > 0 ? `${unreadCount} unread` : "No notifications"}
                  </p>
                </div>
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={handleClearNotifications}
                  disabled={clearAll.isPending}
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Clear All
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Language */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Globe className="h-5 w-5" />
              Language & Region
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Language</Label>
                <p className="text-sm text-muted-foreground">Select your preferred language</p>
              </div>
              <Select defaultValue="en">
                <SelectTrigger className="w-[120px]">
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

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Currency</Label>
                <p className="text-sm text-muted-foreground">Display currency</p>
              </div>
              <Select defaultValue="ngn">
                <SelectTrigger className="w-[120px]">
                  <SelectValue placeholder="Currency" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ngn">₦ NGN</SelectItem>
                  <SelectItem value="usd">$ USD</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>
      </div>
    </MobileLayout>
  );
}
