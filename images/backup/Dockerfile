FROM alpine/git:latest
# or a more specific image like a Debian slim or Ubuntu base image.
RUN apk add --no-cache restic fuse-overlayfs
WORKDIR /app

COPY backup.sh /app/backup.sh
COPY cleanup.sh /app/cleanup.sh

# Make scripts executable
RUN chmod +x /app/backup.sh /app/cleanup.sh
