-- Restart order numbers at midnight India time.
-- CURRENT_DATE follows the database timezone (UTC), so the daily reset was
-- happening at 05:30 IST and late-night/early orders kept yesterday's count.

CREATE OR REPLACE FUNCTION public.next_order_no(p_branch_id UUID)
RETURNS BIGINT
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_today DATE := (now() AT TIME ZONE 'Asia/Kolkata')::date;
  v_no    BIGINT;
BEGIN
  INSERT INTO public.branch_order_sequences (branch_id, last_no, reset_date)
  VALUES (p_branch_id, 1, v_today)
  ON CONFLICT (branch_id) DO UPDATE
    SET last_no    = CASE
                       WHEN branch_order_sequences.reset_date < v_today THEN 1
                       ELSE branch_order_sequences.last_no + 1
                     END,
        reset_date = v_today
  RETURNING last_no INTO v_no;
  RETURN v_no;
END;
$$;
