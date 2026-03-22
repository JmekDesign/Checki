.PHONY: up down restart logs test lint typecheck lint-fix deploy db-shell db-init db-test-init

SERVER=root@77.73.238.214
SERVER_DIR=/srv/checki

# Docker
up:
	docker compose up -d

down:
	docker compose down

restart:
	docker compose restart checki-api

logs:
	docker compose logs -f checki-api

# Deploy
deploy:
	git push origin master
	ssh $(SERVER) "cd $(SERVER_DIR) && git pull && docker compose build checki-api && docker compose up -d checki-api && bash api_wait.sh"

# Quality
test:
	.venv/bin/pytest tests/ -v

lint:
	.venv/bin/ruff check backend/app/

typecheck:
	.venv/bin/mypy --strict backend/app/

lint-fix:
	.venv/bin/ruff check --fix backend/app/ && .venv/bin/ruff format backend/app/

# Database
db-shell:
	docker compose exec checki-db psql -U checki -d checki

db-init:
	docker compose exec -T checki-db psql -U checki -d checki < sql/001_init.sql
	docker compose exec -T checki-db psql -U checki -d checki < sql/002_sessions.sql

db-test-init:
	docker compose exec checki-db psql -U checki -c "CREATE DATABASE checki_test;" || true
	docker compose exec -T checki-db psql -U checki -d checki_test < sql/001_init.sql
	docker compose exec -T checki-db psql -U checki -d checki_test < sql/002_sessions.sql
