import { FastifyRequest, FastifyReply } from 'fastify';
import pool from '../db/pool';
import { BeerWithRating } from '../../types';

interface ListBeersQuery {
  q?: string;
  type?: string;
  container?: 'draught' | 'can' | 'bottle';
  limit?: number;
  offset?: number;
}

interface BeerParams {
  id: string;
}

interface CreateBeerBody {
  brand: string;
  name: string;
  type?: string;
  description?: string;
  container?: 'draught' | 'can' | 'bottle';
  abv?: number;
}

interface UpdateBeerBody extends Partial<CreateBeerBody> {}

export async function listBeers(
  request: FastifyRequest<{ Querystring: ListBeersQuery }>,
  reply: FastifyReply
): Promise<BeerWithRating[]> {
  const { q, type, container, limit = 50, offset = 0 } = request.query;
  
  let query = `
    SELECT 
      b.*,
      r.score as rating,
      r.id as rating_id
    FROM beers b
    LEFT JOIN LATERAL (
      SELECT id, score FROM ratings WHERE beer_id = b.id ORDER BY created_at DESC LIMIT 1
    ) r ON true
  `;
  
  const conditions: string[] = [];
  const params: any[] = [];
  let paramCount = 1;
  
  if (q) {
    conditions.push(`(
      to_tsvector('english', coalesce(b.brand, '') || ' ' || coalesce(b.name, '') || ' ' || coalesce(b.type, '')) @@ plainto_tsquery('english', $${paramCount})
      OR similarity(b.brand, $${paramCount}) > 0.3
      OR similarity(b.name, $${paramCount}) > 0.3
    )`);
    params.push(q);
    paramCount++;
  }
  
  if (type) {
    conditions.push(`b.type ILIKE $${paramCount}`);
    params.push(`%${type}%`);
    paramCount++;
  }
  
  if (container) {
    conditions.push(`b.container = $${paramCount}`);
    params.push(container);
    paramCount++;
  }
  
  if (conditions.length > 0) {
    query += ' WHERE ' + conditions.join(' AND ');
  }
  
  query += `
    ORDER BY b.created_at DESC
    LIMIT $${paramCount} OFFSET $${paramCount + 1}
  `;
  
  params.push(parseInt(String(limit)), parseInt(String(offset)));
  
  const result = await pool.query<BeerWithRating>(query, params);
  return result.rows;
}

export async function getBeer(
  request: FastifyRequest<{ Params: BeerParams }>,
  reply: FastifyReply
): Promise<BeerWithRating | { error: string }> {
  const { id } = request.params;
  
  const query = `
    SELECT 
      b.*,
      r.score as rating,
      r.id as rating_id,
      r.notes as rating_notes
    FROM beers b
    LEFT JOIN LATERAL (
      SELECT id, score, notes FROM ratings WHERE beer_id = b.id ORDER BY created_at DESC LIMIT 1
    ) r ON true
    WHERE b.id = $1
  `;
  
  const result = await pool.query<BeerWithRating>(query, [id]);
  
  if (result.rows.length === 0) {
    reply.code(404);
    return { error: 'Beer not found' };
  }
  
  return result.rows[0];
}

export async function createBeer(
  request: FastifyRequest<{ Body: CreateBeerBody }>,
  reply: FastifyReply
): Promise<any> {
  const { brand, name, type, description, container, abv } = request.body;
  
  if (!brand || !name) {
    reply.code(400);
    return { error: 'Brand and name are required' };
  }
  
  const query = `
    INSERT INTO beers (brand, name, type, description, container, abv)
    VALUES ($1, $2, $3, $4, $5, $6)
    RETURNING *
  `;
  
  const result = await pool.query(query, [
    brand,
    name,
    type || null,
    description || null,
    container || null,
    abv ? parseFloat(String(abv)) : null
  ]);
  
  reply.code(201);
  return result.rows[0];
}

export async function updateBeer(
  request: FastifyRequest<{ Params: BeerParams; Body: UpdateBeerBody }>,
  reply: FastifyReply
): Promise<any> {
  const { id } = request.params;
  const { brand, name, type, description, container, abv } = request.body;
  
  const updates: string[] = [];
  const params: any[] = [];
  let paramCount = 1;
  
  if (brand !== undefined) {
    updates.push(`brand = $${paramCount++}`);
    params.push(brand);
  }
  if (name !== undefined) {
    updates.push(`name = $${paramCount++}`);
    params.push(name);
  }
  if (type !== undefined) {
    updates.push(`type = $${paramCount++}`);
    params.push(type);
  }
  if (description !== undefined) {
    updates.push(`description = $${paramCount++}`);
    params.push(description);
  }
  if (container !== undefined) {
    updates.push(`container = $${paramCount++}`);
    params.push(container);
  }
  if (abv !== undefined) {
    updates.push(`abv = $${paramCount++}`);
    params.push(abv ? parseFloat(String(abv)) : null);
  }
  
  if (updates.length === 0) {
    reply.code(400);
    return { error: 'No fields to update' };
  }
  
  params.push(id);
  const query = `
    UPDATE beers
    SET ${updates.join(', ')}
    WHERE id = $${paramCount}
    RETURNING *
  `;
  
  const result = await pool.query(query, params);
  
  if (result.rows.length === 0) {
    reply.code(404);
    return { error: 'Beer not found' };
  }
  
  return result.rows[0];
}

export async function deleteBeer(
  request: FastifyRequest<{ Params: BeerParams }>,
  reply: FastifyReply
): Promise<void> {
  const { id } = request.params;
  
  const result = await pool.query('DELETE FROM beers WHERE id = $1 RETURNING id', [id]);
  
  if (result.rows.length === 0) {
    reply.code(404);
    return reply.send({ error: 'Beer not found' });
  }
  
  reply.code(204);
  return reply.send();
}
