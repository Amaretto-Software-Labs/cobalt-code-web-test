CREATE TABLE notes (
  id UUID PRIMARY KEY,
  title TEXT NOT NULL DEFAULT '',
  body TEXT NOT NULL DEFAULT '',
  color TEXT NOT NULL DEFAULT 'coral'
    CHECK (color IN ('coral', 'gold', 'sage', 'sky', 'lilac', 'graphite')),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
