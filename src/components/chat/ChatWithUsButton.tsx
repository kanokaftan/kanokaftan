import { useState } from "react";
import { Headset, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useLocation, useNavigate } from "react-router-dom";
import { Button, type ButtonProps } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { useStartSupportConversation } from "@/hooks/useChat";
import { toast } from "sonner";

interface ChatWithUsButtonProps extends Omit<ButtonProps, "onClick"> {
  productId?: string;
  label?: string;
  /** Where chats open (sellers stay in the seller area). */
  chatBasePath?: string;
}

/** Opens a chat with the Kano Kaftan team (protected purchase / support). */
export function ChatWithUsButton({ productId, label = "Buy through Kano Kaftan", chatBasePath = "/messages", ...buttonProps }: ChatWithUsButtonProps) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const startSupport = useStartSupportConversation();
  const [sendingProduct, setSendingProduct] = useState(false);

  const requestPurchase = async (id: string): Promise<string> => {
    setSendingProduct(true);
    try {
      const { data, error } = await supabase.rpc("request_protected_purchase", { p_product_id: id });
      if (error) throw new Error(error.message);
      return data;
    } finally {
      setSendingProduct(false);
    }
  };

  const handleClick = async () => {
    if (!user) {
      toast.info("Sign in to chat with us");
      navigate(`/auth?redirect=${encodeURIComponent(location.pathname)}`);
      return;
    }
    try {
      // From a product: open the support chat with the product already sent.
      const conversationId = productId ? await requestPurchase(productId) : await startSupport.mutateAsync(undefined);
      navigate(`${chatBasePath}/${conversationId}`);
    } catch (error: unknown) {
      console.error("[ChatWithUsButton] could not open support chat", { productId, error });
      toast.error(error instanceof Error ? error.message : "Could not open chat");
    }
  };

  return (
    <Button {...buttonProps} onClick={handleClick} disabled={startSupport.isPending || sendingProduct || buttonProps.disabled}>
      {startSupport.isPending || sendingProduct ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Headset className="mr-2 h-4 w-4" />}
      {label}
    </Button>
  );
}
