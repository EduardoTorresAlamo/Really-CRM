-- Fix client_history RLS: replace FOR ALL with SELECT+INSERT only.
-- The table is documented as an immutable audit log; the prior FOR ALL policy
-- allowed realtors to DELETE their own audit trail entries.

DROP POLICY IF EXISTS "own history" ON client_history;

CREATE POLICY "own history read"
  ON client_history FOR SELECT
  USING (auth.uid() = realtor_id);

CREATE POLICY "own history insert"
  ON client_history FOR INSERT
  WITH CHECK (auth.uid() = realtor_id);
