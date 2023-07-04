
test:
	pytest -n auto --disable-warnings --nomigrations --cov-report=term-missing:skip-covered --cov-report=html --cov=.

test-exit:
	pytest -n auto --disable-warnings --exitfirst

test-last:
	pytest -s --disable-warnings --exitfirst --last-failed