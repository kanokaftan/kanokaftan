import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";

const FEATURED_PROMO_CODE = "K2WFAAD";

interface UseFeaturedListingOptions {
  onSuccess?: () => void;
}

export function useFeaturedListing({ onSuccess }: UseFeaturedListingOptions = {}) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isProcessing, setIsProcessing] = useState(false);

  const applyPromoCode = async (productId: string, promoCode: string): Promise<boolean> => {
    if (promoCode.toUpperCase() !== FEATURED_PROMO_CODE) {
      toast({
        title: "Invalid promo code",
        description: "The promo code you entered is not valid.",
        variant: "destructive",
      });
      return false;
    }

    setIsProcessing(true);
    try {
      const { data, error } = await supabase.functions.invoke("process-featured-payment", {
        body: { productId, promoCode },
      });

      if (error) throw error;

      if (data.promo_applied) {
        toast({
          title: "Product featured! 🎉",
          description: "Your product is now featured using the promo code.",
        });
        queryClient.invalidateQueries({ queryKey: ["vendor-products"] });
        onSuccess?.();
        return true;
      }

      return false;
    } catch (error: any) {
      toast({
        title: "Error applying promo code",
        description: error.message,
        variant: "destructive",
      });
      return false;
    } finally {
      setIsProcessing(false);
    }
  };

  const initPayment = async (productId: string, email: string, callbackUrl?: string): Promise<string | null> => {
    setIsProcessing(true);
    try {
      const { data, error } = await supabase.functions.invoke("process-featured-payment", {
        body: { productId, email, callbackUrl },
      });

      if (error) throw error;

      if (data.authorization_url) {
        return data.authorization_url;
      }

      throw new Error("Failed to initialize payment");
    } catch (error: any) {
      toast({
        title: "Payment error",
        description: error.message,
        variant: "destructive",
      });
      return null;
    } finally {
      setIsProcessing(false);
    }
  };

  const verifyPayment = useCallback(async (reference: string): Promise<boolean> => {
    try {
      const { data, error } = await supabase.functions.invoke("verify-featured-payment", {
        body: { reference },
      });

      if (error) throw error;

      if (data.verified) {
        toast({
          title: "Product featured! 🎉",
          description: "Your payment was successful. Your product is now featured.",
        });
        queryClient.invalidateQueries({ queryKey: ["vendor-products"] });
        return true;
      }

      return false;
    } catch (error: any) {
      toast({
        title: "Verification error",
        description: error.message,
        variant: "destructive",
      });
      return false;
    }
  }, [toast, queryClient]);

  return {
    isProcessing,
    applyPromoCode,
    initPayment,
    verifyPayment,
  };
}
