# Deployment Guide - IKB CopyBot Stable Pro

This guide covers deploying the application to production.

## Prerequisites

- Node.js 18+ environment
- PostgreSQL database (managed or self-hosted)
- Domain name (for production)

## Environment Setup

Create a `.env` file with production values:

```env
# Database Connection
DATABASE_URL="postgresql://user:password@your-db-host:5432/ikb_copybot?schema=public"

# Application URL (your production domain)
NEXT_PUBLIC_APP_BASE_URL="https://your-domain.com"

# Cron Secret (generate a strong random string)
CRON_SECRET="your-secure-random-32-char-string"

# Optional: Helius API (for advanced features)
\1\"\"
\1\"\"
```

## Deployment Options

### Option 1: Vercel (Recommended)

Vercel offers seamless Next.js deployment with zero configuration.

#### Steps:

1. **Push to GitHub**
   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   git remote add origin https://github.com/your-username/ikb-copybot.git
   git push -u origin main
   ```

2. **Import to Vercel**
   - Go to [vercel.com](https://vercel.com)
   - Click "Import Project"
   - Connect your GitHub repository
   - Vercel will auto-detect Next.js

3. **Configure Environment Variables**
   - In Vercel dashboard → Settings → Environment Variables
   - Add all variables from your `.env` file
   - Click "Save"

4. **Deploy**
   - Click "Deploy"
   - Vercel will build and deploy automatically
   - Your app will be live at `your-project.vercel.app`

5. **Setup Database**
   ```bash
   # Run migrations on production database
   npx prisma migrate deploy
   ```

6. **Setup Cron Job** (for automated signal processing)
   Create `vercel.json` in project root:
   ```json
   {
     "crons": [{
       "path": "/api/signals/run",
       "schedule": "*/5 * * * *"
     }]
   }
   ```
   Push changes and Vercel will enable cron.

### Option 2: Railway

Railway provides easy deployment with managed PostgreSQL.

#### Steps:

1. **Create Railway Account**
   - Go to [railway.app](https://railway.app)
   - Sign up with GitHub

2. **Create New Project**
   - Click "New Project"
   - Select "Deploy from GitHub repo"
   - Connect your repository

3. **Add PostgreSQL**
   - Click "New" → "Database" → "PostgreSQL"
   - Railway will provision a database
   - Copy the `DATABASE_URL` from variables

4. **Configure Environment**
   - Go to Variables tab
   - Add all environment variables
   - Railway auto-detects build commands

5. **Deploy**
   - Railway builds and deploys automatically
   - Get your public URL from Settings

6. **Run Migrations**
   ```bash
   # In Railway CLI or dashboard
   npx prisma migrate deploy
   ```

7. **Setup Cron**
   Use an external cron service like [cron-job.org](https://cron-job.org):
   - URL: `https://your-app.railway.app/api/signals/run`
   - Method: POST
   - Headers: `Authorization: Bearer <CRON_TOKEN>
   - Schedule: Every 5 minutes

### Option 3: Self-Hosted (VPS)

Deploy to your own server (Ubuntu/Debian).

#### Requirements:
- Ubuntu 22.04+ or Debian 11+
- 2GB+ RAM
- Node.js 18+
- PostgreSQL 14+
- Nginx
- PM2 or systemd

#### Steps:

1. **Server Setup**
   ```bash
   # Update system
   sudo apt update && sudo apt upgrade -y

   # Install Node.js 18
   curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
   sudo apt install -y nodejs

   # Install PostgreSQL
   sudo apt install -y postgresql postgresql-contrib

   # Install PM2
   sudo npm install -g pm2
   ```

2. **Database Setup**
   ```bash
   # Create database
   sudo -u postgres psql
   CREATE DATABASE ikb_copybot;
   CREATE USER ikb_user WITH PASSWORD 'your_password';
   GRANT ALL PRIVILEGES ON DATABASE ikb_copybot TO ikb_user;
   \q
   ```

3. **Deploy Application**
   ```bash
   # Clone repository
   git clone https://github.com/your-username/ikb-copybot.git
   cd ikb-copybot

   # Install dependencies
   npm install

   # Create .env file
   nano .env
   # Add your environment variables

   # Run migrations
   npx prisma migrate deploy

   # Build application
   npm run build

   # Start with PM2
   pm2 start npm --name "ikb-copybot" -- start
   pm2 save
   pm2 startup
   ```

4. **Nginx Configuration**
   Create `/etc/nginx/sites-available/ikb-copybot`:
   ```nginx
   server {
       listen 80;
       server_name your-domain.com;

       location / {
           proxy_pass http://localhost:3000;
           proxy_http_version 1.1;
           proxy_set_header Upgrade $http_upgrade;
           proxy_set_header Connection 'upgrade';
           proxy_set_header Host $host;
           proxy_cache_bypass $http_upgrade;
       }
   }
   ```

   ```bash
   # Enable site
   sudo ln -s /etc/nginx/sites-available/ikb-copybot /etc/nginx/sites-enabled/
   sudo nginx -t
   sudo systemctl reload nginx
   ```

5. **SSL Certificate** (Let's Encrypt)
   ```bash
   sudo apt install -y certbot python3-certbot-nginx
   sudo certbot --nginx -d your-domain.com
   ```

6. **Setup Cron**
   ```bash
   # Edit crontab
   crontab -e

   # Add line (every 5 minutes):
   */5 * * * * curl -X POST -H "Authorization: Bearer <CRON_TOKEN> https://your-domain.com/api/signals/run  # gitleaks:allow (placeholder)
   ```

## Post-Deployment

### 1. Verify Health
Visit `https://your-domain.com/api/health` to check:
- Database connection
- API status
- Timestamp

