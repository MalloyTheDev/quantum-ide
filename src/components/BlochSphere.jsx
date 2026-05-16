import { memo, useMemo } from 'react';
import { T } from '../styles/tokens.js';
import { getBlochVectors } from '../engine/simulator.js';
import PanelHeader from './PanelHeader.jsx';

// ── Layout constants ──────────────────────────────────────────────────────────
const R = 48; // sphere radius in SVG units
const CX = 82; // sphere center X
const CY = 80; // sphere center Y
const SVG_W = 168;
const SVG_H = 175;

// Perspective projection of the y-axis:
//   The y-axis is rendered at 210° in SVG space (lower-left direction).
//   cos(210°) = −√3/2, sin(210°) = −0.5  but since SVG-y is flipped we use:
//     sx contribution per unit of by: −P_FACTOR · cos(30°) · R
//     sy contribution per unit of by: +P_FACTOR · sin(30°) · R   (positive = down)
const P_FACTOR = 0.4;
const BY_DX = -(P_FACTOR * (Math.sqrt(3) / 2) * R); // ≈ −16.6
const BY_DY = P_FACTOR * 0.5 * R; // ≈  +9.6

// ── Projection ────────────────────────────────────────────────────────────────
/** Map a unit-sphere Bloch vector (bx, by, bz) to SVG pixel coords. */
function proj(bx, by, bz) {
  return {
    sx: CX + R * bx + by * BY_DX,
    sy: CY - R * bz + by * BY_DY,
  };
}

// ── Precomputed static values (all constants, computed once at module load) ───
const P_X_POS = proj(1, 0, 0); // |+⟩
const P_X_NEG = proj(-1, 0, 0); // |−⟩
const P_Y_POS = proj(0, 1, 0); // |i⟩
const P_Y_NEG = proj(0, -1, 0); // |−i⟩
const P_Y_POS2 = proj(0, 1.2, 0); // y-axis extension beyond sphere
const P_Y_NEG2 = proj(0, -1.2, 0);

// Equator: the full projected ellipse as an SVG path (72 segments)
const EQUATOR_PATH = (() => {
  const segs = [];
  const N = 72;
  for (let i = 0; i <= N; i++) {
    const t = (2 * Math.PI * i) / N;
    const { sx, sy } = proj(Math.cos(t), Math.sin(t), 0);
    segs.push(`${i === 0 ? 'M' : 'L'}${sx.toFixed(2)},${sy.toFixed(2)}`);
  }
  return segs.join(' ') + ' Z';
})();

// ── Colors ────────────────────────────────────────────────────────────────────
const C_SPHERE = '#4a4060';
const C_AXIS = '#3d3558';
const C_LABEL = '#e2e8f0';
const C_DIM = '#6b7280';
const C_VECTOR = '#a78bfa';

