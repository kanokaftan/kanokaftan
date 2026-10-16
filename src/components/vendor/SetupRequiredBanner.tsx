import { Link, useLocation } from "react-router-dom";
import { AlertTriangle, ChevronRight } from "lucide-react";
import { missingSetupItems, useShopSetup } from "@/hooks/useShopSetup";

/**
 * Shown on every seller page until phone, exact location and bank account are
 * all saved. Until then the seller can't add or switch on products.
 */
export function SetupRequiredBanner() {
  const { data: setup } = useShopSetup();
  const { pathname } = useLocation();
  if (!setup || setup.complete) return null;

  const missing = missingSetupItems(setup);
  const onSettings = pathname.startsWith("/vendor/settings");

  const body = (
    <>
      <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
      <div className="min-w-0 flex-1">
        <p className="font-semibold">Finish your shop setup to sell</p>
        <p className="mt-0.5 text-[13px]">
          Required: {missing.join(", ")}. You can't add products until these are saved.
        </p>
      </div>
      {!onSettings && <ChevronRight className="mt-0.5 h-5 w-5 shrink-0" />}
    </>
  );

  const className =
    "mb-4 flex items-start gap-3 rounded-2xl border border-amber-300 bg-amber-50 p-3.5 text-sm text-amber-950 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-100";

  return onSettings ? (
    <div role="alert" className={className}>{body}</div>
  ) : (
    <Link to="/vendor/settings" role="alert" className={`${className} active:opacity-80`}>{body}</Link>
  );
}
