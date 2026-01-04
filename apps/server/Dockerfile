FROM oven/bun:1.3.3

WORKDIR /app

COPY . .

RUN bun install
RUN bun run --cwd packages/db db:generate
RUN bun run --cwd apps/server build

EXPOSE 3000

CMD ["bun", "run", "--cwd", "apps/server", "start"]