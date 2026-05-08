FROM node:22-bookworm-slim AS deps
WORKDIR /app

RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl ca-certificates python3 make g++ \
  && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
COPY apps/admin/package.json apps/admin/package.json
RUN npm ci

FROM deps AS build
WORKDIR /app

COPY apps/api ./apps/api
RUN npm run build --workspace api

FROM deps AS migrate
WORKDIR /app

COPY apps/api/prisma ./apps/api/prisma
COPY apps/api/prisma.config.ts ./apps/api/prisma.config.ts

WORKDIR /app/apps/api
CMD ["npx", "--no-install", "prisma", "migrate", "deploy"]

FROM node:22-bookworm-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production

RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
COPY apps/admin/package.json apps/admin/package.json
RUN npm ci --omit=dev --omit=optional --workspace api --include-workspace-root=false \
  && npm cache clean --force

COPY --from=build /app/apps/api/dist ./apps/api/dist
COPY --from=build /app/apps/api/prisma ./apps/api/prisma
COPY --from=build /app/apps/api/generated ./apps/api/generated
COPY --from=build /app/apps/api/prisma.config.ts ./apps/api/prisma.config.ts

WORKDIR /app/apps/api
RUN mkdir -p /data/storage \
  && chown -R node:node /app /data/storage
USER node
EXPOSE 3000
CMD ["npm", "run", "start:prod"]
