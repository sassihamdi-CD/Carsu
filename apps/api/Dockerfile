# Simple Development Dockerfile - just run the dev server
FROM node:20-slim

# Install OpenSSL for Prisma and procps for NestJS watch mode
RUN apt-get update && apt-get install -y openssl libssl-dev ca-certificates procps && rm -rf /var/lib/apt/lists/*

WORKDIR /app/apps/api

# Copy everything
COPY . .

# Install dependencies (including dev dependencies)
RUN npm install --legacy-peer-deps

# Expose port
EXPOSE 3000

# Run dev server directly - that's it!
CMD ["npm", "run", "start:dev"]
