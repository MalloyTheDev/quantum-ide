import { memo } from 'react';
import { T } from '../styles/tokens.js';

/**
 * Compact DSL reference bar shown at the bottom of the IDE.
 */
function DSLReference() {
  return (
    <div
      style={{
        borderTop: `1px solid ${T.border.subtle}`,
        padding: `${T.space[3]}px ${T.space[5]}px`,
        fontSize: T.font.size.xs,
        color: T.text.disabled,
        background: T.bg.deep,
        lineHeight: 1.8,
        fontFamily: T.font.mono,
      }}
    >
      <span style={{ color: T.text.dim, fontWeight: 600 }}>DSL Reference:</span>{' '}
      <span style={{ color: T.semantic.warning }}>qubits</span> N{' \u00b7 '}
      <span style={{ color: T.accent.light }}>h x y z s t sdg tdg</span> Q{' \u00b7 '}
      <span style={{ color: T.accent.light }}>cx cz cs ct</span> C T{' \u00b7 '}
      <span style={{ color: T.accent.light }}>ccx</span> C1 C2 T{' \u00b7 '}
      <span style={{ color: T.accent.light }}>cswap</span> C T1 T2{' \u00b7 '}
      <span style={{ color: T.accent.light }}>swap</span> A B{' \u00b7 '}
      <span style={{ color: T.accent.light }}>rx ry rz u1</span> &theta; Q{' \u00b7 '}
      <span style={{ color: T.semantic.success }}>measure</span> Q | all{' \u00b7 '}
      <span style={{ color: T.semantic.success }}>if m[Q] == 1:</span> GATE{' \u00b7 '}
      <span style={{ color: T.text.dim }}># comment</span>
      {' \u00b7 '}
      <span style={{ color: T.accent.secondary }}>gate</span>{' '}
      <span style={{ color: T.accent.primary }}>Name(p0,p1): \u2026 end</span>
      {' \u00b7 '}
      <span style={{ color: T.text.disabled }}>Angles: pi, pi/2, pi/4, or numeric</span>
      <br />
      <span style={{ color: T.text.dim, fontWeight: 600 }}>Shortcuts:</span>{' '}
      <span style={{ color: T.border.muted }}>Ctrl+Enter</span>
      {' Run \u00b7 '}
      <span style={{ color: T.border.muted }}>Ctrl+Shift+Enter</span>
      {' Step \u00b7 '}
      <span style={{ color: T.border.muted }}>Ctrl+R</span>
      {' Reset \u00b7 '}
      <span style={{ color: T.border.muted }}>Ctrl+Z</span>
      {' Undo \u00b7 '}
      <span style={{ color: T.border.muted }}>Ctrl+Shift+Z</span>
      {' / '}
      <span style={{ color: T.border.muted }}>Ctrl+Y</span>
      {' Redo \u00b7 '}
      <span style={{ color: T.border.muted }}>Ctrl+/</span>
      {' Comment \u00b7 '}
      <span style={{ color: T.border.muted }}>Ctrl+K</span>
      {' Commands \u00b7 '}
      <span style={{ color: T.border.muted }}>Tab</span>
      {' \u21922sp \u00b7 '}
      <span style={{ color: T.border.muted }}>Esc</span>
      {' Blur'}
    </div>
  );
}

export default memo(DSLReference);
