#!/bin/bash
# Deploy canonico del frontend al VPS (sistema.pinturaselperico.com).
# Uso (Git Bash):  cd frontend && ./deploy.sh
# Hace: verifica repo limpio -> build -> scp -> verifica hash en el VPS.
# Evita que dos sesiones (PC / Cowork / Mac) se pisen el deploy: siempre
# despliega HEAD commiteado, nunca trabajo a medias.
set -euo pipefail

VPS=root@137.184.121.244
DIST_REMOTO=/var/www/erp-perico/frontend/dist

cd "$(dirname "$0")"

# 1) Repo limpio: nada sin commitear (si no, podrias desplegar codigo a medias
#    o pisar trabajo de otra sesion que aun no jala estos cambios).
if [ -n "$(git status --porcelain)" ]; then
  echo "ERROR: hay cambios sin commitear. Commitea (o stashea) antes de desplegar:" >&2
  git status --short >&2
  exit 1
fi

echo "==> HEAD: $(git log --oneline -1)"

# 2) Build
npm run build

BUNDLE_LOCAL=$(grep -oE 'assets/index-[A-Za-z0-9_-]+\.js' dist/index.html | head -1)
echo "==> Bundle local: $BUNDLE_LOCAL"

# 3) Deploy COMPLETO de dist (assets, index, logos, manuales, manifest...).
#    assets se borra primero para no acumular bundles viejos; el resto se
#    sobreescribe encima (public/ de Vite: logos, manual/<rol>, manifest).
ssh -o ConnectTimeout=15 "$VPS" "rm -rf $DIST_REMOTO/assets"
scp -o ConnectTimeout=15 -r dist/* "$VPS:$DIST_REMOTO/"

# 4) Verificacion: el index.html del VPS debe referenciar el mismo bundle
BUNDLE_VPS=$(ssh -o ConnectTimeout=15 "$VPS" "grep -oE 'assets/index-[A-Za-z0-9_-]+\.js' $DIST_REMOTO/index.html | head -1")
if [ "$BUNDLE_LOCAL" != "$BUNDLE_VPS" ]; then
  echo "ERROR: el VPS quedo con $BUNDLE_VPS (esperaba $BUNDLE_LOCAL)" >&2
  exit 1
fi

echo "==> DEPLOY OK: $BUNDLE_VPS en produccion ($(git log --oneline -1))"
echo "    Los clientes se recargan solos via VersionChecker al volver a la app."
