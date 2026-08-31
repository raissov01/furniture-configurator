# ── Тәуелділіктер ────────────────────────────────────────────────────────────
FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

# ── Құрастыру ────────────────────────────────────────────────────────────────
FROM node:22-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# Бұлт ҚОСУЛЫ: Vercel-ден айырмашылығы — мұнда тұрақты дискі бар.
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

# ── Жүгіру ───────────────────────────────────────────────────────────────────
FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
# Дерекқор ОСЫ жолда: контейнер жаңарғанда жоба мен аккаунт жоғалмауы үшін
# бұл бума томға шығарылады.
ENV DATA_DIR=/data

RUN addgroup -g 1001 -S nodejs && adduser -S nextjs -u 1001 \
 && mkdir -p /data && chown nextjs:nodejs /data

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs
EXPOSE 3000
VOLUME /data
CMD ["node", "server.js"]
