.PHONY: test

PYTEST_CONFIGS := --disable-warnings --nomigrations --cov-report=term-missing  --cov-report=html --cov=.

test:
	pytest -n auto $(PYTEST_CONFIGS) 

test-exit:
	pytest -n auto --disable-warnings --exitfirst

test-last:
	pytest -n auto --disable-warnings --exitfirst --last-failed