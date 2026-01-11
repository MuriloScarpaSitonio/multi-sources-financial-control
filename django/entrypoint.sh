#!/bin/sh
set -e

# Sync dependencies (fast if already installed, handles dev deps for local)
echo "Syncing dependencies..."
uv sync --frozen

echo "Running command: $@"
exec "$@"
