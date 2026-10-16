import { useEffect } from "react";
import { Navigate, useParams } from "react-router-dom";
import { rememberReferral } from "@/lib/referral";

/** kanokaftan.shop/r/CODE: remembers who shared the link, then opens the seller sign-up page. */
export default function AmbassadorLink() {
  const { code } = useParams<{ code: string }>();

  useEffect(() => {
    rememberReferral(code);
  }, [code]);

  return <Navigate to="/sell" replace />;
}
