FROM node:22-alpine AS builder

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm install

COPY prisma ./prisma/
RUN npx prisma generate

COPY tsconfig.json ./
COPY src ./src/
RUN npm run build

FROM node:22-alpine

WORKDIR /app

ENV NODE_ENV=production
COPY package.json package-lock.json* ./
RUN npm install --omit=dev

COPY prisma ./prisma/
RUN npx prisma generate

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/public ./public

# Set DATABASE_URL (Postgres) when running

EXPOSE 3001

CMD ["node", "dist/index.js"]
