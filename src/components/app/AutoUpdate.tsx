import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { retryPendingUpdate } from "@/lib/registerServiceWorker";

/**
 * Updates install and reload by themselves. If one arrived while the person was
 * paying or filling in a form, it waits; moving to another page is the moment
 * to reload into the new version.
 */
export function AutoUpdate() {
  const location = useLocation();
  useEffect(() => {
    retryPendingUpdate();
  }, [location.pathname, location.search]);
  return null;
}
