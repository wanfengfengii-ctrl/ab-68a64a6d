# syntax=docker/dockerfile:1

# ---- 构建阶段：编译 TypeScript + React 静态产物 ----
FROM node:22-bookworm-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

# ---- 运行阶段：nginx 托管纯静态 Web，全程无业务后端 ----
FROM nginx:1.27-alpine AS web
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
HEALTHCHECK --interval=10s --timeout=3s --start-period=3s --retries=3 \
  CMD wget -q -O /dev/null http://127.0.0.1/healthz || exit 1

# ---- 验收阶段：单元/性质测试 + 对运行中的 Web 做 HTTP 冒烟 ----
FROM node:22-bookworm-slim AS verify
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
CMD ["bash", "scripts/verify.sh"]
