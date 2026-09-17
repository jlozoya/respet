# Imagen de la API.
#
# Se construye desde la raíz del monorepo, porque la API depende del paquete
# de contratos compartidos:
#
#   docker build -f apps/api/Dockerfile -t respet-api .
#
# Tres etapas: dependencias, compilación y ejecución. La última sólo lleva lo
# que hace falta para correr —dependencias de producción, el `dist` y FFmpeg
# para las portadas de los vídeos—, sin compiladores ni código fuente.

ARG NODE_VERSION=24

# --- Dependencias -------------------------------------------------------------
FROM node:${NODE_VERSION}-bookworm-slim AS deps
WORKDIR /app

COPY package.json package-lock.json ./
COPY packages/shared/package.json packages/shared/
COPY apps/api/package.json apps/api/
COPY apps/mobile/package.json apps/mobile/

# Sólo los espacios de trabajo de la API y los contratos: la aplicación no hace
# falta aquí y sus dependencias son las más pesadas.
RUN npm ci --workspace @respet/shared --workspace @respet/api --include-workspace-root

# --- Compilación ----------------------------------------------------------------
FROM deps AS build
WORKDIR /app

COPY packages/shared packages/shared
COPY apps/api apps/api

RUN npm run build --workspace @respet/shared \
 && npm run build --workspace @respet/api \
 && npm prune --omit=dev --workspace @respet/shared --workspace @respet/api --include-workspace-root

# --- Ejecución ------------------------------------------------------------------
FROM node:${NODE_VERSION}-bookworm-slim AS runtime

# FFmpeg saca la duración y la portada de los vídeos; tini reparte las señales
# para que la API se apague con calma al desplegar una versión nueva.
RUN apt-get update \
 && apt-get install -y --no-install-recommends ffmpeg tini ca-certificates \
 && rm -rf /var/lib/apt/lists/*

ENV NODE_ENV=production \
    PORT=3000 \
    STORAGE_ROOT=/data/uploads

WORKDIR /app

COPY --from=build --chown=node:node /app/node_modules node_modules
COPY --from=build --chown=node:node /app/packages/shared/package.json packages/shared/package.json
COPY --from=build --chown=node:node /app/packages/shared/dist packages/shared/dist
COPY --from=build --chown=node:node /app/apps/api/package.json apps/api/package.json
COPY --from=build --chown=node:node /app/apps/api/dist apps/api/dist
COPY --from=build --chown=node:node /app/apps/api/schema.gql apps/api/schema.gql

RUN mkdir -p /data/uploads && chown -R node:node /data

USER node
WORKDIR /app/apps/api
EXPOSE 3000
VOLUME ["/data/uploads"]

HEALTHCHECK --interval=15s --timeout=5s --start-period=30s --retries=5 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

ENTRYPOINT ["/usr/bin/tini", "--"]
CMD ["node", "dist/main.js"]
