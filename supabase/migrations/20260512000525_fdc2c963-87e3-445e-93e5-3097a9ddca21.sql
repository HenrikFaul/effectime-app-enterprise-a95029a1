CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'ms365-sync-every-15min') THEN
    PERFORM cron.unschedule('ms365-sync-every-15min');
  END IF;
END $$;

SELECT cron.schedule(
  'ms365-sync-every-15min',
  '*/15 * * * *',
  $$
  SELECT net.http_post(
    url:='https://oezlzzmzzvbvinuysxaz.supabase.co/functions/v1/ms365-sync',
    headers:='{"Content-Type": "application/json", "apikey": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9lemx6em16enZidmludXlzeGF6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc4Mzk3OTMsImV4cCI6MjA5MzQxNTc5M30.vww0zsBc659ojBEfRmSpI9iJpem1ebaBFjMeBWX19Nk"}'::jsonb,
    body:='{"action":"cron_sync_all"}'::jsonb
  ) AS request_id;
  $$
);