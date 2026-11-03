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
COPY kata-run.c kata-threads.c /src/
RUN gcc -O2 -Wall -Wextra -Werror -static -o /kata-run /src/kata-run.c \
 && gcc -O2 -Wall -Wextra -Werror -shared -fPIC -o /libkata_threads.so /src/kata-threads.c

FROM ${DEBIAN} AS base
COPY --from=kata-run /kata-run /usr/local/bin/kata-run
COPY --from=kata-run /libkata_threads.so /usr/local/lib/libkata_threads.so
# Mount points for the tmpfs mounts the sandbox adds (the root is read-only).
RUN mkdir -p /work /run/kata

FROM base AS cpp
RUN apt-get update \
 && apt-get install -y --no-install-recommends g++ libc6-dev \
 && rm -rf /var/lib/apt/lists/*
# One precompiled header per build flavor, in a .gch directory: GCC uses the
# first one whose flags match the compile (see `cppFlags` in
# judge/src/languages.ts, which these must match exactly). Without a match
# GCC silently falls back to parsing every header, ~1.5 s per compile.
COPY kata_prelude.h /opt/kata/kata_prelude.h
RUN mkdir /opt/kata/kata_prelude.h.gch \
 && cd /opt/kata \
 && g++ -std=gnu++23 -O2 -x c++-header kata_prelude.h -o kata_prelude.h.gch/plain.gch \
 && g++ -std=gnu++23 -O2 -g -fno-omit-frame-pointer -fsanitize=thread \
        -x c++-header kata_prelude.h -o kata_prelude.h.gch/thread.gch \
 && g++ -std=gnu++23 -O2 -g -fno-omit-frame-pointer -fsanitize=address,undefined -fno-sanitize-recover=all \
        -x c++-header kata_prelude.h -o kata_prelude.h.gch/address.gch

FROM base AS rust
RUN apt-get update \
 && apt-get install -y --no-install-recommends rustc gcc libc6-dev \
 && rm -rf /var/lib/apt/lists/*
