# syntax=docker/dockerfile:1

# ---- Base image ----
ARG NODE_VERSION=22.11.0
FROM node:${NODE_VERSION}-slim AS base

LABEL fly_launch_runtime="Node.js"

WORKDIR /app
ENV NODE_ENV="production"

# ---- Build stage ----
FROM base AS build

# Install build tools, Python, Puppeteer deps, and MiKTeX (Bookworm instructions)
RUN apt-get update -qq && \
    apt-get install --no-install-recommends -y \
    build-essential node-gyp pkg-config python-is-python3 \
    wget gnupg ca-certificates curl \
    fonts-liberation libnss3 libx11-xcb1 libxcomposite1 libxcursor1 \
    libxdamage1 libxext6 libxfixes3 libxi6 libxrandr2 libxrender1 \
    libxss1 libxtst6 libglib2.0-0 libatk1.0-0 libatk-bridge2.0-0 \
    libcups2 libdrm2 libdbus-1-3 libexpat1 libfontconfig1 libfreetype6 \
    libgbm1 libgtk-3-0 libpango-1.0-0 libpangocairo-1.0-0 xvfb ffmpeg xauth \
    && \
    # ---- Install MiKTeX (Debian 12 Bookworm official steps) ----
    curl -fsSL https://miktex.org/download/key | gpg --dearmor -o /usr/share/keyrings/miktex.gpg && \
    echo "deb [signed-by=/usr/share/keyrings/miktex.gpg] https://miktex.org/download/debian bookworm universe" \
      > /etc/apt/sources.list.d/miktex.list && \
    apt-get update -qq && \
    apt-get install --no-install-recommends -y miktex && \
    miktexsetup --shared=yes finish && \
    initexmf --admin --set-config-value '[MPM]AutoInstall=1' && \
    rm -rf /var/lib/apt/lists/*

# Copy package files for caching
COPY package*.json ./

# Install dependencies including Puppeteer
RUN npm ci && \
    npm install puppeteer && \
    npx puppeteer install && \
    npx puppeteer browsers install chrome

# Copy app code
COPY . .

# ---- Final stage ----
FROM base

# Install runtime dependencies + MiKTeX (Bookworm)
RUN apt-get update -qq && \
    apt-get install --no-install-recommends -y \
    curl gnupg ca-certificates \
    fonts-liberation libnss3 libx11-xcb1 libxcomposite1 libxcursor1 \
    libxdamage1 libxext6 libxfixes3 libxi6 libxrandr2 libxrender1 \
    libxss1 libxtst6 libglib2.0-0 libatk1.0-0 libatk-bridge2.0-0 \
    libcups2 libdrm2 libdbus-1-3 libexpat1 libfontconfig1 libfreetype6 \
    libgbm1 libgtk-3-0 libpango-1.0-0 libpangocairo-1.0-0 xvfb xauth ffmpeg \
    && \
    curl -fsSL https://miktex.org/download/key | gpg --dearmor -o /usr/share/keyrings/miktex.gpg && \
    echo "deb [signed-by=/usr/share/keyrings/miktex.gpg] https://miktex.org/download/debian bookworm universe" \
      > /etc/apt/sources.list.d/miktex.list && \
    apt-get update -qq && \
    apt-get install --no-install-recommends -y miktex && \
    miktexsetup --shared=yes finish && \
    initexmf --admin --set-config-value '[MPM]AutoInstall=1' && \
    rm -rf /var/lib/apt/lists/*

# Create videos folder to avoid ENOENT
RUN mkdir -p /app/videos

# Copy built app, node_modules, and Puppeteer cache
COPY --from=build /app /app
COPY --from=build /root/.cache /root/.cache

# Expose port
EXPOSE 3000

# Run Puppeteer with Xvfb
CMD xvfb-run -a --server-args="-screen 0 1280x800x24" node index.js