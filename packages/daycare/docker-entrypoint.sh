#!/bin/sh
set -e

# Docker entrypoint for Daycare Engine
#
# Supports role configuration via:
# 1. DAYCARE_ROLE environment variable (default: all)
# 2. --role CLI argument (takes precedence)

# Build the command
CMD="node /app/dist/main.js"

# Check if we're running the start command
if [ "$1" = "start" ]; then
    shift  # Remove 'start' from arguments
    
    # Add role from env var if set and --role not in args
    case "$*" in
        *--role*)
            # --role already specified in CLI args
            ;;
        *)
            # Add role from env var
            if [ -n "$DAYCARE_ROLE" ] && [ "$DAYCARE_ROLE" != "all" ]; then
                set -- --role "$DAYCARE_ROLE" "$@"
            fi
            ;;
    esac
    
    exec $CMD start "$@"
else
    # Pass through any other command
    exec $CMD "$@"
fi
