import { memo } from 'react';
import { T } from '../styles/tokens.js';

const MODELS = [
  { value: 'depolarizing', label: 'Depolarizing' },
  { value: 'amplitude_damping', label: 'Amplitude Damping' },
  { value: 'phase_flip', label: 'Phase Flip' },
];

function NoiseControls({ noiseConfig, onChange, shots }) {
  const locked = shots !== 1;

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: T.space[5],
        padding: `3px ${T.space[5]}px`,
        borderBottom: `1px solid ${T.border.subtle}`,
        background: T.bg.deep,
        fontSize: T.font.size.sm,
        color: T.text.muted,
        flexShrink: 0,
      }}
    >
      <label
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: T.space[2],
          cursor: locked ? 'not-allowed' : 'pointer',
          opacity: locked ? 0.5 : 1,
          userSelect: 'none',
        }}
      >
        <input
          type="checkbox"
          checked={noiseConfig.enabled && !locked}
          disabled={locked}
          onChange={(e) => onChange({ ...noiseConfig, enabled: e.target.checked })}
          style={{ accentColor: T.accent.primary, cursor: 'inherit' }}
        />
        <span>Noisy Simulation</span>
      </label>

      {noiseConfig.enabled && !locked && (
        <>
          <select
            value={noiseConfig.model}
            onChange={(e) => onChange({ ...noiseConfig, model: e.target.value })}
            style={{
              background: T.bg.panel,
              color: T.text.secondary,
              border: `1px solid ${T.border.muted}`,
              borderRadius: T.radius.md,
              padding: '1px 4px',
              fontSize: T.font.size.sm,
              fontFamily: 'inherit',
              outline: 'none',
            }}
          >
            {MODELS.map((m) => (
              <option key={m.value} value={m.value}>
                {m.label}
              </option>
            ))}
          </select>

          <label style={{ display: 'flex', alignItems: 'center', gap: T.space[2] }}>
            <span style={{ color: T.text.dim }}>Strength:</span>
            <input
              type="range"
              min={0}
              max={0.1}
              step={0.001}
              value={noiseConfig.strength}
              onChange={(e) => onChange({ ...noiseConfig, strength: parseFloat(e.target.value) })}
              style={{ width: 80, accentColor: T.accent.primary, cursor: 'pointer' }}
            />
            <span style={{ width: 36, textAlign: 'right', color: T.text.secondary, fontFamily: 'inherit' }}>
              {(noiseConfig.strength * 100).toFixed(1)}%
            </span>
          </label>
        </>
      )}

      {locked && <span style={{ color: T.text.disabled, fontSize: T.font.size.xs }}>(requires shots = 1)</span>}
    </div>
  );
}

export default memo(NoiseControls);
