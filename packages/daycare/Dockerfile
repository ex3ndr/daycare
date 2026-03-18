# syntax=docker/dockerfile:1.7

FROM node:22-bookworm-slim AS builder

WORKDIR /repo

RUN apt-get update \
    && apt-get install -y --no-install-recommends ca-certificates git python3 make g++ \
    && rm -rf /var/lib/apt/lists/*

RUN corepack enable && corepack prepare yarn@1.22.22 --activate

COPY package.json yarn.lock ./
COPY packages/daycare/package.json packages/daycare/package.json
COPY packages/daycare-dashboard/package.json packages/daycare-dashboard/package.json

RUN yarn install --frozen-lockfile

COPY packages/daycare packages/daycare
COPY packages/daycare-dashboard packages/daycare-dashboard

RUN yarn workspace daycare-cli run build

FROM node:22-bookworm-slim AS runner

ENV NODE_ENV=production
ENV DAYCARE_ROOT_DIR=/var/lib/daycare

WORKDIR /app

RUN apt-get update \
    && apt-get install -y --no-install-recommends ca-certificates git tini \
    && rm -rf /var/lib/apt/lists/*

COPY --from=builder /repo/package.json /app/package.json
COPY --from=builder /repo/yarn.lock /app/yarn.lock
COPY --from=builder /repo/node_modules /app/node_modules
COPY --from=builder /repo/packages/daycare/package.json /app/packages/daycare/package.json
COPY --from=builder /repo/packages/daycare/dist /app/packages/daycare/dist

RUN mkdir -p /var/lib/daycare /app/packages/daycare \
    && chown -R node:node /var/lib/daycare /app

USER node

VOLUME ["/var/lib/daycare"]

EXPOSE 7331 7332

ENTRYPOINT ["tini", "--"]
CMD ["node", "./packages/daycare/dist/main.js", "start"]
