/**
 * 界面渲染冒烟：用 renderToString 验证 App 空态与 ResultView 成功态均可渲染，
 * 不依赖浏览器 DOM（纯同步 SSR 渲染）。
 */
import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import App, { ResultView, type RunState } from '../src/App';
import { parseLayup } from '../src/solver/validation';
import { solve } from '../src/solver/solver';
import { buildEvidence } from '../src/solver/evidence';

function assert(cond: boolean, msg: string): asserts cond {
  if (!cond) {
    console.error('断言失败：' + msg);
    process.exit(1);
  }
}

// 1) 初始空态
const empty = renderToString(createElement(App));
assert(empty.includes('复合材料铺层修复工作台'), '标题缺失');
assert(empty.includes('启动综合修复'), '操作入口缺失');
console.log('  初始空态渲染正常');

// 2) 修复成功结果区
const text = '90 0 45 -45 -45 45 0 90';
const p = parseLayup(text);
assert(p.ok, '示例输入应合法');
const cs = [0, 0, 0, 0];
for (const a of p.indices) cs[a]++;
const r = solve(p.indices, cs as [number, number, number, number]);
assert(r.kind === 'success', '应修复成功');
const successState = {
  phase: 'success',
  reference: p.indices,
  result: r,
  evidence: buildEvidence(p.indices, r.sequence),
} as Extract<RunState, { phase: 'success' }>;
const resultHtml = renderToString(createElement(ResultView, { run: successState }));
assert(resultHtml.includes('两级优化目标'), '目标值区缺失');
assert(resultHtml.includes('逐层差异对照'), '逐层对照区缺失');
assert(resultHtml.includes('规则可复核证据'), '规则证据区缺失');
assert(resultHtml.match(/满足/g)?.length === 6, '六条规则应全部显示满足');
console.log('  成功态结果区渲染正常（六条规则证据齐备）');

console.log('界面渲染冒烟通过。');
