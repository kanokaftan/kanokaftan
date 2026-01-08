import { AdminLayout } from "@/components/admin/AdminLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Shield, Users, Database, Bell, Server } from "lucide-react";

export default function AdminSettings() {
  return (
    <AdminLayout title="Settings">
      <div className="grid gap-6 md:grid-cols-2 mb-20 md:mb-0">
        {/* Backend Access Card */}
        <Card className="border-primary/20 bg-primary/5">
          <CardHeader>
            <div className="flex items-center gap-3">
              <Server className="h-5 w-5 text-primary" />
              <CardTitle className="text-lg">Backend Access</CardTitle>
            </div>
            <CardDescription>View and manage your backend infrastructure</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">
              Access database tables, storage buckets, authentication settings, and backend functions.
            </p>
            <Button variant="outline">
              View Backend →
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <Shield className="h-5 w-5 text-primary" />
              <CardTitle className="text-lg">Security</CardTitle>
            </div>
            <CardDescription>Manage platform security settings</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">
              Configure authentication rules, password policies, and access controls for the platform.
            </p>
            <Button variant="outline" disabled>Coming Soon</Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <Users className="h-5 w-5 text-primary" />
              <CardTitle className="text-lg">User Management</CardTitle>
            </div>
            <CardDescription>Configure user-related settings</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">
              Set up verification requirements, registration rules, and user account limits.
            </p>
            <Button variant="outline" disabled>Coming Soon</Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <Database className="h-5 w-5 text-primary" />
              <CardTitle className="text-lg">Data & Storage</CardTitle>
            </div>
            <CardDescription>Manage data and storage settings</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">
              Configure storage limits, data retention policies, and manage backup settings.
            </p>
            <Button variant="outline" disabled>Coming Soon</Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <Bell className="h-5 w-5 text-primary" />
              <CardTitle className="text-lg">Notifications</CardTitle>
            </div>
            <CardDescription>Configure system notifications</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">
              Set up email templates, push alerts, and notification preferences for users.
            </p>
            <Button variant="outline" disabled>Coming Soon</Button>
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
}
