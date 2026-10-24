# syntax=docker/dockerfile:1
# can-va — virtual airlines. Astro SSR (standalone Node adapter), the same shape
# as can-database. Holds no credential and no Secret: it forwards the member's
# can-api cookie to can-va-api.
FROM oven/bun:1 AS build
WORKDIR /app

# .npmrc comes along because can-ui lives on GitHub Packages, which demands a
# token even for a public package.
COPY package.json bun.lock .npmrc ./
# BuildKit secret, never --build-arg: build args are readable from `docker history`.
RUN --mount=type=secret,id=github_token \
    GITHUB_TOKEN="$(cat /run/secrets/github_token)" \
    bun install --frozen-lockfile

COPY . .
RUN bun run build

RUN --mount=type=secret,id=github_token \
    GITHUB_TOKEN="$(cat /run/secrets/github_token)" \
    rm -rf node_modules && bun install --frozen-lockfile --production

FROM node:22-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=4321

# Numeric: Kubernetes' runAsNonRoot only reads numeric ids.
USER 1000

COPY --from=build --chown=node:node /app/dist ./dist
COPY --from=build --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/package.json ./package.json

EXPOSE 4321
CMD ["node", "./dist/server/entry.mjs"]
