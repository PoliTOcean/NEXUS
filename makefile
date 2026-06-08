.PHONY: install build-ui dev-backend dev-eva dev-float test nexus controller

# Use the venv interpreter when present so targets don't run against the system
# Python (which may be the unsupported 3.13). Falls back to python3 if no venv.
PYTHON := $(shell [ -x venv/bin/python ] && echo venv/bin/python || echo python3)

install:
	./install.sh

build-ui:
	cd frontend && pnpm build:apps

dev-backend:
	$(PYTHON) run.py --mode debug --port 8000

dev-eva:
	cd frontend && VITE_NEXUS_BASE_URL=http://127.0.0.1:8000 pnpm --filter @politocean/eva dev

dev-float:
	cd frontend && VITE_NEXUS_BASE_URL=http://127.0.0.1:8000 pnpm --filter @politocean/float dev

test: dev-backend

nexus: build-ui
	$(PYTHON) run.py --mode production

controller:
	$(PYTHON) -m utils_rov.main --controller