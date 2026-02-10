FROM node:22-bookworm-slim AS builder

WORKDIR /repo

RUN apt-get update \
  && apt-get install -y --no-install-recommends ca-certificates git \
  && rm -rf /var/lib/apt/lists/*

RUN corepack enable && corepack prepare yarn@1.22.22 --activate

COPY package.json yarn.lock ./
COPY packages/daycare/package.json packages/daycare/package.json
COPY packages/daycare-factory/package.json packages/daycare-factory/package.json

RUN yarn install --frozen-lockfile

COPY packages/daycare packages/daycare
COPY packages/daycare-factory packages/daycare-factory

RUN yarn workspace daycare-cli run build \
  && yarn workspace daycare-factory run build \
  && mkdir -p /artifacts \
  && npm pack ./packages/daycare --pack-destination /artifacts \
  && npm pack ./packages/daycare-factory --pack-destination /artifacts

FROM node:22-bookworm-slim AS runtime

RUN apt-get update \
  && apt-get install -y --no-install-recommends ca-certificates git \
  && rm -rf /var/lib/apt/lists/*

COPY --from=builder /artifacts /artifacts

RUN npm install -g bun /artifacts/daycare-cli-*.tgz /artifacts/daycare-factory-*.tgz \
  && rm -rf /artifacts

WORKDIR /workspace

CMD ["daycare-factory"]
