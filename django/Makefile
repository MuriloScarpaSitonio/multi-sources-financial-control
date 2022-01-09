.PHONY: test

PYTEST_CONFIGS := --nomigrations --cov-report=term-missing  --cov-report=html --cov=.

test:
	pytest -n`grep -c ^processor /proc/cpuinfo` $(PYTEST_CONFIGS) 