/**
 * 验收冒烟：覆盖三种结果状态，供 verify 服务在容器内执行。
 */
import { parseLayup } from '../src/solver/validation.ts';
import { solve } from '../src/solver/solver.ts';
import { buildEvidence } from '../src/solver/evidence.ts';

function assert(cond: boolean, msg: string): asserts cond {
  if (!cond) {
    console.error('断言失败：' + msg);
    process.exit(1);
  }
}

// 1) 非法输入：奇数层
assert(parseLayup('0 45 -45 90 0').ok === false, '奇数层应判非法');
// 非法输入：±45 不等量
assert(parseLayup('45 45 0 0').ok === false, '+45/−45 不等量应判非法');

// 2) 确实无解：2 个 0° 无法在表面约束下隔离 8 个 90°
const impossibleInput = '0 90 90 90 90 90 90 90 90 0';
const p2 = parseLayup(impossibleInput);
assert(p2.ok, '示例 C 应是结构合法输入');
const c2 = [0, 0, 0, 0];
for (const a of p2.indices) c2[a]++;
const r2 = solve(p2.indices, c2 as [number, number, number, number]);
assert(r2.kind === 'impossible', '示例 C 应确实无解');
console.log('  无解原因：' + (r2.kind === 'impossible' ? r2.reasons[0].slice(0, 44) : '') + '…');

// 3) 修复成功：示例 A
const p3 = parseLayup('90 0 45 -45 -45 45 0 90');
assert(p3.ok, '示例 A 应解析成功');
const c3 = [0, 0, 0, 0];
for (const a of p3.indices) c3[a]++;
const r3 = solve(p3.indices, c3 as [number, number, number, number]);
assert(r3.kind === 'success', '示例 A 应修复成功');
const ev = buildEvidence(p3.indices, r3.sequence);
assert(ev.rules.every((r) => r.status === 'pass'), '六条规则证据应全部满足');
let changed = 0;
for (let i = 0; i < r3.sequence.length; i++)
  if (r3.sequence[i] !== p3.indices[i]) changed++;
assert(changed === r3.changedPositions, '改动位置数应与逐位比较一致');
let trans = 0;
for (let i = 1; i < r3.sequence.length; i++)
  if (r3.sequence[i] !== r3.sequence[i - 1]) trans++;
assert(trans === r3.adjacentChanges, '相邻变化次数应与目标值一致');
console.log(`  示例 A：D=${r3.changedPositions} T=${r3.adjacentChanges}`);

console.log('三态冒烟全部符合预期。');
