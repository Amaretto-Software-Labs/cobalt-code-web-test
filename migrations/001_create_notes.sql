CREATE TABLE IF NOT EXISTS notes (
  id UUID PRIMARY KEY,
  title TEXT NOT NULL DEFAULT '',
  body TEXT NOT NULL DEFAULT '',
  color TEXT NOT NULL DEFAULT 'coral'
    CHECK (color IN ('coral', 'gold', 'sage', 'sky', 'lilac', 'graphite')),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS notes_updated_at_id_idx
  ON notes (updated_at DESC, id DESC);
