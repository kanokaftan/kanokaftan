import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { withProfilePrivate } from "@/lib/profilePrivate";

export interface AdminUser {
  id: string;
  email: string;
  full_name: string | null;
  phone: string | null;
  avatar_url: string | null;
  is_verified: boolean;
  verification_tier?: string | null;
  store_name: string | null;
  created_at: string;
  roles: string[];
}

export function useAdminUsers() {
  const queryClient = useQueryClient();

  const usersQuery = useQuery({
    queryKey: ["admin-users"],
    queryFn: async (): Promise<AdminUser[]> => {
      const { data: profileRows, error: profilesError } = await supabase
        .from("profiles")
        .select("id, full_name, avatar_url, created_at, updated_at, store_name, store_description, store_slug, store_banner_url, is_verified, verified_until, verification_tier, last_seen_at")
        .order("created_at", { ascending: false });

      if (profilesError) throw profilesError;
      const profiles = await withProfilePrivate(profileRows ?? []);

      const { data: roles, error: rolesError } = await supabase
        .from("user_roles")
        .select("user_id, role");

      if (rolesError) throw rolesError;

      const rolesByUser = roles?.reduce((acc, r) => {
        if (!acc[r.user_id]) acc[r.user_id] = [];
        acc[r.user_id].push(r.role);
        return acc;
      }, {} as Record<string, string[]>) || {};

      return profiles?.map(p => ({
        ...p,
        roles: rolesByUser[p.id] || ["customer"],
      })) || [];
    },
    staleTime: 30_000,
  });

  const updateUserVerification = useMutation({
    mutationFn: async ({ userId, isVerified }: { userId: string; isVerified: boolean }) => {
      const { error } = await supabase
        .from("profiles")
        .update({ is_verified: isVerified })
        .eq("id", userId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
      queryClient.invalidateQueries({ queryKey: ["admin-stats"] });
    },
  });

  return {
    users: usersQuery.data || [],
    isLoading: usersQuery.isLoading,
    error: usersQuery.error,
    updateUserVerification,
  };
}
