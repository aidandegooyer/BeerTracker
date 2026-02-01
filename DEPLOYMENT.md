# BeerTracker Deployment Guide

## Pre-Deployment Checklist

### 1. Environment Variables

- [ ] Copy `backend/.env.production` to `backend/.env`
- [ ] Update `AUTH_USERNAME` and `AUTH_PASSWORD` with secure values
- [ ] Update `DATABASE_URL` with production database credentials
- [ ] Update `CORS_ORIGIN` with your frontend domain
- [ ] Copy `frontend/.env.production` to `frontend/.env.production.local`
- [ ] Update `VITE_API_URL` with your backend API URL

### 2. Database Setup

```bash
# Create production database
createdb beertracker

# Run migrations
cd backend
npm run migrate
```

### 3. Install Tesseract OCR

**macOS:**

```bash
brew install tesseract
```

**Ubuntu/Debian:**

```bash
sudo apt-get update
sudo apt-get install tesseract-ocr
```

### 4. Build Applications

**Backend:**

```bash
cd backend
npm install --production
npm run build
```

**Frontend:**

```bash
cd frontend
npm install
npm run build
```

## Deployment Options

### Option 1: VPS (DigitalOcean, Linode, etc.)

#### Setup Steps:

1. **Install Node.js & PostgreSQL**

```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs postgresql tesseract-ocr
```

2. **Setup PostgreSQL**

```bash
sudo -u postgres psql
CREATE DATABASE beertracker;
CREATE USER beertracker WITH PASSWORD 'your_password';
GRANT ALL PRIVILEGES ON DATABASE beertracker TO beertracker;
\q
```

3. **Deploy Backend**

```bash
# Upload files
scp -r backend user@your-server:/var/www/beertracker/

# On server
cd /var/www/beertracker/backend
npm install --production
npm run build
npm run migrate

# Setup PM2 for process management
npm install -g pm2
pm2 start dist/server/index.js --name beertracker-api
pm2 save
pm2 startup
```

4. **Deploy Frontend**

```bash
# Build locally
cd frontend
npm run build

# Upload to server
scp -r dist user@your-server:/var/www/beertracker/frontend/

# Setup Nginx
sudo nano /etc/nginx/sites-available/beertracker
```

**Nginx Config:**

```nginx
server {
    listen 80;
    server_name yourdomain.com;

    # Frontend
    location / {
        root /var/www/beertracker/frontend/dist;
        try_files $uri $uri/ /index.html;
    }

    # Backend API
    location /api {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_cache_bypass $http_upgrade;
    }
}
```

5. **Enable SSL with Certbot**

```bash
sudo apt-get install certbot python3-certbot-nginx
sudo certbot --nginx -d yourdomain.com
```

### Option 2: Docker Deployment

1. **Build and Run**

```bash
# Production docker-compose
docker-compose -f docker-compose.prod.yml up -d
```

2. **Create production compose file**
   Create `docker-compose.prod.yml`:

```yaml
version: "3.8"

services:
  db:
    image: postgres:15-alpine
    environment:
      POSTGRES_USER: beertracker
      POSTGRES_PASSWORD: ${DB_PASSWORD}
      POSTGRES_DB: beertracker
    volumes:
      - db-data:/var/lib/postgresql/data
    restart: always

  backend:
    build:
      context: ./backend
      dockerfile: Dockerfile
    environment:
      NODE_ENV: production
      DATABASE_URL: postgresql://beertracker:${DB_PASSWORD}@db:5432/beertracker
      AUTH_USERNAME: ${AUTH_USERNAME}
      AUTH_PASSWORD: ${AUTH_PASSWORD}
      CORS_ORIGIN: https://yourdomain.com
    volumes:
      - uploads:/app/uploads
    depends_on:
      - db
    restart: always

  frontend:
    build:
      context: ./frontend
      dockerfile: Dockerfile
      args:
        VITE_API_URL: https://api.yourdomain.com
    restart: always

  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf
      - ./ssl:/etc/nginx/ssl
    depends_on:
      - backend
      - frontend
    restart: always

volumes:
  db-data:
  uploads:
```

### Option 3: Cloud Platform (Heroku, Railway, Render)

#### Render.com Example:

1. Create a Web Service for backend
2. Create a Static Site for frontend
3. Create a PostgreSQL database
4. Set environment variables in dashboard

## Post-Deployment

### Monitoring

```bash
# Check backend logs
pm2 logs beertracker-api

# Or with Docker
docker logs beertracker-backend
```

### Backup Database

```bash
# Create backup
pg_dump beertracker > backup.sql

# Restore backup
psql beertracker < backup.sql
```

### Updates

```bash
# Pull latest code
git pull

# Backend
cd backend
npm install
npm run build
pm2 restart beertracker-api

# Frontend
cd frontend
npm install
npm run build
# Upload new dist files
```

## Security Notes

1. **Always use HTTPS in production**
2. **Set strong AUTH_USERNAME and AUTH_PASSWORD**
3. **Keep database credentials secure**
4. **Regular backups of database**
5. **Update dependencies regularly**: `npm audit fix`
6. **Firewall rules**: Only expose ports 80 and 443
7. **Rate limiting**: Consider adding rate limiting to API

## Troubleshooting

**Backend won't start:**

- Check `DATABASE_URL` is correct
- Ensure PostgreSQL is running
- Check logs: `pm2 logs` or `docker logs`

**OCR not working:**

- Verify Tesseract is installed: `tesseract --version`
- Check upload directory permissions

**401 Unauthorized:**

- Clear localStorage in browser
- Verify AUTH credentials match in backend .env
