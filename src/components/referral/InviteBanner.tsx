import { Gift } from "lucide-react";
import { useReferralInvite } from "@/hooks/useReferral";
import { getSavedInviteCode } from "@/lib/customerInvite";

/** "Amina invited you: first-buyer prices on your first order", shown while signing up with a saved invite. */
export function InviteBanner() {
  const code = getSavedInviteCode();
  const { data: invite } = useReferralInvite(code);
  if (!code || !invite?.valid) return null;
  return (
    <div className="mb-5 flex items-start gap-3 rounded-2xl border border-primary/20 bg-primary/5 p-3 text-sm">
      <Gift className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
      <p>
        <span className="font-semibold">{invite.inviter} invited you.</span>{" "}
        Sign up to get first-buyer prices on your first order.
      </p>
    </div>
  );
}
