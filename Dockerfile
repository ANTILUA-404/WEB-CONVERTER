# syntax=docker/dockerfile:1
FROM node:22-bookworm-slim

# ffmpeg (with librubberband on Debian) + yt-dlp
RUN apt-get update \
    && apt-get install -y --no-install-recommends ffmpeg python3 python3-pip ca-certificates curl \
    && pip3 install --no-cache-dir --break-system-packages -U yt-dlp \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY server/package.json ./server/package.json
COPY server ./server
COPY index.html ./index.html
COPY assets ./assets

ENV NODE_ENV=production \
    PORT=8080 \
    HOST=0.0.0.0 \
    DATA_DIR=/data

RUN mkdir -p /data && chown -R node:node /data /app
USER node

EXPOSE 8080
VOLUME ["/data"]

CMD ["node", "server/server.js"]
