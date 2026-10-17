import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { CheckCircle2, Circle, ChevronRight } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { supabase } from "@/integrations/supabase/client";
import { useShopSetup } from "@/hooks/useShopSetup";
import { cn } from "@/lib/utils";

interface Step {
  done: boolean;
  title: string;
  hint: string;
  href: string;
  optional?: boolean;
}

/** "Get your shop ready" steps for new sellers. Hides itself once the required steps are done. */
export function ShopSetupChecklist({ vendorId }: { vendorId: string | null }) {
  const { data: required } = useShopSetup(!!vendorId);
  const { data } = useQuery({
    queryKey: ["shop-setup", vendorId],
    enabled: !!vendorId,
    queryFn: async () => {
      const [profile, products, verified] = await Promise.all([
        supabase.from("profiles").select("avatar_url, store_name").eq("id", vendorId!).maybeSingle(),
        supabase.from("products").select("id", { count: "exact", head: true }).eq("vendor_id", vendorId!).is("deleted_at", null),
        supabase.rpc("vendor_is_verified", { p_vendor_id: vendorId! }),
      ]);
      return {
        hasLogo: !!profile.data?.avatar_url,
        productCount: products.count ?? 0,
        isVerified: verified.data === true,
      };
    },
  });

  if (!data || !required) return null;

  const steps: Step[] = [
    { done: true, title: "Open your shop", hint: "Done", href: "/vendor/settings" },
    { done: data.hasLogo, title: "Add your logo and banner", hint: "Buyers trust shops with branding", href: "/vendor/settings" },
    { done: required.has_phone, title: "Add your phone number", hint: "Required: customers and riders call you", href: "/vendor/settings" },
    { done: required.has_location, title: "Save your exact shop location", hint: "Required: tap \"Use my current location\" in your shop", href: "/vendor/settings" },
    { done: required.has_payout, title: "Add your bank account", hint: "Required: this is where your money is paid", href: "/vendor/settings" },
    { done: data.productCount > 0, title: "List your first product", hint: "Photos, price, sizes and colours", href: "/vendor/products/new" },
    { done: data.isVerified, title: "Get verified", hint: "Badge + homepage promotions", href: "/vendor/verification", optional: true },
  ];

  if (steps.filter((s) => !s.optional).every((s) => s.done)) return null;

  const doneCount = steps.filter((s) => s.done).length;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Get your shop ready</CardTitle>
        <div className="flex items-center gap-3 pt-1">
          <Progress value={(doneCount / steps.length) * 100} className="h-2" />
          <span className="flex-shrink-0 text-xs text-muted-foreground tabular-nums">{doneCount}/{steps.length}</span>
        </div>
      </CardHeader>
      <CardContent className="p-2 pt-0">
        <ul>
          {steps.map((step) => (
            <li key={step.title}>
              <Link
                to={step.href}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-2 py-2.5 hover:bg-muted/60",
                  step.done && "pointer-events-none",
                )}
                aria-disabled={step.done}
              >
                {step.done ? (
                  <CheckCircle2 className="h-5 w-5 flex-shrink-0 text-green-600" />
                ) : (
                  <Circle className="h-5 w-5 flex-shrink-0 text-muted-foreground" />
                )}
                <div className="min-w-0 flex-1">
                  <p className={cn("text-sm font-medium", step.done && "text-muted-foreground line-through")}>
                    {step.title}
                    {step.optional && <span className="ml-1 text-xs font-normal text-muted-foreground">(optional)</span>}
                  </p>
                  {!step.done && <p className="text-xs text-muted-foreground">{step.hint}</p>}
                </div>
                {!step.done && <ChevronRight className="h-4 w-4 text-muted-foreground" />}
              </Link>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
