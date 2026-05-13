# Base node image
FROM node:20-alpine AS base
RUN apk add --no-cache libc6-compat openssl
WORKDIR /app

# Install dependencies
FROM base AS deps
COPY package.json package-lock.json* ./
COPY prisma ./prisma
RUN npm ci

# Build the app
FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NODE_ENV=production
RUN npx prisma generate
RUN npm run build
# Compile workers to a single bundle (resolves @/ path aliases via tsconfig)
RUN npx esbuild src/workers/index.ts \
    --bundle \
    --platform=node \
    --packages=external \
    --tsconfig=tsconfig.json \
    --outfile=worker.js

# Production image runner
FROM base AS runner
ENV NODE_ENV=production
ENV PORT=3099
ENV HOSTNAME="0.0.0.0"

# Don't run production as root
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/prisma ./prisma
COPY --from=builder --chown=nextjs:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=nextjs:nodejs /app/package.json ./package.json
COPY --from=builder --chown=nextjs:nodejs /app/worker.js ./worker.js

USER nextjs
EXPOSE 3099

# The default command runs the web app. Worker overrides this in Compose.
CMD ["node", "server.js"]
