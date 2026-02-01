export interface Beer {
  id: string;
  brand: string;
  name: string;
  type: string | null;
  description: string | null;
  container: 'draught' | 'can' | 'bottle' | null;
  abv: number | null;
  created_at: Date;
  updated_at: Date;
}

export interface BeerWithRating extends Beer {
  rating: number | null;
  rating_id: string | null;
  rating_notes?: string | null;
}

export interface Rating {
  id: string;
  beer_id: string;
  user_id: string | null;
  score: number;
  notes: string | null;
  created_at: Date;
}

export interface Image {
  id: string;
  path: string;
  source: string | null;
  uploaded_at: Date;
}

export interface MenuParse {
  id: string;
  image_id: string;
  raw_text: string;
  parsed_beers: ParsedBeer[] | null;
  created_at: Date;
}

export interface ParsedBeer {
  text: string;
  confidence?: number;
  position?: {
    x: number;
    y: number;
  };
}

export interface BeerMatch {
  beer: BeerWithRating;
  similarity: number;
  matched_text: string;
}
