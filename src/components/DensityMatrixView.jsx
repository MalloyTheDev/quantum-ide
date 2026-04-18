import { memo, useMemo, useState } from 'react';
import { T } from '../styles/tokens.js';
import PanelHeader from './PanelHeader.jsx';

// ── Probability bar view ──────────────────────────────────────────────────────

function ProbView({ probabilities, nQubits }) {
  const maxProb = Math.max(...probabilities, 0.001);
  const dim = probabilities.length;

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      gap: 2,
      padding: '8px 12px',
      overflow: 'auto',
      flex: 1,
    }}>
      <div style={{
        fontSize: T.font.size.xs,
        color: '#9ca3af',
        fontFamily: 'monospace',
        marginBottom: 4,
        fontWeight: 600,
      }}>
        DIAGONAL — {nQubits} qubit{nQubits > 1 ? 's' : ''}, {dim} basis states
      </div>

      {probabilities.map((prob, i) => {
        const label = '|' + i.toString(2).padStart(nQubits, '0') + '⟩';
        return (
          <div key={i} style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            fontFamily: 'monospace',
            fontSize: T.font.size.md,
          }}>
            <span style={{
              color: '#c4b5fd',
              width: Math.max(nQubits * 10 + 24, 44),
              flexShrink: 0,
            }}>
              {label}
            </span>

            <div style={{
              flex: 1,
              height: 14,
              background: '#1e1b2e',
              borderRadius: T.radius.sm,
              overflow: 'hidden',
              minWidth: 40,
            }}>
              <div style={{
                width: `${(prob / maxProb) * 100}%`,
                height: '100%',
                borderRadius: T.radius.sm,
                background: prob > 0.5 ? '#7c3aed' : prob > 0.1 ? '#6366f1' : '#4f46e5',
                transition: 'width 0.3s ease',
              }} />
            </div>

            <span style={{
              color: '#a5b4fc',
              width: 56,
              textAlign: 'right',
              flexShrink: 0,
              fontSize: T.font.size.sm,
            }}>
              {(prob * 100).toFixed(1)}%
            </span>
          </div>
        );
      })}
    </div>
  );
}

// ── Heatmap view ──────────────────────────────────────────────────────────────

function HeatmapView({ densityMatrix, dim, nQubits }) {
  // Cap at 8×8 (3 qubits)
  const displayDim = Math.min(dim, 8);
  const CELL = Math.min(36, Math.floor(280 / displayDim));
  const svgSize = displayDim * CELL + 1;

  const cells = useMemo(() => {
    let maxMag = 0;
    const mags = [];
    for (let i = 0; i < displayDim; i++) {
      mags.push([]);
      for (let j = 0; j < displayDim; j++) {
        const [re, im] = densityMatrix[i][j];
        const mag = Math.sqrt(re * re + im * im);
        mags[i].push(mag);
        if (mag > maxMag) maxMag = mag;
      }
    }
    return { mags, maxMag: maxMag || 1 };
  }, [densityMatrix, displayDim]);

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      padding: '8px 12px',
      overflow: 'auto',
      flex: 1,
      gap: T.space[3],
    }}>
      <div style={{
        fontSize: T.font.size.xs,
        color: '#9ca3af',
        fontFamily: 'monospace',
        fontWeight: 600,
      }}>
        |ρ_ij| HEATMAP — {displayDim}×{displayDim}
        {dim > 8 && <span style={{ color: T.text.disabled }}> (showing first 8×8)</span>}
      </div>

      <svg width={svgSize} height={svgSize} style={{ display: 'block', flexShrink: 0 }}>
        {cells.mags.map((row, i) =>
          row.map((mag, j) => {
            const t = mag / cells.maxMag;
            // Color: black (0) → deep indigo → purple → violet (1)
            const r = Math.round(t * 167);
            const g = Math.round(t * 58);
            const b = Math.round(55 + t * 200);
            return (
              <rect
                key={`${i}-${j}`}
                x={j * CELL}
                y={i * CELL}
                width={CELL - 1}
                height={CELL - 1}
                fill={`rgb(${r},${g},${b})`}
                rx={1}
              >
                <title>ρ[{i}][{j}] = {densityMatrix[i][j][0].toFixed(4)}{densityMatrix[i][j][1] >= 0 ? '+' : ''}{densityMatrix[i][j][1].toFixed(4)}i  |mag|={mag.toFixed(4)}</title>
              </rect>
            );
          })
        )}
        {/* Axis labels */}
        {Array.from({ length: displayDim }, (_, i) => (
          <text
            key={`label-${i}`}
            x={i * CELL + CELL / 2}
            y={svgSize + 11}
            textAnchor="middle"
            fontSize={8}
            fill="#4b5563"
            fontFamily="monospace"
          >
            {i}
          </text>
        ))}
      </svg>

      {/* Color scale legend */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: T.space[3],
        fontSize: T.font.size.xs,
        color: T.text.dim,
      }}>
        <span>0</span>
        <div style={{
          width: 80,
          height: 8,
          borderRadius: 2,
          background: 'linear-gradient(to right, #000037, #a73aff)',
        }} />
        <span>max |ρ_ij|</span>
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

function _tabBtn(label, active, onClick) {
  return (
    <button
      key={label}
      onClick={onClick}
      style={{
        fontSize: T.font.size.xs,
        padding: '2px 7px',
        borderRadius: T.radius.lg,
        border: `1px solid ${active ? T.accent.secondary : T.border.muted}`,
        background: active ? T.bg.panel : 'transparent',
        color: active ? T.accent.light : T.text.muted,
        cursor: 'pointer',
        fontFamily: 'inherit',
        lineHeight: '16px',
      }}
    >
      {label}
    </button>
  );
}

/**
 * Density matrix visualization panel.
 *
 * Props:
 *   densityMatrix - 2^n × 2^n array of [re,im] tuples (or null)
 *   nQubits       - number of qubits
 *   actions       - optional React node for the panel header (e.g. close button)
 */
function DensityMatrixView({ densityMatrix, nQubits, actions }) {
  const [showHeatmap, setShowHeatmap] = useState(false);
  const probabilities = useMemo(
    () => densityMatrix ? densityMatrix.map((row, i) => row[i][0]) : [],
    [densityMatrix]
  );

  if (!densityMatrix || nQubits === 0) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden', flex: 1 }}>
        <PanelHeader label="ρ DENSITY MATRIX" actions={actions} />
        <div style={{
          color: '#6b7280',
          padding: 16,
          fontSize: 13,
          fontStyle: 'italic',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flex: 1,
        }}>
          Run a noisy simulation to see the density matrix
        </div>
      </div>
    );
  }

  const dim = 1 << nQubits;

  const tabActions = (
    <div style={{ display: 'flex', alignItems: 'center', gap: T.space[2] }}>
      {_tabBtn('Probabilities', !showHeatmap, () => setShowHeatmap(false))}
      {_tabBtn('Matrix Heatmap', showHeatmap, () => setShowHeatmap(true))}
      {actions}
    </div>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden', flex: 1 }}>
      <PanelHeader label="ρ DENSITY MATRIX" actions={tabActions} />
      {showHeatmap
        ? <HeatmapView densityMatrix={densityMatrix} dim={dim} nQubits={nQubits} />
        : <ProbView probabilities={probabilities} nQubits={nQubits} />
      }
    </div>
  );
}

export default memo(DensityMatrixView);
