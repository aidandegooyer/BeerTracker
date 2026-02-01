import { FastifyRequest, FastifyReply } from 'fastify';
import pool from '../db/pool';
import { Rating } from '../../types';

interface CreateRatingBody {
  beer_id: string;
  score: number;
  notes?: string;
  user_id?: string;
}

interface ListRatingsQuery {
  beer_id?: string;
}

export async function createRating(
  request: FastifyRequest<{ Body: CreateRatingBody }>,
  reply: FastifyReply
): Promise<Rating | { error: string }> {
  const { beer_id, score, notes, user_id } = request.body;
  
  if (!beer_id || !score) {
    reply.code(400);
    return { error: 'beer_id and score are required' };
  }
  
  if (score < 1 || score > 10) {
    reply.code(400);
    return { error: 'score must be between 1 and 10' };
  }
  
  // Check if beer exists
  const beerCheck = await pool.query('SELECT id FROM beers WHERE id = $1', [beer_id]);
  if (beerCheck.rows.length === 0) {
    reply.code(404);
    return { error: 'Beer not found' };
  }
  
  const query = `
    INSERT INTO ratings (beer_id, score, notes, user_id)
    VALUES ($1, $2, $3, $4)
    RETURNING *
  `;
  
  const result = await pool.query<Rating>(query, [
    beer_id,
    parseFloat(String(score)),
    notes || null,
    user_id || null
  ]);
  
  reply.code(201);
  return result.rows[0];
}

export async function listRatings(
  request: FastifyRequest<{ Querystring: ListRatingsQuery }>,
  reply: FastifyReply
): Promise<any[]> {
  const { beer_id } = request.query;
  
  let query = `
    SELECT r.*, b.name as beer_name, b.brand as beer_brand
    FROM ratings r
    JOIN beers b ON r.beer_id = b.id
  `;
  
  const params: string[] = [];
  
  if (beer_id) {
    query += ' WHERE r.beer_id = $1';
    params.push(beer_id);
  }
  
  query += ' ORDER BY r.created_at DESC';
  
  const result = await pool.query(query, params);
  return result.rows;
}

export async function updateRating(
  request: FastifyRequest<{ Params: { id: string }; Body: { score?: number; notes?: string } }>,
  reply: FastifyReply
): Promise<Rating | { error: string }> {
  const { id } = request.params;
  const { score, notes } = request.body;
  
  if (score !== undefined && (score < 1 || score > 10)) {
    reply.code(400);
    return { error: 'score must be between 1 and 10' };
  }
  
  const updates: string[] = [];
  const params: any[] = [];
  let paramCount = 1;
  
  if (score !== undefined) {
    updates.push(`score = $${paramCount}`);
    params.push(parseFloat(String(score)));
    paramCount++;
  }
  
  if (notes !== undefined) {
    updates.push(`notes = $${paramCount}`);
    params.push(notes || null);
    paramCount++;
  }
  
  if (updates.length === 0) {
    reply.code(400);
    return { error: 'No fields to update' };
  }
  
  params.push(id);
  const query = `
    UPDATE ratings 
    SET ${updates.join(', ')}
    WHERE id = $${paramCount}
    RETURNING *
  `;
  
  const result = await pool.query<Rating>(query, params);
  
  if (result.rows.length === 0) {
    reply.code(404);
    return { error: 'Rating not found' };
  }
  
  return result.rows[0];
}
