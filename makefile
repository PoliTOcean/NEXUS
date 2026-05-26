.PHONY: install build-ui dev-backend dev-eva dev-float test nexus controller

install:
	./install.sh

build-ui:
	cd frontend && pnpm build:apps

dev-backend:
	python3 run.py --mode debug --port 8000

dev-eva:
	cd frontend && VITE_NEXUS_BASE_URL=http://127.0.0.1:8000 pnpm --filter @politocean/eva dev

dev-float:
	cd frontend && VITE_NEXUS_BASE_URL=http://127.0.0.1:8000 pnpm --filter @politocean/float dev

test: dev-backend

nexus: build-ui
	python3 run.py --mode production

controller:
	python3 -m utils_rov.main --controller
