import { Command } from 'cmdk';
import { T } from '../styles/tokens.js';

const commands = [
  { label: 'New Program', value: 'new' },
  { label: 'Open File', value: 'open' },
  { label: 'Save File', value: 'save' },
  { label: 'Save As', value: 'save-as' },
  { label: 'Run Program', value: 'run' },
  { label: 'Step One Gate', value: 'step' },
  { label: 'Reset Simulation', value: 'reset' },
  { label: 'Import OpenQASM', value: 'import-qasm' },
  { label: 'Export OpenQASM', value: 'export-qasm' },
];

export default function CommandPalette({ open, onOpenChange, actions }) {
  if (!open) return null;

  const runCommand = (value) => {
    onOpenChange(false);
    actions[value]?.();
  };

  return (
    <div
      role="presentation"
      onMouseDown={() => onOpenChange(false)}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 500,
        background: 'rgba(0,0,0,0.42)',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'flex-start',
        paddingTop: 90,
      }}
    >
      <Command
        label="Command palette"
        onMouseDown={(e) => e.stopPropagation()}
        style={{
          width: 'min(520px, calc(100vw - 32px))',
          background: T.bg.panel,
          border: `1px solid ${T.accent.secondary}`,
          borderRadius: T.radius.lg,
          boxShadow: '0 18px 50px rgba(0,0,0,0.55)',
          overflow: 'hidden',
          fontFamily: T.font.mono,
        }}
      >
        <Command.Input
          autoFocus
          placeholder="Type a command..."
          style={{
            width: '100%',
            border: 'none',
            outline: 'none',
            padding: '12px 14px',
            background: T.bg.deep,
            color: T.text.primary,
            fontFamily: 'inherit',
            fontSize: T.font.size.base,
          }}
        />
        <Command.List style={{ maxHeight: 320, overflowY: 'auto', padding: 6 }}>
          <Command.Empty style={{ padding: 12, color: T.text.dim, fontSize: T.font.size.sm }}>
            No command found.
          </Command.Empty>
          {commands.map((command) => (
            <Command.Item
              key={command.value}
              value={command.label}
              onSelect={() => runCommand(command.value)}
              style={{
                padding: '8px 10px',
                borderRadius: T.radius.md,
                color: T.text.secondary,
                cursor: 'pointer',
                fontSize: T.font.size.sm,
              }}
            >
              {command.label}
            </Command.Item>
          ))}
        </Command.List>
      </Command>
    </div>
  );
}
