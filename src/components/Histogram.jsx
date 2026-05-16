import { memo, useState } from 'react';
import { T } from '../styles/tokens.js';
import PanelHeader from './PanelHeader.jsx';

/**
 * SVG bar chart showing measurement outcome frequencies from multi-shot execution.
 *
 * Props:
 *   data   - Frequency map: { "00": 512, "11": 488, ... }
 *   shots  - Total number of shots (for percentage calculation)
 *   nQubits - Number of qubits (unused directly, available for future labelling)
 */
function Histogram({ data, shots }) {
  const [showPercent, setShowPercent] = useState(false);
  const [hoveredIdx, setHoveredIdx] = useState(null);

  if (!data || Object.keys(data).length === 0) return null;

  const entries = Object.entries(data).sort(([a], [b]) => a.localeCompare(b));
  const maxCount = Math.max(...entries.map(([, c]) => c));
  const maxPct = (maxCount / shots) * 100;

  // ── Layout constants ────────────────────────────────
  const BAR_W = Math.max(24, Math.min(52, Math.floor(340 / entries.length)));
  const BAR_GAP = 6;
  const M_L = 46; // left margin  (y-axis labels)
  const M_R = 12; // right margin
  const M_T = 28; // top margin   (value labels above tallest bar)
  const M_B = 34; // bottom margin (x-axis labels)
  const CH = 110; // chart height in pixels

  const svgW = M_L + entries.length * (BAR_W + BAR_GAP) - BAR_GAP + M_R;
  const svgH = M_T + CH + M_B;

  // Y-axis: 5 evenly-spaced ticks including 0 and max
  const yTicks = [0, 0.25, 0.5, 0.75, 1].map((f) => {
    const label = showPercent ? `${(maxPct * f).toFixed(maxPct * f < 10 ? 1 : 0)}%` : String(Math.round(maxCount * f));
    return { label, y: M_T + CH * (1 - f) };
  });

  // Toggle button for the PanelHeader actions slot
  const toggleBtn = (
    <button
      onClick={() => setShowPercent((p) => !p)}
      style={{
        fontSize: T.font.size.xs,
        padding: '2px 7px',
        borderRadius: T.radius.lg,
        border: `1px solid ${T.border.muted}`,
        background: 'transparent',
        color: T.accent.soft,
        cursor: 'pointer',
        fontFamily: 'inherit',
        lineHeight: '16px',
      }}
    >
      {showPercent ? 'Counts' : 'Percent'}
    </button>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden', flex: 1 }}>
      <PanelHeader label="MEASUREMENT HISTOGRAM" actions={toggleBtn} />

      {/* Summary line */}
      <div
        style={{
          padding: `${T.space[2]}px ${T.space[5]}px`,
          fontSize: T.font.size.xs,
          color: T.text.dim,
          borderBottom: `1px solid ${T.border.subtle}`,
          flexShrink: 0,
        }}
      >
        {shots.toLocaleString()} shot{shots !== 1 ? 's' : ''} &nbsp;·&nbsp;
        {entries.length} distinct outcome{entries.length !== 1 ? 's' : ''}
      </div>

      {/* Scrollable chart area */}
      <div style={{ overflow: 'auto', flex: 1, padding: `${T.space[5]}px ${T.space[5]}px` }}>
        <svg width={Math.max(svgW, 260)} height={svgH} style={{ overflow: 'visible', display: 'block' }}>
          {/* Grid lines + Y-axis tick labels */}
          {yTicks.map(({ label, y }, i) => (
            <g key={i}>
              <line
                x1={M_L}
                y1={y}
                x2={M_L + entries.length * (BAR_W + BAR_GAP) - BAR_GAP}
                y2={y}
                stroke={T.border.subtle}
                strokeWidth={i === 0 ? 0 : 0.5}
              />
              <text
                x={M_L - 5}
                y={y + 4}
                textAnchor="end"
                fontSize={T.font.size.xs}
                fill={T.text.dim}
                fontFamily="inherit"
              >
                {label}
              </text>
            </g>
          ))}

          {/* Bars + labels */}
          {entries.map(([state, count], i) => {
            const barH = Math.max(2, Math.round(CH * (count / maxCount)));
            const x = M_L + i * (BAR_W + BAR_GAP);
            const y = M_T + CH - barH;
            const pct = ((count / shots) * 100).toFixed(1);
            const isHov = hoveredIdx === i;

            const valLabel = showPercent ? `${pct}%` : String(count);

            return (
              <g
                key={state}
                onMouseEnter={() => setHoveredIdx(i)}
                onMouseLeave={() => setHoveredIdx(null)}
                style={{ cursor: 'default' }}
              >
                {/* Bar */}
                <rect
                  x={x}
                  y={y}
                  width={BAR_W}
                  height={barH}
                  rx={2}
                  ry={2}
                  fill={isHov ? T.accent.secondary : T.accent.primary}
                  opacity={isHov ? 1 : 0.82}
                  style={{ transition: 'fill 0.1s, opacity 0.1s' }}
                />

                {/* Value label above bar (always visible) */}
                <text
                  x={x + BAR_W / 2}
                  y={y - 5}
                  textAnchor="middle"
                  fontSize={T.font.size.xs}
                  fill={isHov ? T.accent.light : T.text.muted}
                  fontFamily="inherit"
                  style={{ transition: 'fill 0.1s' }}
                >
                  {valLabel}
                </text>

                {/* Hover tooltip (shows both count and %) */}
                {isHov && (
                  <g>
                    <rect
                      x={x + BAR_W / 2 - 30}
                      y={y - 42}
                      width={60}
                      height={34}
                      rx={3}
                      fill={T.bg.panel}
                      stroke={T.accent.secondary}
                      strokeWidth={0.75}
                    />
                    <text
                      x={x + BAR_W / 2}
                      y={y - 26}
                      textAnchor="middle"
                      fontSize={T.font.size.xs}
                      fill={T.text.primary}
                      fontFamily="inherit"
                    >
                      {count.toLocaleString()} shots
                    </text>
                    <text
                      x={x + BAR_W / 2}
                      y={y - 14}
                      textAnchor="middle"
                      fontSize={T.font.size.xs}
                      fill={T.accent.soft}
                      fontFamily="inherit"
                    >
                      {pct}%
                    </text>
                  </g>
                )}

                {/* X-axis label: |state⟩ */}
                <text
                  x={x + BAR_W / 2}
                  y={M_T + CH + 14}
                  textAnchor="middle"
                  fontSize={T.font.size.xs}
                  fill={T.accent.light}
                  fontFamily="inherit"
                >
                  |{state}⟩
                </text>
              </g>
            );
          })}

          {/* Axes */}
          <line x1={M_L} y1={M_T} x2={M_L} y2={M_T + CH} stroke={T.border.muted} strokeWidth={1} />
          <line
            x1={M_L}
            y1={M_T + CH}
            x2={M_L + entries.length * (BAR_W + BAR_GAP) - BAR_GAP}
            y2={M_T + CH}
            stroke={T.border.muted}
            strokeWidth={1}
          />
        </svg>
      </div>
    </div>
  );
}

export default memo(Histogram);
