# Multi-stage build for Next.js frontend

# Stage 1: Dependencies
FROM node:20-alpine AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci

# Stage 2: Builder
FROM node:20-alpine AS builder
WORKDIR /app

# Copy dependencies from deps stage
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Build Next.js application
# Note: Environment variables with NEXT_PUBLIC_ prefix must be available at build time
ARG NEXT_PUBLIC_API_BASE
ENV NEXT_PUBLIC_API_BASE=${NEXT_PUBLIC_API_BASE}

RUN npm run build

# Stage 3: Runner
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production

# Add non-root user
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Copy built application
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs

# Set default frontend port
ENV FRONTEND_PORT=3000
ENV PORT=${FRONTEND_PORT}
ENV HOSTNAME="0.0.0.0"

EXPOSE ${FRONTEND_PORT}

# Health check (uses environment variable for port)
HEALTHCHECK --interval=30s --timeout=3s --start-period=40s --retries=3 \
    CMD sh -c "node -e \"require('http').get('http://localhost:${FRONTEND_PORT}/api/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})\"" || exit 1

CMD ["node", "server.js"]
