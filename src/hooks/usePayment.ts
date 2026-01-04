import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";

interface PaymentResult {
  success: boolean;
  authorization_url?: string;
  reference?: string;
  error?: string;
}

interface VerifyResult {
  success: boolean;
  status?: string;
  amount?: number;
  reference?: string;
  paidAt?: string;
  error?: string;
}

export function usePayment() {
  const [isProcessing, setIsProcessing] = useState(false);

  const initiatePayment = async (orderId: string, email: string): Promise<PaymentResult> => {
    setIsProcessing(true);
    try {
      const { data, error } = await supabase.functions.invoke("process-payment", {
        body: {
          orderId,
          email,
          callbackUrl: `${window.location.origin}/orders/${orderId}?verify=true`,
        },
      });

      if (error) throw error;
      return data as PaymentResult;
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Payment failed";
      return { success: false, error: message };
    } finally {
      setIsProcessing(false);
    }
  };

  const verifyPayment = async (reference: string, orderId: string): Promise<VerifyResult> => {
    try {
      const { data, error } = await supabase.functions.invoke("verify-payment", {
        body: { reference, orderId },
      });

      if (error) throw error;
      return data as VerifyResult;
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Verification failed";
      return { success: false, error: message };
    }
  };

  return {
    initiatePayment,
    verifyPayment,
    isProcessing,
  };
}
