/**
 * 性能冒烟：n=48（半幅 24）极限规模下求解器应在浏览器可接受时间内完成。
 * 运行：npx tsx scripts/perf.ts  （或 node --experimental-strip-types）
 */
import { solve } from '../src/solver/solver.ts';
import { parseLayup } from '../src/solver/validation.ts';
import { buildEvidence, countTransitions } from '../src/solver/evidence.ts';

const cases: { name: string; text: string }[] = [
  { name: '四角度各 12 层（最坏计数平衡）', text: Array(12).fill(0).concat(Array(12).fill(45), Array(12).fill(-45), Array(12).fill(90)).join(' ') },
  { name: '仅 0/90 各 24 层', text: Array(24).fill(0).concat(Array(24).fill(90)).join(' ') },
  { name: '0×46 + 90×2（无解重负载）', text: Array(46).fill(0).concat([90, 90]).join(' ') },
  { name: '全部 0°（48 层）', text: Array(48).fill(0).join(' ') },
];

for (const c of cases) {
  const parsed = parseLayup(c.text);
  if (!parsed.ok) {
    console.log(`${c.name}: 输入非法`, parsed.errors);
    continue;
  }
  const counts = [0, 0, 0, 0];
  for (const a of parsed.indices) counts[a]++;
  const t0 = performance.now();
  const r = solve(parsed.indices, counts as [number, number, number, number]);
  const t1 = performance.now();
  if (r.kind === 'success') {
    const ev = buildEvidence(parsed.indices, r.sequence);
    const t2 = performance.now();
    console.log(
      `${c.name}: D=${r.changedPositions} T=${r.adjacentChanges} ` +
        `规则全过=${ev.rules.every((x) => x.status === 'pass')} ` +
        `T核对=${countTransitions(r.sequence)} 求解=${(t1 - t0).toFixed(1)}ms 证据=${(t2 - t1).toFixed(1)}ms`,
    );
  } else {
    console.log(`${c.name}: 无解（${(t1 - t0).toFixed(1)}ms）${r.reasons[0].slice(0, 30)}...`);
  }
}
