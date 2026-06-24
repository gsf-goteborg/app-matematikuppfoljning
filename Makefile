.PHONY: install install-backend install-frontend seed dev dev-backend dev-frontend demo clean

VENV := backend/.venv
# Windows puts venv executables in Scripts/, Unix in bin/.
ifeq ($(OS),Windows_NT)
	PYTHON ?= python
	VENV_BIN := $(VENV)/Scripts
else
	PYTHON ?= python3
	VENV_BIN := $(VENV)/bin
endif
PIP := $(VENV_BIN)/pip
PY := $(VENV_BIN)/python
STUDENTS ?= 2000
SEED ?= 42

install: install-backend install-frontend ## Install backend + frontend deps

install-backend:
	$(PYTHON) -m venv $(VENV)
	$(PIP) install -q -e backend

install-frontend:
	cd frontend && npm install

seed: ## Generate synthetic data (override with STUDENTS=.. SEED=..)
	cd backend && ../$(VENV_BIN)/python seed.py --students $(STUDENTS) --seed $(SEED)

dev-backend:
	cd backend && ../$(VENV_BIN)/uvicorn app.main:app --reload --port 8000

dev-frontend:
	cd frontend && npm run dev

dev: ## Start backend (uvicorn) and frontend (Vite) in parallel
	@echo "Startar backend (8000) och frontend (5173)…"
	@trap 'kill 0' INT TERM; \
	( cd backend && ../$(VENV_BIN)/uvicorn app.main:app --reload --port 8000 ) & \
	( cd frontend && npm run dev ) & \
	wait

demo: seed dev ## Seed then run both servers

clean:
	rm -rf $(VENV) frontend/node_modules frontend/dist backend/demo.db backend/seed_scenarios.json
