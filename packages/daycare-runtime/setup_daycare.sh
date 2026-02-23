#!/bin/bash --login

set -euo pipefail

DAYCARE_ENV_PYTHON_VERSION=${DAYCARE_ENV_PYTHON_VERSION:-}
DAYCARE_ENV_NODE_VERSION=${DAYCARE_ENV_NODE_VERSION:-}
DAYCARE_ENV_RUBY_VERSION=${DAYCARE_ENV_RUBY_VERSION:-}
DAYCARE_ENV_RUST_VERSION=${DAYCARE_ENV_RUST_VERSION:-}
DAYCARE_ENV_GO_VERSION=${DAYCARE_ENV_GO_VERSION:-}
DAYCARE_ENV_SWIFT_VERSION=${DAYCARE_ENV_SWIFT_VERSION:-}
DAYCARE_ENV_PHP_VERSION=${DAYCARE_ENV_PHP_VERSION:-}
DAYCARE_ENV_JAVA_VERSION=${DAYCARE_ENV_JAVA_VERSION:-}

echo "Configuring language runtimes..."

# For Python and Node, always run the install commands so we can install
# global libraries for linting and formatting. This just switches the version.

# For others (e.g. rust), to save some time on bootup we only install other language toolchains
# if the versions differ.

if [ -n "${DAYCARE_ENV_PYTHON_VERSION}" ]; then
    echo "# Python: ${DAYCARE_ENV_PYTHON_VERSION}"
    pyenv global "${DAYCARE_ENV_PYTHON_VERSION}"
    python3 --version
fi

if [ -n "${DAYCARE_ENV_NODE_VERSION}" ]; then
    current=$(node -v | cut -d. -f1)   # ==> v20
    echo "# Node.js: v${DAYCARE_ENV_NODE_VERSION} (default: ${current})"
    if [ "${current}" != "v${DAYCARE_ENV_NODE_VERSION}" ]; then
        nvm alias default "${DAYCARE_ENV_NODE_VERSION}"
        nvm use --save "${DAYCARE_ENV_NODE_VERSION}"
        corepack enable
    fi
fi

if [ -n "${DAYCARE_ENV_RUBY_VERSION}" ]; then
    current=$(ruby -v | cut -d' ' -f2 | cut -d'p' -f1)   # ==> 3.2.3
    echo "# Ruby: ${DAYCARE_ENV_RUBY_VERSION} (default: ${current})"
    if [ "${current}" != "${DAYCARE_ENV_RUBY_VERSION}" ]; then
        mise use --global "ruby@${DAYCARE_ENV_RUBY_VERSION}"
        ruby --version
    fi
fi

if [ -n "${DAYCARE_ENV_RUST_VERSION}" ]; then
    current=$(rustc --version | awk '{print $2}')   # ==> 1.86.0
    echo "# Rust: ${DAYCARE_ENV_RUST_VERSION} (default: ${current})"
    if [ "${current}" != "${DAYCARE_ENV_RUST_VERSION}" ]; then
       rustup default "${DAYCARE_ENV_RUST_VERSION}"
       rustc --version
    fi
fi

if [ -n "${DAYCARE_ENV_GO_VERSION}" ]; then
    current=$(go version | awk '{print $3}')   # ==> go1.23.8
    echo "# Go: go${DAYCARE_ENV_GO_VERSION} (default: ${current})"
    if [ "${current}" != "go${DAYCARE_ENV_GO_VERSION}" ]; then
        mise use --global "go@${DAYCARE_ENV_GO_VERSION}"
        go version
    fi
fi

if [ -n "${DAYCARE_ENV_SWIFT_VERSION}" ]; then
    current=$(swift --version | sed -n 's/^Swift version \([0-9]\+\.[0-9]\+\).*/\1/p')   # ==> 6.2
    echo "# Swift: ${DAYCARE_ENV_SWIFT_VERSION} (default: ${current})"
    if [ "${current}" != "${DAYCARE_ENV_SWIFT_VERSION}" ]; then
        swiftly use "${DAYCARE_ENV_SWIFT_VERSION}"
        swift --version
    fi
fi


if [ -n "${DAYCARE_ENV_PHP_VERSION}" ]; then
    current=$(php -r 'echo PHP_MAJOR_VERSION.".".PHP_MINOR_VERSION;')
    echo "# PHP: ${DAYCARE_ENV_PHP_VERSION} (default: ${current})"
    if [ "${current}" != "${DAYCARE_ENV_PHP_VERSION}" ]; then
        phpenv global "${DAYCARE_ENV_PHP_VERSION}snapshot"
        php --version
    fi
fi

if [ -n "${DAYCARE_ENV_JAVA_VERSION}" ]; then
    current=$(java -version 2>&1 | awk -F'[ ."]+' '/version/ {print $3}')
    echo "# Java: ${DAYCARE_ENV_JAVA_VERSION} (default: ${current})"
    if [ "${current}" != "${DAYCARE_ENV_JAVA_VERSION}" ]; then
        mise use --global "java@${DAYCARE_ENV_JAVA_VERSION}"
        java -version
    fi
fi
