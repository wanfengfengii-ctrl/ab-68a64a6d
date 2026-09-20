import { describe, expect, it } from 'vitest';
import {
  circularDiff180,
  isAdjacentCompatible,
  angleIndexFromToken,
} from '../src/solver/angles';
import { parseLayup } from '../src/solver/validation';
import { solve } from '../src/solver/solver';
import { buildEvidence, countTransitions } from '../src/solver/evidence';

/** 独立暴力校验器：枚举给定多重集的所有不同排列，逐条规则过滤并取全局最优 */
function bruteForceOptimal(reference: number[]) {
  const n = reference.length;
  const counts = [0, 0, 0, 0];
  for (const a of reference) counts[a]++;

  const results: { seq: number[]; d: number; t: number }[] = [];
  const half: number[] = [];

  function feasibleFull(seq: number[]): boolean {
    if (seq[0] === 3 || seq[n - 1] === 3) return false;
    for (let i = 0; i + 1 < n; i++) {
      if (!isAdjacentCompatible(seq[i], seq[i + 1])) return false;
    }
    let run = 1;
    for (let i = 1; i <= n; i++) {
      if (i < n && seq[i] === seq[i - 1]) run++;
      else {
        if (run > 3) return false;
        run = 1;
      }
    }
    for (let i = 0; i < n / 2; i++) {
      if (seq[i] !== seq[n - 1 - i]) return false;
    }
    return true;
  }

  function enumerate() {
    if (half.length === n / 2) {
      const seq = half.concat([...half].reverse());
      if (!feasibleFull(seq)) return;
      let d = 0;
      for (let i = 0; i < n; i++) if (seq[i] !== reference[i]) d++;
      results.push({ seq, d, t: countTransitions(seq) });
      return;
    }
    for (let v = 0; v < 4; v++) {
      const usedCount = half.filter((x) => x === v).length;
      if (usedCount * 2 >= counts[v]) continue; // 半幅配额
      half.push(v);
      enumerate();
      half.pop();
    }
  }
  enumerate();

  if (results.length === 0) return null;
  results.sort((a, b) => {
    if (a.d !== b.d) return a.d - b.d;
    if (a.t !== b.t) return a.t - b.t;
    for (let i = 0; i < n; i++) {
      if (a.seq[i] !== b.seq[i]) return a.seq[i] - b.seq[i];
    }
    return 0;
  });
  return results[0];
}

const allRulesSatisfied = (seq: number[]) => {
  const n = seq.length;
  if (seq[0] === 3 || seq[n - 1] === 3) return false;
  for (let i = 0; i + 1 < n; i++) {
    if (!isAdjacentCompatible(seq[i], seq[i + 1])) return false;
  }
  let run = 1;
  for (let i = 1; i <= n; i++) {
    if (i < n && seq[i] === seq[i - 1]) run++;
    else {
      if (run > 3) return false;
      run = 1;
    }
  }
  for (let i = 0; i < n / 2; i++) if (seq[i] !== seq[n - 1 - i]) return false;
  return true;
};

describe('角度基础', () => {
  it('180° 周期角差折回正确', () => {
    expect(circularDiff180(0, 0)).toBe(0); // 0 vs 0
    expect(circularDiff180(0, 1)).toBe(45); // 0 vs +45
    expect(circularDiff180(1, 2)).toBe(90); // +45 vs −45 → 90
    expect(circularDiff180(2, 3)).toBe(45); // −45 vs 90：|−135| 折回 45
    expect(circularDiff180(0, 3)).toBe(90); // 0 vs 90
    expect(isAdjacentCompatible(1, 2)).toBe(false);
    expect(isAdjacentCompatible(2, 3)).toBe(true);
  });

  it('记号解析兼容多种写法', () => {
    expect(angleIndexFromToken('+45')).toBe(1);
    expect(angleIndexFromToken('−45')).toBe(2);
    expect(angleIndexFromToken('90°')).toBe(3);
    expect(angleIndexFromToken('7')).toBe(-1);
  });
});

describe('输入校验', () => {
  it('拒绝空、奇数层、超范围、非法记号、±45 不等量', () => {
    expect(parseLayup('').ok).toBe(false);
    expect(parseLayup('0 0 0').ok).toBe(false);
    expect(parseLayup('0 0 0 45').ok).toBe(false); // 奇数层 + 不等量
    expect(Array<number>(49).fill(0).join(' ')).toContain('0');
    expect(parseLayup(Array(49).fill(0).join(' ')).ok).toBe(false);
    expect(parseLayup('0 0 30 45').ok).toBe(false);
    expect(parseLayup('45 45 0 0').ok).toBe(false); // +45×2，无 −45
  });

  it('接受分隔符多样性与合法输入', () => {
    expect(parseLayup('0, 45; −45、90/0\n45 -45 90').ok).toBe(true);
  });
});

