# Stage 1: Build
FROM node:22-slim AS builder

WORKDIR /app

# Install build tools for better-sqlite3 (node-gyp)
RUN apt-get update && apt-get install -y python3 make g++ && rm -rf /var/lib/apt/lists/*

# Install dependencies
COPY package.json package-lock.json* ./
RUN npm install

# Copy source
COPY . .

# Build Next.js standalone output
RUN npm run build

# Stage 2: Production
FROM node:22-slim AS runner

WORKDIR /app

# Install runtime tools needed by better-sqlite3 and tesseract.js
RUN apt-get update && apt-get install -y libsqlite3-dev && rm -rf /var/lib/apt/lists/*

ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

# Create data directory for SQLite (persistent volume mount point)
RUN mkdir -p /app/data

# Copy standalone build output
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public

# Copy language files for tesseract.js (needed for OCR)
COPY --from=builder /app/node_modules/tesseract.js ./node_modules/tesseract.js
COPY --from=builder /app/node_modules/tesseract.js-core ./node_modules/tesseract.js-core
COPY --from=builder /app/node_modules/worker-loader ./node_modules/worker-loader
COPY --from=builder /app/node_modules/resolve-url ./node_modules/resolve-url

# Ensure tesseract.js can find its trained data
COPY --from=builder /app/node_modules/tesseract.js/dist/worker.min.js ./node_modules/tesseract.js/dist/worker.min.js
COPY --from=builder /app/node_modules/tesseract.js/dist/createWorker.js ./node_modules/tesseract.js/dist/createWorker.js
COPY --from=builder /app/node_modules/tesseract.js/dist/index.js ./node_modules/tesseract.js/dist/index.js
COPY --from=builder /app/node_modules/tesseract.js/dist/internal.js ./node_modules/tesseract.js/dist/internal.js
COPY --from=builder /app/node_modules/tesseract.js/dist/constants/*.js ./node_modules/tesseract.js/dist/constants/
COPY --from=builder /app/node_modules/tesseract.js/dist/utils/*.js ./node_modules/tesseract.js/dist/utils/
COPY --from=builder /app/node_modules/tesseract.js/dist/worker-script/*.js ./node_modules/tesseract.js/dist/worker-script/

EXPOSE 3000

CMD ["node", "server.js"]
