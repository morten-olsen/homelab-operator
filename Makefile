.PHONY: dev-recreate dev-destroy server-install

dev-destroy:
	colima delete -f

dev-recreate: dev-destroy
	colima start --network-address --kubernetes -m 8 --k3s-arg="--disable helm-controller,local-storage,traefik --docker" # --mount ${PWD}/data:/data:w 
	flux install --components="source-controller,helm-controller"

setup-flux:
	flux install --components="source-controller,helm-controller"

server-install:
	curl -sfL https://get.k3s.io | sh -s - --disable traefik,local-storage,helm-controller