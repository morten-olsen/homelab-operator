FROM node:23-slim
RUN corepack enable
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile --prod
COPY . .
CMD ["node", "src/index.ts"]
