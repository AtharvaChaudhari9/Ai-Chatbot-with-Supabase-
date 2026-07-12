#!/bin/bash
# Automate setup of AWS EC2 instance for deploying the AI Chatbot application.
set -e

echo "=========================================================="
echo "Starting System Configuration for AI Chatbot..."
echo "=========================================================="

# 1. Detect Package Manager and Install Prerequisites
if command -v dnf &> /dev/null; then
    echo "Detected DNF (Amazon Linux 2023 / Fedora-based)"
    sudo dnf update -y
    sudo dnf install -y git docker nginx
    
    # Try to install docker-compose-plugin
    if sudo dnf install -y docker-compose-plugin; then
        echo "docker-compose-plugin installed via DNF"
    else
        echo "Installing docker-compose manually..."
        sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
        sudo chmod +x /usr/local/bin/docker-compose
        sudo ln -sf /usr/local/bin/docker-compose /usr/bin/docker-compose
    fi
elif command -v yum &> /dev/null; then
    echo "Detected YUM (Amazon Linux 2 / CentOS-based)"
    sudo yum update -y
    sudo yum install -y git
    
    # Check if amazon-linux-extras is available
    if command -v amazon-linux-extras &> /dev/null; then
        echo "Installing docker and nginx via amazon-linux-extras..."
        sudo amazon-linux-extras install docker nginx1 -y
    else
        sudo yum install -y docker nginx
    fi
    
    echo "Installing docker-compose manually..."
    sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
    sudo chmod +x /usr/local/bin/docker-compose
    sudo ln -sf /usr/local/bin/docker-compose /usr/bin/docker-compose
else
    echo "Unsupported package manager. Please install git, docker, docker-compose, and nginx manually."
    exit 1
fi

# 2. Configure Swap Space (Crucial for 1GB RAM EC2 Free Tier)
# Prevents OOM errors when building next.js frontend and backend images
if [ $(free -m | grep -i swap | awk '{print $2}') -eq 0 ]; then
    echo "Configuring 4GB Swap Space..."
    sudo dd if=/dev/zero of=/swapfile bs=1M count=4096
    sudo chmod 600 /swapfile
    sudo mkswap /swapfile
    sudo swapon /swapfile
    echo "/swapfile swap swap defaults 0 0" | sudo tee -a /etc/fstab
    echo "Swap space configured successfully!"
else
    echo "Swap space already exists. Skipping swap configuration."
fi

# 3. Start & Enable Docker
echo "Starting and configuring Docker..."
sudo systemctl enable docker
sudo systemctl start docker

# Add ec2-user to docker group to run docker commands without sudo
sudo usermod -aG docker ec2-user

# 4. Set up Nginx Reverse Proxy
echo "Configuring Nginx reverse proxy..."
NGINX_CONF="/etc/nginx/conf.d/chatbot.conf"

if [ ! -d "/etc/nginx/conf.d" ]; then
    sudo mkdir -p /etc/nginx/conf.d
fi

# Write Nginx configuration for proxying Port 80 to Port 3000 (frontend) and 8080 (Keycloak)
sudo tee $NGINX_CONF > /dev/null << 'EOF'
server {
    listen 80;
    server_name cognexa-ai.duckdns.org;


    # Adjust client_max_body_size to support uploading larger PDF/TXT files
    client_max_body_size 50M;

    # Keycloak Realm routing (OIDC endpoints)
    location /realms/ {
        proxy_pass http://127.0.0.1:8080;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        # Buffer tweaks for large OIDC headers
        proxy_buffer_size          128k;
        proxy_buffers              4 256k;
        proxy_busy_buffers_size    256k;
    }

    # Keycloak Admin console
    location /admin/ {
        proxy_pass http://127.0.0.1:8080;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Keycloak Resources static assets
    location /resources/ {
        proxy_pass http://127.0.0.1:8080;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Frontend Next.js routing
    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;

        # Fix "upstream sent too big header" when NextAuth sets large cookies
        proxy_buffer_size          128k;
        proxy_buffers              4 256k;
        proxy_busy_buffers_size    256k;
    }
}
EOF

# Restart and enable Nginx
sudo systemctl enable nginx
sudo systemctl restart nginx

echo "=========================================================="
echo "EC2 Setup Completed Successfully!"
echo "=========================================================="
echo "IMPORTANT STEPS TO RUN NEXT:"
echo "1. Run: exit"
echo "   (This logs you out so group changes take effect)"
echo "2. SSH back into your EC2 instance."
echo "3. Clone the repo and navigate into it:"
echo "   git clone https://github.com/AtharvaChaudhari9/Ai-Chatbot-with-Supabase-.git"
echo "   cd Ai-Chatbot-with-Supabase-"
echo "4. Create your env files (use the templates in the repo)."
echo "5. Run: docker compose up -d --build"
echo "=========================================================="
