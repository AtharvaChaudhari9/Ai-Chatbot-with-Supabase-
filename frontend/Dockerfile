# Stage 1: Build the application
FROM node:20-alpine AS builder
WORKDIR /app

# Copy dependency definitions
COPY package.json package-lock.json ./

# Install dependencies in clean mode
RUN npm ci

# Copy application files
COPY . .



# Compile Next.js production build
RUN npm run build

# Stage 2: Serve the application
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000

# Copy built artifacts and runtime dependencies
COPY --from=builder /app/package.json /app/package-lock.json ./
COPY --from=builder /app/.next /app/.next
COPY --from=builder /app/public /app/public
COPY --from=builder /app/node_modules /app/node_modules
COPY --from=builder /app/next.config.ts ./next.config.ts
COPY --from=builder /app/.env* ./

EXPOSE 3000

CMD ["npm", "start"]
