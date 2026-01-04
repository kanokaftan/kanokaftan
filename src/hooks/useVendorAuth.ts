import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";

export function useVendorAuth() {
  const { user, isVendor, isLoading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    if (isLoading) return;

    if (!user) {
      toast({
        title: "Authentication required",
        description: "Please log in to access the vendor dashboard",
        variant: "destructive",
      });
      navigate("/auth?mode=login");
      return;
    }

    if (!isVendor) {
      toast({
        title: "Access denied",
        description: "You need a vendor account to access this area",
        variant: "destructive",
      });
      navigate("/");
    }
  }, [user, isVendor, isLoading, navigate, toast]);

  return { isVendor, isLoading, userId: user?.id || null };
}
