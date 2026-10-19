-- Stricter "is this bank account in your own name?" check.
--
-- Before: any two shared words passed, so "Muhammad Abubakar" matched every
-- other Muhammad Abubakar's account, and "Aisha Musa Bello" matched "Musa Bello".
-- Now every word of the Kano Kaftan profile name (titles like Alhaji left out)
-- must be in the bank's account name, and at least two of them must be full
-- words. Extra bank words (a middle name) are fine, and a middle name may match
-- a bank initial ("Ahmed Isa Musa" vs "AHMED I MUSA"). Common spellings count
-- as the same word (Mohammed = Muhammad), as do joined names
-- (Abdulrahman = Abdul Rahman).
--
-- The "friend has the same name as the inviter" check now needs the same full
-- name both ways, so relatives who share a surname aren't blocked.

/** One name word in a standard spelling. */
CREATE OR REPLACE FUNCTION public.canonical_name_word(p_word TEXT)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT CASE
    WHEN p_word IN ('MUHAMMAD', 'MUHAMMED', 'MOHAMMED', 'MOHAMMAD', 'MOHAMED', 'MUHAMED', 'MUHD', 'MOHD', 'MUHAMAD', 'MAMMAN') THEN 'MUHAMMAD'
    WHEN p_word IN ('ABUBAKAR', 'ABUBAKR', 'ABUBAKRE', 'ABUBAKARR') THEN 'ABUBAKAR'
    WHEN p_word IN ('AISHA', 'AISHAT', 'AYSHA', 'AISHAH', 'AYISHA') THEN 'AISHA'
    WHEN p_word IN ('FATIMA', 'FATIMAH', 'FATIMOH') THEN 'FATIMA'
    WHEN p_word IN ('IBRAHIM', 'IBRAHEEM', 'IBRAHIMA') THEN 'IBRAHIM'
    WHEN p_word IN ('YUSUF', 'YUSUPH', 'YUSSUF', 'YUSUFU', 'YOUSUF') THEN 'YUSUF'
    WHEN p_word IN ('ABDULLAHI', 'ABDULLAH', 'ABDALLAH') THEN 'ABDULLAHI'
    WHEN p_word IN ('SULAIMAN', 'SULEIMAN', 'SULEMAN', 'SULAYMAN') THEN 'SULAIMAN'
    WHEN p_word IN ('UMAR', 'UMARU', 'UMORU', 'OMAR') THEN 'UMAR'
    WHEN p_word IN ('USMAN', 'USMANU', 'USMAAN', 'OSMAN') THEN 'USMAN'
    WHEN p_word IN ('HAUWA', 'HAUWAU', 'HAWWA') THEN 'HAUWA'
    WHEN p_word IN ('ZAINAB', 'ZAINABU', 'ZAYNAB') THEN 'ZAINAB'
    WHEN p_word IN ('KHADIJA', 'KHADIJAH', 'HADIZA', 'HADIZAH', 'KHADIJAT') THEN 'KHADIJA'
    WHEN p_word IN ('MARYAM', 'MARYAMU', 'MARIAM') THEN 'MARYAM'
    WHEN p_word IN ('ISMAIL', 'ISMAILA', 'ISMA''IL') THEN 'ISMAIL'
    WHEN p_word IN ('MUSTAPHA', 'MUSTAFA') THEN 'MUSTAPHA'
    WHEN p_word IN ('ALIYU', 'ALIYYU') THEN 'ALIYU'
    ELSE p_word
  END;
$$;

