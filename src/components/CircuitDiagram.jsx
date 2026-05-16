import { memo, useState, useRef, useCallback, useEffect } from 'react';
import { T } from '../styles/tokens.js';

const WIRE_SPACING = 40;
const GATE_SPACING = 56;
const LEFT_MARGIN = 60;
const TOP_MARGIN = 32;

function wireY(qubit) {
  return TOP_MARGIN + qubit * WIRE_SPACING;
}

function gateX(index) {
  return LEFT_MARGIN + index * GATE_SPACING;
}

/**
 * Renders a single-qubit gate box on the circuit diagram.
 */
function GateBox({ x, qubit, label, active, opacity }) {
  const y = wireY(qubit);
  return (
    <g opacity={opacity}>
      <rect
        x={x - 16}
        y={y - 14}
        width={32}
        height={28}
        rx={3}
        fill={active ? T.accent.active : T.bg.gateFill}
        stroke={active ? T.accent.activeSoft : T.accent.secondary}
        strokeWidth={active ? 2 : 1}
      />
      <text
        x={x}
        y={y + 4}
        textAnchor="middle"
        fill={T.text.primary}
        fontSize={11}
        fontFamily="monospace"
        fontWeight="bold"
      >
        {label}
      </text>
    </g>
  );
}

/**
 * Renders a CNOT gate: dot on control, ⊕ on target, vertical line.
 */
function CNOTSymbol({ x, control, target, active, opacity }) {
  const stroke = active ? T.accent.activeSoft : T.accent.secondary;
  const sw = active ? 2 : 1;
  return (
    <g opacity={opacity}>
      <line x1={x} y1={wireY(control)} x2={x} y2={wireY(target)} stroke={stroke} strokeWidth={sw} />
      {/* Control dot */}
      <circle cx={x} cy={wireY(control)} r={4} fill={active ? T.accent.active : T.accent.secondary} />
      {/* Target ⊕ */}
      <circle cx={x} cy={wireY(target)} r={10} fill="none" stroke={stroke} strokeWidth={sw} />
      <line x1={x} y1={wireY(target) - 10} x2={x} y2={wireY(target) + 10} stroke={stroke} strokeWidth={sw} />
      <line x1={x - 10} y1={wireY(target)} x2={x + 10} y2={wireY(target)} stroke={stroke} strokeWidth={sw} />
    </g>
  );
}

/**
 * Renders a CZ gate: dot on both qubits (dot-dot style), vertical line.
 */
function CZSymbol({ x, control, target, active, opacity }) {
  const stroke = active ? T.accent.activeSoft : T.accent.secondary;
  const sw = active ? 2 : 1;
  const minQ = Math.min(control, target);
  const maxQ = Math.max(control, target);
  return (
    <g opacity={opacity}>
      <line x1={x} y1={wireY(minQ)} x2={x} y2={wireY(maxQ)} stroke={stroke} strokeWidth={sw} />
      <circle cx={x} cy={wireY(control)} r={4} fill={active ? T.accent.active : T.accent.secondary} />
      <circle cx={x} cy={wireY(target)} r={4} fill={active ? T.accent.active : T.accent.secondary} />
    </g>
  );
}

/**
 * Renders a controlled single-qubit gate: dot on control, labeled box on target.
 * Used for CS and CT.
 */
function ControlledGateSymbol({ x, control, target, label, active, opacity }) {
  const stroke = active ? T.accent.activeSoft : T.accent.secondary;
  const sw = active ? 2 : 1;
  const minQ = Math.min(control, target);
  const maxQ = Math.max(control, target);
  return (
    <g opacity={opacity}>
      <line x1={x} y1={wireY(minQ)} x2={x} y2={wireY(maxQ)} stroke={stroke} strokeWidth={sw} />
      <circle cx={x} cy={wireY(control)} r={4} fill={active ? T.accent.active : T.accent.secondary} />
      <rect
        x={x - 14}
        y={wireY(target) - 12}
        width={28}
        height={24}
        rx={3}
        fill={active ? T.accent.active : T.bg.gateFill}
        stroke={stroke}
        strokeWidth={sw}
      />
      <text
        x={x}
        y={wireY(target) + 4}
        textAnchor="middle"
        fill={T.text.primary}
        fontSize={11}
        fontFamily="monospace"
        fontWeight="bold"
      >
        {label}
      </text>
    </g>
  );
}

