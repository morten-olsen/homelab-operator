.PHONY: setup dev-recreate dev-create dev-destroy

setup:
	./scripts/setup-server.sh

dev-destroy:
	colima delete -f

dev-create:
	colima start --network-address --kubernetes -m 8 --mount ${PWD}/data:/data:w --k3s-arg="--disable=helm-controller,local-storage"

dev-recreate: dev-destroy dev-create setup

server-install:
	curl -sfL https://get.k3s.io | sh -s - --disable traefik,local-storage,helm-controller