FROM node:18-alpine AS builder

# Build frontend
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm install
COPY frontend/ ./
RUN npm run build

# Backend setup
FROM node:18-alpine
WORKDIR /app

# Create data directory for SQLite
RUN mkdir -p /app/data && chmod 777 /app/data

# Copy backend code to backend subdirectory
COPY backend/ ./backend/

# Install backend dependencies
WORKDIR /app/backend
RUN npm install --production

# Copy built frontend to correct relative path
COPY --from=builder /app/frontend/build /app/frontend/build

EXPOSE 3001

WORKDIR /app/backend
CMD ["node", "index.js"]
