FROM node:22-alpine AS build
RUN corepack enable
WORKDIR /app
COPY package.json pnpm-lock.yaml .npmrc ./
RUN pnpm config set ignore-build-scripts false && pnpm install --frozen-lockfile
COPY . .
RUN npx prisma generate
RUN pnpm run build

FROM node:22-alpine AS production
WORKDIR /app
COPY --from=build /app/dist ./dist
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/prisma ./prisma
COPY --from=build /app/fixtures ./fixtures
COPY --from=build /app/package.json ./
CMD ["node", "dist/main.js"]
