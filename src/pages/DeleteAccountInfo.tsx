import { Link } from "react-router-dom";
import { Trash2 } from "lucide-react";
import { MobileLayout } from "@/components/layout/MobileLayout";
import { Button } from "@/components/ui/button";
import { DeleteAccountButton } from "@/components/account/DeleteAccountCard";
import { useAuth } from "@/contexts/AuthContext";
import { useDocumentMeta } from "@/hooks/useDocumentMeta";
import { CONTACT_EMAIL } from "@/components/legal/LegalPage";

/**
 * Public page explaining how to delete a Kano Kaftan account (Google Play asks
 * for a web link). Signed-in visitors can delete straight from here.
 */
export default function DeleteAccountInfo() {
  const { user } = useAuth();
  useDocumentMeta({ title: "Delete your account - Kano Kaftan", description: "How to delete your Kano Kaftan account and what happens to your data." });

  return (
    <MobileLayout>
      <div className="mx-auto max-w-xl space-y-5 px-4 pb-24 pt-6">
        <div>
          <h1 className="flex items-center gap-2 font-display text-2xl font-bold"><Trash2 className="h-6 w-6" />Delete your account</h1>
          <p className="mt-2 text-sm text-muted-foreground">You can delete your Kano Kaftan account at any time, in the app or on this page.</p>
        </div>

        <section className="rounded-2xl border bg-card p-4 text-sm">
          <h2 className="font-semibold">How to delete it</h2>
          <ol className="mt-2 list-decimal space-y-1 pl-5">
            <li>Sign in to Kano Kaftan (app or website).</li>
            <li>Go to Profile → Account settings.</li>
            <li>Tap "Delete my account" at the bottom, type DELETE and confirm.</li>
          </ol>
          <div className="mt-4">
            {user ? (
              <DeleteAccountButton className="w-full rounded-full border border-destructive/40 py-2.5 font-medium text-destructive hover:bg-destructive/5" />
            ) : (
              <Button asChild className="w-full rounded-full"><Link to="/auth?redirect=/delete-account">Sign in to delete your account</Link></Button>
            )}
          </div>
          <p className="mt-3 text-xs text-muted-foreground">
            Can't sign in? Email <a className="underline" href={`mailto:${CONTACT_EMAIL}?subject=Delete%20my%20account`}>{CONTACT_EMAIL}</a> from the
            email on your account and we'll delete it within 7 days.
          </p>
        </section>

        <section className="rounded-2xl border bg-card p-4 text-sm">
          <h2 className="font-semibold">What is deleted</h2>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            <li>Your name, email, phone number, delivery addresses and profile photo</li>
            <li>Your bank account details, K² balance and invite code</li>
            <li>Your chats, calls, favourites, follows and reviews</li>
            <li>Your shop, products and stories, if you sell on Kano Kaftan</li>
          </ul>
          <h2 className="mt-4 font-semibold">What is kept</h2>
          <p className="mt-1">
            Records of past orders and payments are kept without your name or contact details, because the law requires businesses to keep
            sales records. Accounts with no orders or sales are removed completely.
          </p>
          <h2 className="mt-4 font-semibold">When you can't delete yet</h2>
          <p className="mt-1">If you have an order in progress, an open dispute, or money still to be paid to you, finish those first so nobody loses money.</p>
        </section>

        <p className="text-center text-xs text-muted-foreground">
          See also our <Link to="/privacy" className="underline">Privacy Policy</Link>.
        </p>
      </div>
    </MobileLayout>
  );
}
