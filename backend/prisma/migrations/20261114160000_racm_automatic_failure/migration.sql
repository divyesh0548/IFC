ALTER TABLE controls_reminder
  ADD COLUMN ineffective_reminder_sent_count INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN ineffective_final_reminder_sent_at TIMESTAMP(6);

-- Terminal conclusions cannot be changed by bulk operations or racing requests.
CREATE FUNCTION prevent_failed_racm_update() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF LOWER(TRIM(COALESCE(OLD.control_design_conclusion, ''))) = 'failed' THEN
    RAISE EXCEPTION 'Failed RACMs are read-only. Late submission and reopening are not available.' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER failed_racm_read_only BEFORE UPDATE ON control_forms
  FOR EACH ROW EXECUTE FUNCTION prevent_failed_racm_update();
