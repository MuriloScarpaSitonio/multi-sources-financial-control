linter-check:
	ruff check .

formatter-check:
	black . --check

code-convention: linter-check formatter-check

security-check:
	bandit --configfile pyproject.toml --recursive .

typing-check:
	mypy . --exclude=tests --ignore-missing-imports

test:
	USE_POSTGRES=1 uv run pytest -n auto --disable-warnings --cov-report=term-missing:skip-covered --cov-report=html --cov=.

test-exit:
	USE_POSTGRES=1 pytest -n auto --disable-warnings --exitfirst

test-last:
	USE_POSTGRES=1 pytest -s --disable-warnings --exitfirst --last-failed


pre-commit: test code-convention security-check #typing-check

pc: pre-commit  # alias

migrate: 
	docker-compose run django python3 manage.py migrate

shell: 
	docker-compose run django python3 manage.py shell

seed:
	docker-compose exec django bash /app/scripts/seed_db.sh /app/db_dump.sql
