export interface Beer {
  id: string;
  brand: string;
  name: string;
  type: string | null;
  description: string | null;
  container: 'draught' | 'can' | 'bottle' | null;
  abv: number | null;
  created_at: string;
  updated_at: string;
  rating?: number | null;
  rating_id?: string | null;
  rating_notes?: string | null;
}

export interface Rating {
  id: string;
  beer_id: string;
  user_id: string | null;
  score: number;
  notes: string | null;
  created_at: string;
}

export interface BeerMatch {
  beer: Beer;
  similarity: number;
  matched_text: string;
}

export interface MenuParseResult {
  id: string;
  image_id: string;
  raw_text: string;
  parsed_beers: { text: string }[] | null;
  created_at: string;
}
