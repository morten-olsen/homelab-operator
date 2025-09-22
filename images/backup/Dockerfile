FROM alpine/git:latest@sha256:bd54f921f6d803dfa3a4fe14b7defe36df1b71349a3e416547e333aa960f86e3
# or a more specific image like a Debian slim or Ubuntu base image.
RUN apk add --no-cache restic fuse-overlayfs
WORKDIR /app

COPY backup.sh /app/backup.sh
COPY cleanup.sh /app/cleanup.sh

# Make scripts executable
RUN chmod +x /app/backup.sh /app/cleanup.sh
