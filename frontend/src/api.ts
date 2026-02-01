import type { Beer, Rating, BeerMatch, MenuParseResult } from './types';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

// Helper to include auth token in all requests
const fetchWithAuth = (url: string, options: RequestInit = {}) => {
  const token = localStorage.getItem('authToken');
  return fetch(url, {
    ...options,
    headers: {
      ...options.headers,
      ...(token ? { 'X-Auth-Token': token } : {}),
    }
  });
};

// Beer API
export async function getBeers(query?: { q?: string; type?: string; container?: string }): Promise<Beer[]> {
  const params = new URLSearchParams();
  if (query?.q) params.append('q', query.q);
  if (query?.type) params.append('type', query.type);
  if (query?.container) params.append('container', query.container);
  
  const response = await fetchWithAuth(`${API_URL}/api/beers?${params}`);
  if (!response.ok) throw new Error('Failed to fetch beers');
  return response.json();
}

export async function getBeer(id: string): Promise<Beer> {
  const response = await fetchWithAuth(`${API_URL}/api/beers/${id}`);
  if (!response.ok) throw new Error('Failed to fetch beer');
  return response.json();
}

export async function createBeer(beer: Partial<Beer>): Promise<Beer> {
  const response = await fetchWithAuth(`${API_URL}/api/beers`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(beer),
  });
  if (!response.ok) throw new Error('Failed to create beer');
  return response.json();
}

export async function updateBeer(id: string, beer: Partial<Beer>): Promise<Beer> {
  const response = await fetchWithAuth(`${API_URL}/api/beers/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(beer),
  });
  if (!response.ok) throw new Error('Failed to update beer');
  return response.json();
}

export async function deleteBeer(id: string): Promise<void> {
  const response = await fetchWithAuth(`${API_URL}/api/beers/${id}`, {
    method: 'DELETE',
  });
  if (!response.ok) throw new Error('Failed to delete beer');
}

// Rating API
export async function createRating(rating: { beer_id: string; score: number; notes?: string }): Promise<Rating> {
  const response = await fetchWithAuth(`${API_URL}/api/ratings`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(rating),
  });
  if (!response.ok) throw new Error('Failed to create rating');
  return response.json();
}

export async function updateRating(id: string, rating: { score?: number; notes?: string }): Promise<Rating> {
  const response = await fetchWithAuth(`${API_URL}/api/ratings/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(rating),
  });
  if (!response.ok) throw new Error('Failed to update rating');
  return response.json();
}

// Menu/OCR API
export async function uploadMenu(file: File): Promise<{ image_id: string; message: string }> {
  const formData = new FormData();
  formData.append('file', file);
  
  const response = await fetchWithAuth(`${API_URL}/api/upload-menu`, {
    method: 'POST',
    body: formData,
  });
  if (!response.ok) throw new Error('Failed to upload menu');
  return response.json();
}

export async function getMenuParse(imageId: string): Promise<MenuParseResult> {
  const response = await fetchWithAuth(`${API_URL}/api/parse-menu/${imageId}`);
  if (!response.ok) {
    const error = new Error(`Failed to fetch parse results (${response.status})`);
    (error as any).status = response.status;
    throw error;
  }
  return response.json();
}

export async function matchDetected(data: { parsed_text?: string; parsed_beers?: string[] }): Promise<BeerMatch[]> {
  const response = await fetchWithAuth(`${API_URL}/api/match-detected`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!response.ok) throw new Error('Failed to match beers');
  return response.json();
}
