#!/bin/sh
set -e

echo "Running Prisma migrations..."
npx prisma migrate deploy --schema=./apps/api/prisma/schema.prisma

echo "Starting Zemo API..."
exec node apps/api/dist/src/index.js
