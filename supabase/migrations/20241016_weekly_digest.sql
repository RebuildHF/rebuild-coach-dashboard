-- ============================================================
-- Weekly digest helpers
-- ============================================================

-- Helper function: join public.users + auth.users + coach_data
-- Returns one row per coach with their email and full data blob.
-- Runs with SECURITY DEFINER so the Edge Function (service role)
-- can safely join auth.users without exposing it to anon/user roles.
CREATE OR REPLACE FUNCTION get_coaches_for_digest()
RETURNS TABLE (
  coach_id  uuid,
  name      text,
  email     text,
  enrolled_date text,
  data      jsonb
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    u.id                                       AS coach_id,
    u.name,
    au.email,
    (cd.data->>'enrolled_date')::text          AS enrolled_date,
    COALESCE(cd.data, '{}'::jsonb)             AS data
  FROM public.users u
  JOIN auth.users au ON au.id = u.id
  LEFT JOIN public.coach_data cd ON cd.coach_id = u.id
  WHERE u.role = 'coach';
$$;

-- Grant execute to the service_role used by Edge Functions
GRANT EXECUTE ON FUNCTION get_coaches_for_digest() TO service_role;


-- ============================================================
-- pg_cron: fire the weekly-digest Edge Function every Friday
-- 9 pm UTC = Saturday 7 am AEST (UTC+10)
-- ============================================================

-- Enable pg_cron extension if not already enabled
CREATE EXTENSION IF NOT EXISTS pg_cron;
-- Enable pg_net for HTTP calls from cron
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Remove existing job if it exists (idempotent re-run)
SELECT cron.unschedule('weekly-coach-digest')
WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'weekly-coach-digest'
);

-- Schedule the job
SELECT cron.schedule(
  'weekly-coach-digest',
  '0 21 * * 5',   -- Every Friday at 21:00 UTC (Saturday 7am AEST)
  $$
  SELECT net.http_post(
    url     := (SELECT 'https://' || project_ref || '.supabase.co/functions/v1/weekly-digest'
                FROM (SELECT 'ecdjmzvghhgydhputckj' AS project_ref) t),
    headers := jsonb_build_object(
      'Content-Type',  'application/json',
      'Authorization', 'Bearer ' || current_setting('app.service_role_key', true)
    ),
    body    := '{}'::jsonb
  );
  $$
);
