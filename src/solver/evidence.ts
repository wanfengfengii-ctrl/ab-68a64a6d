/**
 * 规则证据：对修复结果独立复核每条约束，输出可供工程师逐条核对的证据。
 * 所有检查均在浏览器本地完成，不依赖求解器自身的返回结论。
 */
import { ANGLE_LABELS, ANGLE_VALUES, circularDiff180 } from './angles';

export type RuleStatus = 'pass' | 'fail';

export interface EvidenceRow {
  label: string;
  detail: string;
}

export interface RuleEvidence {
  id: string;
  name: string;
  status: RuleStatus;
  summary: string;
  rows: EvidenceRow[];
}

export interface FullEvidence {
  rules: RuleEvidence[];
  /** 相邻角差明细（每层界面） */
  boundaries: { index: number; a: number; b: number; diff: number; ok: boolean }[];
  /** 同角连续段明细 */
  runs: { angle: number; start: number; length: number; ok: boolean }[];
}

const NAMES = ['0°', '+45°', '−45°', '90°'];

export function buildEvidence(
  reference: number[],
  repaired: number[],
): FullEvidence {
  const n = repaired.length;
  const rules: RuleEvidence[] = [];

  // 规则 1：各角度数量保持
  const refCounts = [0, 0, 0, 0];
  const newCounts = [0, 0, 0, 0];
  for (const a of reference) refCounts[a]++;
  for (const a of repaired) newCounts[a]++;
  const countRows: EvidenceRow[] = [0, 1, 2, 3].map((a) => ({
    label: NAMES[a],
    detail: `参考 ${refCounts[a]} 层 → 修复 ${newCounts[a]} 层${
      refCounts[a] === newCounts[a] ? '（一致）' : '（不一致！）'
    }`,
  }));
  rules.push({
    id: 'counts',
    name: '各角度数量保持',
    status: refCounts.every((c, a) => c === newCounts[a]) ? 'pass' : 'fail',
    summary: `总层数 ${n}；四种角度计数与参考序列完全一致。`,
    rows: countRows,
  });

  // 规则 2：关于中面对称
  const pairRows: EvidenceRow[] = [];
  let symOk = true;
  for (let i = 0; i < n / 2; i++) {
    const j = n - 1 - i;
    const ok = repaired[i] === repaired[j];
    if (!ok) symOk = false;
    pairRows.push({
      label: `第 ${i + 1} 层 ↔ 第 ${j + 1} 层`,
      detail: `${ANGLE_LABELS[repaired[i]]} ↔ ${ANGLE_LABELS[repaired[j]]}${
        ok ? '（相等）' : '（不相等！）'
      }`,
    });
  }
  rules.push({
    id: 'symmetry',
    name: '关于中面对称',
    status: symOk ? 'pass' : 'fail',
    summary: symOk
      ? `全部 ${n / 2} 对镜像位置角度相等，s[i] = s[n+1−i]。`
      : '存在镜像位置角度不相等。',
    rows: pairRows,
  });

  // 规则 3：+45 与 −45 等量
  const balOk = newCounts[1] === newCounts[2];
  rules.push({
    id: 'balance',
    name: '+45° 与 −45° 等量',
    status: balOk ? 'pass' : 'fail',
    summary: balOk
      ? `+45° ${newCounts[1]} 层，−45° ${newCounts[2]} 层，数量相等。`
      : `+45° ${newCounts[1]} 层，−45° ${newCounts[2]} 层，数量不等！`,
    rows: [
      { label: '+45°', detail: `${newCounts[1]} 层` },
      { label: '−45°', detail: `${newCounts[2]} 层` },
    ],
  });

  // 规则 4：表面非 90
  const surfA = repaired[0];
  const surfB = repaired[n - 1];
  const surfOk = surfA !== 3 && surfB !== 3;
  rules.push({
    id: 'surface',
    name: '表面（最外层）非 90°',
    status: surfOk ? 'pass' : 'fail',
    summary: surfOk
      ? `第 1 层 ${ANGLE_LABELS[surfA]}、第 ${n} 层 ${ANGLE_LABELS[surfB]}，均非 90°。`
      : `表面出现 90°（第 1 层 ${ANGLE_LABELS[surfA]}、第 ${n} 层 ${ANGLE_LABELS[surfB]}）！`,
    rows: [
      { label: `第 1 层`, detail: ANGLE_LABELS[surfA] },
      { label: `第 ${n} 层`, detail: ANGLE_LABELS[surfB] },
    ],
  });

  // 规则 5：相邻角差 ≤ 45°（180° 周期）
  const boundaries = [];
  let adjOk = true;
  for (let i = 0; i + 1 < n; i++) {
    const diff = circularDiff180(repaired[i], repaired[i + 1]);
    const ok = diff <= 45;
    if (!ok) adjOk = false;
    boundaries.push({ index: i, a: repaired[i], b: repaired[i + 1], diff, ok });
  }
  const badB = boundaries.filter((b) => !b.ok);
  rules.push({
    id: 'adjacent',
    name: '相邻角差 ≤ 45°（180° 周期）',
    status: adjOk ? 'pass' : 'fail',
    summary: adjOk
      ? `全部 ${n - 1} 个层间界面角差均 ≤ 45°（+45° 与 −45° 差 90°，不相邻）。`
      : `${badB.length} 个界面角差超过 45°：` +
        badB
          .slice(0, 6)
          .map((b) => `第 ${b.index + 1}/${b.index + 2} 层间 ${b.diff}°`)
          .join('、'),
    rows: boundaries.map((b) => ({
      label: `第 ${b.index + 1}–${b.index + 2} 层界面`,
      detail: `${ANGLE_LABELS[b.a]} → ${ANGLE_LABELS[b.b]}，角差 ${b.diff}°${
        b.ok ? '（≤45°）' : '（超限！）'
      }`,
    })),
  });

  // 规则 6：同角连续不超过三层
  const runs: { angle: number; start: number; length: number; ok: boolean }[] = [];
  let runStart = 0;
  for (let i = 1; i <= n; i++) {
    if (i === n || repaired[i] !== repaired[runStart]) {
      runs.push({
        angle: repaired[runStart],
        start: runStart,
        length: i - runStart,
        ok: i - runStart <= 3,
      });
      runStart = i;
    }
  }
  const runOk = runs.every((r) => r.ok);
  rules.push({
    id: 'maxrun',
    name: '同角连续不超过三层',
    status: runOk ? 'pass' : 'fail',
    summary: runOk
      ? `共 ${runs.length} 个同角连续段，最长 ${Math.max(
          ...runs.map((r) => r.length),
        )} 层，均不超过 3 层（含中面接缝处）。`
      : `存在 ${runs.filter((r) => !r.ok).length} 个连续段超过 3 层！`,
    rows: runs.map((r, k) => ({
      label: `连续段 ${k + 1}：第 ${r.start + 1}–${r.start + r.length} 层`,
      detail: `${ANGLE_LABELS[r.angle]} 连续 ${r.length} 层${r.ok ? '' : '（超限！）'}`,
    })),
  });

  return { rules, boundaries, runs };
}

/** 供调试/测试：序列的实际相邻变化次数 */
export function countTransitions(seq: readonly number[]): number {
  let t = 0;
  for (let i = 1; i < seq.length; i++) if (seq[i] !== seq[i - 1]) t++;
  return t;
}

export { ANGLE_VALUES };
