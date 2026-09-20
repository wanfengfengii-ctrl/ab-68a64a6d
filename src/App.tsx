import { useMemo, useRef, useState } from 'react';
import { ANGLE_LABELS } from './solver/angles';
import { countAngles, parseLayup } from './solver/validation';
import { solve, type SolveSuccess } from './solver/solver';
import { buildEvidence, type FullEvidence } from './solver/evidence';

export type RunState =
  | { phase: 'invalid'; errors: string[] }
  | { phase: 'impossible'; reasons: string[] }
  | { phase: 'success'; reference: number[]; result: SolveSuccess; evidence: FullEvidence };

const EXAMPLES: { name: string; text: string }[] = [
  {
    name: '示例 A：表面 90° + 相邻超限',
    text: '90 0 45 -45 -45 45 0 90',
  },
  {
    name: '示例 B：四角度各四层、长连跑与错误次序',
    text: '0 0 0 0 45 45 45 45 -45 -45 -45 -45 90 90 90 90',
  },
  {
    name: '示例 C：确实无解（90° 过多无法隔离）',
    text: '0 90 90 90 90 90 90 90 90 0',
  },
];

export default function App() {
  const [inputText, setInputText] = useState('');
  const [run, setRun] = useState<RunState | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // 实时解析用于统计展示（不触发求解，也不产生旧结果）
  const live = useMemo(() => parseLayup(inputText), [inputText]);
  const liveCounts = inputText.trim() ? countAngles(live.indices) : null;

  function handleTextChange(value: string) {
    setInputText(value);
    // 输入一经修改，旧综合结果立即作废，避免逐位对照指向过期序列
    setRun(null);
  }

  function handleRun() {
    const parsed = parseLayup(inputText);
    if (!parsed.ok) {
      setRun({ phase: 'invalid', errors: parsed.errors });
      return;
    }
    const counts = countAngles(parsed.indices).perAngle;
    const result = solve(parsed.indices, counts);
    if (result.kind === 'impossible') {
      setRun({ phase: 'impossible', reasons: result.reasons });
      return;
    }
    setRun({
      phase: 'success',
      reference: parsed.indices,
      result,
      evidence: buildEvidence(parsed.indices, result.sequence),
    });
  }

  function handleImportFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      handleTextChange(String(reader.result ?? ''));
    };
    reader.readAsText(file);
    e.target.value = '';
  }

  return (
    <div className="app">
      <header className="app-header">
        <h1>复合材料铺层修复工作台</h1>
        <p className="sub">
          纯浏览器本地综合，不调用任何业务后端 · 全局依次最小化「改动位置数 → 相邻角度变化次数」，
          同值下按 0°、+45°、−45°、90° 取字典序最小
        </p>
      </header>

      <section className="panel">
        <h2>
          参考铺层
          <span className="hint">
            角度仅可 0 / +45 / −45 / 90，4–48 个偶数层；可用空格、逗号、顿号、斜杠或换行分隔
          </span>
        </h2>
        <textarea
          className="layup-input"
          value={inputText}
          onChange={(e) => handleTextChange(e.target.value)}
          placeholder={'例如：90 0 45 -45 -45 45 0 90'}
          spellCheck={false}
        />

        {liveCounts && (
          <div className="counts-bar">
            <span>
              共 <b>{liveCounts.total}</b> 层
            </span>
            {([0, 1, 2, 3] as const).map((a) => (
              <span key={a}>
                {ANGLE_LABELS[a]}：<b>{liveCounts.perAngle[a]}</b>
              </span>
            ))}
            <span>
              +45/−45：
              <b>
                {liveCounts.perAngle[1] === liveCounts.perAngle[2] ? '等量' : '不等量'}
              </b>
            </span>
          </div>
        )}

        <div className="toolbar">
          <button className="primary" onClick={handleRun}>
            启动综合修复
          </button>
          <button className="file-label ghost" type="button">
            导入文件（.txt / .csv）
            <input
              ref={fileRef}
              type="file"
              accept=".txt,.csv,.layup,text/plain"
              onChange={handleImportFile}
            />
          </button>
          <button className="ghost" onClick={() => handleTextChange('')}>
            清空
          </button>
          {EXAMPLES.map((ex) => (
            <button key={ex.name} className="ghost" onClick={() => handleTextChange(ex.text)}>
              {ex.name}
            </button>
          ))}
        </div>

        {run?.phase === 'invalid' && (
          <div className="alert error" role="alert">
            <b>输入非法，已清除旧结果：</b>
            <ul>
              {run.errors.map((err, i) => (
                <li key={i}>{err}</li>
              ))}
            </ul>
          </div>
        )}

        {run?.phase === 'impossible' && (
          <div className="alert impossible" role="alert">
            <b>该参考铺层确实无解，已清除旧结果：</b>
            <ul>
              {run.reasons.map((r, i) => (
                <li key={i}>{r}</li>
              ))}
            </ul>
          </div>
        )}
      </section>

      {run?.phase === 'success' && <ResultView run={run} />}

      {run === null && (
        <section className="panel">
          <div className="empty-state">
            输入或导入参考铺层后点击「启动综合修复」，结果将在此处展示两级目标值、逐层差异与规则证据。
          </div>
        </section>
      )}
    </div>
  );
}

