-- Security advisor follow-ups.
-- guest_cart_session_ok had no fixed search_path.
ALTER FUNCTION public.guest_cart_session_ok(text) SET search_path = public;
-- A trigger function: nobody needs to call it directly.
REVOKE EXECUTE ON FUNCTION public.notify_admins_new_signup() FROM PUBLIC, anon, authenticated;