/**
 * Renders a Toffoli (CCX) gate: two control dots + ⊕ on target.
 */
function ToffoliSymbol({ x, control1, control2, target, active, opacity }) {
  const stroke = active ? T.accent.activeSoft : T.accent.secondary;
  const sw = active ? 2 : 1;
  const allQ = [control1, control2, target];
  const minQ = Math.min(...allQ);
  const maxQ = Math.max(...allQ);
  return (
    <g opacity={opacity}>
      <line x1={x} y1={wireY(minQ)} x2={x} y2={wireY(maxQ)} stroke={stroke} strokeWidth={sw} />
      <circle cx={x} cy={wireY(control1)} r={4} fill={active ? T.accent.active : T.accent.secondary} />
      <circle cx={x} cy={wireY(control2)} r={4} fill={active ? T.accent.active : T.accent.secondary} />
      {/* Target ⊕ */}
      <circle cx={x} cy={wireY(target)} r={10} fill="none" stroke={stroke} strokeWidth={sw} />
      <line x1={x} y1={wireY(target) - 10} x2={x} y2={wireY(target) + 10} stroke={stroke} strokeWidth={sw} />
      <line x1={x - 10} y1={wireY(target)} x2={x + 10} y2={wireY(target)} stroke={stroke} strokeWidth={sw} />
    </g>
  );
}

/**
 * Renders a CSWAP (Fredkin) gate: control dot + × on each swap target.
 */
function CSWAPSymbol({ x, control, target1, target2, active, opacity }) {
  const stroke = active ? T.accent.activeSoft : T.accent.secondary;
  const sw = active ? 2 : 1;
  const allQ = [control, target1, target2];
  const minQ = Math.min(...allQ);
  const maxQ = Math.max(...allQ);
  return (
    <g opacity={opacity}>
      <line x1={x} y1={wireY(minQ)} x2={x} y2={wireY(maxQ)} stroke={stroke} strokeWidth={sw} />
      <circle cx={x} cy={wireY(control)} r={4} fill={active ? T.accent.active : T.accent.secondary} />
      {[target1, target2].map((q) => (
        <g key={q}>
          <line x1={x - 6} y1={wireY(q) - 6} x2={x + 6} y2={wireY(q) + 6} stroke={stroke} strokeWidth={2} />
          <line x1={x + 6} y1={wireY(q) - 6} x2={x - 6} y2={wireY(q) + 6} stroke={stroke} strokeWidth={2} />
        </g>
      ))}
    </g>
  );
}

/**
 * Renders a SWAP gate: × on both qubits, vertical line.
 */
function SWAPSymbol({ x, qubit1, qubit2, active, opacity }) {
  const stroke = active ? T.accent.activeSoft : T.accent.secondary;
  return (
    <g opacity={opacity}>
      <line x1={x} y1={wireY(qubit1)} x2={x} y2={wireY(qubit2)} stroke={stroke} strokeWidth={active ? 2 : 1} />
      {[qubit1, qubit2].map((q) => (
        <g key={q}>
          <line x1={x - 6} y1={wireY(q) - 6} x2={x + 6} y2={wireY(q) + 6} stroke={stroke} strokeWidth={2} />
          <line x1={x + 6} y1={wireY(q) - 6} x2={x - 6} y2={wireY(q) + 6} stroke={stroke} strokeWidth={2} />
        </g>
      ))}
    </g>
  );
}

/**
 * Renders a measurement symbol (meter icon).
 */
function MeasureSymbol({ x, qubit, active, opacity }) {
  const y = wireY(qubit);
  const stroke = active ? T.semantic.successLight : T.semantic.success;
  return (
    <g opacity={opacity}>
      <rect
        x={x - 14}
        y={y - 12}
        width={28}
        height={24}
        rx={3}
        fill={active ? T.semantic.successDark : T.bg.gateFill}
        stroke={stroke}
        strokeWidth={active ? 2 : 1}
      />
      <path d={`M${x - 6} ${y + 6} A 8 8 0 0 1 ${x + 6} ${y + 6}`} fill="none" stroke={stroke} strokeWidth={1.5} />
      <line x1={x} y1={y + 6} x2={x + 5} y2={y - 6} stroke={stroke} strokeWidth={1.5} />
    </g>
  );
}

