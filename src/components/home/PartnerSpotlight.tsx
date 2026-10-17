import { Link } from "react-router-dom";
import { ChevronRight } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ChoiceLabel, PartnerBadge } from "@/components/partners/PartnerMarks";
import { useHomepagePartners, type HomepagePartner } from "@/hooks/usePartners";

function PartnerCard({ partner }: { partner: HomepagePartner }) {
  const storeHref = partner.store_slug ? `/shop/${partner.store_slug}` : null;
  const initial = (partner.store_name || partner.name).charAt(0);

  return (
    <article className="overflow-hidden rounded-3xl border border-[#9A7400]/30 bg-card shadow-sm">
      {/* Banner: the partner's store banner, or a black-and-gold wash */}
      <div className="relative h-24 bg-gradient-to-br from-[#1c1917] via-[#2b2410] to-[#5c4613]">
        {partner.banner_url && (
          <img src={partner.banner_url} alt="" className="h-full w-full object-cover opacity-80" loading="lazy" decoding="async" />
        )}
        <PartnerBadge label={partner.badge_label} className="absolute left-3 top-3" />
      </div>

      <div className="-mt-8 px-4 pb-4">
        <Avatar className="h-16 w-16 border-4 border-card ring-2 ring-[#9A7400]/70">
          <AvatarImage src={partner.avatar_url || undefined} alt="" loading="lazy" />
          <AvatarFallback className="bg-[#1c1917] text-lg font-bold text-[#F5D67A]">{initial}</AvatarFallback>
        </Avatar>
        <h2 className="mt-2 font-display text-xl font-bold leading-tight">{partner.title}</h2>
        {partner.tagline && <p className="mt-1 text-sm text-muted-foreground">{partner.tagline}</p>}

        {storeHref && (
          <Link
            to={storeHref}
            className="mt-3 inline-flex h-10 items-center gap-1 rounded-full bg-foreground px-4 text-sm font-semibold text-background active:scale-95"
          >
            Visit {partner.store_name}
            <ChevronRight className="h-4 w-4" />
          </Link>
        )}

        {partner.picks.length > 0 && (
          <div className="mt-4 border-t pt-3">
            <ChoiceLabel label={partner.choice_label} size="sm" />
            <p className="mt-1 text-xs text-muted-foreground">Tailors and sellers {partner.name} recommends</p>
            <div className="-mx-4 mt-2 flex gap-3 overflow-x-auto px-4 py-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {partner.picks.map((shop) => (
                <Link key={shop.store_slug} to={`/shop/${shop.store_slug}`} className="flex w-[64px] shrink-0 flex-col items-center gap-1 active:opacity-70">
                  <Avatar className="h-14 w-14 ring-2 ring-[#9A7400]/50 ring-offset-2 ring-offset-card">
                    <AvatarImage src={shop.avatar_url || undefined} alt="" loading="lazy" />
                    <AvatarFallback className="bg-primary font-bold text-primary-foreground">{shop.store_name.charAt(0)}</AvatarFallback>
                  </Avatar>
                  <span className="w-full truncate text-center text-[11px] font-medium">{shop.store_name}</span>
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>
    </article>
  );
}

/** Homepage spot for partners (Founding Partner Agreement 2(d)), with the shops they picked. */
export function PartnerSpotlight() {
  const { data: partners } = useHomepagePartners();
  if (!partners?.length) return null;
  return (
    <section aria-label="Partners" className="space-y-3 px-4 py-3">
      {partners.map((partner) => <PartnerCard key={partner.id} partner={partner} />)}
    </section>
  );
}
