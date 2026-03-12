#!/bin/sh
# fccview here! Improved script to handle Hugging Face persistent storage.

set -e

# Hugging Face persistent storage is usually at /data
# If it exists, we want to use it for our data directory.
if [ -d "/data" ]; then
    echo "> Hugging Face persistent storage detected at /data"

    # If /data is empty, seed it with initial structure
    if [ ! -d "/data/users" ]; then
        echo "> Seeding /data with initial directory structure..."
        mkdir -p /data/users /data/checklists /data/notes /data/sharing /data/encryption /data/logs
        # Also ensure we have a users.json if possible, or it will be created on start
        [ -f "/app/data/users/users.json" ] && cp /app/data/users/users.json /data/users/users.json
    fi

    # Replace /app/data with a symlink to /data
    if [ -d "/app/data" ] && [ ! -L "/app/data" ]; then
        echo "> Symlinking /app/data to /data"
        rm -rf /app/data
        ln -s /data /app/data
    fi
fi

PUID=${PUID:-1000}
PGID=${PGID:-1000}
UMASK=${UMASK:-002}

# Handle permissions if running as root (standard Docker)
if [ "$(id -u)" = "0" ]; then
    if [ "$PUID" != "1000" ] || [ "$PGID" != "1000" ]; then
        GROUP_NAME=$(getent group "$PGID" | cut -d: -f1)
        if [ -z "$GROUP_NAME" ]; then
            addgroup -g "$PGID" appgroup
            GROUP_NAME="appgroup"
        fi
        
        if ! getent passwd "$PUID" > /dev/null 2>&1; then
            adduser -D -u "$PUID" -G "$GROUP_NAME" appuser
        fi
        
        # Only chown if /data is not a mount point we can't control
        chown -R "$PUID:$PGID" /app/data /app/.next /app/config 2>/dev/null || true
    fi
    
    umask "$UMASK"
    
    USER_NAME=$(getent passwd "$PUID" | cut -d: -f1)
    GROUP_NAME=$(getent group "$PGID" | cut -d: -f1)
    exec su-exec "$USER_NAME:$GROUP_NAME" "$@"
else
    # Running in an environment like HF which already provides a non-root user
    umask "$UMASK"
    exec "$@"
fi