/**
 * Renders a custom gate as a dashed box spanning all involved qubits,
 * labeled with the gate name.
 */
function CustomGateSymbol({ x, name, qubits, active, opacity }) {
  const stroke = active ? T.accent.soft : T.accent.primary;
  const sw = active ? 2 : 1;
  const minQ = Math.min(...qubits);
  const maxQ = Math.max(...qubits);
  const y1 = wireY(minQ) - 14;
  const y2 = wireY(maxQ) + 14;
  return (
    <g opacity={opacity}>
      <rect
        x={x - 20}
        y={y1}
        width={40}
        height={y2 - y1}
        rx={4}
        fill={active ? T.bg.customGateActive : T.bg.customGate}
        stroke={stroke}
        strokeWidth={sw}
        strokeDasharray={active ? 'none' : '4,2'}
      />
      <text
        x={x}
        y={(y1 + y2) / 2 + 4}
        textAnchor="middle"
        fill={active ? T.accent.light : T.accent.primary}
        fontSize={9}
        fontFamily="monospace"
        fontWeight="bold"
      >
        {name.toUpperCase()}
      </text>
    </g>
  );
}

/**
 * Renders a classically-controlled instruction using the same glyph as the
 * wrapped quantum gate plus a dashed measurement-memory marker.
 */
function ConditionalSymbol({ x, condition, instruction, active, opacity, nQubits }) {
  const stroke = active ? T.semantic.successLight : T.semantic.success;
  const qubits = instruction.qubits ?? [condition.qubit];
  const minQ = Math.min(condition.qubit, ...qubits);
  const maxQ = Math.max(condition.qubit, ...qubits);

  const inner = (() => {
    switch (instruction.type) {
      case 'gate':
      case 'rotation':
        return (
          <GateBox
            x={x}
            qubit={instruction.qubits[0]}
            label={instruction.gate.toUpperCase()}
            active={active}
            opacity={1}
          />
        );
      case 'cx':
        return (
          <CNOTSymbol
            x={x}
            control={instruction.qubits[0]}
            target={instruction.qubits[1]}
            active={active}
            opacity={1}
          />
        );
      case 'cz':
        return (
          <CZSymbol x={x} control={instruction.qubits[0]} target={instruction.qubits[1]} active={active} opacity={1} />
        );
      case 'cs':
        return (
          <ControlledGateSymbol
            x={x}
            control={instruction.qubits[0]}
            target={instruction.qubits[1]}
            label="S"
            active={active}
            opacity={1}
          />
        );
      case 'ct':
        return (
          <ControlledGateSymbol
            x={x}
            control={instruction.qubits[0]}
            target={instruction.qubits[1]}
            label="T"
            active={active}
            opacity={1}
          />
        );
      case 'swap':
        return (
          <SWAPSymbol x={x} qubit1={instruction.qubits[0]} qubit2={instruction.qubits[1]} active={active} opacity={1} />
        );
      case 'ccx':
        return (
          <ToffoliSymbol
            x={x}
            control1={instruction.qubits[0]}
            control2={instruction.qubits[1]}
            target={instruction.qubits[2]}
            active={active}
            opacity={1}
          />
        );
      case 'cswap':
        return (
          <CSWAPSymbol
            x={x}
            control={instruction.qubits[0]}
            target1={instruction.qubits[1]}
            target2={instruction.qubits[2]}
            active={active}
            opacity={1}
          />
        );
      case 'measure':
        return <MeasureSymbol x={x} qubit={instruction.qubits[0]} active={active} opacity={1} />;
      case 'measure_all':
        return (
          <g>
            {Array.from({ length: nQubits }, (_, q) => (
              <MeasureSymbol key={q} x={x} qubit={q} active={active} opacity={1} />
            ))}
          </g>
        );
      case 'custom_gate':
        return (
          <CustomGateSymbol x={x} name={instruction.name} qubits={instruction.qubits} active={active} opacity={1} />
        );
      default:
        return null;
    }
  })();

  return (
    <g opacity={opacity}>
      <line
        x1={x - 22}
        y1={wireY(minQ)}
        x2={x - 22}
        y2={wireY(maxQ)}
        stroke={stroke}
        strokeWidth={1}
        strokeDasharray="3,3"
      />
      <circle
        cx={x - 22}
        cy={wireY(condition.qubit)}
        r={4}
        fill={active ? T.semantic.successLight : T.bg.deep}
        stroke={stroke}
        strokeWidth={1.5}
      />
      <text
        x={x - 22}
        y={Math.max(10, wireY(condition.qubit) - 10)}
        textAnchor="middle"
        fill={stroke}
        fontSize={8}
        fontFamily="monospace"
        fontWeight="bold"
      >
        m{condition.qubit}={condition.value}
      </text>
      {inner}
    </g>
  );
}

