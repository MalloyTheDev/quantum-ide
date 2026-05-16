/**
 * Quantum IDE - Design Tokens
 *
 * Single source of truth for all visual values.
 * Import `T` wherever you need a color, spacing, radius, or type value.
 *
 * Usage:
 *   import { T } from '../styles/tokens.js';
 *   style={{ background: T.bg.app, color: T.text.primary }}
 */

export const T = {
  // Backgrounds
  bg: {
    app: '#0f0d1a', // Root / window background
    deep: '#0d0b16', // Recessed panels (log, DSL bar)
    toolbar: '#16132a', // Top toolbar strip
    panel: '#1e1b2e', // Secondary surfaces (chips, bars, dropdowns)
    header: 'rgba(19,16,34,0.5)', // Semi-transparent panel header tint
    // Editor line highlights
    activeLine: '#1e3a5f',
    errorLine: '#3b1111',
    // SVG circuit diagram gate box fills
    gateFill: '#1e293b', // Default (inactive) gate box fill
    customGate: '#1a0f3d', // Custom gate inactive fill
    customGateActive: '#2e1065', // Custom gate active fill
  },

  // Borders
  border: {
    subtle: '#27233a', // Panel edges, dividers, scrollbar thumb
    muted: '#374151', // Ghost button borders, select boxes
    hover: '#3b3656', // Scrollbar thumb hover
  },

  // Accent (purple / indigo)
  accent: {
    primary: '#7c3aed', // Logo, Run button, high-probability bar
    secondary: '#6366f1', // Step button, selection highlight, gate strokes
    dim: '#4f46e5', // Low-probability bar, subdued indigo
    light: '#c4b5fd', // Logo text, gate keywords, basis state labels
    soft: '#a5b4fc', // Step button text, caret, measurement spans
    selection: '#6366f180', // ::selection background
    active: '#3b82f6', // Active line border, active gate box fill, active CNOT dot
    activeSoft: '#60a5fa', // Active gate stroke / line color
    activeNum: '#93c5fd', // Active line number
  },

  // Text
  text: {
    primary: '#e2e8f0', // Main readable text
    secondary: '#d1d5db', // Slightly dimmer text (step log entries)
    muted: '#9ca3af', // Tertiary labels, ghost button color
    dim: '#6b7280', // Panel section labels, placeholder-level
    disabled: '#4b5563', // Very faded (wire strokes, numeric hints)
    inverse: '#ffffff', // On-color text (primary button)
  },

  // Semantic
  semantic: {
    success: '#10b981', // ✓ log, measurement result header, measure gate stroke
    successLight: '#34d399', // Lighter emerald for active measure gate stroke
    successDark: '#065f46', // Active measure gate fill
    warning: '#f59e0b', // Amber: qubits keyword, ⏩ step, |1⟩ outcome
    error: '#ef4444', // Error log lines
    errorDark: '#7f1d1d', // Error icon color
    info: '#3b82f6', // |0⟩ outcome, active line left-border
  },

  // Typography
  font: {
    // Use 'inherit' in components so the root font-stack propagates correctly.
    // Only set this explicitly at the root (App / index.css).
    mono: "'JetBrains Mono', 'Fira Code', 'Cascadia Code', Menlo, Monaco, 'Courier New', monospace",
    size: {
      xs: 10,
      sm: 11,
      md: 12,
      base: 13,
      lg: 14,
    },
    lineHeight: {
      code: '21px',
    },
  },

  // Spacing
  space: {
    1: 2,
    2: 4,
    3: 6,
    4: 8,
    5: 12,
    6: 16,
  },

  // Border radius
  radius: {
    sm: 2,
    md: 3,
    lg: 4,
    pill: 10,
  },
};