describe('求解器与暴力枚举一致（全局最优证明）', () => {
  const cases: number[][] = [
    [3, 0, 1, 2, 2, 1, 0, 3], // 示例 A
    [0, 0, 0, 0, 1, 1, 1, 1, 2, 2, 2, 2, 3, 3, 3, 3], // 示例 B
    [0, 0, 0, 0], // 最简
    [3, 3, 0, 0], // 表面 90
    [1, 2, 1, 2, 2, 1, 2, 1], // ±45 交替但 +45/−45 相邻
    [0, 0, 0, 0, 3, 3, 3, 3],
    [1, 1, 2, 2, 2, 2, 1, 1],
    [0, 0, 1, 1, 2, 2, 3, 3, 3, 3, 2, 2, 1, 1, 0, 0],
    [0, 0, 0, 0, 0, 0, 1, 1, 2, 2, 3, 3],
    [3, 0, 3, 0, 0, 3, 0, 3],
    [0, 1, 2, 3, 3, 2, 1, 0],
    [0, 0, 3, 3, 0, 0, 3, 3, 0, 0, 3, 3],
    [0, 1, 3, 2, 2, 3, 1, 0], // 本身已是可行铺层 → D 应为 0
  ];

  for (const ref of cases) {
    it(`n=${ref.length} ref=[${ref.join(',')}]`, () => {
      const counts = [0, 0, 0, 0];
      for (const a of ref) counts[a]++;
      const dp = solve(ref, counts as [number, number, number, number]);
      const brute = bruteForceOptimal(ref);

      if (brute === null) {
        expect(dp.kind).toBe('impossible');
        return;
      }
      expect(dp.kind).toBe('success');
      if (dp.kind !== 'success') return;
      expect(dp.changedPositions).toBe(brute.d);
      expect(dp.adjacentChanges).toBe(brute.t);
      expect(dp.sequence).toEqual(brute.seq); // 字典序也一致
      expect(allRulesSatisfied(dp.sequence)).toBe(true);
      // 数量保持
      const rc = [0, 0, 0, 0];
      for (const a of dp.sequence) rc[a]++;
      expect(rc).toEqual(counts);
    });
  }

  it('随机小例：DP 与暴力枚举在两级目标与字典序上完全一致', () => {
    // 固定伪随机种子，保证可复现
    let seed = 20260920;
    const rnd = () => {
      seed = (seed * 1103515245 + 12345) % 2147483648;
      return seed / 2147483648;
    };
    let checked = 0;
    for (let trial = 0; trial < 60; trial++) {
      const n = 2 * (2 + Math.floor(rnd() * 4)); // n ∈ {4,6,8,10}
      const ref: number[] = [];
      // 偶数计数采样：每种角度选偶数个
      const evens = [0, 2, 4, 6, 8];
      let remain = n;
      const cs = [0, 0, 0, 0];
      for (let a = 0; a < 3 && remain > 0; a++) {
        const maxK = Math.min(remain / 2, evens.length - 1);
        const k = Math.floor(rnd() * (maxK + 1));
        cs[a] = evens[k];
        remain -= cs[a];
      }
      cs[3] += remain;
      if (cs[3] % 2 !== 0) continue;
      const bag: number[] = [];
      cs.forEach((c, a) => {
        for (let i = 0; i < c; i++) bag.push(a);
      });
      // 打乱
      for (let i = bag.length - 1; i > 0; i--) {
        const j = Math.floor(rnd() * (i + 1));
        [bag[i], bag[j]] = [bag[j], bag[i]];
      }
      ref.push(...bag);
      if (ref.length !== n) continue;

      const dp = solve(ref, cs as [number, number, number, number]);
      const brute = bruteForceOptimal(ref);
      if (brute === null) {
        expect(dp.kind).toBe('impossible');
      } else {
        expect(dp.kind).toBe('success');
        if (dp.kind !== 'success') continue;
        expect(dp.changedPositions).toBe(brute.d);
        expect(dp.adjacentChanges).toBe(brute.t);
        expect(dp.sequence).toEqual(brute.seq);
      }
      checked++;
    }
    expect(checked).toBeGreaterThan(30);
  });
});

describe('无解情形', () => {
  it('奇数计数角度直接判定不可对称', () => {
    // 计数 0×4、+45×1、−45×1（等量但为奇数）：保持数量时无法关于中面对称
    const r = solve([0, 0, 0, 1, 2, 0], [4, 1, 1, 0]);
    expect(r.kind).toBe('impossible');
  });

  it('90° 过多无法隔离（示例 C）', () => {
    const text = '0 90 90 90 90 90 90 90 90 0';
    const parsed = parseLayup(text);
    expect(parsed.ok).toBe(true);
    const counts = [0, 0, 0, 0];
    for (const a of parsed.indices) counts[a]++;
    const r = solve(parsed.indices, counts as [number, number, number, number]);
    expect(r.kind).toBe('impossible');
  });
});

describe('证据模块独立复核', () => {
  it('修复结果六条规则全部 pass 且计数一致', () => {
    const ref = [3, 0, 1, 2, 2, 1, 0, 3];
    const counts = [0, 0, 0, 0];
    for (const a of ref) counts[a]++;
    const r = solve(ref, counts as [number, number, number, number]);
    expect(r.kind).toBe('success');
    if (r.kind !== 'success') return;
    const ev = buildEvidence(ref, r.sequence);
    expect(ev.rules.every((rule) => rule.status === 'pass')).toBe(true);
    // 变化次数与证据/目标一致
    const changes = ev.boundaries.filter((b) => b.a !== b.b).length;
    expect(changes).toBe(r.adjacentChanges);
  });

  it('能检出故意构造的违规证据', () => {
    // 表面 90；+45 连 4 层；+45→−45 角差 90；0→90 角差 90；镜像不等
    const ref = [3, 1, 1, 1, 1, 2, 0, 3];
    const ev = buildEvidence([0, 0, 1, 2, 2, 1, 0, 0], ref);
    const byId = Object.fromEntries(ev.rules.map((r) => [r.id, r.status]));
    expect(byId.surface).toBe('fail');
    expect(byId.maxrun).toBe('fail'); // +45 连 4 层（跨中面）
    expect(byId.adjacent).toBe('fail'); // −45→0 90° 等
    expect(byId.symmetry).toBe('fail');
  });
});