/** Name words in order: upper case, letters only, titles dropped, standard spellings. Single letters (initials) are kept. */
CREATE OR REPLACE FUNCTION public.name_tokens(p_name TEXT)
RETURNS TEXT[]
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT COALESCE(array_agg(public.canonical_name_word(w) ORDER BY n), '{}')
  FROM unnest(regexp_split_to_array(
         btrim(upper(regexp_replace(replace(COALESCE(p_name, ''), '''', ''), '[^A-Za-z]+', ' ', 'g'))), '\s+'))
       WITH ORDINALITY AS t(w, n)
  WHERE w <> ''
    AND w NOT IN ('MR', 'MRS', 'MS', 'MISS', 'DR', 'ALH', 'ALHAJI', 'ALHAJA', 'ALHAJJI', 'HAJIYA', 'HAJIA', 'HAJJA',
                  'MALAM', 'MALLAM', 'MAL', 'CHIEF', 'ENGR', 'PROF', 'BARR', 'SIR', 'MADAM', 'ARC', 'PHARM', 'SHEIKH', 'USTAZ');
$$;

/** Full name words (two letters or more), without repeats. Kept for the "has a first name and surname" check. */
CREATE OR REPLACE FUNCTION public.name_words(p_name TEXT)
RETURNS TEXT[]
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT COALESCE(array_agg(DISTINCT w), '{}')
  FROM unnest(public.name_tokens(p_name)) w
  WHERE char_length(w) >= 2;
$$;

/**
 * True when the bank's account name is the profile's owner: every profile word is in
 * the account name (or a middle word matches an initial), with at least two full-word matches.
 */
CREATE OR REPLACE FUNCTION public.names_match(p_profile_name TEXT, p_account_name TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $$
DECLARE
  v_profile TEXT[] := ARRAY(SELECT w FROM unnest(public.name_tokens(p_profile_name)) w WHERE char_length(w) >= 2);
  v_account TEXT[] := public.name_tokens(p_account_name);
  v_full TEXT[];
  v_initials TEXT[];
  v_n INTEGER;
  v_i INTEGER := 1;
  v_matched INTEGER := 0;
BEGIN
  v_n := cardinality(v_profile);
  IF v_n < 2 THEN
    RETURN false;
  END IF;

  -- Bank words, plus each pair joined (ABDUL RAHMAN also counts as ABDULRAHMAN).
  v_full := ARRAY(SELECT w FROM unnest(v_account) w WHERE char_length(w) >= 2);
  v_full := v_full || ARRAY(
    SELECT public.canonical_name_word(v_full[k] || v_full[k + 1])
    FROM generate_series(1, cardinality(v_full) - 1) k);
  v_initials := ARRAY(SELECT w FROM unnest(v_account) w WHERE char_length(w) = 1);

  WHILE v_i <= v_n LOOP
    IF v_profile[v_i] = ANY (v_full) THEN
      v_matched := v_matched + 1;
    ELSIF v_i < v_n AND public.canonical_name_word(v_profile[v_i] || v_profile[v_i + 1]) = ANY (v_full) THEN
      -- The profile splits a name the bank writes as one word.
      v_matched := v_matched + 2;
      v_i := v_i + 1;
    ELSIF v_i > 1 AND v_i < v_n AND left(v_profile[v_i], 1) = ANY (v_initials) THEN
      -- A middle name the bank only has as an initial: allowed, but doesn't count as a full match.
      NULL;
    ELSE
      RETURN false;
    END IF;
    v_i := v_i + 1;
  END LOOP;

  RETURN v_matched >= 2;
END;
$$;

/** Same person's name on both accounts (each name's words are all in the other). */
CREATE OR REPLACE FUNCTION public.names_same(p_a TEXT, p_b TEXT)
RETURNS BOOLEAN
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT public.names_match(p_a, p_b) AND public.names_match(p_b, p_a);
$$;

/** Pays the inviter once the invited buyer has a verified bank account (and isn't the inviter's own). */
CREATE OR REPLACE FUNCTION public.reward_referral_if_verified(p_user_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ref public.customer_referrals%ROWTYPE;
  v_mine public.customer_bank_accounts%ROWTYPE;
  v_amount NUMERIC;
  v_friend TEXT;
BEGIN
  SELECT * INTO v_ref FROM public.customer_referrals WHERE referred_id = p_user_id AND status = 'joined' FOR UPDATE;
  IF NOT FOUND THEN
    RETURN;
  END IF;
  SELECT * INTO v_mine FROM public.customer_bank_accounts WHERE user_id = p_user_id;
  IF NOT FOUND THEN
    RETURN;
  END IF;
  -- The friend's verified name can't be the inviter's own full name: that's a second account.
  IF EXISTS (SELECT 1 FROM public.customer_bank_accounts b WHERE b.user_id = v_ref.referrer_id
             AND public.names_same(b.account_name, v_mine.account_name)) THEN
    UPDATE public.customer_referrals SET status = 'cancelled' WHERE id = v_ref.id;
    RETURN;
  END IF;

  SELECT COALESCE(referral_referrer_credit, 0) INTO v_amount FROM public.platform_settings WHERE id = 1;
  UPDATE public.customer_referrals SET status = 'rewarded', rewarded_at = now() WHERE id = v_ref.id;
  IF v_amount > 0 THEN
    INSERT INTO public.customer_credits (user_id, amount, kind, referral_id, note)
    VALUES (v_ref.referrer_id, v_amount, 'referral_reward', v_ref.id, 'Your friend verified their account')
    ON CONFLICT DO NOTHING;
    SELECT COALESCE(NULLIF(split_part(btrim(full_name), ' ', 1), ''), 'Your friend') INTO v_friend FROM public.profiles WHERE id = p_user_id;
    INSERT INTO public.notifications (user_id, title, message, type, category, action_url, metadata)
    VALUES (v_ref.referrer_id, format('+%s K² credit', to_char(v_amount, 'FM999,999,990')),
            format('%s verified their account. You also get %s%% of their orders as K² credit.', v_friend,
                   to_char((SELECT referral_order_percent FROM public.platform_settings WHERE id = 1), 'FM990.##')),
            'success', 'promotion', '/invite', jsonb_build_object('referral_id', v_ref.id));
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.canonical_name_word(TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.name_tokens(TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.name_words(TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.names_match(TEXT, TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.names_same(TEXT, TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.reward_referral_if_verified(UUID) FROM PUBLIC, anon, authenticated;
