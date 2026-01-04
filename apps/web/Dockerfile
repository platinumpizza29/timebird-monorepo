FROM oven/bun:1.3.3

WORKDIR /app

ARG VITE_SERVER_URL
ENV VITE_SERVER_URL=$VITE_SERVER_URL

COPY . .

RUN bun install
RUN bun run --cwd apps/web build

EXPOSE 3001

CMD ["bun", "run", "--cwd", "apps/web", "serve", "--", "--host", "0.0.0.0", "--port", "3001"]
