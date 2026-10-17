import { supabase } from "@/integrations/supabase/client";

/** What delete_product did: removed it, archived it (it was ordered before), or it was already gone. */
export type RemoveProductOutcome = "deleted" | "archived" | "gone";

const OUTCOMES: RemoveProductOutcome[] = ["deleted", "archived", "gone"];

/**
 * Deletes a product for its seller or an admin. A product that appears in past
 * orders is archived instead (hidden everywhere, out of carts and wishlists) so
 * order history, refunds and payouts keep working.
 */
export async function removeProduct(productId: string): Promise<RemoveProductOutcome> {
  const { data, error } = await supabase.rpc("delete_product", { p_product_id: productId });
  if (error) {
    console.error("[products] delete_product failed", { productId, error });
    throw new Error(error.message || "Couldn't delete this product. Please try again.");
  }
  return OUTCOMES.includes(data as RemoveProductOutcome) ? (data as RemoveProductOutcome) : "deleted";
}

export function removeProductMessage(outcome: RemoveProductOutcome): string {
  if (outcome === "archived") return "It's no longer shown anywhere. Past orders that include it are kept.";
  if (outcome === "gone") return "It had already been removed.";
  return "It has been removed from your shop.";
}
