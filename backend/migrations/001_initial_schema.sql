-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";
CREATE EXTENSION IF NOT EXISTS "unaccent";

-- Beers table
CREATE TABLE beers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    brand TEXT NOT NULL,
    name TEXT NOT NULL,
    type TEXT,
    description TEXT,
    container TEXT CHECK (container IN ('draught', 'can', 'bottle', NULL)),
    abv NUMERIC(4,2),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Ratings table
CREATE TABLE ratings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    beer_id UUID NOT NULL REFERENCES beers(id) ON DELETE CASCADE,
    user_id UUID,
    score NUMERIC(3,1) NOT NULL CHECK (score >= 1 AND score <= 10),
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Images table
CREATE TABLE images (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    path TEXT NOT NULL,
    source TEXT,
    uploaded_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Menu parses table
CREATE TABLE menu_parses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    image_id UUID NOT NULL REFERENCES images(id) ON DELETE CASCADE,
    raw_text TEXT NOT NULL,
    parsed_beers JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create indexes for full-text search
CREATE INDEX idx_beers_fts ON beers USING GIN (
    to_tsvector('english', coalesce(brand, '') || ' ' || coalesce(name, '') || ' ' || coalesce(type, ''))
);

-- Create trigram indexes for fuzzy matching
CREATE INDEX idx_beers_brand_trgm ON beers USING GIN (brand gin_trgm_ops);
CREATE INDEX idx_beers_name_trgm ON beers USING GIN (name gin_trgm_ops);

-- Create index for ratings lookup
CREATE INDEX idx_ratings_beer_id ON ratings(beer_id);

-- Create index for menu parses lookup
CREATE INDEX idx_menu_parses_image_id ON menu_parses(image_id);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger to auto-update updated_at
CREATE TRIGGER update_beers_updated_at BEFORE UPDATE ON beers
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();


