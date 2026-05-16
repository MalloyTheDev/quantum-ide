import { memo, useMemo } from 'react';
import { cabs2, cfmt } from '../engine/complex.js';
import { T } from '../styles/tokens.js';

/**
 * Displays the quantum state vector with probability bars,
 * amplitudes, and measurement results.
 */
function StateInspector({ state, nQubits, measurements, probabilities }) {
  // Noisy mode: no state vector but probabilities from density matrix diagonal
  const noisyMode = !state && probabilities != null && nQubits > 0;

  const maxProb = useMemo(() => {
    if (!state && !noisyMode) return 0.001;
    return noisyMode ? Math.max(...probabilities, 0.001) : Math.max(...state.map(cabs2), 0.001);
  }, [state, probabilities, noisyMode]);

  const stateEntries = useMemo(() => {
    if (!state && !noisyMode) return [];
    if (noisyMode) {
      return probabilities.map((prob, j) => ({
        index: j,
        label: '|' + j.toString(2).padStart(nQubits, '0') + '\u27e9',
        amplitude: null,
        probability: prob,
      }));
    }
    return state.map((amp, j) => ({
      index: j,
      label: '|' + j.toString(2).padStart(nQubits, '0') + '\u27e9',
      amplitude: amp,
      probability: cabs2(amp),
    }));
  }, [state, nQubits, probabilities, noisyMode]);

  // For large state spaces, only show non-zero entries
  const filtered = useMemo(() => {
    if (!state && !noisyMode) return [];
    const len = noisyMode ? probabilities.length : state.length;
    if (len <= 16) return stateEntries;
    const nonZero = stateEntries.filter((e) => e.probability > 1e-10);
    return nonZero.length > 0 ? nonZero : stateEntries.slice(0, 4);
  }, [stateEntries, state, probabilities, noisyMode]);

  const hiddenCount = stateEntries.length - filtered.length;

  if (!state && !noisyMode) {
    return (
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
        Run or step through a program to inspect the quantum state
      </div>
    );
  }

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 4,
        padding: '8px 12px',
        overflow: 'auto',
        flex: 1,
      }}
    >
      {/* Header */}
      <div
        style={{
          fontSize: T.font.size.sm,
          color: T.text.muted,
          fontFamily: T.font.mono,
          marginBottom: 4,
          fontWeight: 600,
          display: 'flex',
          justifyContent: 'space-between',
        }}
      >
        <span>
          {noisyMode ? 'DENSITY MATRIX (diagonal)' : 'STATE VECTOR'} -- {nQubits} qubit{nQubits > 1 ? 's' : ''},{' '}
          {1 << nQubits} {noisyMode ? 'states' : 'amplitudes'}
        </span>
        {hiddenCount > 0 && (
          <span style={{ color: T.text.disabled }}>({hiddenCount} zero-amplitude states hidden)</span>
        )}
      </div>

      {/* State entries */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 2,
          overflow: 'auto',
          flex: 1,
        }}
      >
        {filtered.map(({ index, label, amplitude, probability }) => (
          <div
            key={index}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              fontFamily: T.font.mono,
              fontSize: T.font.size.md,
            }}
          >
            {/* Basis state label */}
            <span
              style={{
                color: T.accent.light,
                width: Math.max(nQubits * 10 + 24, 44),
                flexShrink: 0,
              }}
            >
              {label}
            </span>

            {/* Probability bar */}
            <div
              style={{
                flex: 1,
                height: 14,
                background: T.bg.panel,
                borderRadius: T.radius.sm,
                overflow: 'hidden',
                position: 'relative',
                minWidth: 40,
              }}
            >
              <div
                style={{
                  width: `${(probability / maxProb) * 100}%`,
                  height: '100%',
                  borderRadius: T.radius.sm,
                  background:
                    probability > 0.5 ? T.accent.primary : probability > 0.1 ? T.accent.secondary : T.accent.dim,
                  transition: 'width 0.3s ease',
                }}
              />
            </div>

            {/* Probability percentage */}
            <span
              style={{
                color: T.accent.soft,
                width: 56,
                textAlign: 'right',
                flexShrink: 0,
                fontSize: T.font.size.sm,
              }}
            >
              {(probability * 100).toFixed(1)}%
            </span>

            {/* Complex amplitude (hidden in noisy mode) */}
            {amplitude != null && (
              <span
                style={{
                  color: T.text.dim,
                  width: 130,
                  textAlign: 'right',
                  flexShrink: 0,
                  fontSize: T.font.size.xs,
                }}
              >
                {cfmt(amplitude)}
              </span>
            )}
          </div>
        ))}
      </div>

      {/* Measurement results */}
      {measurements.length > 0 && (
        <div
          style={{
            borderTop: `1px solid ${T.border.subtle}`,
            paddingTop: 8,
            marginTop: 4,
          }}
        >
          <div
            style={{
              fontSize: T.font.size.sm,
              color: T.semantic.success,
              fontFamily: T.font.mono,
              fontWeight: 600,
              marginBottom: 4,
            }}
          >
            MEASUREMENT RESULTS
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {measurements.map((m, i) => (
              <div
                key={i}
                style={{
                  fontFamily: T.font.mono,
                  fontSize: T.font.size.md,
                  color: T.text.secondary,
                  background: T.bg.panel,
                  padding: '2px 8px',
                  borderRadius: T.radius.md,
                  border: `1px solid ${T.border.subtle}`,
                }}
              >
                q{m.qubit} &rarr;{' '}
                <span
                  style={{
                    color: m.outcome ? T.semantic.warning : T.semantic.info,
                    fontWeight: 'bold',
                  }}
                >
                  |{m.outcome}&rang;
                </span>
              </div>
            ))}
          </div>
          <div
            style={{
              marginTop: 4,
              fontSize: T.font.size.sm,
              color: T.text.dim,
              fontFamily: T.font.mono,
            }}
          >
            Collapsed state:{' '}
            <span style={{ color: T.accent.light }}>|{measurements.map((m) => m.outcome).join('')}&rang;</span>
          </div>
        </div>
      )}
    </div>
  );
}

export default memo(StateInspector);
