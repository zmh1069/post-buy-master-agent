# Use official Node.js 20 image
FROM node:20-slim

# Install system dependencies for Puppeteer and Chrome
RUN apt-get update && apt-get install -y \
    wget \
    gnupg \
    ca-certificates \
    procps \
    libxss1 \
    libnss3 \
    libatk-bridge2.0-0 \
    libdrm2 \
    libxkbcommon0 \
    libxcomposite1 \
    libxdamage1 \
    libxrandr2 \
    libgbm1 \
    libasound2 \
    libpango-1.0-0 \
    libcairo2 \
    libatspi2.0-0 \
    libgtk-3-0 \
    fonts-liberation \
    xdg-utils \
    && rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /usr/src/app

# Copy package files first for better caching
COPY package*.json ./

# Install all dependencies (this layer will be cached unless package.json changes)
RUN npm install --production

# Create a non-root user for security
RUN groupadd -r pptruser && useradd -r -g pptruser -G audio,video pptruser \
    && mkdir -p /home/pptruser/Downloads \
    && chown -R pptruser:pptruser /home/pptruser \
    && chown -R pptruser:pptruser /usr/src/app

# Install Chrome for Puppeteer as the pptruser
USER pptruser
RUN npx puppeteer browsers install chrome

# Copy source code (this layer changes when code changes)
COPY --chown=pptruser:pptruser . .

# Set working directory to the master agent
WORKDIR /usr/src/app/agents/post-buy-master-agent

# Expose port 8080 (Cloud Run default)
EXPOSE 8080

# Start the server with garbage collection enabled and optimized memory settings
CMD ["node", "--expose-gc", "--max-old-space-size=2048", "server.js"] 