-- Add verified column to beers table
ALTER TABLE beers ADD COLUMN IF NOT EXISTS verified BOOLEAN NOT NULL DEFAULT FALSE;