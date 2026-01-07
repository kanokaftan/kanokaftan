import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export interface DeliveryAddress {
  id: string;
  user_id: string;
  label: string;
  full_name: string;
  phone: string;
  street_address: string;
  city: string;
  state: string;
  landmark: string | null;
  is_default: boolean;
  latitude: number | null;
  longitude: number | null;
  created_at: string;
  updated_at: string;
}

export interface AddressFormData {
  label: string;
  full_name: string;
  phone: string;
  street_address: string;
  city: string;
  state: string;
  landmark?: string;
  is_default?: boolean;
  latitude?: number | null;
  longitude?: number | null;
}

export function useAddresses() {
  const { user } = useAuth();
  const userId = user?.id || null;
  const queryClient = useQueryClient();

  const addressesQuery = useQuery({
    queryKey: ["addresses", userId],
    queryFn: async () => {
      if (!userId) return [];

      const { data, error } = await supabase
        .from("delivery_addresses")
        .select("*")
        .eq("user_id", userId)
        .order("is_default", { ascending: false })
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data as DeliveryAddress[];
    },
    enabled: !!userId,
  });

  const addAddress = useMutation({
    mutationFn: async (address: AddressFormData) => {
      if (!userId) throw new Error("Must be logged in");

      const { data, error } = await supabase
        .from("delivery_addresses")
        .insert({
          user_id: userId,
          ...address,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["addresses"] });
    },
  });

  const updateAddress = useMutation({
    mutationFn: async ({ id, ...address }: AddressFormData & { id: string }) => {
      if (!userId) throw new Error("Must be logged in");

      const { data, error } = await supabase
        .from("delivery_addresses")
        .update(address)
        .eq("id", id)
        .eq("user_id", userId)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["addresses"] });
    },
  });

  const deleteAddress = useMutation({
    mutationFn: async (id: string) => {
      if (!userId) throw new Error("Must be logged in");

      const { error } = await supabase
        .from("delivery_addresses")
        .delete()
        .eq("id", id)
        .eq("user_id", userId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["addresses"] });
    },
  });

  const setDefaultAddress = useMutation({
    mutationFn: async (id: string) => {
      if (!userId) throw new Error("Must be logged in");

      const { error } = await supabase
        .from("delivery_addresses")
        .update({ is_default: true })
        .eq("id", id)
        .eq("user_id", userId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["addresses"] });
    },
  });

  return {
    addresses: addressesQuery.data || [],
    isLoading: addressesQuery.isLoading,
    defaultAddress: addressesQuery.data?.find((a) => a.is_default) || addressesQuery.data?.[0],
    addAddress,
    updateAddress,
    deleteAddress,
    setDefaultAddress,
  };
}
