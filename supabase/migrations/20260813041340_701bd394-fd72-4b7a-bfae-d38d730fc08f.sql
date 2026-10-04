ALTER TABLE public.finance_categories DROP CONSTRAINT IF EXISTS finance_categories_kind_check;
ALTER TABLE public.finance_categories ADD CONSTRAINT finance_categories_kind_check CHECK (kind = ANY (ARRAY['expense'::text, 'income'::text, 'both'::text]));

-- de-duplicate any existing exact duplicates before enforcing uniqueness
DELETE FROM public.finance_categories a
USING public.finance_categories b
WHERE a.ctid > b.ctid
  AND a.user_id = b.user_id
  AND a.kind = b.kind
  AND lower(btrim(a.name)) = lower(btrim(b.name))
  AND NOT EXISTS (SELECT 1 FROM public.finance_transactions t WHERE t.category_id = a.id);

CREATE UNIQUE INDEX IF NOT EXISTS finance_categories_user_kind_name_uidx
  ON public.finance_categories (user_id, kind, lower(btrim(name)));