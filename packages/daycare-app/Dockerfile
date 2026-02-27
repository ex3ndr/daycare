FROM node:22-alpine AS builder

WORKDIR /workspace

# Install workspace dependencies first for better layer caching.
COPY package.json yarn.lock ./
COPY packages/daycare-app/package.json ./packages/daycare-app/package.json
RUN yarn install --frozen-lockfile --ignore-engines

# Copy only the app workspace sources required for export.
COPY packages/daycare-app ./packages/daycare-app

ENV NODE_ENV=production
ENV APP_ENV=production
ENV EXPO_PUBLIC_BASE_URL=/
RUN yarn workspace daycare-app export:web

FROM nginx:alpine AS runner

COPY --from=builder /workspace/packages/daycare-app/dist /usr/share/nginx/html

RUN rm /etc/nginx/conf.d/default.conf
RUN cat <<'EOF' > /etc/nginx/conf.d/default.conf
server {
    listen 80;
    server_name _;
    root /usr/share/nginx/html;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }
}
EOF

EXPOSE 80
