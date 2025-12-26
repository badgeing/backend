FROM node:20-alpine AS build

RUN corepack enable && corepack prepare pnpm@8.10.0 --activate

WORKDIR /app

COPY package.json ./

RUN pnpm install

COPY . .

ARG VITE_BACKEND_URL
ENV VITE_BACKEND_URL=${VITE_BACKEND_URL}

RUN pnpm build

FROM node:20-alpine

RUN npm install -g serve

WORKDIR /app

COPY --from=build /app/dist ./dist

EXPOSE 4173

CMD ["serve", "-s", "dist", "-l", "4173"]
