FROM alpine/git:latest@sha256:63d6641dc22922b38b8c19780d2308879ef29a8fb9766ddb90f7e4c9ddeefad3
# or a more specific image like a Debian slim or Ubuntu base image.
RUN apk add --no-cache restic fuse-overlayfs
WORKDIR /app

COPY backup.sh /app/backup.sh
COPY cleanup.sh /app/cleanup.sh

# Make scripts executable
RUN chmod +x /app/backup.sh /app/cleanup.sh
