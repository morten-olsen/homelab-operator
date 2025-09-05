#!/bin/sh

set -e

if [ -z "$RESTIC_PASSWORD" ]; then
  echo "Error: RESTIC_PASSWORD environment variable is not set." >&2
  exit 1
fi

RESTIC_REPOSITORY="/mnt/backup"
SOURCE_DIR="/mnt/source"

mkdir -p "$SOURCE_DIR"
mkdir -p "/mnt/backup"

echo "Starting Restic backup from $SOURCE_DIR to $RESTIC_REPOSITORY"

echo "Checking/Initializing Restic repository..."
restic init --repo "$RESTIC_REPOSITORY" || true

echo "Running Restic backup..."
restic backup \
  -r "$RESTIC_REPOSITORY"
  "$SOURCE_DIR" \
  --verbose \
  --tag "daily"

if [ $? -eq 0 ]; then
  echo "Restic backup completed successfully!"
else
  echo "Restic backup failed!"
  exit 1
fi

echo "Backup finished."
