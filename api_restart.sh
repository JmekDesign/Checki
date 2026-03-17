#!/usr/bin/env bash
set -euo pipefail
cd /srv/checki
docker compose restart checki-api
bash /srv/checki/api_wait.sh
