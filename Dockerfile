# Use Node 20; no Nixpacks cache mount = no EBUSY on node_modules/.cache
FROM node:20-bookworm-slim AS builder

WORKDIR /app

# OpenSSL required by Prisma
RUN apt-get update -qq && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/*

# Install deps first (no cache mount — avoids EBUSY)
COPY package.json ./
RUN npm install

COPY . .
RUN npx prisma generate && npm run build

# Runtime
FROM node:20-bookworm-slim AS runner

WORKDIR /app

ENV NODE_ENV=production
RUN apt-get update -qq && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/*

COPY --from=builder /app/package.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/prisma ./prisma

EXPOSE 3000

CMD ["sh", "-c", "npx prisma migrate deploy && node dist/index.js"]
