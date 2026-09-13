# --- Build stage: compile the Express API to dist/server.cjs ---
FROM node:20-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
# Bundle the server only (frontend is served by Firebase Hosting).
RUN npx esbuild server.ts --bundle --platform=node --format=cjs --packages=external --sourcemap --outfile=dist/server.cjs

# --- Runtime stage: production deps only ---
FROM node:20-slim
WORKDIR /app
ENV NODE_ENV=production
ENV API_ONLY=true
COPY package.json package-lock.json ./
RUN npm ci --omit=dev
COPY --from=build /app/dist ./dist
# Cloud Run provides PORT; server.ts binds to it.
EXPOSE 8080
CMD ["node", "dist/server.cjs"]
