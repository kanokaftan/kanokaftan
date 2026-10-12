import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { ChevronRight } from "lucide-react";
import { VendorLayout } from "@/components/vendor/VendorLayout";
import { HowYouEarn } from "@/components/vendor/HowYouEarn";
import { LanguageToggle } from "@/components/LanguageToggle";

/** Seller: the three ways to earn on Kano Kaftan and what we keep in each. */
export default function VendorEarnings() {
  const { t } = useTranslation();
  return (
    <VendorLayout title={t("seller.earn.pageTitle")}>
      <div className="mx-auto max-w-lg space-y-4">
        <div className="flex justify-end">
          <LanguageToggle />
        </div>
        <p className="text-sm text-muted-foreground">{t("seller.earn.intro")}</p>
        <HowYouEarn />
        <div className="space-y-2 text-sm text-muted-foreground">
          <p>{t("seller.earn.payoutNote")}</p>
          <p>{t("seller.earn.protectionNote")}</p>
        </div>
        <Link to="/vendor/settings" className="flex items-center justify-between rounded-2xl border bg-card px-4 py-3 text-sm font-medium active:bg-muted/60">
          {t("seller.earn.bankLink")}
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
        </Link>
      </div>
    </VendorLayout>
  );
}
