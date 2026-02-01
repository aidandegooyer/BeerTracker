# BeerTracker 🍺

A full-stack beer tracking application with OCR menu scanning. Track your favorite beers, rate them, and scan menus to see which beers you've already tried!

## Features

- **Beer Collection**: Add, edit, and search your beer collection
- **Rating System**: Rate beers from 1-10 with notes
- **Menu Scanner**: Take photos of beer menus and get matches with your rated beers
- **OCR Integration**: Automatic text extraction from menu images using Tesseract
- **Fuzzy Matching**: Smart matching algorithm using PostgreSQL trigram similarity
- **Fully Dockerized**: Easy deployment with Docker Compose

## Tech Stack

### Backend

- **Node.js** with **TypeScript**
- **Fastify** - Fast and low overhead web framework
- **PostgreSQL** - Database with pg_trgm extension for fuzzy search
- **Sharp** - High-performance image processing
- **Tesseract OCR** - Open-source OCR engine

### Frontend

- **React** with **TypeScript**
- **Vite** - Fast build tool
- **Tailwind CSS** - Utility-first CSS
- **shadcn/ui** - Beautiful, accessible components
- **Radix UI** - Unstyled, accessible components

## Getting Started

### Prerequisites

- Node.js 18+ (for local development)
- Docker and Docker Compose (recommended)
- PostgreSQL 15+ (if running without Docker)

### Environment Setup

1. **Clone the repository**

   ```bash
   git clone <your-repo-url>
   cd BeerTracker
   ```

2. **Set up environment variables**

   ```bash
   cp .env.example .env
   ```

3. **Backend environment variables** (`.env`)

   ```env
   DATABASE_URL=postgresql://beertracker:beertracker_dev@localhost:5432/beertracker
   PORT=3000
   NODE_ENV=development
   UPLOAD_DIR=./uploads
   MAX_FILE_SIZE=10485760
   TESSERACT_PATH=/usr/bin/tesseract
   ```

4. **Frontend environment variables** (`frontend/.env`)
   ```env
   VITE_API_URL=http://localhost:3000
   ```

### Running with Docker (Recommended)

1. **Start all services**

   ```bash
   docker-compose up --build
   ```

2. **Access the application**
   - Frontend: http://localhost:5173
   - Backend API: http://localhost:3000
   - Health check: http://localhost:3000/health

3. **Stop services**
   ```bash
   docker-compose down
   ```

### Running Locally

#### Backend

```bash
cd backend
npm install
npm run migrate  # Run database migrations
npm run dev     # Start development server
```

#### Frontend

```bash
cd frontend
npm install
npm run dev     # Start Vite dev server
```

## Database Setup

The application uses PostgreSQL with the following extensions:

- `uuid-ossp` - UUID generation
- `pg_trgm` - Trigram similarity for fuzzy matching
- `unaccent` - Remove accents for better search

Migrations are automatically run when using Docker Compose. For local setup:

```bash
cd backend
npm run migrate
```

## API Endpoints

### Beers

- `GET /api/beers` - List beers (supports search via `?q=query`)
- `POST /api/beers` - Create a new beer
- `GET /api/beers/:id` - Get beer details with ratings
- `PUT /api/beers/:id` - Update beer
- `DELETE /api/beers/:id` - Delete beer

### Ratings

- `GET /api/ratings` - List ratings (supports filtering via `?beer_id=uuid`)
- `POST /api/ratings` - Create a rating

### Menu Scanning

- `POST /api/upload-menu` - Upload menu image (starts OCR processing)
- `GET /api/parse-menu/:image_id` - Get OCR results
- `POST /api/match-detected` - Match detected beer names against database

## Deployment

### VPS Deployment ($5/month)

1. **Server Requirements**
   - 1 GB RAM minimum
   - 20 GB storage
   - Ubuntu 20.04+ or Debian 11+

2. **Install Docker**

   ```bash
   curl -fsSL https://get.docker.com -o get-docker.sh
   sh get-docker.sh
   ```

3. **Clone and configure**

   ```bash
   git clone <your-repo-url>
   cd BeerTracker
   cp .env.example .env
   # Edit .env with production values
   ```

4. **Deploy**

   ```bash
   docker-compose up -d
   ```

5. **Set up reverse proxy (optional)**
   Use Nginx or Caddy to handle SSL/TLS:

   ```bash
   # Install Caddy
   sudo apt install -y debian-keyring debian-archive-keyring apt-transport-https
   curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | sudo gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
   echo "deb [signed-by=/usr/share/keyrings/caddy-stable-archive-keyring.gpg] https://dl.cloudsmith.io/public/caddy/stable/deb/debian any-version main" | sudo tee /etc/apt/sources.list.d/caddy-stable.list
   sudo apt update
   sudo apt install caddy

   # Caddyfile example
   yourdomain.com {
       reverse_proxy localhost:3000
   }
   ```

### Resource Optimization

The Docker Compose file includes memory limits suitable for budget VPS:

- Database: 1GB limit
- Application: 768MB limit

To further optimize:

- Regular cleanup: `docker system prune -a --volumes`
- Rotate logs: Configure Docker logging driver
- Backup database: `docker exec beertracker-db pg_dump -U beertracker beertracker > backup.sql`

## Development

### Project Structure

```
BeerTracker/
├── backend/
│   ├── src/
│   │   ├── server/
│   │   │   ├── db/           # Database connection and migrations
│   │   │   ├── ocr/          # OCR processing
│   │   │   ├── routes/       # API route handlers
│   │   │   └── index.ts      # Server entry point
│   │   └── types/            # TypeScript type definitions
│   ├── migrations/           # SQL migrations
│   ├── uploads/              # Uploaded images
│   ├── Dockerfile
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── components/       # React components
│   │   │   └── ui/           # shadcn/ui components
│   │   ├── lib/              # Utilities
│   │   ├── api.ts            # API client
│   │   ├── types.ts          # TypeScript types
│   │   └── App.tsx           # Main app component
│   └── package.json
└── docker-compose.yml
```

### Adding shadcn/ui Components

```bash
cd frontend
npx shadcn@latest add <component-name>
```

### Running Tests

```bash
# Backend
cd backend
npm test

# Frontend
cd frontend
npm test
```

## License

ISC

## Contributing

Contributions welcome! Please open an issue or submit a pull request.
