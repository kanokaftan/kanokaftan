import { useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { setAnalyticsEnabled, track } from "@/lib/analytics";

/** Admin pages and admins' own browsing would skew the numbers. */
const UNTRACKED_PATH = /^\/admin(\/|$)/;

/** Records a page view on every screen change, plus searches on the products page. */
export function AnalyticsTracker() {
  const location = useLocation();
  const { isAdmin, isLoading, rolesLoading } = useAuth();
  const loading = isLoading || rolesLoading;
  const lastTracked = useRef<string | null>(null);

  useEffect(() => {
    setAnalyticsEnabled(!isAdmin);
  }, [isAdmin]);

  useEffect(() => {
    // Wait until we know whether this is an admin.
    if (loading || isAdmin || UNTRACKED_PATH.test(location.pathname)) return;
    const key = `${location.pathname}${location.search}`;
    if (lastTracked.current === key) return;
    const samePage = lastTracked.current?.split("?")[0] === location.pathname;
    lastTracked.current = key;

    // Filtering or paging on the same screen isn't a new page view.
    if (!samePage) track("page_view", { path: location.pathname });

    const search = new URLSearchParams(location.search).get("search")?.trim();
    if (location.pathname === "/products" && search) track("search", { search });
  }, [location.pathname, location.search, isAdmin, loading]);

  return null;
}
