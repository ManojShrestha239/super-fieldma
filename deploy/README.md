# Native Linux Production Deployment Runbook

Production runs natively on Linux (Ubuntu 22.04/24.04) with **PHP 8.4-FPM**, **MySQL 8**, **Redis 7**, **Nginx**, and **Supervisor** (Docker is for local development only).

## 1. Application Setup
```bash
cd /var/www/fieldma-monitor
composer install --no-dev --optimize-autoloader
npm ci && npm run build
php artisan migrate --force
php artisan config:cache
php artisan route:cache
php artisan view:cache
```

## 2. Nginx & Supervisor
```bash
sudo cp deploy/nginx.conf.example /etc/nginx/sites-available/fieldma-monitor.conf
sudo ln -sf /etc/nginx/sites-available/fieldma-monitor.conf /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx

sudo cp deploy/supervisor/fieldma-monitor.conf /etc/supervisor/conf.d/fieldma-monitor.conf
sudo supervisorctl reread
sudo supervisorctl update
sudo supervisorctl status
```

## 3. Scheduler Cron (1-Minute Fleet Polling)
Add to `www-data` crontab (`sudo crontab -u www-data -e`):
```cron
* * * * * cd /var/www/fieldma-monitor && php artisan schedule:run >> /dev/null 2>&1
```

## 4. Remote FieldMA Read-Only MySQL Provisioning
Create a dedicated least-privilege `SELECT`-only account on each remote FieldMA database server restricted to the Central Monitor server IP (or WireGuard subnet):
```sql
CREATE USER 'fieldma_monitor'@'10.0.0.5' IDENTIFIED BY 'STRONG_UNIQUE_PASSWORD';
GRANT SELECT ON target_fieldma_db.* TO 'fieldma_monitor'@'10.0.0.5';
FLUSH PRIVILEGES;
```

## 5. Zero-Downtime Worker Reload on Deploy
After every code deploy, restart the long-running queue workers and Reverb server so updated PHP classes are loaded:
```bash
php artisan queue:restart
sudo supervisorctl restart fieldma-reverb
```
