FROM alpine/git:latest@sha256:7e6d53df14a830e62a3bcefb1daf37f9ea1b9405756c975ad2de66234d362fef
# or a more specific image like a Debian slim or Ubuntu base image.
RUN apk add --no-cache restic fuse-overlayfs
WORKDIR /app

COPY backup.sh /app/backup.sh
COPY cleanup.sh /app/cleanup.sh

# Make scripts executable
RUN chmod +x /app/backup.sh /app/cleanup.sh