/**
 * Main circuit diagram component.
 * Renders qubit wires and gate symbols from parsed instructions.
 * When onGateDrop is provided, each wire cell becomes a drop target.
 */
function CircuitDiagram({ instructions, nQubits, currentStep, onGateDrop, onGateDropAngle }) {
  const [highlightCell, setHighlightCell] = useState(null);
  const [errorFlashCell, setErrorFlashCell] = useState(null);
  const [pendingAngle, setPendingAngle] = useState(null);
  const [angleInput, setAngleInput] = useState('pi/2');
  const flashTimerRef = useRef(null);

  useEffect(() => {
    return () => {
      if (flashTimerRef.current) clearTimeout(flashTimerRef.current);
    };
  }, []);

  const handleDragOver = useCallback((e, q, col) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
    setHighlightCell({ q, col });
  }, []);

  const handleDragLeave = useCallback(() => {
    setHighlightCell(null);
  }, []);

  const handleDrop = useCallback(
    (e, q, col) => {
      e.preventDefault();
      setHighlightCell(null);

      let data;
      try {
        data = JSON.parse(e.dataTransfer.getData('application/json'));
      } catch {
        return;
      }

      const { gate, needsAngle } = data;
      const gateName = gate.toUpperCase();

      if (needsAngle) {
        setPendingAngle({ gate: gateName, qubitIndex: q, colIndex: col, x: e.clientX, y: e.clientY });
        setAngleInput('pi/2');
        return;
      }

      const is2q = ['CNOT', 'CZ', 'CS', 'CT', 'SWAP'].includes(gateName);
      const is3q = ['CCX', 'CSWAP'].includes(gateName);

      if ((is2q && q + 1 >= nQubits) || (is3q && q + 2 >= nQubits)) {
        setErrorFlashCell({ q, col });
        if (flashTimerRef.current) clearTimeout(flashTimerRef.current);
        flashTimerRef.current = setTimeout(() => setErrorFlashCell(null), 600);
        return;
      }

      if (onGateDrop) onGateDrop(gateName, q, col);
    },
    [nQubits, onGateDrop]
  );

  const handleAngleConfirm = useCallback(() => {
    if (!pendingAngle) return;
    if (onGateDropAngle) onGateDropAngle(pendingAngle.gate, pendingAngle.qubitIndex, angleInput, pendingAngle.colIndex);
    setPendingAngle(null);
  }, [pendingAngle, angleInput, onGateDropAngle]);

  const handleAngleCancel = useCallback(() => {
    setPendingAngle(null);
  }, []);

  if (nQubits === 0) {
    return (
      <div style={{ color: T.text.dim, padding: 16, fontSize: T.font.size.base, fontStyle: 'italic' }}>
        Write some quantum code to see the circuit diagram
      </div>
    );
  }

  const effectiveCols = onGateDrop ? instructions.length + 1 : instructions.length;
  const w = Math.max(300, LEFT_MARGIN + Math.max(effectiveCols, 1) * GATE_SPACING + 40);
  const h = TOP_MARGIN + nQubits * WIRE_SPACING + 8;

  return (
    <>
      <svg width="100%" viewBox={`0 0 ${w} ${h}`} style={{ minHeight: 60 }}>
        {/* Qubit wires */}
        {Array.from({ length: nQubits }, (_, q) => (
          <g key={`wire-${q}`}>
            <text x={10} y={wireY(q) + 4} fill={T.text.muted} fontSize={11} fontFamily="monospace">
              q{q}
            </text>
            <line x1={36} y1={wireY(q)} x2={w - 8} y2={wireY(q)} stroke={T.text.disabled} strokeWidth={1} />
          </g>
        ))}

        {/* Gate symbols */}
        {instructions.map((inst, i) => {
          const x = gateX(i);
          const active = currentStep !== null && i === currentStep;
          const past = currentStep !== null && i < currentStep;
          const opacity = currentStep === null ? 1 : past ? 0.4 : active ? 1 : 0.3;

          switch (inst.type) {
            case 'gate':
            case 'rotation':
              return (
                <GateBox
                  key={i}
                  x={x}
                  qubit={inst.qubits[0]}
                  label={inst.gate.toUpperCase()}
                  active={active}
                  opacity={opacity}
                />
              );

            case 'cx':
              return (
                <CNOTSymbol
                  key={i}
                  x={x}
                  control={inst.qubits[0]}
                  target={inst.qubits[1]}
                  active={active}
                  opacity={opacity}
                />
              );

            case 'cz':
              return (
                <CZSymbol
                  key={i}
                  x={x}
                  control={inst.qubits[0]}
                  target={inst.qubits[1]}
                  active={active}
                  opacity={opacity}
                />
              );

            case 'cs':
              return (
                <ControlledGateSymbol
                  key={i}
                  x={x}
                  control={inst.qubits[0]}
                  target={inst.qubits[1]}
                  label="S"
                  active={active}
                  opacity={opacity}
                />
              );

            case 'ct':
              return (
                <ControlledGateSymbol
                  key={i}
                  x={x}
                  control={inst.qubits[0]}
                  target={inst.qubits[1]}
                  label="T"
                  active={active}
                  opacity={opacity}
                />
              );

            case 'ccx':
              return (
                <ToffoliSymbol
                  key={i}
                  x={x}
                  control1={inst.qubits[0]}
                  control2={inst.qubits[1]}
                  target={inst.qubits[2]}
                  active={active}
                  opacity={opacity}
                />
              );

            case 'cswap':
              return (
                <CSWAPSymbol
                  key={i}
                  x={x}
                  control={inst.qubits[0]}
                  target1={inst.qubits[1]}
                  target2={inst.qubits[2]}
                  active={active}
                  opacity={opacity}
                />
              );

            case 'swap':
              return (
                <SWAPSymbol
                  key={i}
                  x={x}
                  qubit1={inst.qubits[0]}
                  qubit2={inst.qubits[1]}
                  active={active}
                  opacity={opacity}
                />
              );

            case 'measure': {
              return <MeasureSymbol key={i} x={x} qubit={inst.qubits[0]} active={active} opacity={opacity} />;
            }

            case 'measure_all':
              return (
                <g key={i}>
                  {Array.from({ length: nQubits }, (_, q) => (
                    <MeasureSymbol key={q} x={x} qubit={q} active={active} opacity={opacity} />
                  ))}
                </g>
              );

            case 'barrier':
              return (
                <g key={i} opacity={opacity}>
                  {Array.from({ length: nQubits }, (_, q) => (
                    <line
                      key={q}
                      x1={x}
                      y1={wireY(q) - 12}
                      x2={x}
                      y2={wireY(q) + 12}
                      stroke={T.text.dim}
                      strokeWidth={1}
                      strokeDasharray="3,3"
                    />
                  ))}
                </g>
              );

            case 'custom_gate':
              return (
                <CustomGateSymbol
                  key={i}
                  x={x}
                  name={inst.name}
                  qubits={inst.qubits}
                  active={active}
                  opacity={opacity}
                />
              );

            case 'conditional':
              return (
                <ConditionalSymbol
                  key={i}
                  x={x}
                  condition={inst.condition}
                  instruction={inst.instruction}
                  active={active}
                  opacity={opacity}
                  nQubits={nQubits}
                />
              );

            default:
              return null;
          }
        })}

        {/* Error flash overlay */}
        {errorFlashCell && (
          <rect
            x={gateX(errorFlashCell.col) - GATE_SPACING / 2}
            y={wireY(errorFlashCell.q) - WIRE_SPACING / 2}
            width={GATE_SPACING}
            height={WIRE_SPACING}
            fill="rgba(239,68,68,0.35)"
            rx={3}
            style={{ pointerEvents: 'none' }}
          />
        )}

        {/* Drag-over highlight overlay */}
        {highlightCell && (
          <rect
            x={gateX(highlightCell.col) - GATE_SPACING / 2}
            y={wireY(highlightCell.q) - WIRE_SPACING / 2}
            width={GATE_SPACING}
            height={WIRE_SPACING}
            fill="rgba(99,102,241,0.25)"
            stroke={T.accent.secondary}
            strokeWidth={1}
            rx={3}
            style={{ pointerEvents: 'none' }}
          />
        )}

        {/* Drop zones - one per (qubit, column) cell */}
        {onGateDrop &&
          Array.from({ length: nQubits }, (_, q) =>
            Array.from({ length: effectiveCols }, (_, col) => (
              <foreignObject
                key={`drop-${q}-${col}`}
                x={gateX(col) - GATE_SPACING / 2}
                y={wireY(q) - WIRE_SPACING / 2}
                width={GATE_SPACING}
                height={WIRE_SPACING}
              >
                <div
                  style={{ width: '100%', height: '100%', cursor: 'copy', boxSizing: 'border-box' }}
                  onDragOver={(e) => handleDragOver(e, q, col)}
                  onDragLeave={handleDragLeave}
                  onDrop={(e) => handleDrop(e, q, col)}
                />
              </foreignObject>
            ))
          )}
      </svg>

      {/* Floating angle prompt for rotation gates */}
      {pendingAngle && (
        <div
          style={{
            position: 'fixed',
            left: pendingAngle.x + 8,
            top: pendingAngle.y + 8,
            zIndex: 200,
            background: T.bg.panel,
            border: `1px solid ${T.accent.secondary}`,
            borderRadius: T.radius.lg,
            padding: `${T.space[4]}px ${T.space[5]}px`,
            display: 'flex',
            flexDirection: 'column',
            gap: T.space[3],
            boxShadow: '0 4px 16px rgba(0,0,0,0.6)',
            minWidth: 160,
          }}
        >
          <div style={{ fontSize: T.font.size.sm, color: T.accent.light }}>
            {pendingAngle.gate} angle (q{pendingAngle.qubitIndex})
          </div>
          <input
            autoFocus
            value={angleInput}
            onChange={(e) => setAngleInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleAngleConfirm();
              if (e.key === 'Escape') handleAngleCancel();
            }}
            style={{
              padding: '4px 6px',
              borderRadius: T.radius.md,
              border: `1px solid ${T.border.muted}`,
              background: T.bg.deep,
              color: T.text.primary,
              fontSize: T.font.size.base,
              fontFamily: 'inherit',
              outline: 'none',
              width: '100%',
              boxSizing: 'border-box',
            }}
          />
          <div style={{ display: 'flex', gap: T.space[3], justifyContent: 'flex-end' }}>
            <button
              onClick={handleAngleCancel}
              style={{
                padding: '3px 10px',
                borderRadius: T.radius.md,
                border: `1px solid ${T.border.muted}`,
                background: 'transparent',
                color: T.text.muted,
                fontSize: T.font.size.sm,
                fontFamily: 'inherit',
                cursor: 'pointer',
              }}
            >
              Cancel
            </button>
            <button
              onClick={handleAngleConfirm}
              style={{
                padding: '3px 10px',
                borderRadius: T.radius.md,
                border: 'none',
                background: T.accent.primary,
                color: T.text.inverse,
                fontSize: T.font.size.sm,
                fontFamily: 'inherit',
                cursor: 'pointer',
              }}
            >
              Confirm
            </button>
          </div>
        </div>
      )}
    </>
  );
}

export default memo(CircuitDiagram);
