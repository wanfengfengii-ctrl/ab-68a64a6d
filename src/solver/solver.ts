/**
 * 铺层修复全局最优综合器。
 *
 * 优化目标（按字典次序依次最小化）：
 *   1) D：与参考序列相比发生改动的位置数；
 *   2) T：修复序列中相邻角度变化次数；
 *   3) 序列字典序（角度规定次序 0° < +45° < −45° < 90°）。
 *
 * 约束：
 *   - 各角度数量保持；
 *   - 关于中面对称 s[i] = s[n-1-i]；
 *   - 表面（第 1 层与最后一层）非 90°；
 *   - 相邻角差按 180° 周期计 ≤ 45°；
 *   - 同角连续不超过 3 层。
 *
 * 算法：n = 2m，对称序列由半幅 h 决定，s = h + reverse(h)。
 *   - 偶数层对称 ⇒ 每个角度的总计数必须为偶数，半幅配额 q[a] = c[a]/2；
 *   - 中面接缝两侧恒为同角（相邻差 0、不计变化），但若半幅末尾同角连跑 r 层，
 *     接缝处会拼成 2r 层连跑，故要求半幅末层与次末层不同（末尾连跑长度为 1）；
 *   - 表面约束只需 h[0] ≠ 90°；
 *   - D 按镜像位置对累计：第 i 个半幅位置选角 v 的代价
 *         d_i(v) = [v≠参考[i]] + [v≠参考[n-1-i]]；
 *   - 相邻变化次数 T = 2·C，C 为半幅内部变化次数（接缝为 0，两侧镜像对称）。
 * 在 (已用配额, 末角, 末尾连跑长度) 状态上做分层 DP，同一状态仅保留
 * (D, C, 半幅字典序) 最优的一个前缀——这是精确全局最优，而非局部交换。
 */
import { isAdjacentCompatible } from './angles';

export interface SolveSuccess {
  kind: 'success';
  /** 修复后完整序列（角度下标） */
  sequence: number[];
  /** 半幅序列 */
  half: number[];
  /** 目标一：改动位置数 */
  changedPositions: number;
  /** 目标二：相邻角度变化次数 */
  adjacentChanges: number;
  /** 半幅内部相邻变化次数 */
  halfChanges: number;
  /** 改动位置（从 0 起） */
  changedIndices: number[];
}

export interface SolveImpossible {
  kind: 'impossible';
  reasons: string[];
}

export type SolveResult = SolveSuccess | SolveImpossible;

interface Node {
  d: number; // 累计改动位置数
  c: number; // 半幅内累计相邻变化数
  run: number; // 末尾同角连跑长度 1..3
  pref: string; // 半幅前缀（字符 '0'..'3'，字典序即角度规定次序）
}

const SHIFT = 5; // 每种角度配额 ≤ 24（5 位），4 个计数 + 末角 2 位 + 连跑 2 位
const MASK = 0x1f;

function pack(used: readonly number[], last: number, run: number): number {
  return (
    (used[0] << 0) |
    (used[1] << SHIFT) |
    (used[2] << (2 * SHIFT)) |
    (used[3] << (3 * SHIFT)) |
    (last << (4 * SHIFT)) |
    (run << (4 * SHIFT + 2))
  );
}

export function solve(
  reference: number[],
  counts: readonly [number, number, number, number],
): SolveResult {
  const n = reference.length;
  const m = n / 2;

  // —— 对称可行性前置检查：偶数层中面对称铺层，每个角度计数必须为偶数 ——
  const oddAngles = [0, 1, 2, 3].filter((a) => counts[a] % 2 !== 0);
  if (oddAngles.length > 0) {
    return {
      kind: 'impossible',
      reasons: [
        `各角度层数均为偶数才能在保持数量的同时关于中面对称，当前奇数计数角度有 ${oddAngles
          .map((a) => ['0°', '+45°', '−45°', '90°'][a])
          .join('、')}，重排无法消除奇数层。`,
      ],
    };
  }

  const q = counts.map((c) => c / 2) as [number, number, number, number];

  // 每个半幅位置选各角的改动代价 d_i(v)
  const posCost: number[][] = [];
  for (let i = 0; i < m; i++) {
    const row: number[] = [];
    for (let v = 0; v < 4; v++) {
      row[v] = (reference[i] !== v ? 1 : 0) + (reference[n - 1 - i] !== v ? 1 : 0);
    }
    posCost.push(row);
  }

  // —— 第 0 层：表面非 90°（last=3 禁用）——
  let prev = new Map<number, Node>();
  for (let v = 0; v < 3; v++) {
    if (q[v] === 0) continue;
    const used = [0, 0, 0, 0];
    used[v] = 1;
    prev.set(pack(used, v, 1), {
      d: posCost[0][v],
      c: 0,
      run: 1,
      pref: String.fromCharCode(48 + v),
    });
  }

  for (let i = 1; i < m && prev.size > 0; i++) {
    const next = new Map<number, Node>();
    for (const [key, node] of prev) {
      const used = [
        (key >>> 0) & MASK,
        (key >>> SHIFT) & MASK,
        (key >>> (2 * SHIFT)) & MASK,
        (key >>> (3 * SHIFT)) & MASK,
      ];
      const last = (key >>> (4 * SHIFT)) & 0x3;
      for (let v = 0; v < 4; v++) {
        if (used[v] >= q[v]) continue;
        if (!isAdjacentCompatible(last, v)) continue;
        const run = v === last ? node.run + 1 : 1;
        if (run > 3) continue; // 同角连续不超过三层
        used[v]++;
        const nk = pack(used, v, run);
        const nd = node.d + posCost[i][v];
        const nc = node.c + (v === last ? 0 : 1);
        const np = node.pref + String.fromCharCode(48 + v);
        const existing = next.get(nk);
        if (
          existing === undefined ||
          nd < existing.d ||
          (nd === existing.d &&
            (nc < existing.c || (nc === existing.c && np < existing.pref)))
        ) {
          next.set(nk, { d: nd, c: nc, run, pref: np });
        }
        used[v]--;
      }
    }
    prev = next;
  }

  if (prev.size === 0) {
    return {
      kind: 'impossible',
      reasons: ['在满足表面非 90°、相邻角差 ≤ 45°、同角连续 ≤ 3 层的全部状态空间中穷尽搜索，不存在可行铺层排列。'],
    };
  }

  // —— 终态：半幅末尾连跑必须为 1（否则中面接缝处连跑 2r ≥ 4）——
  let best: Node | null = null;
  for (const node of prev.values()) {
    if (m >= 2 && node.run !== 1) continue;
    if (
      best === null ||
      node.d < best.d ||
      (node.d === best.d &&
        (node.c < best.c || (node.c === best.c && node.pref < best.pref)))
    ) {
      best = node;
    }
  }

  if (best === null) {
    return {
      kind: 'impossible',
      reasons: [
        '所有可行排列在中面接缝处都会形成 4 层及以上的同角连续（半幅末尾至少需两个不同角度收尾），不存在满足全部规则的铺层。',
      ],
    };
  }

  const half = [...best.pref].map((ch) => ch.charCodeAt(0) - 48);
  const sequence = half.concat([...half].reverse());
  const changedIndices: number[] = [];
  for (let i = 0; i < n; i++) {
    if (sequence[i] !== reference[i]) changedIndices.push(i);
  }

  return {
    kind: 'success',
    sequence,
    half,
    changedPositions: best.d,
    adjacentChanges: 2 * best.c,
    halfChanges: best.c,
    changedIndices,
  };
}
