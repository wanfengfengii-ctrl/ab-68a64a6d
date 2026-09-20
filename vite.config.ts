/// <reference types="vitest" />
import type { Connect, PluginOption } from 'vite';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

/** 与 nginx 容器一致的健康检查端点，便于本地 dev/preview 与验收脚本使用 */
function healthzMiddleware(req: Connect.IncomingMessage, res: Connect.ServerResponse, next: Connect.NextFunction) {
  if (req.url === '/healthz') {
    res.statusCode = 200;
    res.setHeader('Content-Type', 'text/plain');
    res.end('ok\n');
    return;
  }
  next();
}

const healthzPlugin = (): PluginOption => ({
  name: 'healthz',
  configureServer(server) {
    server.middlewares.use(healthzMiddleware);
  },
  configurePreviewServer(server) {
    server.middlewares.use(healthzMiddleware);
  },
});

export default defineConfig({
  plugins: [react(), healthzPlugin()],
  server: {
    host: true,
    port: 5173,
  },
  preview: {
    host: true,
    port: 4173,
  },
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
  },
});
