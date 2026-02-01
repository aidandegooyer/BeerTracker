-- Update the ratings table to allow decimal values for scores
DO $$ 
BEGIN
  ALTER TABLE ratings ALTER COLUMN score TYPE NUMERIC(3,1);
EXCEPTION
  WHEN others THEN
    -- Column might already be updated, skip
    RAISE NOTICE 'Column already updated or error: %', SQLERRM;
END $$;
