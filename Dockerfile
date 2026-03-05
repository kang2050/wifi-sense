# ---- Build Stage ----
FROM node:20-alpine AS builder

WORKDIR /app

# Install pnpm
RUN npm install -g pnpm

COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

COPY . .

# Build args — defaults point to the Coolify-deployed backend
ARG VITE_WS_URL=ws://xww8okkg0wcg40c0ogcw88ko.76.13.31.179.sslip.io/ws
ARG VITE_API_BASE=http://xww8okkg0wcg40c0ogcw88ko.76.13.31.179.sslip.io
ENV VITE_WS_URL=$VITE_WS_URL
ENV VITE_API_BASE=$VITE_API_BASE

RUN pnpm build

# ---- Serve Stage ----
FROM nginx:alpine

COPY --from=builder /app/dist /usr/share/nginx/html

# SPA fallback: all routes → index.html
RUN printf 'server {\n  listen 80;\n  root /usr/share/nginx/html;\n  index index.html;\n  location / {\n    try_files $uri $uri/ /index.html;\n  }\n}\n' > /etc/nginx/conf.d/default.conf

EXPOSE 80
