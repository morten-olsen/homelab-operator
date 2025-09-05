#!/bin/sh

set -e

if [ -z "$RESTIC_PASSWORD" ]; then
  echo "Error: RESTIC_PASSWORD environment variable is not set." >&2
  exit 1
fi
RESTIC_REPOSITORY="/mnt/backup"

echo "Starting Restic cleanup for repository $RESTIC_REPOSITORY"

echo "Checking Restic repository existence..."
restic snapshots --repository "$RESTIC_REPOSITORY"

# Restic forget and prune strategy
# --keep-daily 7: Keep 7 most recent daily backups
# --keep-weekly 4: Keep 4 most recent weekly backups
# --keep-monthly 6: Keep 6 most recent monthly backups
# --keep-yearly 1: Keep 1 most recent yearly backup
# --prune: Actually delete data that's no longer referenced
# --group-by host,paths: Group snapshots for retention by host and path.
echo "Running Restic forget and prune..."
restic forget \
  --group-by host,paths \
  --tag "daily" \
  --keep-daily 7 \
  --keep-weekly 4 \
  --keep-monthly 6 \
  --keep-yearly 1 \
  --prune \
  --verbose \
  --repository "$RESTIC_REPOSITORY"

if [ $? -eq 0 ]; then
  echo "Restic cleanup completed successfully!"
else
  echo "Restic cleanup failed!"
  exit 1
fi

echo "Cleanup finished."
