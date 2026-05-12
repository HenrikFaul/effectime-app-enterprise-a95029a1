ALTER TABLE public.features ADD COLUMN IF NOT EXISTS sort_order integer NOT NULL DEFAULT 0;
CREATE INDEX IF NOT EXISTS idx_features_sort_order ON public.features (sort_order);