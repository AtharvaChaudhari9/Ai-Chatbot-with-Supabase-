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

# Copy built standalone folder and static files (saves copying 500MB+ node_modules)
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public
COPY --from=builder /app/.env* ./

EXPOSE 3000

# Next.js standalone build outputs a compact self-contained server.js file
CMD ["node", "server.js"]