export function ResultView({ run }: { run: Extract<RunState, { phase: 'success' }> }) {
  const { reference, result, evidence } = run;
  const n = result.sequence.length;
  const changedSet = new Set(result.changedIndices);

  return (
    <>
      <section className="panel">
        <h2>两级优化目标（全局最优值）</h2>
        <div className="objectives">
          <div className="objective-card">
            <div className="level">第一级目标（最先最小化）</div>
            <div className="value">{result.changedPositions}</div>
            <div className="desc">
              改动位置数 / {n} 层：与参考序列逐位比较，角度不同的位置总数
            </div>
          </div>
          <div className="objective-card">
            <div className="level">第二级目标（在第一级最优前提下最小化）</div>
            <div className="value">{result.adjacentChanges}</div>
            <div className="desc">
              相邻角度变化次数：{n} 层共 {n - 1} 个界面中角度发生变化的界面数
              （半幅内部 {result.halfChanges} 次 × 2，中面接缝为同角）
            </div>
          </div>
        </div>
        <div className="lexi-note">
          三级裁决：以上两个目标均相同的全部方案里，按规定角度次序
          <b> 0° → +45° → −45° → 90° </b>
          取字典序最小的铺层。该值由对全部可行排列的分层动态规划穷举得到，非局部交换或首个可行解。
        </div>
      </section>

      <section className="panel">
        <h2>
          逐层差异对照
          <span className="hint">
            {result.changedIndices.length} 个位置被改动（橙色），{n - result.changedIndices.length}{' '}
            个位置保持
          </span>
        </h2>
        <div className="legend">
          <span>
            <i className="sw sw-chg" />
            改动
          </span>
          <span>
            <i className="sw sw-keep" />
            保持
          </span>
        </div>
        <div className="compare-scroll">
          <table className="compare">
            <thead>
              <tr>
                <th>层位</th>
                {Array.from({ length: n }, (_, i) => (
                  <th key={i}>{i + 1}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="pos-idx">原序列</td>
                {reference.map((a, i) => (
                  <td key={i} className={changedSet.has(i) ? 'changed' : 'same'}>
                    {ANGLE_LABELS[a]}
                  </td>
                ))}
              </tr>
              <tr>
                <td className="pos-idx">修复后</td>
                {result.sequence.map((a, i) => (
                  <td key={i} className={changedSet.has(i) ? 'changed' : 'same'}>
                    {ANGLE_LABELS[a]}
                  </td>
                ))}
              </tr>
              <tr>
                <td className="pos-idx">状态</td>
                {Array.from({ length: n }, (_, i) => (
                  <td key={i}>
                    <span className={`badge ${changedSet.has(i) ? 'chg' : 'keep'}`}>
                      {changedSet.has(i) ? '改' : '留'}
                    </span>
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
        <div className="seq-line" style={{ marginTop: 12 }}>
          修复序列：
          {result.sequence.map((a, i) => (
            <span key={i} className={changedSet.has(i) ? 'tok-chg' : ''}>
              {ANGLE_LABELS[a]}
              {i + 1 < n ? ' ' : ''}
            </span>
          ))}
        </div>
      </section>

      <section className="panel">
        <h2>
          规则可复核证据
          <span className="hint">展开每张卡片可查看逐层/逐界面的独立复核明细</span>
        </h2>
        <div className="rule-grid">
          {evidence.rules.map((rule) => (
            <div key={rule.id} className={`rule-card ${rule.status}`}>
              <div className="rule-head">
                <span className="name">{rule.name}</span>
                <span className={`status-pill ${rule.status}`}>
                  {rule.status === 'pass' ? '满足 ✓' : '违反 ✗'}
                </span>
              </div>
              <div className="rule-summary">{rule.summary}</div>
              <details className="evidence-detail">
                <summary>核对明细（{rule.rows.length} 条）</summary>
                <table className="evidence-table">
                  <tbody>
                    {rule.rows.map((row, i) => (
                      <tr key={i}>
                        <td>{row.label}</td>
                        <td>{row.detail}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </details>
            </div>
          ))}
        </div>
      </section>
    </>
  );
}
