ALTER TABLE notes ADD COLUMN IF NOT EXISTS owner_id TEXT;

UPDATE notes SET owner_id = 'legacy' WHERE owner_id IS NULL;

ALTER TABLE notes ALTER COLUMN owner_id SET DEFAULT 'legacy';
ALTER TABLE notes ALTER COLUMN owner_id SET NOT NULL;

CREATE INDEX IF NOT EXISTS notes_owner_updated_at_id_idx
  ON notes (owner_id, updated_at DESC, id DESC);
