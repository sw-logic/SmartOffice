#!/bin/sh
set -e

echo "DATABASE_URL is set: $([ -n "$DATABASE_URL" ] && echo 'yes' || echo 'NO - MISSING!')"
echo "Running database migrations..."
npx prisma migrate deploy

echo "Starting application..."
exec node build
