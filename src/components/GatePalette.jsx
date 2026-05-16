import { useState } from 'react';
import { T } from '../styles/tokens.js';

const GATE_GROUPS = [
  {
    label: 'Single-qubit',
    gates: [
      { name: 'H', display: 'H', needsAngle: false },
      { name: 'X', display: 'X', needsAngle: false },
      { name: 'Y', display: 'Y', needsAngle: false },
      { name: 'Z', display: 'Z', needsAngle: false },
      { name: 'S', display: 'S', needsAngle: false },
      { name: 'T', display: 'T', needsAngle: false },
      { name: 'SDG', display: 'S†', needsAngle: false },
      { name: 'TDG', display: 'T†', needsAngle: false },
    ],
  },
  {
    label: 'Rotation',
    gates: [
      { name: 'RX', display: 'RX', needsAngle: true },
      { name: 'RY', display: 'RY', needsAngle: true },
      { name: 'RZ', display: 'RZ', needsAngle: true },
      { name: 'U1', display: 'U1', needsAngle: true },
    ],
  },
  {
    label: 'Two-qubit',
    gates: [
      { name: 'CNOT', display: 'CNOT', needsAngle: false },
      { name: 'CZ', display: 'CZ', needsAngle: false },
      { name: 'CS', display: 'CS', needsAngle: false },
      { name: 'CT', display: 'CT', needsAngle: false },
      { name: 'SWAP', display: 'SWAP', needsAngle: false },
    ],
  },
  {
    label: 'Three-qubit',
    gates: [
      { name: 'CCX', display: 'CCX', needsAngle: false },
      { name: 'CSWAP', display: 'CSWAP', needsAngle: false },
    ],
  },
  {
    label: 'Measure',
    gates: [{ name: 'MEASURE', display: 'M', needsAngle: false }],
  },
];

function GateChip({ gate, display, needsAngle, onGateDragStart }) {
  const [hovered, setHovered] = useState(false);

  return (
    <div
      draggable="true"
      onDragStart={(e) => {
        e.dataTransfer.setData('application/json', JSON.stringify({ gate, needsAngle }));
        e.dataTransfer.effectAllowed = 'copy';
        if (onGateDragStart) onGateDragStart({ gate, needsAngle });
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '3px 4px',
        borderRadius: T.radius.md,
        border: `1px solid ${hovered ? T.accent.primary : T.accent.secondary}`,
        background: hovered ? T.accent.primary : T.bg.panel,
        color: hovered ? T.text.inverse : T.text.primary,
        fontSize: T.font.size.sm,
        fontWeight: 600,
        fontFamily: 'inherit',
        cursor: 'grab',
        userSelect: 'none',
        transition: 'background 0.12s, border-color 0.12s',
        minWidth: 32,
        textAlign: 'center',
      }}
    >
      {display}
    </div>
  );
}

export default function GatePalette({ onGateDragStart }) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: T.space[4],
        padding: `${T.space[5]}px ${T.space[4]}px`,
        background: T.bg.deep,
        borderRight: `1px solid ${T.border.subtle}`,
        overflowY: 'auto',
        width: 68,
        minWidth: 68,
        flexShrink: 0,
      }}
    >
      {GATE_GROUPS.map((group) => (
        <div key={group.label} style={{ display: 'flex', flexDirection: 'column', gap: T.space[2] }}>
          <div
            style={{
              fontSize: T.font.size.xs,
              color: T.text.dim,
              textTransform: 'uppercase',
              letterSpacing: 0.5,
              marginBottom: T.space[1],
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {group.label}
          </div>
          {group.gates.map((g) => (
            <GateChip
              key={g.name}
              gate={g.name}
              display={g.display}
              needsAngle={g.needsAngle}
              onGateDragStart={onGateDragStart}
            />
          ))}
        </div>
      ))}
    </div>
  );
}