// ── Single qubit Bloch sphere ─────────────────────────────────────────────────
function SingleSphere({ vec, label }) {
  const { x, y, z, theta, phi } = vec;
  const tip = proj(x, y, z);
  const dx = tip.sx - CX;
  const dy = tip.sy - CY;
  const len = Math.sqrt(dx * dx + dy * dy);

  // Arrowhead barbs
  const HEAD = 7;
  const BEVEL = 0.38;
  const ang = Math.atan2(dy, dx);
  const hx1 = tip.sx - HEAD * Math.cos(ang - BEVEL);
  const hy1 = tip.sy - HEAD * Math.sin(ang - BEVEL);
  const hx2 = tip.sx - HEAD * Math.cos(ang + BEVEL);
  const hy2 = tip.sy - HEAD * Math.sin(ang + BEVEL);

  const tDeg = ((theta * 180) / Math.PI).toFixed(1);
  const pDeg = ((phi * 180) / Math.PI).toFixed(1);

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        flexShrink: 0,
      }}
    >
      {/* Qubit label above sphere */}
      <div
        style={{
          fontSize: T.font.size.xs,
          color: T.text.dim,
          marginBottom: 2,
          fontFamily: 'inherit',
        }}
      >
        {label}
      </div>

      <svg width={SVG_W} height={SVG_H} style={{ display: 'block', overflow: 'visible' }}>
        {/* ── Sphere outline ── */}
        <circle cx={CX} cy={CY} r={R} fill="none" stroke={C_SPHERE} strokeWidth={1} />

        {/* ── Equator (accurately projected, dashed) ── */}
        <path d={EQUATOR_PATH} fill="none" stroke={C_AXIS} strokeWidth={0.75} strokeDasharray="3,2" />

        {/* ── z-axis (vertical, extended 10px beyond sphere) ── */}
        <line
          x1={CX}
          y1={CY - R - 10}
          x2={CX}
          y2={CY + R + 10}
          stroke={C_AXIS}
          strokeWidth={0.75}
          strokeDasharray="3,2"
        />

        {/* ── x-axis (horizontal, extended 8px beyond sphere) ── */}
        <line
          x1={P_X_NEG.sx - 8}
          y1={CY}
          x2={P_X_POS.sx + 8}
          y2={CY}
          stroke={C_AXIS}
          strokeWidth={0.75}
          strokeDasharray="3,2"
        />

        {/* ── y-axis (projected diagonal, extended beyond sphere) ── */}
        <line
          x1={P_Y_NEG2.sx}
          y1={P_Y_NEG2.sy}
          x2={P_Y_POS2.sx}
          y2={P_Y_POS2.sy}
          stroke={C_AXIS}
          strokeWidth={0.75}
          strokeDasharray="3,2"
        />

        {/* ── Pole labels ── */}
        <text x={CX} y={CY - R - 14} textAnchor="middle" fontSize={10} fill={C_LABEL} fontFamily="inherit">
          |0⟩
        </text>

        <text x={CX} y={CY + R + 15} textAnchor="middle" fontSize={10} fill={C_LABEL} fontFamily="inherit">
          |1⟩
        </text>

        {/* ── Equator labels ── */}
        <text x={P_X_POS.sx + 7} y={CY + 4} textAnchor="start" fontSize={10} fill={C_LABEL} fontFamily="inherit">
          |+⟩
        </text>

        <text x={P_X_NEG.sx - 7} y={CY + 4} textAnchor="end" fontSize={10} fill={C_LABEL} fontFamily="inherit">
          |−⟩
        </text>

        <text x={P_Y_POS.sx - 4} y={P_Y_POS.sy + 13} textAnchor="middle" fontSize={9} fill={C_DIM} fontFamily="inherit">
          |i⟩
        </text>

        <text x={P_Y_NEG.sx + 4} y={P_Y_NEG.sy - 6} textAnchor="middle" fontSize={9} fill={C_DIM} fontFamily="inherit">
          |−i⟩
        </text>

        {/* ── State vector arrow (only if non-trivial) ── */}
        {len > 0.5 && (
          <g>
            <line x1={CX} y1={CY} x2={tip.sx} y2={tip.sy} stroke={C_VECTOR} strokeWidth={2} strokeLinecap="round" />
            <line x1={tip.sx} y1={tip.sy} x2={hx1} y2={hy1} stroke={C_VECTOR} strokeWidth={2} strokeLinecap="round" />
            <line x1={tip.sx} y1={tip.sy} x2={hx2} y2={hy2} stroke={C_VECTOR} strokeWidth={2} strokeLinecap="round" />
            <circle cx={tip.sx} cy={tip.sy} r={2.5} fill={C_VECTOR} />
          </g>
        )}

        {/* ── Center dot ── */}
        <circle cx={CX} cy={CY} r={2} fill={C_AXIS} />

        {/* ── Angle readout ── */}
        <text x={CX} y={CY + R + 29} textAnchor="middle" fontSize={9} fill={C_DIM} fontFamily="inherit">
          θ={tDeg}° φ={pDeg}°
        </text>
      </svg>
    </div>
  );
}

// ── Bloch sphere panel ────────────────────────────────────────────────────────
/**
 * Bloch sphere visualization for up to 4 qubits.
 *
 * Props:
 *   state   - Current state vector (array of [re, im]) or null
 *   nQubits - Number of qubits
 *   actions - Optional React node passed to PanelHeader (e.g. toggle button)
 */
function BlochSphere({ state, nQubits, actions, vectors: vectorsProp }) {
  const vectorsComputed = useMemo(() => {
    if (vectorsProp) return vectorsProp;
    if (!state || nQubits === 0) return null;
    return getBlochVectors(state, nQubits);
  }, [state, nQubits, vectorsProp]);
  const vectors = vectorsComputed;

  if (!vectorsComputed || nQubits === 0) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden', flex: 1 }}>
        <PanelHeader label="BLOCH SPHERE" actions={actions} />
        <div
          style={{
            color: C_DIM,
            padding: 16,
            fontSize: T.font.size.base,
            fontStyle: 'italic',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flex: 1,
          }}
        >
          Run or step through a program to see the Bloch sphere
        </div>
      </div>
    );
  }

  if (nQubits > 4) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden', flex: 1 }}>
        <PanelHeader label="BLOCH SPHERE" actions={actions} />
        <div
          style={{
            color: C_DIM,
            padding: 16,
            fontSize: T.font.size.base,
            fontStyle: 'italic',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flex: 1,
          }}
        >
          Bloch sphere available for ≤4 qubits
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden', flex: 1 }}>
      <PanelHeader label="BLOCH SPHERE" actions={actions} />
      <div
        style={{
          display: 'flex',
          flexDirection: 'row',
          gap: T.space[5],
          padding: `${T.space[4]}px ${T.space[5]}px`,
          overflow: 'auto',
          flex: 1,
          alignItems: 'flex-start',
        }}
      >
        {vectors && vectors.map((vec, k) => <SingleSphere key={k} vec={vec} label={`q${k}`} />)}
      </div>
    </div>
  );
}

export default memo(BlochSphere);
