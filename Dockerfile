# ── Stage 1: Build the SvelteKit app ──────────────────────────────────────────
FROM node:22-alpine AS build

WORKDIR /app
COPY package.json package-lock.json ./
COPY prisma ./prisma/
RUN npm ci

COPY . .

RUN npx prisma generate
RUN npm run build

# Remove dev dependencies after build
RUN npm prune --omit=dev

# ── Stage 2: Production image ─────────────────────────────────────────────────
FROM node:22-alpine AS production

WORKDIR /app

# Create non-root user
RUN addgroup -S appgroup && adduser -S appuser -G appgroup

# Copy only what's needed to run
COPY --from=build /app/build ./build
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/package.json ./
COPY --from=build /app/prisma ./prisma
COPY docker-entrypoint.sh ./

RUN chmod +x docker-entrypoint.sh

# Create uploads directory and set ownership
RUN mkdir -p /app/uploads && chown -R appuser:appgroup /app/uploads

USER appuser

ENV NODE_ENV=production
ENV PORT=3000
ENV UPLOAD_DIR=/app/uploads

EXPOSE 3000

ENTRYPOINT ["./docker-entrypoint.sh"]
