import { useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { useClaimReferral } from "@/hooks/useReferral";
import { clearSavedInviteCode, getSavedInviteCode, saveInviteCode } from "@/lib/customerInvite";
import { k2 } from "@/lib/k2";

/**
 * Keeps a customer invite code from any link (?invite=CODE; ambassador links use ?ref=) and, once the visitor is signed in
 * to a customer account, uses it once. The server decides whether it counts.
 */
export function ReferralWatcher() {
  const location = useLocation();
  const { user, rolesLoading, isVendor, isAdmin } = useAuth();
  const claim = useClaimReferral();
  const triedFor = useRef<string | null>(null);

  useEffect(() => {
    const invite = new URLSearchParams(location.search).get("invite");
    if (invite) saveInviteCode(invite);
  }, [location.search]);

  useEffect(() => {
    if (!user || rolesLoading || triedFor.current === user.id) return;
    const code = getSavedInviteCode();
    if (!code) return;
    triedFor.current = user.id;
    // Seller and admin accounts can't use customer invites.
    if (isVendor || isAdmin) {
      clearSavedInviteCode();
      return;
    }
    claim.mutate(code, {
      onSuccess: (result) => {
        clearSavedInviteCode();
        if (result.claimed) {
          const credit = Number(result.credit ?? 0);
          if (credit > 0) {
            toast.success(`${k2(credit)} added`, { description: "Use it to pay for items in the app." });
          } else {
            toast.success("Invite accepted", {
              description: "You get first-buyer prices on your first order. Link your bank account at checkout to unlock them.",
            });
          }
        } else if (result.reason) {
          toast.info(result.reason);
        }
      },
      // Keep the code so it can be tried again next time the app opens.
      onError: (error) => console.error("[ReferralWatcher] claim failed", error),
    });
  }, [user, rolesLoading, isVendor, isAdmin, claim]);

  return null;
}
