#!/usr/bin/env bash
# Compose 验收服务（verify）入口：
#   1) 求解器单元测试与"DP vs 全排列暴力枚举"全局最优性质测试；
#   2) 界面渲染冒烟（空态 + 成功态结果区）；
#   3) 对 compose 中 web 服务做静态站点 HTTP 冒烟（健康端点 + 首页 + 产物）；
#   4) Node 侧端到端冒烟：非法输入、确实无解、修复成功三态。
# 全部仅依赖 Node 内置能力与项目 devDependencies，不访问任何业务后端。
set -euo pipefail

export WEB_URL="${WEB_URL:-http://web:80}"

echo "== [1/4] 单元测试 / 全局最优性质测试 =="
npm run test:run

echo "== [2/4] 界面渲染冒烟（空态 + 成功态结果区） =="
npx vite-node scripts/ui-smoke.tsx

echo "== [3/4] Web 静态站点 HTTP 冒烟：${WEB_URL} =="
npx vite-node scripts/http-smoke.ts

echo "== [4/4] 求解三态端到端冒烟（Node 侧） =="
npx vite-node scripts/acceptance-smoke.ts

echo "全部验收通过。"
