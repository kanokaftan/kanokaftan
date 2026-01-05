import { useState } from "react";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { useAdminUsers } from "@/hooks/useAdminUsers";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Search, BadgeCheck, Shield, Store } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";

export default function AdminUsers() {
  const { users, isLoading, updateUserVerification } = useAdminUsers();
  const [search, setSearch] = useState("");

  const filteredUsers = users.filter(user => 
    user.full_name?.toLowerCase().includes(search.toLowerCase()) ||
    user.email.toLowerCase().includes(search.toLowerCase())
  );

  const handleVerify = async (userId: string, currentStatus: boolean) => {
    try {
      await updateUserVerification.mutateAsync({ userId, isVerified: !currentStatus });
      toast.success(currentStatus ? "User unverified" : "User verified");
    } catch (error) {
      toast.error("Failed to update user verification");
    }
  };

  const getRoleBadge = (role: string) => {
    switch (role) {
      case "admin":
        return <Badge variant="destructive" className="gap-1"><Shield className="h-3 w-3" />Admin</Badge>;
      case "vendor":
        return <Badge variant="secondary" className="gap-1"><Store className="h-3 w-3" />Vendor</Badge>;
      default:
        return <Badge variant="outline">Customer</Badge>;
    }
  };

  return (
    <AdminLayout title="Users">
      {/* Search */}
      <div className="mb-6">
        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search users..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      {/* Mobile View */}
      <div className="md:hidden space-y-3 mb-20">
        {isLoading ? (
          [...Array(5)].map((_, i) => <Skeleton key={i} className="h-24 w-full" />)
        ) : filteredUsers.length === 0 ? (
          <p className="text-center text-muted-foreground py-8">No users found</p>
        ) : (
          filteredUsers.map((user) => (
            <div key={user.id} className="bg-card rounded-lg p-4 border">
              <div className="flex items-start gap-3">
                <Avatar>
                  <AvatarImage src={user.avatar_url || undefined} />
                  <AvatarFallback>{user.full_name?.charAt(0) || user.email.charAt(0).toUpperCase()}</AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-medium truncate">{user.full_name || "No name"}</p>
                    {user.is_verified && <BadgeCheck className="h-4 w-4 text-primary" />}
                  </div>
                  <p className="text-sm text-muted-foreground truncate">{user.email}</p>
                  <div className="flex flex-wrap gap-1 mt-2">
                    {user.roles.map((role) => (
                      <span key={role}>{getRoleBadge(role)}</span>
                    ))}
                  </div>
                </div>
              </div>
              <div className="flex items-center justify-between mt-3 pt-3 border-t">
                <span className="text-xs text-muted-foreground">
                  Joined {format(new Date(user.created_at), "MMM dd, yyyy")}
                </span>
                <Button
                  size="sm"
                  variant={user.is_verified ? "outline" : "default"}
                  onClick={() => handleVerify(user.id, user.is_verified)}
                  disabled={updateUserVerification.isPending}
                >
                  {user.is_verified ? "Unverify" : "Verify"}
                </Button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Desktop Table */}
      <div className="hidden md:block">
        <div className="rounded-lg border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>User</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Roles</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Joined</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                [...Array(5)].map((_, i) => (
                  <TableRow key={i}>
                    <TableCell colSpan={6}><Skeleton className="h-10 w-full" /></TableCell>
                  </TableRow>
                ))
              ) : filteredUsers.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                    No users found
                  </TableCell>
                </TableRow>
              ) : (
                filteredUsers.map((user) => (
                  <TableRow key={user.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Avatar>
                          <AvatarImage src={user.avatar_url || undefined} />
                          <AvatarFallback>{user.full_name?.charAt(0) || user.email.charAt(0).toUpperCase()}</AvatarFallback>
                        </Avatar>
                        <span className="font-medium">{user.full_name || "No name"}</span>
                      </div>
                    </TableCell>
                    <TableCell>{user.email}</TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {user.roles.map((role) => (
                          <span key={role}>{getRoleBadge(role)}</span>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell>
                      {user.is_verified ? (
                        <Badge className="gap-1 bg-green-100 text-green-800">
                          <BadgeCheck className="h-3 w-3" />Verified
                        </Badge>
                      ) : (
                        <Badge variant="outline">Unverified</Badge>
                      )}
                    </TableCell>
                    <TableCell>{format(new Date(user.created_at), "MMM dd, yyyy")}</TableCell>
                    <TableCell>
                      <Button
                        size="sm"
                        variant={user.is_verified ? "outline" : "default"}
                        onClick={() => handleVerify(user.id, user.is_verified)}
                        disabled={updateUserVerification.isPending}
                      >
                        {user.is_verified ? "Unverify" : "Verify"}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </AdminLayout>
  );
}
