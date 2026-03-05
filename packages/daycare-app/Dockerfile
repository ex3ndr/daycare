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
ENV EXPO_UNSTABLE_WEB_MODAL=1
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

    # Static assets — return 404 if missing (never serve index.html for .js/.css/etc)
    location ~* \.(?:js|css|map|json|png|jpg|jpeg|gif|svg|ico|woff2?|ttf|eot)$ {
        try_files $uri =404;
        expires 0;
        add_header Cache-Control "no-store";
    }

    # SPA fallback — serve index.html for all other routes (no cache)
    location / {
        try_files $uri /index.html;
        expires 0;
        add_header Cache-Control "no-store";
    }
}
EOF

EXPOSE 80
