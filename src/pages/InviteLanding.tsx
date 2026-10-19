import { useEffect } from "react";
import { Link, Navigate, useParams } from "react-router-dom";
import { Gift, Loader2 } from "lucide-react";
import { MobileLayout } from "@/components/layout/MobileLayout";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { useReferralInvite } from "@/hooks/useReferral";
import { normaliseInviteCode, saveInviteCode } from "@/lib/customerInvite";
import { naira } from "@/lib/naira";

/** kanokaftan.shop/invite/CODE: what a friend sees when they open your link. */
export default function InviteLanding() {
  const { code: rawCode } = useParams();
  const code = normaliseInviteCode(rawCode);
  const { user } = useAuth();
  const { data: invite, isLoading } = useReferralInvite(code);

  useEffect(() => {
    if (code) saveInviteCode(code);
  }, [code]);

  if (!code) return <Navigate to="/" replace />;

  return (
    <MobileLayout>
      <div className="mx-auto max-w-md px-4 py-8 text-center">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10">
          <Gift className="h-8 w-8 text-primary" />
        </div>
        {isLoading ? (
          <Loader2 className="mx-auto mt-6 h-6 w-6 animate-spin text-muted-foreground" />
        ) : invite?.valid ? (
          <>
            <h1 className="mt-5 font-display text-2xl font-bold">{invite.inviter} invited you to Kano Kaftan</h1>
            <p className="mt-2 text-muted-foreground">
              Create your account and get <span className="font-semibold text-foreground">{naira(Number(invite.friend_credit))}</span> off
              your first order of {naira(Number(invite.min_order))} or more.
            </p>
          </>
        ) : (
          <>
            <h1 className="mt-5 font-display text-2xl font-bold">Welcome to Kano Kaftan</h1>
            <p className="mt-2 text-muted-foreground">This invite isn't active any more, but you can still shop kaftans, shoes and caps from Kano's best sellers.</p>
          </>
        )}
        <div className="mt-8 space-y-3">
          {user ? (
            <Button asChild className="h-12 w-full rounded-xl text-base"><Link to="/">Start shopping</Link></Button>
          ) : (
            <Button asChild className="h-12 w-full rounded-xl text-base"><Link to="/auth?mode=register&as=shop">Create my account</Link></Button>
          )}
          {!user && (
            <Button asChild variant="outline" className="h-12 w-full rounded-xl text-base"><Link to="/">Look around first</Link></Button>
          )}
        </div>
        {!user && invite?.valid && (
          <p className="mt-4 text-xs text-muted-foreground">Your invite is saved on this phone for 30 days.</p>
        )}
      </div>
    </MobileLayout>
  );
}
