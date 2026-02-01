import Fastify from 'fastify';
import cors from '@fastify/cors';
import multipart from '@fastify/multipart';
import fastifyStatic from '@fastify/static';
import dotenv from 'dotenv';
import path from 'path';
import * as beerRoutes from './routes/beers';
import * as ratingRoutes from './routes/ratings';
import * as menuRoutes from './routes/menu';

// Load environment variables
dotenv.config();

const PORT = parseInt(process.env.PORT || '3000', 10);
const HOST = process.env.HOST || '0.0.0.0';

// Create Fastify instance
const fastify = Fastify({
  logger: {
    level: process.env.LOG_LEVEL || 'info'
  }
});

// Register plugins
async function registerPlugins() {
  // CORS - Allow local network access
  const allowedOrigins = [
    'http://localhost:5173',
    /^http:\/\/192\.168\.\d{1,3}\.\d{1,3}:5173$/,  // Local network
    /^http:\/\/10\.\d{1,3}\.\d{1,3}\.\d{1,3}:5173$/,  // Alternative local network
  ];
  
  await fastify.register(cors, {
    origin: (origin, cb) => {
      if (!origin || allowedOrigins.some(allowed => 
        typeof allowed === 'string' ? allowed === origin : allowed.test(origin)
      )) {
        cb(null, true);
      } else {
        cb(new Error('Not allowed'), false);
      }
    },
    credentials: true
  });
  
  // Simple session-based auth (if enabled)
  const validTokens = new Set<string>();
  
  // Auth validation function
  fastify.decorate('validateAuth', async function(request: any, reply: any) {
    if (!process.env.AUTH_USERNAME || !process.env.AUTH_PASSWORD) {
      return; // Auth disabled
    }
    
    const token = request.headers['x-auth-token'];
    if (!token || !validTokens.has(token)) {
      return reply.code(401).send({ error: 'Unauthorized' });
    }
  });
  
  // Store validTokens in fastify for access in routes
  fastify.decorate('validTokens', validTokens);
  
  // Multipart for file uploads
  await fastify.register(multipart, {
    limits: {
      fileSize: parseInt(process.env.MAX_FILE_SIZE || '10485760', 10) // 10MB default
    }
  });
  
  // Serve static files from uploads directory in production
  if (process.env.NODE_ENV === 'production') {
    const uploadDir = path.join(__dirname, '../../uploads');
    await fastify.register(fastifyStatic, {
      root: uploadDir,
      prefix: '/uploads/'
    });
  }
}

// Register routes
function registerRoutes() {
  // Apply auth to all routes if enabled
  const authOptions = process.env.AUTH_USERNAME && process.env.AUTH_PASSWORD 
    ? { onRequest: (fastify as any).validateAuth } 
    : {};
  
  // Health check
  fastify.get('/health', async () => {
    return { status: 'ok', timestamp: new Date().toISOString() };
  });
  
  // Login endpoint
  fastify.post('/api/login', async (request, reply) => {
    const { username, password } = request.body as any;
    
    if (username === process.env.AUTH_USERNAME && password === process.env.AUTH_PASSWORD) {
      const token = Buffer.from(`${username}:${password}:${Date.now()}`).toString('base64');
      (fastify as any).validTokens.add(token);
      return { success: true, token };
    }
    
    reply.code(401);
    return { error: 'Invalid credentials' };
  });
  
  // Beer routes
  fastify.get('/api/beers', authOptions, beerRoutes.listBeers);
  fastify.get('/api/beers/:id', authOptions, beerRoutes.getBeer);
  fastify.post('/api/beers', authOptions, beerRoutes.createBeer);
  fastify.put('/api/beers/:id', authOptions, beerRoutes.updateBeer);
  fastify.delete('/api/beers/:id', authOptions, beerRoutes.deleteBeer);
  
  // Rating routes
  fastify.get('/api/ratings', authOptions, ratingRoutes.listRatings);
  fastify.post('/api/ratings', authOptions, ratingRoutes.createRating);
  fastify.put('/api/ratings/:id', authOptions, ratingRoutes.updateRating);
  
  // Menu/OCR routes
  fastify.post('/api/upload-menu', authOptions, menuRoutes.uploadMenu);
  fastify.get('/api/parse-menu/:image_id', authOptions, menuRoutes.getMenuParse);
  fastify.post('/api/match-detected', authOptions, menuRoutes.matchDetected);
}

// Error handler
fastify.setErrorHandler((error, request, reply) => {
  fastify.log.error(error);
  
  const statusCode = error.statusCode || 500;
  const message = statusCode === 500 
    ? 'Internal Server Error' 
    : error.message;
  
  reply.status(statusCode).send({
    error: message,
    statusCode
  });
});

// Start server
async function start() {
  try {
    await registerPlugins();
    registerRoutes();
    
    await fastify.listen({ port: PORT, host: HOST });
    
    console.log(`🍺 BeerTracker API server is running on http://${HOST}:${PORT}`);
    console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
}

// Graceful shutdown
const signals = ['SIGINT', 'SIGTERM'];
signals.forEach(signal => {
  process.on(signal, async () => {
    console.log(`\nReceived ${signal}, closing server gracefully...`);
    await fastify.close();
    process.exit(0);
  });
});

// Start the server
start();
