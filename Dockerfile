# -------- Build Stage --------
FROM node:22-slim as builder

ARG VER
ARG REPO
ENV VITE_APP_VER=${VER}

WORKDIR /app
RUN npm install --global pnpm@9
COPY package.json .npmrc pnpm-lock.yaml ./
RUN pnpm install
COPY apps/ ./apps
COPY libs/ ./libs
COPY nx.json tsconfig.base.json env.d.ts ./
RUN pnpm nx build ${REPO}

# -------- Prune Stage (optional) --------
FROM builder AS pruner

RUN pnpm prune --prod  # removes devDependencies

# -------- Runtime Stage --------
FROM nginx:stable-slim as runtime

ARG REPO

COPY --from=pruner /app/dist/apps/${REPO} /usr/share/nginx/html
COPY apps/${REPO}/nginx/default.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
