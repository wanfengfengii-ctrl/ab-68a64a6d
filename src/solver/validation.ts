/**
 * 参考铺层输入解析与结构校验。
 * 只校验"输入本身"是否是一个可被修复的合法计数问题：
 * 层数 4..48 的偶数、角度记号合法、+45/−45 数量相等。
 * 其余铺层规则（对称、表面、相邻等）由修复综合负责满足，并由证据模块复核。
 */
export interface ParsedInput {
  ok: boolean;
  /** 角度下标序列（0..3，规定次序 0,+45,−45,90），解析失败为空 */
  indices: number[];
  errors: string[];
}

const TOKEN_SPLIT = /[\s,，;；/|、]+/u;

export function parseLayup(text: string): ParsedInput {
  const errors: string[] = [];
  const raw = text.trim();
  if (raw.length === 0) {
    return { ok: false, indices: [], errors: ['内容为空：请输入或导入参考铺层。'] };
  }

  const tokens = raw.split(TOKEN_SPLIT).filter((t) => t.length > 0);
  const indices: number[] = [];
  const bad: string[] = [];
  for (const token of tokens) {
    const idx = parseOne(token);
    if (idx < 0) bad.push(token);
    else indices.push(idx);
  }
  if (bad.length > 0) {
    errors.push(
      `存在 ${bad.length} 个无法识别的角度记号（仅允许 0、+45、−45、90）：${bad
        .slice(0, 8)
        .map((t) => `“${t}”`)
        .join('、')}${bad.length > 8 ? ' 等' : ''}`,
    );
  }

  const n = indices.length;
  if (bad.length === 0 || n > 0) {
    if (n < 4) errors.push(`层数不足：当前 ${n} 层，合法序列须含 4 至 48 层。`);
    else if (n > 48) errors.push(`层数超限：当前 ${n} 层，合法序列至多 48 层。`);
    else if (n % 2 !== 0) errors.push(`层数须为偶数：当前 ${n} 层（铺层关于中面对称）。`);
  }

  if (errors.length === 0) {
    const c45 = indices.filter((i) => i === 1).length;
    const cNeg45 = indices.filter((i) => i === 2).length;
    if (c45 !== cNeg45) {
      errors.push(
        `+45° 与 −45° 层数必须相等：当前 +45° 为 ${c45} 层、−45° 为 ${cNeg45} 层，无法通过重排修复。`,
      );
    }
  }

  return { ok: errors.length === 0, indices, errors };
}

function parseOne(token: string): number {
  const t = token.replace(/°/g, '').replace(/[−–—]/g, '-').trim();
  if (t === '0' || t === '0.0') return 0;
  if (t === '45' || t === '+45') return 1;
  if (t === '-45') return 2;
  if (t === '90' || t === '90.0') return 3;
  return -1;
}

export interface AngleCounts {
  total: number;
  perAngle: [number, number, number, number];
}

export function countAngles(indices: number[]): AngleCounts {
  const perAngle: [number, number, number, number] = [0, 0, 0, 0];
  for (const i of indices) perAngle[i]++;
  return { total: indices.length, perAngle };
}
