
ALTER TABLE public.events 
  ADD COLUMN start_date date,
  ADD COLUMN end_date date;

-- Backfill existing data: set start_date to first day of month/year, end_date to last day
UPDATE public.events 
SET start_date = make_date(year, month, 1),
    end_date = (make_date(year, month, 1) + interval '1 month' - interval '1 day')::date;

-- Now make them NOT NULL
ALTER TABLE public.events 
  ALTER COLUMN start_date SET NOT NULL,
  ALTER COLUMN end_date SET NOT NULL;
