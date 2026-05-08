#!/bin/bash
# Run this on the server after every git pull to deploy a new version.
set -e

echo "→ Installing dependencies..."
npm ci --include=dev

echo "→ Generating Prisma client..."
npx prisma generate

echo "→ Running database migrations..."
npx prisma db push

echo "→ Building Next.js..."
npm run build

echo "→ Reloading PM2 processes..."
pm2 reload ecosystem.config.js --env production

echo "✓ Deploy complete"
