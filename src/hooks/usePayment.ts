import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";

interface PaymentResult {
  success: boolean;
  authorization_url?: string;
  reference?: string;
  error?: string;
  code?: string;
}

interface VerifyResult {
  success: boolean;
  status?: string;
  amount?: number;
  reference?: string;
  paidAt?: string;
  error?: string;
  code?: string;
}

/** Server code meaning Paystack isn't connected yet (the order is kept; paying later works). */
export const PAYMENTS_NOT_CONFIGURED = "payments_not_configured";

/** Reads the server's own explanation from a failed function call instead of "non-2xx status code". */
async function readFunctionError(error: unknown, fallback: string): Promise<{ message: string; code?: string }> {
  const context = (error as { context?: unknown })?.context;
  if (context instanceof Response) {
    try {
      const body = await context.clone().json();
      if (typeof body?.error === "string" && body.error) return { message: body.error, code: body.code };
    } catch {
      // Body was not JSON; fall back to the generic message.
    }
  }
  return { message: fallback };
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

      if (error) {
        const details = await readFunctionError(error, "We couldn't start the payment. Please try again.");
        console.error("[payment] process-payment failed", { orderId, details, error });
        return { success: false, error: details.message, code: details.code };
      }
      return data as PaymentResult;
    } catch (error: unknown) {
      console.error("[payment] process-payment threw", { orderId, error });
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

      if (error) {
        const details = await readFunctionError(error, "We couldn't check the payment yet. Please refresh in a moment.");
        console.error("[payment] verify-payment failed", { orderId, reference, details, error });
        return { success: false, error: details.message, code: details.code };
      }
      return data as VerifyResult;
    } catch (error: unknown) {
      console.error("[payment] verify-payment threw", { orderId, reference, error });
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