### 2. Initial Setup
1. Connect a wallet (Phantom/Solflare/MetaMask)
2. Verify wallet appears in database
3. Manually trigger signals: `POST /api/signals/run`
4. Check actions are created
5. Test full pipeline with test action

### 3. Monitor Logs

**Vercel:**
- Dashboard → Deployments → View Logs

**Railway:**
- Dashboard → Deployments → View Logs

**Self-Hosted:**
```bash
pm2 logs ikb-copybot
# or
journalctl -u your-service-name -f
```

### 4. Database Management

Access Prisma Studio (locally connected to production):
```bash
# In local terminal with production DATABASE_URL
npx prisma studio
```

Or use database client:
```bash
psql $DATABASE_URL
```

## Security Checklist

- [ ] All environment variables are set correctly
- [ ] `CRON_SECRET` is a strong random string
- [ ] Database uses strong password
- [ ] Database is not publicly accessible (firewall rules)
- [ ] HTTPS is enabled (SSL certificate)
- [ ] Private keys are NEVER in the codebase
- [ ] `.env` is in `.gitignore`
- [ ] Kill switch is accessible and tested

## Monitoring

### Key Metrics to Monitor:
- API response times (`/api/health`)
- Database connection status
- Cron job execution (check `AuditLog` table)
- Action creation rate
- Failed transactions

### Suggested Tools:
- **Uptime**: UptimeRobot, Pingdom
- **Errors**: Sentry, LogRocket
- **Database**: pgAdmin, TablePlus
- **Logs**: Papertrail, Logtail

## Backup Strategy

### Database Backups

**Automated (recommended):**
```bash
# Daily backup script
#!/bin/bash
DATE=$(date +%Y%m%d_%H%M%S)
pg_dump $DATABASE_URL > backup_$DATE.sql
# Upload to S3, Dropbox, etc.
```

**Vercel/Railway:**
- Use built-in database backup features
- Or configure automated backup add-ons

### Code Backups
- Keep GitHub repository up to date
- Tag releases: `git tag -a v1.0.0 -m "Release 1.0.0"`

## Scaling Considerations

### Vertical Scaling (Single Server)
- Increase RAM/CPU on hosting provider
- Optimize database queries
- Add database indexes
- Enable connection pooling

### Horizontal Scaling (Multiple Servers)
- Use managed PostgreSQL (connection pooling required)
- Deploy multiple Next.js instances behind load balancer
- Ensure cron job runs on only one instance
- Share session state via Redis (if needed)

## Troubleshooting

### Build Fails
```bash
# Clear cache and rebuild
rm -rf .next node_modules
npm install
npm run build
```

### Database Connection Issues
- Verify `DATABASE_URL` is correct
- Check database is accessible (firewall rules)
- Test connection: `psql $DATABASE_URL`

### Cron Not Running
- Verify cron secret is correct
- Check cron job logs
- Manually test: `curl -X POST -H "Authorization: Bearer <CRON_TOKEN> /api/signals/run`

### Wallet Connection Fails
- Ensure `NEXT_PUBLIC_APP_BASE_URL` is correct
- Check browser console for errors
- Verify wallet extension is installed and unlocked

## Rollback Procedure

If deployment fails:

1. **Vercel/Railway:**
   - Go to Deployments
   - Click previous working deployment
   - Click "Promote to Production"

2. **Self-Hosted:**
   ```bash
   git revert HEAD
   npm run build
   pm2 restart ikb-copybot
   ```

3. **Database Rollback:**
   ```bash
   # Restore from backup
   psql $DATABASE_URL < backup_YYYYMMDD_HHMMSS.sql
   ```

## Support

For deployment issues:
1. Check logs first
2. Verify environment variables
3. Test health endpoint
4. Review audit logs in database
5. Check GitHub issues

## License

See LICENSE file for deployment terms.
