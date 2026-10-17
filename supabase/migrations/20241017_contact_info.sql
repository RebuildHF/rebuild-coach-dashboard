-- ============================================================
-- Add contact fields to public.users
-- ============================================================

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS email text,
  ADD COLUMN IF NOT EXISTS phone text;

-- ============================================================
-- Update get_coaches_for_digest() to use public.users.email
-- (not auth.users.email, which is empty for code-based logins)
-- ============================================================

CREATE OR REPLACE FUNCTION get_coaches_for_digest()
RETURNS TABLE (
  coach_id      uuid,
  name          text,
  email         text,
  enrolled_date text,
  data          jsonb
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    u.id                                       AS coach_id,
    u.name,
    u.email,
    (cd.data->>'enrolled_date')::text          AS enrolled_date,
    COALESCE(cd.data, '{}'::jsonb)             AS data
  FROM public.users u
  LEFT JOIN public.coach_data cd ON cd.coach_id = u.id
  WHERE u.role = 'coach';
$$;

GRANT EXECUTE ON FUNCTION get_coaches_for_digest() TO service_role;
