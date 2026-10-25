# CareSignal — build entry points.
#   make data   fetch → validate → transform → hac_rebuild → metrics → export_site → export_excel
#   make test   pytest + web vitest
#   make web    npm ci && vite build
#   make all    data + test + web
# In CI, override the interpreter:  make data PY=python

PY ?= .venv/bin/python
NPM ?= npm
FETCH_FLAGS ?= --if-changed

.PHONY: all data fetch validate transform hac metrics export excel test test-unit test-py test-web web lint clean venv size

all: data test web size

venv:
	python3 -m venv .venv && .venv/bin/pip install -r requirements.txt

data: fetch validate transform hac metrics export excel

fetch:
	$(PY) -m pipeline.fetch $(FETCH_FLAGS)

validate:
	$(PY) -m pipeline.validate

transform:
	$(PY) -m pipeline.transform

hac:
	$(PY) -m pipeline.hac_rebuild

metrics:
	$(PY) -m pipeline.metrics

export:
	$(PY) -m pipeline.export_site
	$(PY) scripts/update_readme_findings.py

excel:
	$(PY) -m pipeline.export_excel

test: test-py test-web

# Full suite, including tests marked `data` (need data/processed from `make data`).
test-py:
	$(PY) -m pytest -q

# Unit tests only — no CMS data required (used by ci.yml on pull requests).
test-unit:
	$(PY) -m pytest -q -m "not data"

test-web:
	cd web && npx vitest run --passWithNoTests

web:
	cd web && $(NPM) ci && $(NPM) run build

lint:
	$(PY) -m ruff check .
	cd web && npx eslint .

size:
	bash scripts/size_guard.sh web/dist 200

clean:
	rm -rf data/processed web/dist web/public/data web/public/downloads .pytest_cache
	find . -name __pycache__ -type d -prune -not -path './web/node_modules/*' -exec rm -rf {} +
