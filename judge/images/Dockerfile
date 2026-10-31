# Judge sandbox images, one target per language:
#
#   docker build --target cpp  -t kata-judge-cpp  judge/images
#   docker build --target rust -t kata-judge-rust judge/images
#
# Untrusted code only ever runs in containers from these images, started by
# judge/src/sandbox.ts with a read-only root, no network, and kata-run as
# the only privileged process.
ARG DEBIAN=debian:trixie-slim

FROM ${DEBIAN} AS kata-run
RUN apt-get update \
 && apt-get install -y --no-install-recommends gcc libc6-dev \
 && rm -rf /var/lib/apt/lists/*
COPY kata-run.c /src/kata-run.c
RUN gcc -O2 -Wall -Wextra -Werror -static -o /kata-run /src/kata-run.c

FROM ${DEBIAN} AS base
COPY --from=kata-run /kata-run /usr/local/bin/kata-run
# Mount points for the tmpfs mounts the sandbox adds (the root is read-only).
RUN mkdir -p /work /run/kata

FROM base AS cpp
RUN apt-get update \
 && apt-get install -y --no-install-recommends g++ libc6-dev \
 && rm -rf /var/lib/apt/lists/*
COPY kata_prelude.h /opt/kata/kata_prelude.h
RUN g++ -std=gnu++23 -O2 -x c++-header /opt/kata/kata_prelude.h -o /opt/kata/kata_prelude.h.gch

FROM base AS rust
RUN apt-get update \
 && apt-get install -y --no-install-recommends rustc gcc libc6-dev \
 && rm -rf /var/lib/apt/lists/*
