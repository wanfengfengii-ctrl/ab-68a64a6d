/**
 * Web 静态站点 HTTP 冒烟（verify 服务使用 Node 内置 fetch，无需额外系统包）：
 *   - GET /healthz 必须 200 且正文为 ok；
 *   - GET / 必须 200 且包含应用标题；
 *   - 从首页解析出的哈希 JS 产物必须可访问。
 */
export {};

const base = (process.env.WEB_URL ?? 'http://web:80').replace(/\/$/, '');

async function waitFor(url: string, timeoutMs: number): Promise<Response> {
  const deadline = Date.now() + timeoutMs;
  let lastErr: unknown;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(url);
      if (res.ok) return res;
      lastErr = new Error(`HTTP ${res.status}`);
    } catch (e) {
      lastErr = e;
    }
    await new Promise((r) => setTimeout(r, 1000));
  }
  throw new Error(`等待 ${url} 超时：${String(lastErr)}`);
}

const health = await waitFor(`${base}/healthz`, 30000);
const healthText = (await health.text()).trim();
if (healthText !== 'ok') throw new Error(`/healthz 正文异常：${healthText}`);
console.log('  /healthz → 200 ok');

const home = await (await fetch(`${base}/`)).text();
if (!home.includes('复合材料铺层修复工作台')) {
  throw new Error('首页缺少应用标题');
}
console.log('  / 首页包含应用标题');

const m = home.match(/\/assets\/index-[^"']+\.js/);
if (!m) throw new Error('首页未引用哈希 JS 产物');
const assetRes = await fetch(`${base}${m[0]}`);
if (!assetRes.ok) throw new Error(`静态产物 ${m[0]} 返回 ${assetRes.status}`);
console.log(`  静态产物 ${m[0]} 可访问（HTTP 200）`);
