FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM deps AS builder
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1 NODE_OPTIONS=--max-old-space-size=2048
RUN npm run build

FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=3000 DATA_DIR=/data PLATFORM_ROOT=/app
RUN addgroup -S app && adduser -S app -G app && mkdir -p /data && chown app:app /data
COPY --from=builder --chown=app:app /app /app
RUN cp -r .next/static .next/standalone/.next/static && cp -r public .next/standalone/public
USER app
EXPOSE 3000
ENTRYPOINT ["node", "scripts/platform-entrypoint.mjs"]
CMD ["web"]
