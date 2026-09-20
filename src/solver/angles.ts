/**
 * 角度域：只允许 0°、+45°、−45°、90°。
 * 规定次序（同时作为字典序）：0 < +45 < −45 < 90，对应下标 0..3。
 */
export const ANGLE_VALUES = [0, 45, -45, 90] as const;
export type AngleValue = (typeof ANGLE_VALUES)[number];

export const ANGLE_LABELS = ['0°', '+45°', '−45°', '90°'] as const;

/** 解析单个角度记号为下标，无法识别返回 -1 */
export function angleIndexFromToken(token: string): number {
  const t = token.replace('°', '').trim();
  if (t === '0') return 0;
  if (t === '45' || t === '+45') return 1;
  if (t === '-45' || t === '−45') return 2;
  if (t === '90') return 3;
  return -1;
}

export function angleLabel(index: number): string {
  return ANGLE_LABELS[index] ?? '?';
}

export function angleValue(index: number): number {
  return ANGLE_VALUES[index];
}

/**
 * 相邻角差，按 180° 周期计：先取普通差值绝对值，再折回 [0°,90°]。
 * 例如 −45° 与 90°：|−135°| 折回为 45°。
 */
export function circularDiff180(aIndex: number, bIndex: number): number {
  const d = Math.abs(ANGLE_VALUES[aIndex] - ANGLE_VALUES[bIndex]) % 180;
  return d > 90 ? 180 - d : d;
}

/** 相邻角差是否不超过 45°（注意 +45 与 −45 相差 90°，不允许相邻） */
export function isAdjacentCompatible(aIndex: number, bIndex: number): boolean {
  return circularDiff180(aIndex, bIndex) <= 45;
}
