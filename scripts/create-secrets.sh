#!/bin/bash

# Load environment variables from .env file
if [ -f .env ]; then
  export $(cat .env | grep -v '#' | awk '/=/ {print $1}')
fi

# Check if CLOUDFLARE_API_KEY is set
if [ -z "${CLOUDFLARE_API_KEY}" ]; then
  echo "Error: CLOUDFLARE_API_KEY is not set. Please add it to your .env file."
  exit 1
fi

# Create the postgres namespace if it doesn't exist
kubectl get namespace postgres > /dev/null 2>&1 || kubectl create namespace postgres

# Create the secret
kubectl create secret generic cloudflare-api-token \
  --namespace cert-manager \
  --from-literal=api-token="${CLOUDFLARE_API_KEY}"
