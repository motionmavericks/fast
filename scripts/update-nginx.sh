#!/bin/bash
cat > /etc/nginx/sites-available/lucidlink-api << 'EOL'
server {
    listen 80;
    server_name lucidlink.motionmavericks.com.au lucid.motionmavericks.com.au;

    location / {
        proxy_pass http://localhost:4000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
EOL

# Test Nginx config
nginx -t

# Reload Nginx
systemctl reload nginx

echo "Nginx configuration updated to include both domain names." 