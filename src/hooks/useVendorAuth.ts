import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export function useVendorAuth() {
  const [isVendor, setIsVendor] = useState<boolean | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    async function checkVendorStatus() {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        
        if (!session?.user) {
          toast({
            title: "Authentication required",
            description: "Please log in to access the vendor dashboard",
            variant: "destructive",
          });
          navigate("/auth?mode=login");
          return;
        }

        setUserId(session.user.id);

        // Check if user has vendor role using the has_role function
        const { data, error } = await supabase.rpc("has_role", {
          _user_id: session.user.id,
          _role: "vendor",
        });

        if (error) throw error;

        if (!data) {
          toast({
            title: "Access denied",
            description: "You need a vendor account to access this area",
            variant: "destructive",
          });
          navigate("/");
          return;
        }

        setIsVendor(true);
      } catch (error) {
        console.error("Error checking vendor status:", error);
        setIsVendor(false);
        navigate("/");
      } finally {
        setIsLoading(false);
      }
    }

    checkVendorStatus();
  }, [navigate, toast]);

  return { isVendor, isLoading, userId };
}
