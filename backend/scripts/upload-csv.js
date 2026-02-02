#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const csv = require('csv-parse/sync');
const http = require('http');

const csvPath = process.argv[2];

if (!csvPath) {
  console.error('Usage: node upload-csv.js <path-to-csv>');
  process.exit(1);
}

if (!fs.existsSync(csvPath)) {
  console.error(`File not found: ${csvPath}`);
  process.exit(1);
}

const content = fs.readFileSync(csvPath, 'utf-8');
const records = csv.parse(content, {
  columns: true,
  skip_empty_lines: true,
  trim: true,
});

console.log(`Found ${records.length} beers to upload...\n`);

const apiUrl = process.env.API_URL || 'http://localhost:3000';
const auth = process.env.AUTH_PASSWORD ? Buffer.from(`user:${process.env.AUTH_PASSWORD}`).toString('base64') : null;

async function uploadBeer(beer) {
  const payload = {
    brand: (beer.Brand || '').trim(),
    name: (beer.Name || '').trim(),
    type: (beer.Type || '').trim() || null,
    description: (beer.Description || '').trim() || null,
    abv: beer['ABV %'] ? parseFloat(beer['ABV %']) : null,
  };

  // Skip if brand or name is missing
  if (!payload.brand || !payload.name) {
    console.log(`⚠️  Skipping: missing brand or name`);
    return false;
  }

  return new Promise((resolve) => {
    const postData = JSON.stringify(payload);
    const url = new URL(`${apiUrl}/api/beers`);

    const options = {
      hostname: url.hostname,
      port: url.port || 3000,
      path: url.pathname + url.search,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData),
      },
    };

    if (auth) {
      options.headers['Authorization'] = `Basic ${auth}`;
    }

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        if (res.statusCode === 200 || res.statusCode === 201) {
          console.log(`✓ ${payload.brand} - ${payload.name}`);
          resolve(true);
        } else {
          console.error(`✗ ${payload.brand} - ${payload.name}: ${res.statusCode}`);
          resolve(false);
        }
      });
    });

    req.on('error', (e) => {
      console.error(`✗ ${payload.brand} - ${payload.name}: ${e.message}`);
      resolve(false);
    });

    req.write(postData);
    req.end();
  });
}

async function uploadAll() {
  let success = 0;
  let failed = 0;

  for (const beer of records) {
    const result = await uploadBeer(beer);
    if (result) success++;
    else failed++;
    // Rate limit to avoid overwhelming server
    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  console.log(`\n✓ Success: ${success}`);
  console.log(`✗ Failed: ${failed}`);
}

uploadAll().catch(console.error);
