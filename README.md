# 🎵 Concert Player

Concert Player is a web-based audio playback application designed for live performances and events. It allows users to create and manage playlists, control playback with precision, and use a mobile remote control for convenience. The application is built with a focus on stability and real-time synchronization between the player and remote controls.

## ✨ Features

- **📝 Playlist Management:** Easily add, remove, reorder, and duplicate tracks.
- **📁 Drag & Drop:** Intuitive drag-and-drop support for both files and playlist items.
- **📱 Mobile Remote Control:** Control playback from any mobile device on the same network using a QR code or a direct link.
- **🌐 Multi-Session Support:** Each browser session is isolated, allowing multiple users to have their own independent playlists and remotes.
- **📊 Real-time State Sync:** The player and remote are always synchronized, providing instant feedback.
- **⚙️ Customizable Settings:** Adjust fade-in/fade-out durations, playback modes (auto/manual), and more.
- **🔊 Audio Visualizer:** A real-time audio visualizer for a more engaging experience.
- **📦 PWA Support:** Installable as a Progressive Web App for offline access and a native-like experience.

## 🛠️ Tech Stack

- **Backend:** Node.js, Express.js
- **Real-time Communication:** WebSocket (`ws` library)
- **Frontend:** HTML5, CSS3, Vanilla JavaScript (ES6+)
- **Deployment:** Nginx (as a reverse proxy), PM2 (process manager)

---

## 🚀 Getting Started

### Prerequisites

- Node.js (v14 or higher)
- npm

### Local Setup

1.  **Clone the repository:**
    ```bash
    git clone https://github.com/keelbismark/concert-player.git
    cd concert-player
    ```

2.  **Install dependencies:**
    ```bash
    npm install
    ```

3.  **Start the server:**
    ```bash
    npm start
    ```

4.  **Open the application:**
    - **Player:** Open your browser and navigate to `http://localhost:3000`
    - **Remote Control:** Open `http://localhost:3000/remote.html` or use the QR code feature in the player's UI.

---

## ☁️ Production Deployment

This guide explains how to deploy the Concert Player on a server using **Nginx** as a reverse proxy and **PM2** to manage the application process.

### Step 1: Server Preparation

1.  **Point your domain to the server's IP address.**
    - In your domain registrar's DNS settings, create an **A record** pointing your domain (e.g., `yourdomain.com`) to your server's public IP.

2.  **Install necessary software on your server (e.g., Ubuntu):**
    ```bash
    # Update package list
    sudo apt update

    # Install Nginx
    sudo apt install nginx

    # Install Node.js (this example uses NodeSource for a specific version)
    curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
    sudo apt-get install -y nodejs

    # Install PM2 globally
    sudo npm install pm2 -g
    ```

### Step 2: Deploy and Run the Application

1.  **Clone the repository** on your server and navigate into the project directory.
    ```bash
    git clone https://github.com/keelbismark/concert-player.git
    cd concert-player
    ```

2.  **Install dependencies:**
    ```bash
    npm install
    ```

3.  **Start the application with PM2:**
    ```bash
    pm2 start server.js --name concert-player
    ```

4.  **Ensure the application restarts on server reboot:**
    ```bash
    pm2 startup
    ```
    (Follow the instructions PM2 provides to complete the setup).

### Step 3: Configure Nginx

1.  **Create a new Nginx configuration file** for your site:
    ```bash
    sudo nano /etc/nginx/sites-available/yourdomain.com
    ```

2.  **Paste the following configuration**, replacing `yourdomain.com` with your actual domain name. This file is based on the `nginx.conf` included in the repository.
    ```nginx
    server {
        listen 80;
        server_name yourdomain.com www.yourdomain.com;

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

3.  **Enable the configuration** by creating a symbolic link:
    ```bash
    sudo ln -s /etc/nginx/sites-available/yourdomain.com /etc/nginx/sites-enabled/
    ```

4.  **Test the Nginx configuration** for syntax errors:
    ```bash
    sudo nginx -t
    ```

5.  **Restart Nginx** to apply the changes:
    ```bash
    sudo systemctl restart nginx
    ```

### (Recommended) Step 4: Secure with HTTPS using Let's Encrypt

1.  **Install Certbot:**
    ```bash
    sudo apt install certbot python3-certbot-nginx
    ```

2.  **Obtain and install an SSL certificate:**
    ```bash
    sudo certbot --nginx -d yourdomain.com -d www.yourdomain.com
    ```
    Certbot will automatically update your Nginx configuration to handle HTTPS.

Your application is now live and accessible via `https://yourdomain.com`.
