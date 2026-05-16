import { memo } from 'react';
import { T } from '../styles/tokens.js';

/**
 * Shared panel header bar used above each IDE panel section.
 * Replaces the 3× duplicated inline style block in App.jsx.
 *
 * @param {string} label - The header label text (rendered in uppercase)
 * @param {React.ReactNode} [actions] - Optional right-side action elements
 */
function PanelHeader({ label, actions }) {
  return (
    <div
      style={{
        padding: `${T.space[3]}px ${T.space[5]}px`,
        fontSize: T.font.size.sm,
        color: T.text.dim,
        background: T.bg.header,
        borderBottom: `1px solid ${T.border.subtle}`,
        fontWeight: 600,
        letterSpacing: 0.5,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexShrink: 0,
      }}
    >
      <span>{label}</span>
      {actions && <span>{actions}</span>}
    </div>
  );
}

export default memo(PanelHeader);
