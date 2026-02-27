# syntax=docker/dockerfile:1.7
FROM oven/bun:1 AS srt-builder

WORKDIR /build

RUN bun init -y \
    && bun add @anthropic-ai/sandbox-runtime@0.0.34

RUN bun build --compile node_modules/@anthropic-ai/sandbox-runtime/dist/cli.js --outfile srt

FROM ubuntu:24.04

ARG TARGETOS
ARG TARGETARCH

ENV LANG="C.UTF-8"
ENV HOME=/home
ENV DEBIAN_FRONTEND=noninteractive

ENV XDG_CACHE_HOME=/home/developer/.cache
ENV NPM_CONFIG_CACHE=$XDG_CACHE_HOME/npm
ENV YARN_CACHE_FOLDER=$XDG_CACHE_HOME/yarn
ENV PNPM_STORE_DIR=/home/developer/.local/share/pnpm/store
ENV PIP_CACHE_DIR=$XDG_CACHE_HOME/pip
ENV UV_CACHE_DIR=$XDG_CACHE_HOME/uv
ENV CARGO_HOME=/home/developer/.cargo
ENV RUSTUP_HOME=/usr/local/rustup
ENV GOROOT=/usr/local/go
ENV GOPATH=/home/developer/go
ENV GOMODCACHE=$GOPATH/pkg/mod
ENV GOCACHE=$XDG_CACHE_HOME/go-build
ENV PATH=$GOROOT/bin:$GOPATH/bin:$CARGO_HOME/bin:/usr/local/cargo/bin:$PATH

### BASE ###

