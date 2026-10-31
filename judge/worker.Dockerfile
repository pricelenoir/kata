# The judge worker (control plane), for runner hosts. It starts sandbox
# containers through the host's Docker daemon, so it runs with the Docker
# socket mounted — trusted code on a dedicated host, never the web tier.
# Untrusted code never runs in this container.
#
#   docker build -f judge/worker.Dockerfile -t kata-judge-worker .
FROM node:24-trixie-slim
RUN apt-get update \
 && apt-get install -y --no-install-recommends docker-cli \
 && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --ignore-scripts
COPY tsconfig.json ./
COPY types ./types
COPY content/coding-exercises ./content/coding-exercises
COPY judge/src ./judge/src
USER node
CMD ["npx", "tsx", "judge/src/worker.ts"]
