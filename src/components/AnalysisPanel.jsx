import { memo } from 'react';
import { T } from '../styles/tokens.js';
import PanelHeader from './PanelHeader.jsx';

function fmt(value, digits = 4) {
  return value == null ? 'n/a' : Number(value).toFixed(digits);
}

function Metric({ label, value }) {
  return (
    <div
      style={{
        minWidth: 112,
        border: `1px solid ${T.border.subtle}`,
        background: T.bg.panel,
        borderRadius: T.radius.md,
        padding: `${T.space[3]}px ${T.space[4]}px`,
      }}
    >
      <div style={{ fontSize: T.font.size.xs, color: T.text.dim, marginBottom: 2 }}>{label}</div>
      <div style={{ fontSize: T.font.size.lg, color: T.accent.light, fontWeight: 700 }}>{value}</div>
    </div>
  );
}

function MiniMatrix({ matrix }) {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(2, minmax(64px, 1fr))',
        gap: 2,
        fontSize: T.font.size.xs,
        color: T.text.secondary,
      }}
    >
      {matrix.flat().map(([re, im], index) => (
        <span
          key={index}
          style={{
            background: T.bg.app,
            border: `1px solid ${T.border.subtle}`,
            borderRadius: T.radius.sm,
            padding: '2px 4px',
            textAlign: 'right',
            whiteSpace: 'nowrap',
          }}
        >
          {fmt(re, 3)}
          {Math.abs(im) > 1e-8 ? `${im >= 0 ? '+' : ''}${fmt(im, 3)}i` : ''}
        </span>
      ))}
    </div>
  );
}

function AnalysisPanel({ summary, reference, onReferenceChange, actions }) {
  const headerActions = summary ? (
    <div style={{ display: 'flex', alignItems: 'center', gap: T.space[2] }}>
      <select
        aria-label="Fidelity reference state"
        value={reference}
        onChange={(event) => onReferenceChange(event.target.value)}
        style={{
          padding: '2px 7px',
          borderRadius: T.radius.lg,
          border: `1px solid ${T.border.muted}`,
          background: T.bg.panel,
          color: T.accent.soft,
          fontFamily: 'inherit',
          fontSize: T.font.size.xs,
        }}
      >
        {summary.referenceOptions.map((option) => (
          <option key={option.key} value={option.key}>
            {option.label}
          </option>
        ))}
      </select>
      {actions}
    </div>
  ) : (
    actions
  );

  if (!summary) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden', flex: 1 }}>
        <PanelHeader label="ANALYSIS LAB" actions={headerActions} />
        <div
          style={{
            color: T.text.dim,
            padding: 16,
            fontSize: T.font.size.base,
            fontStyle: 'italic',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flex: 1,
          }}
        >
          Run a single-shot simulation to inspect reduced states, entropy, fidelity, and Pauli expectations
        </div>
      </div>
    );
  }

  const expectations = summary.expectations.filter((item) => item.value != null);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden', flex: 1 }}>
      <PanelHeader label="ANALYSIS LAB" actions={headerActions} />
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: T.space[4],
          padding: T.space[4],
          overflow: 'auto',
          flex: 1,
        }}
      >
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: T.space[3] }}>
          <Metric label="Norm / Trace" value={fmt(summary.norm)} />
          <Metric label="Purity" value={fmt(summary.purity)} />
          <Metric label="Linear Entropy" value={fmt(summary.linearEntropy)} />
          <Metric label="Entropy" value={fmt(summary.entropy)} />
          {summary.fidelity && (
            <Metric label={`Fidelity ${summary.fidelity.reference}`} value={fmt(summary.fidelity.value)} />
          )}
        </div>

        <section>
          <div style={{ color: T.text.dim, fontSize: T.font.size.sm, fontWeight: 700, marginBottom: T.space[2] }}>
            REDUCED SINGLE-QUBIT STATES
          </div>
          <div
            style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))', gap: T.space[3] }}
          >
            {summary.reducedStates.map((state) => (
              <div
                key={state.qubit}
                style={{
                  border: `1px solid ${T.border.subtle}`,
                  background: T.bg.panel,
                  borderRadius: T.radius.md,
                  padding: T.space[4],
                  display: 'flex',
                  flexDirection: 'column',
                  gap: T.space[3],
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', color: T.accent.light }}>
                  <strong>q{state.qubit}</strong>
                  <span style={{ color: T.text.dim }}>
                    P0 {fmt(state.probabilities[0], 3)} / P1 {fmt(state.probabilities[1], 3)}
                  </span>
                </div>
                <MiniMatrix matrix={state.densityMatrix} />
                <div style={{ color: T.text.secondary, fontSize: T.font.size.xs, lineHeight: 1.7 }}>
                  purity {fmt(state.purity)} · entropy {fmt(state.entropy)} · Bloch ({fmt(state.bloch.x, 3)},{' '}
                  {fmt(state.bloch.y, 3)}, {fmt(state.bloch.z, 3)})
                </div>
              </div>
            ))}
          </div>
        </section>

        <section>
          <div style={{ color: T.text.dim, fontSize: T.font.size.sm, fontWeight: 700, marginBottom: T.space[2] }}>
            PAULI EXPECTATIONS
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: T.space[2] }}>
            {expectations.map(({ term, label, value }) => (
              <span
                key={term}
                style={{
                  border: `1px solid ${T.border.subtle}`,
                  background: T.bg.panel,
                  color: Math.abs(value) > 0.75 ? T.accent.light : T.text.secondary,
                  borderRadius: T.radius.pill,
                  padding: '3px 9px',
                  fontSize: T.font.size.sm,
                  whiteSpace: 'nowrap',
                }}
              >
                {label} = {fmt(value, 3)}
              </span>
            ))}
          </div>
        </section>

        {summary.entropyNote && (
          <div style={{ color: T.text.disabled, fontSize: T.font.size.xs }}>{summary.entropyNote}</div>
        )}
      </div>
    </div>
  );
}

export default memo(AnalysisPanel);
