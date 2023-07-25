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
	pytest -n auto --disable-warnings --nomigrations --cov-report=term-missing:skip-covered --cov-report=html --cov=.

test-exit:
	pytest -n auto --disable-warnings --exitfirst

test-last:
	pytest -s --disable-warnings --exitfirst --last-failed


pre-commit: test code-convention security-check #typing-check

pc: pre-commit  # alias