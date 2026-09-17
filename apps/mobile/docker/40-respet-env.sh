#!/bin/sh
# Escribe la configuración en tiempo de ejecución de la web a partir de las
# variables del contenedor. La imagen oficial de nginx ejecuta lo que haya en
# /docker-entrypoint.d/ antes de arrancar.
set -eu

target=/usr/share/nginx/html/env.js

json_escape() {
  printf '%s' "$1" | sed 's/\\/\\\\/g; s/"/\\"/g'
}

cat > "$target" <<EOF
window.__RESPET_ENV__ = {
  "apiUrl": "$(json_escape "${RESPET_API_URL:-}")",
  "graphqlUrl": "$(json_escape "${RESPET_GRAPHQL_URL:-}")",
  "googleMapsApiKey": "$(json_escape "${RESPET_GOOGLE_MAPS_API_KEY:-}")",
  "googleClientId": "$(json_escape "${RESPET_GOOGLE_CLIENT_ID:-}")",
  "facebookAppId": "$(json_escape "${RESPET_FACEBOOK_APP_ID:-}")",
  "publicMail": "$(json_escape "${RESPET_PUBLIC_MAIL:-}")"
};
EOF

echo "respet: env.js escrito para ${RESPET_GRAPHQL_URL:-(valores de la compilación)}"
