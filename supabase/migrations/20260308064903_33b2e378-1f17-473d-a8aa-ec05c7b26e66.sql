
CREATE TABLE public.personal_availability (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  availability_date date NOT NULL,
  status text NOT NULL DEFAULT 'good',
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE (user_id, availability_date)
);

ALTER TABLE public.personal_availability ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own availability"
  ON public.personal_availability FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own availability"
  ON public.personal_availability FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own availability"
  ON public.personal_availability FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own availability"
  ON public.personal_availability FOR DELETE
  USING (auth.uid() = user_id);

CREATE TRIGGER update_personal_availability_updated_at
  BEFORE UPDATE ON public.personal_availability
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
