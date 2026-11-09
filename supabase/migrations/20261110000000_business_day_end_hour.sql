-- Restaurants open past midnight: let each one choose when its business day ends (IST).
-- 0 = midnight, 3 = 3:00 AM. Orders before that hour belong to the previous day.

ALTER TABLE public.restaurants
  ADD COLUMN IF NOT EXISTS day_end_hour SMALLINT NOT NULL DEFAULT 0
  CHECK (day_end_hour BETWEEN 0 AND 6);

CREATE OR REPLACE FUNCTION public.next_order_no(p_branch_id UUID)
RETURNS BIGINT
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_end_hour INT;
  v_today    DATE;
  v_no       BIGINT;
BEGIN
  SELECT r.day_end_hour INTO v_end_hour
  FROM public.branches b
  JOIN public.restaurants r ON r.id = b.restaurant_id
  WHERE b.id = p_branch_id;

  v_today := ((now() AT TIME ZONE 'Asia/Kolkata') - make_interval(hours => COALESCE(v_end_hour, 0)))::date;

  INSERT INTO public.branch_order_sequences (branch_id, last_no, reset_date)
  VALUES (p_branch_id, 1, v_today)
  ON CONFLICT (branch_id) DO UPDATE
    SET last_no    = CASE
                       WHEN branch_order_sequences.reset_date < v_today THEN 1
                       ELSE branch_order_sequences.last_no + 1
                     END,
        reset_date = GREATEST(branch_order_sequences.reset_date, v_today)
  RETURNING last_no INTO v_no;
  RETURN v_no;
END;
$$;
