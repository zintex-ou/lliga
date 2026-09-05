FROM node:22-bookworm-slim AS build
WORKDIR /app
RUN apt-get update -q && apt-get install -y -q python3 make g++ && rm -rf /var/lib/apt/lists/*
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:22-bookworm-slim
WORKDIR /app
ENV NODE_ENV=production DATA_DIR=/data PORT=3000
COPY --from=build /app/.next/standalone ./
COPY --from=build /app/.next/static ./.next/static
COPY --from=build /app/public ./public
COPY --from=build /app/drizzle ./drizzle
COPY --from=build /app/seed ./seed
COPY --from=build /app/node_modules/tsx ./node_modules/tsx
COPY --from=build /app/node_modules/drizzle-orm ./node_modules/drizzle-orm
COPY --from=build /app/node_modules/bcryptjs ./node_modules/bcryptjs
COPY --from=build /app/src/db ./src/db
COPY --from=build /app/tsconfig.json ./
VOLUME ["/data"]
EXPOSE 3000
CMD ["sh", "-c", "node node_modules/tsx/dist/cli.mjs seed/seed.ts; node server.js"]
