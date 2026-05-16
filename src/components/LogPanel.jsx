import { memo, useEffect, useRef } from 'react';
import { T } from '../styles/tokens.js';

/**
 * Scrollable log panel that shows execution output, errors, and step info.
 * Auto-scrolls to the bottom when new entries are added.
 */
function LogPanel({ errors, log }) {
  const scrollRef = useRef(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [log, errors]);

  const hasContent = errors.length > 0 || log.length > 0;

  return (
    <div
      ref={scrollRef}
      style={{
        height: 80,
        borderTop: `1px solid ${T.border.subtle}`,
        overflow: 'auto',
        padding: '4px 12px',
        fontSize: T.font.size.sm,
        fontFamily: T.font.mono,
        background: T.bg.deep,
      }}
    >
      {!hasContent && (
        <div style={{ color: T.text.disabled, fontStyle: 'italic' }}>
          Output log -- run or step to see execution trace
        </div>
      )}

      {errors.map((e, i) => (
        <div key={`err-${i}`} style={{ color: T.semantic.error }}>
          <span style={{ color: T.semantic.errorDark }}>&#x2717;</span> Line {e.line + 1}: {e.msg}
        </div>
      ))}

      {log.map((entry, i) => {
        let color = T.text.muted;
        if (entry.startsWith('✓')) color = T.semantic.success;
        else if (entry.startsWith('▶')) color = T.accent.soft;
        else if (entry.startsWith('⏩')) color = T.semantic.warning;
        else if (entry.startsWith('Step')) color = T.text.secondary;

        return (
          <div key={`log-${i}`} style={{ color }}>
            {entry}
          </div>
        );
      })}
    </div>
  );
}

export default memo(LogPanel);
