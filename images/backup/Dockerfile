FROM alpine/git:latest@sha256:1dd70a5eed7f9b17aecd66756d138137d6818061c4fefefa5859b07f760e68fe
# or a more specific image like a Debian slim or Ubuntu base image.
RUN apk add --no-cache restic fuse-overlayfs
WORKDIR /app

COPY backup.sh /app/backup.sh
COPY cleanup.sh /app/cleanup.sh

# Make scripts executable
RUN chmod +x /app/backup.sh /app/cleanup.sh
