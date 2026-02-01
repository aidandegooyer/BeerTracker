# Deploy BeerTracker to DigitalOcean with Docker

Complete guide to deploying BeerTracker on DigitalOcean using Docker Compose.

## Prerequisites

- DigitalOcean account
- Domain name (optional but recommended for SSL)
- Local Docker installed (for testing)

## Cost Estimate

- **Basic Droplet**: $6-12/month (2GB RAM, 1 CPU recommended)
- **Domain**: $10-15/year (if you don't have one)
- **Total**: ~$10/month

## Part 1: Create DigitalOcean Droplet

### 1.1 Create Droplet

1. Go to [DigitalOcean](https://cloud.digitalocean.com/)
2. Click **Create** → **Droplets**
3. Choose configuration:
   - **Image**: Ubuntu 22.04 LTS
   - **Plan**: Basic ($12/month recommended - 2GB RAM, 1 CPU, 50GB SSD)
   - **Datacenter**: Choose closest to your users
   - **Authentication**: SSH Key (recommended) or Password
   - **Hostname**: beertracker

4. Click **Create Droplet**
5. Note your Droplet's IP address

### 1.2 Initial Server Setup

SSH into your droplet:

```bash
ssh root@YOUR_DROPLET_IP
```

Update system:

```bash
apt update && apt upgrade -y
```

Install Docker:

```bash
# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sh get-docker.sh

# Install Docker Compose
apt install docker-compose -y

# Verify installation
docker --version
docker-compose --version
```

Create a non-root user (optional but recommended):

```bash
adduser deployuser
usermod -aG sudo deployuser
usermod -aG docker deployuser

# Switch to new user
su - deployuser
```

## Part 2: Setup Domain (Optional but Recommended)

### 2.1 Configure DNS

In your domain registrar (GoDaddy, Namecheap, etc.):

**Option A: Single Domain**

```
Type: A
Name: @
Value: YOUR_DROPLET_IP
TTL: 3600
```

**Option B: Subdomain**

```
Type: A
Name: beer (creates beer.yourdomain.com)
Value: YOUR_DROPLET_IP
TTL: 3600
```

### 2.2 Wait for DNS Propagation

Wait 5-60 minutes, then verify:

```bash
dig yourdomain.com
# or
dig beer.yourdomain.com
```

## Part 3: Deploy Application

### 3.1 Clone Repository

On your droplet:

```bash
cd /home/deployuser
git clone YOUR_REPO_URL beertracker
cd beertracker
```

**Or upload files manually:**

```bash
# On your local machine
scp -r /path/to/BeerTracker root@YOUR_DROPLET_IP:/home/deployuser/
```

### 3.2 Configure Environment

Create production environment file:

```bash
cd /home/deployuser/beertracker
nano .env.production
```

Add this configuration (replace with your values):

```bash
# Database Configuration
DB_USER=beertracker
DB_PASSWORD=YOUR_SECURE_DB_PASSWORD_HERE
DB_NAME=beertracker

# Backend Authentication
AUTH_USERNAME=admin
AUTH_PASSWORD=YOUR_SECURE_AUTH_PASSWORD

# CORS Configuration
CORS_ORIGIN=https://yourdomain.com

# Frontend API URL
VITE_API_URL=https://yourdomain.com
```

**Important Security Notes:**

- Use strong, unique passwords
- Never commit `.env.production` to git
- Consider using a password manager to generate passwords

### 3.3 Update Nginx Configuration for SSL

Edit `frontend/nginx.conf` to handle both HTTP and HTTPS:

```bash
nano frontend/nginx.conf
```

Replace content with:

```nginx
server {
    listen 80;
    server_name yourdomain.com;  # Replace with your actual domain

    # Certbot challenge location
    location /.well-known/acme-challenge/ {
        root /var/www/certbot;
    }

    # Redirect all other traffic to HTTPS
    location / {
        return 301 https://$host$request_uri;
    }
}

server {
    listen 443 ssl http2;
    server_name yourdomain.com;  # Replace with your actual domain

    # SSL certificates (will be created by certbot)
    ssl_certificate /etc/letsencrypt/live/yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/yourdomain.com/privkey.pem;

    root /usr/share/nginx/html;
    index index.html;

    # Gzip compression
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_types text/plain text/css text/xml text/javascript application/x-javascript application/xml+rss application/json;

    # SPA routing
    location / {
        try_files $uri $uri/ /index.html;
    }

    # Cache static assets
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "no-referrer-when-downgrade" always;
}
```

### 3.4 Initial Deployment (HTTP only)

First, deploy without SSL to get the site running:

```bash
# Create SSL directories
mkdir -p ssl/certbot/conf
mkdir -p ssl/certbot/www

# Load environment variables
export $(cat .env.production | xargs)

# Build and start services
docker-compose -f docker-compose.production.yml up -d --build

# Check status
docker-compose -f docker-compose.production.yml ps

# View logs
docker-compose -f docker-compose.production.yml logs -f
```

Verify the site is accessible at `http://YOUR_DROPLET_IP`

### 3.5 Setup SSL with Let's Encrypt

Once the site is running on HTTP:

**First, temporarily enable HTTP-only mode:**

```bash
# Temporarily use HTTP-only nginx config
cat > frontend/nginx-temp.conf << 'EOF'
server {
    listen 80;
    server_name yourdomain.com;

    root /usr/share/nginx/html;
    index index.html;

    location /.well-known/acme-challenge/ {
        root /var/www/certbot;
    }

    location / {
        try_files $uri $uri/ /index.html;
    }
}
EOF

# Update docker to use temp config
docker-compose -f docker-compose.production.yml restart frontend
```

**Get SSL certificate:**

```bash
# Stop containers temporarily
docker-compose -f docker-compose.production.yml down

# Get certificate using certbot directly
docker run -it --rm \
  -v $(pwd)/ssl/certbot/conf:/etc/letsencrypt \
  -v $(pwd)/ssl/certbot/www:/var/www/certbot \
  -p 80:80 \
  certbot/certbot certonly \
  --standalone \
  -d yourdomain.com \
  --agree-tos \
  --email your-email@example.com \
  --non-interactive

# Restore original nginx config with SSL
cp frontend/nginx.conf.bak frontend/nginx.conf  # if you backed it up
# Or manually edit nginx.conf to include SSL blocks from step 3.3

# Restart everything
docker-compose -f docker-compose.production.yml up -d
```

**Setup automatic renewal:**

```bash
# Add cron job for certificate renewal
crontab -e

# Add this line (checks twice daily):
0 0,12 * * * cd /home/deployuser/beertracker && docker-compose -f docker-compose.production.yml run --rm certbot renew && docker-compose -f docker-compose.production.yml restart frontend
```

## Part 4: Verify Deployment

### 4.1 Check Services

```bash
# Check all containers are running
docker-compose -f docker-compose.production.yml ps

# Should see:
# beertracker-db        - Up
# beertracker-backend   - Up
# beertracker-frontend  - Up
```

### 4.2 Test Application

1. **Frontend**: Visit `https://yourdomain.com`
2. **Backend API**: `curl https://yourdomain.com/api/beers` (should get 401)
3. **Login**: Use AUTH_USERNAME and AUTH_PASSWORD from `.env.production`
4. **Upload Menu**: Test OCR functionality

### 4.3 Check Logs

```bash
# All logs
docker-compose -f docker-compose.production.yml logs

# Specific service
docker-compose -f docker-compose.production.yml logs backend
docker-compose -f docker-compose.production.yml logs frontend
docker-compose -f docker-compose.production.yml logs db

# Follow logs in real-time
docker-compose -f docker-compose.production.yml logs -f backend
```

## Part 5: Maintenance

### 5.1 Update Application

```bash
cd /home/deployuser/beertracker

# Pull latest changes
git pull

# Rebuild and restart
docker-compose -f docker-compose.production.yml up -d --build

# Cleanup old images
docker image prune -f
```

### 5.2 Backup Database

```bash
# Manual backup
docker exec beertracker-db pg_dump -U beertracker beertracker > backup_$(date +%Y%m%d).sql

# Automated daily backups
crontab -e

# Add:
0 2 * * * cd /home/deployuser/beertracker && docker exec beertracker-db pg_dump -U beertracker beertracker > /home/deployuser/backups/backup_$(date +\%Y\%m\%d).sql
```

**Setup backup directory:**

```bash
mkdir -p /home/deployuser/backups

# Keep only last 7 days
0 3 * * * find /home/deployuser/backups -name "backup_*.sql" -mtime +7 -delete
```

### 5.3 Restore Database

```bash
# Stop backend
docker-compose -f docker-compose.production.yml stop backend

# Restore
docker exec -i beertracker-db psql -U beertracker beertracker < backup_YYYYMMDD.sql

# Start backend
docker-compose -f docker-compose.production.yml start backend
```

### 5.4 View Disk Usage

```bash
# Docker disk usage
docker system df

# Cleanup unused resources
docker system prune -a --volumes
```

## Part 6: Troubleshooting

### Frontend Not Loading

```bash
# Check frontend logs
docker-compose -f docker-compose.production.yml logs frontend

# Check nginx config
docker exec beertracker-frontend nginx -t

# Rebuild frontend
docker-compose -f docker-compose.production.yml up -d --build frontend
```

### Backend API Errors

```bash
# Check backend logs
docker-compose -f docker-compose.production.yml logs backend

# Check environment variables
docker exec beertracker-backend env | grep -E "DATABASE|CORS|AUTH"

# Restart backend
docker-compose -f docker-compose.production.yml restart backend
```

### Database Connection Issues

```bash
# Check database status
docker-compose -f docker-compose.production.yml ps db

# Check database logs
docker-compose -f docker-compose.production.yml logs db

# Connect to database
docker exec -it beertracker-db psql -U beertracker -d beertracker

# Check connections
SELECT * FROM pg_stat_activity;
```

### OCR Not Working

```bash
# Check if Tesseract is installed in container
docker exec beertracker-backend tesseract --version

# Check uploads directory
docker exec beertracker-backend ls -la /app/uploads

# Check backend logs for OCR errors
docker-compose -f docker-compose.production.yml logs backend | grep -i ocr
```

### SSL Certificate Issues

```bash
# Check certificate expiry
docker run --rm -v $(pwd)/ssl/certbot/conf:/etc/letsencrypt certbot/certbot certificates

# Force renewal
docker run --rm -v $(pwd)/ssl/certbot/conf:/etc/letsencrypt -v $(pwd)/ssl/certbot/www:/var/www/certbot certbot/certbot renew --force-renewal

# Restart frontend to load new cert
docker-compose -f docker-compose.production.yml restart frontend
```

### Out of Memory

```bash
# Check memory usage
docker stats

# Increase droplet size in DigitalOcean dashboard
# Or add resource limits in docker-compose.production.yml
```

## Part 7: Security Hardening

### 7.1 Firewall Setup

```bash
# Enable UFW firewall
ufw allow OpenSSH
ufw allow 80/tcp
ufw allow 443/tcp
ufw enable

# Check status
ufw status
```

### 7.2 Fail2Ban (Prevent Brute Force)

```bash
apt install fail2ban -y

# Configure
cat > /etc/fail2ban/jail.local << EOF
[sshd]
enabled = true
port = ssh
logpath = /var/log/auth.log
maxretry = 3
bantime = 3600
EOF

systemctl restart fail2ban
```

### 7.3 Automatic Security Updates

```bash
apt install unattended-upgrades -y
dpkg-reconfigure --priority=low unattended-upgrades
```

## Part 8: Monitoring

### 8.1 Setup Uptime Monitoring

Use free services like:

- [UptimeRobot](https://uptimerobot.com) (free for 50 monitors)
- [Freshping](https://www.freshworks.com/website-monitoring/)

Monitor: `https://yourdomain.com`

### 8.2 Setup Logging

```bash
# Install logrotate for docker logs
cat > /etc/logrotate.d/docker-containers << EOF
/var/lib/docker/containers/*/*.log {
  rotate 7
  daily
  compress
  size=10M
  missingok
  delaycompress
  copytruncate
}
EOF
```

## Quick Reference Commands

```bash
# Start all services
docker-compose -f docker-compose.production.yml up -d

# Stop all services
docker-compose -f docker-compose.production.yml down

# View logs
docker-compose -f docker-compose.production.yml logs -f

# Restart service
docker-compose -f docker-compose.production.yml restart backend

# Rebuild and restart
docker-compose -f docker-compose.production.yml up -d --build

# Execute command in container
docker exec -it beertracker-backend sh

# Database backup
docker exec beertracker-db pg_dump -U beertracker beertracker > backup.sql

# Cleanup Docker
docker system prune -a

# Update code and restart
git pull && docker-compose -f docker-compose.production.yml up -d --build
```

## Cost Optimization

### Scale Down for Personal Use

For personal/low-traffic use, you can use the $6/month droplet:

- 1GB RAM, 1 CPU
- Update docker-compose.production.yml resource limits
- Consider using DigitalOcean's $4/month database instead

### Managed Database Alternative

Replace self-hosted PostgreSQL with DigitalOcean Managed Database:

- $15/month for managed PostgreSQL
- Automatic backups and high availability
- No need to manage database container

## Support

- [DigitalOcean Docs](https://docs.digitalocean.com/)
- [Docker Docs](https://docs.docker.com/)
- [Let's Encrypt Community](https://community.letsencrypt.org/)