RUN --mount=type=cache,target=/var/cache/apt,sharing=locked \
    --mount=type=cache,target=/var/lib/apt,sharing=locked \
    apt-get update \
    && apt-get install -y --no-install-recommends \
        binutils=2.42-* \
        bubblewrap \
        sudo=1.9.* \
        build-essential=12.10* \
        bzr=2.7.* \
        curl=8.5.* \
        default-libmysqlclient-dev=1.1.* \
        dnsutils=1:9.18.* \
        fd-find=9.0.* \
        ffmpeg \
        gettext=0.21-* \
        git=1:2.43.* \
        git-lfs=3.4.* \
        gnupg=2.4.* \
        imagemagick \
        inotify-tools=3.22.* \
        iputils-ping=3:20240117-* \
        jq=1.7.* \
        libbz2-dev=1.0.* \
        libc6=2.39-* \
        libc6-dev=2.39-* \
        libcurl4-openssl-dev=8.5.* \
        libdb-dev=1:5.3.* \
        libedit2=3.1-* \
        libffi-dev=3.4.* \
        libgcc-13-dev=13.3.* \
        libgdbm-compat-dev=1.23-* \
        libgdbm-dev=1.23-* \
        libgdiplus=6.1+dfsg-* \
        libgssapi-krb5-2=1.20.* \
        libimage-exiftool-perl \
        liblzma-dev=5.6.* \
        libncurses-dev=6.4+20240113-* \
        libnss3-dev=2:3.98-* \
        libpq-dev=16.* \
        libpsl-dev=0.21.* \
        libpython3-dev=3.12.* \
        libreadline-dev=8.2-* \
        libsqlite3-dev=3.45.* \
        libssl-dev=3.0.* \
        libstdc++-13-dev=13.3.* \
        libunwind8=1.6.* \
        libuuid1=2.39.* \
        libvips-tools \
        libxml2-dev=2.9.* \
        libz3-dev=4.8.* \
        lsof \
        make=4.3-* \
        mediainfo \
        moreutils=0.69-* \
        netcat-openbsd=1.226-* \
        openssh-client=1:9.6p1-* \
        p7zip-full \
        pkg-config=1.8.* \
        protobuf-compiler=3.21.* \
        ripgrep=14.1.* \
        rsync=3.2.* \
        shellcheck=0.9.* \
        socat \
        software-properties-common=0.99.* \
        sqlite3=3.45.* \
        strace \
        swig3.0=3.0.* \
        tk-dev=8.6.* \
        tree \
        tzdata=2025b-* \
        universal-ctags=5.9.* \
        unixodbc-dev=2.3.* \
        unzip=6.0-* \
        uuid-dev=2.39.* \
        wget=1.21.* \
        xz-utils=5.6.* \
        zip=3.0-* \
        zlib1g=1:1.3.* \
        zlib1g-dev=1:1.3.* \
        zstd \
    && rm -rf /var/lib/apt/lists/* \
    && ln -sf /usr/bin/fdfind /usr/local/bin/fd

### SRT ###

COPY --from=srt-builder /build/srt /usr/local/lib/srt/srt
COPY --from=srt-builder /build/node_modules/@anthropic-ai/sandbox-runtime/vendor /usr/local/lib/srt/vendor
RUN chmod +x /usr/local/lib/srt/srt \
    && ln -s /usr/local/lib/srt/srt /usr/local/bin/srt

### NODE ###

ARG NVM_VERSION=v0.40.2
ARG NODE_VERSION=22

ENV NVM_DIR=/root/.nvm
ENV COREPACK_DEFAULT_TO_LATEST=0
ENV COREPACK_ENABLE_DOWNLOAD_PROMPT=0
ENV COREPACK_ENABLE_AUTO_PIN=0
ENV COREPACK_ENABLE_STRICT=0

RUN --mount=type=cache,target=$NPM_CONFIG_CACHE \
    --mount=type=cache,target=$YARN_CACHE_FOLDER \
    --mount=type=cache,target=$PNPM_STORE_DIR \
    git -c advice.detachedHead=0 clone --branch "$NVM_VERSION" --depth 1 https://github.com/nvm-sh/nvm.git "$NVM_DIR" \
    && echo 'source $NVM_DIR/nvm.sh' >> /etc/profile \
    && echo "prettier\neslint\ntypescript" > $NVM_DIR/default-packages \
    && . $NVM_DIR/nvm.sh \
    && nvm install "$NODE_VERSION" \
    && nvm use "$NODE_VERSION" \
    && npm install -g npm@11.4 pnpm@10.12 \
    && corepack enable \
    && corepack install -g yarn \
    && nvm alias default "$NODE_VERSION" \
    && nvm cache clear \
    && npm cache clean --force || true \
    && pnpm store prune || true \
    && yarn cache clean || true

### PYTHON ###

RUN --mount=type=cache,target=/var/cache/apt,sharing=locked \
    --mount=type=cache,target=/var/lib/apt,sharing=locked \
    --mount=type=cache,target=$PIP_CACHE_DIR \
    apt-get update \
    && apt-get install -y --no-install-recommends \
        python3 \
        python3-pip \
        python3-venv \
    && rm -rf /var/lib/apt/lists/* \
    && python3 -m pip install --no-cache-dir --break-system-packages --upgrade uv \
    && python3 --version \
    && pip3 --version \
    && uv --version

ENV UV_NO_PROGRESS=1

### RUST ###

ARG RUST_VERSION=stable
RUN --mount=type=cache,target=/usr/local/cargo/registry \
    --mount=type=cache,target=/usr/local/cargo/git \
    export HOME=/root CARGO_HOME=/usr/local/cargo RUSTUP_HOME=/usr/local/rustup \
    && curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y --profile minimal --default-toolchain "$RUST_VERSION" \
    && CARGO_HOME=/usr/local/cargo RUSTUP_HOME=/usr/local/rustup /usr/local/cargo/bin/rustc --version \
    && CARGO_HOME=/usr/local/cargo RUSTUP_HOME=/usr/local/rustup /usr/local/cargo/bin/cargo --version \
    && echo 'export RUSTUP_HOME=/usr/local/rustup' >> /etc/profile \
    && echo 'export CARGO_HOME=/home/developer/.cargo' >> /etc/profile \
    && echo 'export PATH="/usr/local/cargo/bin:$CARGO_HOME/bin:$PATH"' >> /etc/profile

### GO ###

ARG GO_VERSION=1.25.1
RUN ARCH="${TARGETARCH:-$(dpkg --print-architecture)}" \
    && case "$ARCH" in \
         amd64|x86_64) GO_ARCH=amd64 ;; \
         arm64|aarch64) GO_ARCH=arm64 ;; \
         *) echo "unsupported architecture: $ARCH" >&2; exit 1 ;; \
       esac \
    && curl -fsSL "https://go.dev/dl/go${GO_VERSION}.linux-${GO_ARCH}.tar.gz" -o /tmp/go.tgz \
    && rm -rf "$GOROOT" \
    && tar -C /usr/local -xzf /tmp/go.tgz \
    && rm -f /tmp/go.tgz \
    && go version

### SETUP SCRIPTS ###

COPY setup_daycare.sh /opt/daycare/setup_daycare.sh
RUN chmod +x /opt/daycare/setup_daycare.sh

### CLEANUP ###

RUN find /home -mindepth 1 -delete

### ENTRYPOINT ###

ENTRYPOINT ["sleep", "infinity"]
