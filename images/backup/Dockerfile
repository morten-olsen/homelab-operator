FROM alpine/git:latest@sha256:9c9c6debba3eac25c9230db4bbd1e17d0c27efffdb93e502a47f6f447ab90ac4
# or a more specific image like a Debian slim or Ubuntu base image.
RUN apk add --no-cache restic fuse-overlayfs
WORKDIR /app

COPY backup.sh /app/backup.sh
COPY cleanup.sh /app/cleanup.sh

# Make scripts executable
RUN chmod +x /app/backup.sh /app/cleanup.sh
