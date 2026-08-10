FROM node:22-alpine AS build
WORKDIR /app

COPY package*.json ./
# --include=dev: garante @nestjs/cli mesmo se NODE_ENV=production vier do ambiente de build
RUN npm ci --include=dev

COPY . .
RUN npm run build
RUN npm prune --omit=dev

FROM node:22-alpine AS runtime
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000

RUN addgroup -S app && adduser -S app -G app

# su-exec larga o privilegio de root no entrypoint sem deixar processo orfao,
# o que `su` faria. Alpine ja tem no repositorio principal.
RUN apk add --no-cache su-exec

COPY --from=build /app/package*.json ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist

RUN mkdir -p uploads && chown -R app:app /app

COPY docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

# Sem USER app aqui de proposito. O entrypoint precisa comecar como root para
# acertar o dono do volume que o Railway monta em /app/uploads, e so entao
# executa o node como `app`. Trocar a ordem traz de volta o EACCES.
EXPOSE 3000

ENTRYPOINT ["/usr/local/bin/docker-entrypoint.sh"]
CMD ["node", "dist/main"]
