import { useState } from "react";
import { Link } from "react-router-dom";
import { formatDistanceToNowStrict, parseISO } from "date-fns";
import { ChevronDown, ChevronRight, Smartphone } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import type { LiveVisitor, LiveVisitorRole } from "@/hooks/useTrafficAnalytics";
import { pageLabel, ZONE_COUNTRIES } from "@/lib/analyticsLabels";
import { cn } from "@/lib/utils";

const ROLE_LABEL: Record<LiveVisitorRole, string> = {
  guest: "Guest", buyer: "Customer", seller: "Seller", admin: "Admin", delivery: "Delivery",
};
const ROLE_TONE: Record<LiveVisitorRole, string> = {
  guest: "bg-muted text-muted-foreground",
  buyer: "bg-sky-500/15 text-sky-700 dark:text-sky-300",
  seller: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
  admin: "bg-primary/15 text-primary",
  delivery: "bg-indigo-500/15 text-indigo-700 dark:text-indigo-300",
};
function personLink(person: LiveVisitor): string | null {
  if (!person.user_id) return null;
  return person.role === "seller" ? `/admin/vendors/${person.user_id}` : `/admin/users/${person.user_id}`;
}

function LivePersonRow({ person }: { person: LiveVisitor }) {
  const name = person.name || person.email || (person.role === "guest" ? "Guest" : "Signed-in visitor");
  const link = personLink(person);
  const country = person.timezone ? ZONE_COUNTRIES[person.timezone] : undefined;
  const device = [person.device, person.os, person.app ? "installed app" : person.browser].filter(Boolean).join(" · ");
  const onSite = person.visit_started ? formatDistanceToNowStrict(parseISO(person.visit_started)) : null;
  const body = (
    <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 px-4 py-3">
      <Avatar className="h-9 w-9">
        <AvatarImage src={person.avatar_url || undefined} />
        <AvatarFallback className="text-xs">{person.role === "guest" ? <Smartphone className="h-4 w-4" /> : name.charAt(0).toUpperCase()}</AvatarFallback>
      </Avatar>
      <div className="min-w-0">
        <p className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5">
          <span className="break-words text-sm font-medium">{name}</span>
          <span className={cn("rounded-full px-1.5 py-0.5 text-[10px] font-semibold", ROLE_TONE[person.role])}>{ROLE_LABEL[person.role]}</span>
        </p>
        {person.store_name && person.role === "seller" && <p className="break-words text-xs text-muted-foreground">{person.store_name}</p>}
        <p className="break-words text-xs">
          <span className="text-muted-foreground">Now on </span>
          <span className="font-medium">{pageLabel(person.path)}</span>
        </p>
        <p className="break-words text-[11px] text-muted-foreground">
          {[device, country, onSite && `on site ${onSite}`, `${person.pages_seen} ${person.pages_seen === 1 ? "page" : "pages"}`, person.source && person.source !== "direct" ? `came from ${person.source}` : null]
            .filter(Boolean).join(" · ")}
        </p>
      </div>
      {link ? <ChevronRight className="h-4 w-4 text-muted-foreground" aria-hidden="true" /> : <span />}
    </div>
  );
  return link ? <Link to={link} className="block transition-colors hover:bg-muted/40">{body}</Link> : body;
}

/** Everyone on the site in the last 5 minutes: who they are and what they're looking at. */
export function LiveVisitorsList({ people, preview }: { people: LiveVisitor[]; preview: number }) {
  const [showAll, setShowAll] = useState(false);
  if (!people.length) return null;
  const shown = showAll ? people : people.slice(0, preview);
  return (
    <div className="border-t">
      <ul className="divide-y">
        {shown.map((person) => <li key={person.visitor_id}><LivePersonRow person={person} /></li>)}
      </ul>
      {people.length > preview && (
        <button type="button" onClick={() => setShowAll((v) => !v)} className="flex w-full items-center justify-center gap-1 border-t py-2.5 text-xs font-medium text-primary">
          {showAll ? "Show fewer" : `Show all ${people.length}`}
          <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", showAll && "rotate-180")} />
        </button>
      )}
    </div>
  );
}
