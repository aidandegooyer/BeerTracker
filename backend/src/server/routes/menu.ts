import { FastifyRequest, FastifyReply } from 'fastify';
import { MultipartFile } from '@fastify/multipart';
import path from 'path';
import fs from 'fs';
import fsPromises from 'fs/promises';
import { pipeline } from 'stream/promises';
import pool from '../db/pool';
import { extractTextFromImage, parseBeerNames } from '../ocr';
import { BeerMatch } from '../../types';

interface MatchDetectedBody {
  parsed_text?: string;
  parsed_beers?: string[];
}

interface MenuParseParams {
  image_id: string;
}

/**
 * Upload menu image and optionally run OCR
 */
export async function uploadMenu(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<{ image_id: string; message: string }> {
  try {
    const data = await request.file();
    
    if (!data) {
      reply.code(400);
      return reply.send({ error: 'No file uploaded' });
    }
    
    // Validate file type
    const allowedMimeTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    if (!allowedMimeTypes.includes(data.mimetype)) {
      reply.code(400);
      return reply.send({ error: 'Invalid file type. Only JPEG, PNG, and WebP are allowed.' });
    }
    
    // Generate unique filename
    const filename = `${Date.now()}_${data.filename}`;
    const uploadDir = process.env.UPLOAD_DIR || './uploads';
    const filepath = path.join(uploadDir, filename);
    
    // Ensure upload directory exists
    await fsPromises.mkdir(uploadDir, { recursive: true });
    
    // Save file
    await pipeline(data.file, fs.createWriteStream(filepath));
    
    // Insert image record
    const imageResult = await pool.query(
      'INSERT INTO images (path, source) VALUES ($1, $2) RETURNING id',
      [filepath, data.filename]
    );
    
    const imageId = imageResult.rows[0].id;
    
    console.log(`Image uploaded with ID: ${imageId}, starting background OCR...`);
    
    // Start OCR in background (don't wait for it)
    processMenuImage(imageId, filepath).catch(err => {
      console.error('Background OCR processing failed:', err);
      console.error('Error stack:', err.stack);
    });
    
    reply.code(201);
    return {
      image_id: imageId,
      message: 'Image uploaded. OCR processing started.'
    };
  } catch (error: any) {
    console.error('Upload error:', error);
    reply.code(500);
    return reply.send({ error: 'Failed to upload image' });
  }
}

/**
 * Process menu image with OCR (background task)
 */
async function processMenuImage(imageId: string, filepath: string): Promise<void> {
  try {
    console.log(`Starting OCR for image ${imageId}...`);
    
    // Run OCR
    const rawText = await extractTextFromImage(filepath);
    console.log(`OCR raw text extracted (${rawText.length} chars)`);
    
    // Parse beer names
    const parsedBeers = parseBeerNames(rawText);
    console.log(`Parsed ${parsedBeers.length} potential beers`);
    
    // Store results
    const result = await pool.query(
      'INSERT INTO menu_parses (image_id, raw_text, parsed_beers) VALUES ($1, $2, $3) RETURNING id',
      [imageId, rawText, JSON.stringify(parsedBeers.map(text => ({ text })))]
    );
    
    console.log(`OCR completed for image ${imageId}. Inserted parse record ${result.rows[0].id}. Found ${parsedBeers.length} potential beers.`);
  } catch (error) {
    console.error(`OCR processing failed for image ${imageId}:`, error);
    
    // Store error result
    await pool.query(
      'INSERT INTO menu_parses (image_id, raw_text, parsed_beers) VALUES ($1, $2, $3)',
      [imageId, `OCR failed: ${error}`, null]
    );
  }
}

/**
 * Get menu parse results by image ID
 */
export async function getMenuParse(
  request: FastifyRequest<{ Params: MenuParseParams }>,
  reply: FastifyReply
): Promise<any> {
  const { image_id } = request.params;
  
  console.log(`Fetching menu parse for image_id: ${image_id}`);
  
  const result = await pool.query(
    'SELECT * FROM menu_parses WHERE image_id = $1 ORDER BY created_at DESC LIMIT 1',
    [image_id]
  );
  
  console.log(`Query returned ${result.rows.length} rows`);
  
  if (result.rows.length === 0) {
    reply.code(404);
    return { error: 'No parse results found. OCR may still be processing.' };
  }
  
  return result.rows[0];
}

/**
 * Match detected beer names against database using fuzzy matching
 */
export async function matchDetected(
  request: FastifyRequest<{ Body: MatchDetectedBody }>,
  reply: FastifyReply
): Promise<BeerMatch[]> {
  const { parsed_text, parsed_beers } = request.body;
  
  let beerNames: string[];
  
  if (parsed_beers && Array.isArray(parsed_beers)) {
    beerNames = parsed_beers;
  } else if (parsed_text) {
    beerNames = parseBeerNames(parsed_text);
  } else {
    reply.code(400);
    return reply.send({ error: 'Either parsed_text or parsed_beers is required' });
  }
  
  if (beerNames.length === 0) {
    return [];
  }
  
  const matches: BeerMatch[] = [];
  
  for (const beerName of beerNames) {
    // Use pg_trgm similarity for fuzzy matching
    const query = `
      SELECT 
        b.*,
        r.score as rating,
        r.id as rating_id,
        GREATEST(
          similarity(b.name, $1),
          similarity(b.brand, $1),
          similarity(b.brand || ' ' || b.name, $1)
        ) as similarity
      FROM beers b
      LEFT JOIN LATERAL (
        SELECT id, score FROM ratings WHERE beer_id = b.id ORDER BY created_at DESC LIMIT 1
      ) r ON true
      WHERE 
        similarity(b.name, $1) > 0.3
        OR similarity(b.brand, $1) > 0.3
        OR similarity(b.brand || ' ' || b.name, $1) > 0.3
      ORDER BY similarity DESC
      LIMIT 3
    `;
    
    const result = await pool.query(query, [beerName]);
    
    for (const row of result.rows) {
      matches.push({
        beer: row,
        similarity: parseFloat(row.similarity),
        matched_text: beerName
      });
    }
  }
  
  // Sort by similarity and remove duplicates
  const uniqueMatches = Array.from(
    new Map(matches.map(m => [m.beer.id, m])).values()
  ).sort((a, b) => b.similarity - a.similarity);
  
  return uniqueMatches;
}
