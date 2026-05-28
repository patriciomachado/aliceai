# Alice - Production Deployment Guide 🚀

This document covers production architectures, SSL certifications, reverse-proxy structures, and VPS automated deployment procedures.

---

## 🏗️ Production Architecture Diagram

```text
               [ Internet (SSL/HTTPS) ]
                          │
                          ▼
            [ Cloudflare CDN / WAF Protection ]
                          │
                          ▼
          [ VPS Firewall (Allow 80/443 ONLY) ]
                          │
                          ▼
        [ Nginx Reverse Proxy (Port 80/443) ]
             /                         \
            /                           \
           ▼                             ▼
[ Frontend SPA (Port 3001) ]   [ Express REST Engine (Port 3000) ]
                                         │
                                         ▼
                                 [ Redis Cache Queue ]
```

---

## 🛠️ VPS Initial Configuration

### 1. Install Docker & Compose
Log in to your VPS machine via SSH and execute:
```bash
sudo apt update
sudo apt install -y docker.io docker-compose curl
sudo systemctl enable --now docker
```

### 2. Configure Directory
```bash
sudo mkdir -p /var/www/alice
sudo chown -R $USER:$USER /var/www/alice
```

### 3. Setup SSL via Certbot (Optional / Outside Compose)
For safe HTTPS domains configuration:
```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d app.alice.ai -d api.alice.ai
```

---

## 🚀 Execution & Continuous Deployment (CD)

### Automated Pipeline CD (GitHub Actions)
Our workflow in `.github/workflows/deploy.yml` takes care of continuous deployments:
1. Every push to the `main` branch triggers syntax lints, unit testing, and builds.
2. In success, it SSHs into your VPS server, enters `/var/www/alice`, pulls latest code, and executes `./scripts/deploy.sh`.

To activate the pipeline, configure these secrets in your GitHub repository:
- `VPS_HOST`: Public IP of your server.
- `VPS_USER`: SSH login username (e.g. `root` or `ubuntu`).
- `VPS_SSH_KEY`: Private SSH Key to access host.

### Production Logs Telemetry
View active production logs in VPS:
```bash
# View backend container logs
docker-compose logs -f backend

# View reverse proxy access logs
docker-compose logs -f nginx
```
