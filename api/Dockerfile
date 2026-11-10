# API: Fastify + PostgreSQL. Il codice TypeScript viene eseguito con tsx (dipendenza di produzione).
# ffmpeg converte i file dei clienti (foto, video, audio): vedi api/src/media.ts.
FROM node:24-alpine
WORKDIR /app
ENV NODE_ENV=production PORT=4000
RUN apk add --no-cache ffmpeg

COPY package.json package-lock.json ./
COPY shared/package.json shared/
COPY api/package.json api/
COPY web/package.json web/
RUN npm ci --omit=dev --workspace @inviteme/api --workspace @inviteme/shared --include-workspace-root \
 && npm cache clean --force

COPY shared shared
COPY api api
COPY engine engine
COPY themes themes
# Logo incorporato nelle email (api/src/mail.ts): lo stesso file servito dal frontend.
COPY web/public/brand/logo-email.png web/public/brand/logo-email.png

RUN mkdir -p /app/data/media && chown -R node:node /app/data
USER node
EXPOSE 4000
CMD ["npx", "tsx", "api/src/server.ts"]
