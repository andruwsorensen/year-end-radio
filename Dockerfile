FROM node:22-bookworm-slim

RUN apt-get update \
    && apt-get install -y --no-install-recommends ca-certificates python3 python3-pip \
    && python3 -m pip install --break-system-packages --no-cache-dir yt-dlp \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package.json ./
COPY server.mjs playback-source.mjs library-store.mjs ./
COPY public ./public

RUN mkdir -p /app/data && chown node:node /app/data

ENV NODE_ENV=production
ENV PORT=4173

EXPOSE 4173

USER node

HEALTHCHECK --interval=15s --timeout=5s --start-period=10s --retries=4 \
  CMD node -e "fetch('http://127.0.0.1:4173/api/health').then((response) => { if (!response.ok) process.exit(1); }).catch(() => process.exit(1))"

CMD ["node", "server.mjs"]
