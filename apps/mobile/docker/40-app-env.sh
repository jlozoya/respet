#!/bin/sh
# Escribe la configuración en tiempo de ejecución de la web a partir de las
# variables del contenedor. La imagen oficial de nginx ejecuta lo que haya en
# /docker-entrypoint.d/ antes de arrancar.
#
# La marca viaja aquí para que la primera pantalla salga ya con el nombre y el
# color correctos; la API la vuelve a servir en la consulta `branding`, que es
# la que manda en cuanto responde.
set -eu

target=/usr/share/nginx/html/env.js

json_escape() {
  printf '%s' "$1" | sed 's/\\/\\\\/g; s/"/\\"/g'
}

cat > "$target" <<EOF
window.__APP_ENV__ = {
  "apiUrl": "$(json_escape "${APP_API_URL:-}")",
  "graphqlUrl": "$(json_escape "${APP_GRAPHQL_URL:-}")",
  "googleMapsApiKey": "$(json_escape "${APP_GOOGLE_MAPS_API_KEY:-}")",
  "googleClientId": "$(json_escape "${APP_GOOGLE_CLIENT_ID:-}")",
  "facebookAppId": "$(json_escape "${APP_FACEBOOK_APP_ID:-}")",
  "appName": "$(json_escape "${APP_NAME:-}")",
  "appTagline": "$(json_escape "${APP_TAGLINE:-}")",
  "appDescription": "$(json_escape "${APP_DESCRIPTION:-}")",
  "appLogoUrl": "$(json_escape "${APP_LOGO_URL:-}")",
  "appIconUrl": "$(json_escape "${APP_ICON_URL:-}")",
  "appBrandColor": "$(json_escape "${APP_BRAND_COLOR:-}")",
  "appBrandGradient": "$(json_escape "${APP_BRAND_GRADIENT:-}")",
  "appWebsite": "$(json_escape "${APP_WEBSITE:-}")",
  "appPublicMail": "$(json_escape "${APP_PUBLIC_MAIL:-}")",
  "appPhone": "$(json_escape "${APP_PHONE:-}")",
  "appAddress": "$(json_escape "${APP_ADDRESS:-}")",
  "appFacebook": "$(json_escape "${APP_FACEBOOK:-}")",
  "appInstagram": "$(json_escape "${APP_INSTAGRAM:-}")"
};
EOF

echo "${APP_NAME:-app}: env.js escrito para ${APP_GRAPHQL_URL:-(valores de la compilación)}"
