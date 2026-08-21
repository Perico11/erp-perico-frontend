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

# 3) Deploy ATÓMICO de dist. Incidente 30-jun-2026: el esquema viejo (rm -rf
#    assets → scp SOBRE el dist VIVO) dejó prod ROTO cuando el scp se cortó a
#    media subida (index.html referenciando un JS inexistente = pantalla blanca),
#    agravado por DOS sesiones desplegando a la vez. Ahora:
#    - LOCK remoto (mkdir es atómico): si otro deploy está en curso, aborta.
#    - Se sube TODO a dist.new; si el scp muere, el dist vivo NI SE TOCÓ.
#    - Swap con mv (ventana de milisegundos) y dist.old queda como rollback:
#      ssh $VPS 'rm -rf dist && mv dist.old dist'  (dentro de frontend/)
LOCK="$DIST_REMOTO.lock"
if ! ssh -o ConnectTimeout=15 "$VPS" "mkdir $LOCK 2>/dev/null"; then
  echo "ERROR: hay OTRO deploy en curso ($LOCK existe en el VPS)." >&2
  echo "  Si es un deploy muerto (crasheó), libéralo con:" >&2
  echo "  ssh $VPS 'rmdir $LOCK'" >&2
  exit 1
fi
trap 'ssh -o ConnectTimeout=15 "$VPS" "rmdir $LOCK 2>/dev/null" || true' EXIT

ssh -o ConnectTimeout=15 "$VPS" "rm -rf $DIST_REMOTO.new && mkdir -p $DIST_REMOTO.new"
scp -o ConnectTimeout=15 -r dist/* "$VPS:$DIST_REMOTO.new/"
ssh -o ConnectTimeout=15 "$VPS" "rm -rf $DIST_REMOTO.old && mv $DIST_REMOTO $DIST_REMOTO.old && mv $DIST_REMOTO.new $DIST_REMOTO"

# 4) Verificacion: el index.html del VPS debe referenciar el mismo bundle
BUNDLE_VPS=$(ssh -o ConnectTimeout=15 "$VPS" "grep -oE 'assets/index-[A-Za-z0-9_-]+\.js' $DIST_REMOTO/index.html | head -1")
if [ "$BUNDLE_LOCAL" != "$BUNDLE_VPS" ]; then
  echo "ERROR: el VPS quedo con $BUNDLE_VPS (esperaba $BUNDLE_LOCAL)" >&2
  exit 1
fi

echo "==> DEPLOY OK: $BUNDLE_VPS en produccion ($(git log --oneline -1))"
echo "    Los clientes se recargan solos via VersionChecker al volver a la app."
