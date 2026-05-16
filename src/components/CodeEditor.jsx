import { useMemo } from 'react';
import CodeMirror from '@uiw/react-codemirror';
import { EditorView, Decoration, keymap } from '@codemirror/view';
import { RangeSetBuilder } from '@codemirror/state';
import { autocompletion } from '@codemirror/autocomplete';
import { StreamLanguage, foldService, syntaxHighlighting, HighlightStyle } from '@codemirror/language';
import { linter, lintGutter } from '@codemirror/lint';
import { searchKeymap } from '@codemirror/search';
import { tags as tag } from '@lezer/highlight';
import { T } from '../styles/tokens.js';

const KEYWORDS = ['qubits', 'qreg', 'measure', 'm', 'barrier', 'gate', 'end', 'if'];

const GATES = [
  'h',
  'x',
  'y',
  'z',
  's',
  't',
  'sdg',
  'tdg',
  'id',
  'cx',
  'cnot',
  'cz',
  'cs',
  'ct',
  'swap',
  'ccx',
  'toffoli',
  'cswap',
  'rx',
  'ry',
  'rz',
  'u1',
];

const COMPLETIONS = [
  ...KEYWORDS.map((label) => ({ label, type: 'keyword' })),
  ...GATES.map((label) => ({ label, type: 'function' })),
  { label: 'measure all', type: 'keyword', apply: 'measure all' },
  { label: 'if m[0] == 1: x 1', type: 'snippet', apply: 'if m[0] == 1: x 1' },
  { label: 'gate Bell(a, b):', type: 'snippet', apply: 'gate Bell(a, b):\n  h a\n  cx a b\nend' },
];

const dslLanguage = StreamLanguage.define({
  name: 'quantum-assembly',
  token(stream) {
    if (stream.eatSpace()) return null;
    if (stream.match(/#.*/)) return 'comment';
    if (stream.match(/\/\/.*/)) return 'comment';
    if (stream.match(/"(?:[^"\\]|\\.)*"/)) return 'string';
    if (stream.match(/-?(?:\d+(?:\.\d+)?|(?:\d+\*)?pi(?:\/\d+)?)/i)) return 'number';
    if (stream.match(/\b(?:qubits|qreg|measure|m|barrier|gate|end|if)\b/i)) return 'keyword';
    if (stream.match(/\b(?:h|x|y|z|s|t|sdg|tdg|id|cx|cnot|cz|cs|ct|swap|ccx|toffoli|cswap|rx|ry|rz|u1)\b/i))
      return 'atom';
    if (stream.match(/\bm\[\d+\]/i)) return 'variableName';
    stream.next();
    return null;
  },
});

const dslLanguageData = dslLanguage.data.of({
  commentTokens: { line: '#' },
});

const dslHighlight = HighlightStyle.define([
  { tag: tag.keyword, color: T.semantic.warning, fontWeight: '700' },
  { tag: tag.atom, color: T.accent.light, fontWeight: '700' },
  { tag: tag.number, color: T.accent.soft },
  { tag: tag.comment, color: T.text.dim, fontStyle: 'italic' },
  { tag: tag.string, color: T.semantic.successLight },
  { tag: tag.variableName, color: T.accent.activeNum },
]);

const editorTheme = EditorView.theme({
  '&': {
    height: '100%',
    backgroundColor: T.bg.deep,
    color: T.text.primary,
    fontSize: `${T.font.size.base}px`,
  },
  '.cm-scroller': {
    fontFamily: T.font.mono,
    lineHeight: T.font.lineHeight.code,
  },
  '.cm-content': {
    caretColor: T.accent.soft,
    padding: '4px 0',
  },
  '.cm-gutters': {
    backgroundColor: T.bg.deep,
    color: T.text.disabled,
    borderRight: `1px solid ${T.border.subtle}`,
  },
  '.cm-activeLineGutter': {
    color: T.accent.activeNum,
    backgroundColor: T.bg.activeLine,
  },
  '.cm-activeLine': {
    backgroundColor: 'rgba(30, 58, 95, 0.45)',
  },
  '.cm-activeStepLine': {
    backgroundColor: `${T.bg.activeLine} !important`,
    borderLeft: `3px solid ${T.semantic.info}`,
  },
  '.cm-errorLine': {
    backgroundColor: `${T.bg.errorLine} !important`,
    borderLeft: `3px solid ${T.semantic.error}`,
  },
  '.cm-selectionBackground, &.cm-focused .cm-selectionBackground': {
    backgroundColor: `${T.accent.selection} !important`,
  },
  '.cm-tooltip': {
    backgroundColor: T.bg.panel,
    border: `1px solid ${T.border.muted}`,
    color: T.text.primary,
  },
  '.cm-diagnostic': {
    fontFamily: T.font.mono,
  },
});

function dslCompletions(context) {
  const word = context.matchBefore(/[\w.[\]=:]*/);
  if (!word || (word.from === word.to && !context.explicit)) return null;
  return {
    from: word.from,
    options: COMPLETIONS,
  };
}

function diagnosticsExtension(errors) {
  return linter((view) => {
    return errors.map((error) => {
      const lineNumber = Math.max(1, Math.min(view.state.doc.lines, error.line + 1));
      const line = view.state.doc.line(lineNumber);
      return {
        from: line.from,
        to: line.to,
        severity: 'error',
        message: error.msg,
      };
    });
  });
}

function lineDecorations(activeLine, errorLines) {
  return EditorView.decorations.compute([], (state) => {
    const builder = new RangeSetBuilder();
    const errorSet = new Set(errorLines ?? []);

    for (const lineIndex of errorSet) {
      if (lineIndex < 0 || lineIndex >= state.doc.lines) continue;
      const line = state.doc.line(lineIndex + 1);
      builder.add(line.from, line.from, Decoration.line({ class: 'cm-errorLine' }));
    }

    if (activeLine !== null && activeLine !== undefined && activeLine >= 0 && activeLine < state.doc.lines) {
      const line = state.doc.line(activeLine + 1);
      builder.add(line.from, line.from, Decoration.line({ class: 'cm-activeStepLine' }));
    }

    return builder.finish();
  });
}

const gateFoldService = foldService.of((state, lineStart) => {
  const startLine = state.doc.lineAt(lineStart);
  if (!/^\s*gate\b.*:\s*$/i.test(startLine.text)) return null;

  for (let lineNo = startLine.number + 1; lineNo <= state.doc.lines; lineNo++) {
    const line = state.doc.line(lineNo);
    if (/^\s*end\s*$/i.test(line.text)) {
      return { from: startLine.to, to: line.from };
    }
  }

  return null;
});

export default function CodeEditor({ code, onChange, activeLine, errorLines, errors = [] }) {
  const extensions = useMemo(
    () => [
      dslLanguage,
      dslLanguageData,
      syntaxHighlighting(dslHighlight),
      editorTheme,
      autocompletion({ override: [dslCompletions] }),
      diagnosticsExtension(errors),
      lintGutter(),
      lineDecorations(activeLine, errorLines),
      gateFoldService,
      keymap.of(searchKeymap),
    ],
    [activeLine, errorLines, errors]
  );

  return (
    <div style={{ flex: 1, minHeight: 0 }}>
      <CodeMirror
        value={code}
        height="100%"
        basicSetup={{
          lineNumbers: true,
          foldGutter: true,
          highlightActiveLine: true,
          highlightActiveLineGutter: true,
          searchKeymap: true,
          autocompletion: true,
          bracketMatching: true,
          closeBrackets: true,
        }}
        extensions={extensions}
        onChange={onChange}
        theme="dark"
      />
    </div>
  );
}
