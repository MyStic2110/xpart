# Stage 1: Build the React frontend
FROM node:20-alpine AS frontend-builder
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm install
COPY frontend/ ./
RUN npm run build

# Stage 2: Production runtime
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=8080

COPY package*.json ./
RUN npm install --omit=dev

COPY tsconfig.json drizzle.config.ts ./
COPY src/ ./src/

# Copy the built React frontend into frontend/dist for Fastify static serving
COPY --from=frontend-builder /app/frontend/dist ./frontend/dist

# Ensure persistent uploads directory exists
RUN mkdir -p uploads

EXPOSE 8080

CMD ["npm", "start"]
