-- Medication stock movements are signed deltas:
-- restock adds units; adjustment may add or subtract units after a physical count.
-- Keep zero deltas out of the ledger.

DO $$
DECLARE
  v_constraint text;
BEGIN
  -- Remove any older quantity-only check (for example quantity > 0).
  -- The replacement below validates quantity according to movement type.
  FOR v_constraint IN
    SELECT conname
    FROM pg_constraint
    WHERE conrelid = 'public.medication_stock_movements'::regclass
      AND contype = 'c'
      AND pg_get_constraintdef(oid) ILIKE '%quantity%'
  LOOP
    EXECUTE format(
      'ALTER TABLE public.medication_stock_movements DROP CONSTRAINT %I',
      v_constraint
    );
  END LOOP;
END $$;

ALTER TABLE public.medication_stock_movements
  ADD CONSTRAINT medication_stock_movements_quantity_sign_check
  CHECK (
    (movement_type = 'restock' AND quantity > 0)
    OR
    (movement_type = 'adjustment' AND quantity <> 0)
  );
