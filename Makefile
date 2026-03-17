.PHONY: up down restart logs test lint typecheck lint-fix db-shell db-init db-test-init

# Docker
up:
	docker compose up -d

down:
	docker compose down

restart:
	docker compose restart checki-api

logs:
	docker compose logs -f checki-api

# Quality
test:
	pytest tests/ -v

lint:
	ruff check backend/app/

typecheck:
	mypy --strict backend/app/

lint-fix:
	ruff check --fix backend/app/ && ruff format backend/app/

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
