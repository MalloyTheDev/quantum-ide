/**
 * OpenQASM 2.0 Import / Export
 *
 * exportToQASM — converts parsed DSL instructions -> valid QASM string
 * importFromQASM — converts QASM string -> DSL source text
 *
 * CS (controlled-S) and CT (controlled-T) are not in the standard qelib1.inc
 * gate set, so they are exported as equivalent gate sequences using only
 * standard gates (T, TDG, CX, U1).
 *
 * On import, gate definition blocks are reconstructed as DSL custom gates
 * where the body uses only known operations.
 */

const PI = Math.PI;

// Map numeric angle -> symbolic string for clean QASM output
const ANGLE_SYMS = [
  [2 * PI,    '2*pi'],
  [-2 * PI,   '-2*pi'],
  [PI,        'pi'],
  [-PI,       '-pi'],
  [PI / 2,    'pi/2'],
  [-PI / 2,   '-pi/2'],
  [PI / 3,    'pi/3'],
  [-PI / 3,   '-pi/3'],
  [PI / 4,    'pi/4'],
  [-PI / 4,   '-pi/4'],
  [PI / 6,    'pi/6'],
  [-PI / 6,   '-pi/6'],
  [PI / 8,    'pi/8'],
  [-PI / 8,   '-pi/8'],
];

function angleToStr(angle) {
  for (const [val, sym] of ANGLE_SYMS) {
    if (Math.abs(angle - val) < 1e-10) return sym;
  }
  return String(angle);
}

// Single-qubit DSL gate name -> QASM gate name (identical in this set)
const GATE_TO_QASM = { h: 'h', x: 'x', y: 'y', z: 'z', s: 's', t: 't', sdg: 'sdg', tdg: 'tdg', id: 'id' };

/**
 * Emit one instruction as a QASM line (or several, for measure_all / custom_gate).
 * Returns a string (may contain newlines) or null to skip.
 */
function emitInstruction(inst, nQubits, customGates, qubitOf) {
  const q = qubitOf || (i => i);

  switch (inst.type) {
    case 'qubits':
      return null;

    case 'gate': {
      const name = GATE_TO_QASM[inst.gate];
      if (name) return `${name} q[${q(inst.qubits[0])}];`;
      return `// unsupported: ${inst.gate} q[${q(inst.qubits[0])}]`;
    }

    case 'rotation':
      return `${inst.gate}(${angleToStr(inst.angle)}) q[${q(inst.qubits[0])}];`;

    case 'cx':
      return `cx q[${q(inst.qubits[0])}],q[${q(inst.qubits[1])}];`;

    case 'cz':
      return `cz q[${q(inst.qubits[0])}],q[${q(inst.qubits[1])}];`;

    case 'cs': {
      // CS (controlled-S) = diag(1,1,1,i). Decomposed into standard qelib1.inc gates:
      //   t q[c]; cx q[c],q[t]; tdg q[t]; cx q[c],q[t]; t q[t];
      const c = q(inst.qubits[0]);
      const t = q(inst.qubits[1]);
      return [
        `t q[${c}];`,
        `cx q[${c}],q[${t}];`,
        `tdg q[${t}];`,
        `cx q[${c}],q[${t}];`,
        `t q[${t}];`,
      ].join('\n');
    }

    case 'ct': {
      // CT (controlled-T) = diag(1,1,1,e^{i*pi/4}). Decomposed using u1 (in qelib1.inc):
      //   u1(pi/8) q[c]; cx q[c],q[t]; u1(-pi/8) q[t]; cx q[c],q[t]; u1(pi/8) q[t];
      const c = q(inst.qubits[0]);
      const t = q(inst.qubits[1]);
      return [
        `u1(pi/8) q[${c}];`,
        `cx q[${c}],q[${t}];`,
        `u1(-pi/8) q[${t}];`,
        `cx q[${c}],q[${t}];`,
        `u1(pi/8) q[${t}];`,
      ].join('\n');
    }

    case 'swap':
      return `swap q[${q(inst.qubits[0])}],q[${q(inst.qubits[1])}];`;

    case 'ccx':
      return `ccx q[${q(inst.qubits[0])}],q[${q(inst.qubits[1])}],q[${q(inst.qubits[2])}];`;

    case 'cswap':
      return `cswap q[${q(inst.qubits[0])}],q[${q(inst.qubits[1])}],q[${q(inst.qubits[2])}];`;

    case 'measure':
      return `measure q[${q(inst.qubits[0])}] -> c[${q(inst.qubits[0])}];`;

    case 'measure_all': {
      const rows = [];
      for (let i = 0; i < nQubits; i++) rows.push(`measure q[${i}] -> c[${i}];`);
      return rows.join('\n');
    }

    case 'barrier':
      return 'barrier q;';

    case 'custom_gate': {
      const def = customGates[inst.name];
      if (!def) return `// unsupported: ${inst.name}`;
      const expanded = [];
      for (const bodyInst of def.body) {
        const remapped = {
          ...bodyInst,
          qubits: bodyInst.qubits?.map(localIdx => inst.qubits[localIdx]),
        };
        const line = emitInstruction(remapped, nQubits, customGates, q);
        if (line !== null) expanded.push(line);
      }
      return expanded.join('\n') || null;
    }

    default:
      return `// unsupported: ${inst.type}`;
  }
}

/**
 * Convert DSL instructions to an OpenQASM 2.0 string.
 *
 * @param {Array}  instructions  - Parsed instruction list from parser.js
 * @param {number} nQubits       - Number of qubits
 * @param {Object} customGates   - Custom gate definitions (for inline expansion)
 * @returns {string} Valid OpenQASM 2.0 source
 */
export function exportToQASM(instructions, nQubits, customGates = {}) {
  const lines = [
    'OPENQASM 2.0;',
    'include "qelib1.inc";',
    '',
    `qreg q[${nQubits}];`,
    `creg c[${nQubits}];`,
    '',
  ];

  for (const inst of instructions) {
    const out = emitInstruction(inst, nQubits, customGates, null);
    if (out !== null) lines.push(out);
  }

  return lines.join('\n');
}

// QASM gate name -> DSL instruction type / gate name
const QASM_SINGLE = new Set(['h', 'x', 'y', 'z', 's', 't', 'sdg', 'tdg', 'id']);
const QASM_ROT    = new Set(['rx', 'ry', 'rz']);
const QASM_TWO    = new Set(['cx', 'cz', 'swap']);
const QASM_THREE  = new Set(['ccx', 'cswap']);

/**
 * Try to convert a single line from a QASM gate body to a DSL gate-body instruction.
 *
 * QASM gate bodies use local parameter names (e.g. "h q0; cx q0,q1;").
 * The DSL gate body also uses the same parameter names (e.g. "h q0", "cx q0 q1").
 * We verify each name is in the params list and emit it unchanged.
 *
 * Returns a DSL string on success, or null if the operation is not recognised.
 */
function tryConvertBodyLine(line, params) {
  const stripped = line.replace(/;$/, '').trim();
  if (!stripped || stripped.startsWith('//')) return null;

  // Rotation: rx(angle) q0
  const rotM = stripped.match(/^(rx|ry|rz)\(([^)]+)\)\s+(\w+)$/);
  if (rotM) {
    const pName = rotM[3].toLowerCase();
    if (!params.includes(pName)) return null;
    return `${rotM[1]} ${rotM[2].trim()} ${pName}`;
  }

  // Single-qubit: h q0
  const sqM = stripped.match(/^(\w+)\s+(\w+)$/);
  if (sqM && QASM_SINGLE.has(sqM[1].toLowerCase())) {
    const pName = sqM[2].toLowerCase();
    if (!params.includes(pName)) return null;
    return `${sqM[1].toLowerCase()} ${pName}`;
  }

  // Two-qubit: cx q0,q1
  const tqM = stripped.match(/^(\w+)\s+(\w+)\s*,\s*(\w+)$/);
  if (tqM && QASM_TWO.has(tqM[1].toLowerCase())) {
    const p1 = tqM[2].toLowerCase();
    const p2 = tqM[3].toLowerCase();
    if (!params.includes(p1) || !params.includes(p2)) return null;
    return `${tqM[1].toLowerCase()} ${p1} ${p2}`;
  }

  // Three-qubit: ccx q0,q1,q2
  const thM = stripped.match(/^(\w+)\s+(\w+)\s*,\s*(\w+)\s*,\s*(\w+)$/);
  if (thM && QASM_THREE.has(thM[1].toLowerCase())) {
    const p1 = thM[2].toLowerCase();
    const p2 = thM[3].toLowerCase();
    const p3 = thM[4].toLowerCase();
    if (!params.includes(p1) || !params.includes(p2) || !params.includes(p3)) return null;
    return `${thM[1].toLowerCase()} ${p1} ${p2} ${p3}`;
  }

  return null;
}

/**
 * Convert an OpenQASM 2.0 string back to DSL source text.
 *
 * Gate definition blocks are reconstructed as DSL custom gates when the
 * body uses only operations that the DSL supports. Unsupported gate
 * definitions are silently skipped (they won't be callable in the DSL).
 *
 * @param {string} qasmString - OpenQASM 2.0 source
 * @returns {string} DSL source text suitable for the code editor
 */
export function importFromQASM(qasmString) {
  const dsl = [];
  const definedGates = new Set(); // gate names defined in this QASM file
  const qasmLines = qasmString.split('\n');
  let i = 0;

  while (i < qasmLines.length) {
    const rawLine = qasmLines[i];
    i++;

    const line = rawLine.trim();
    if (!line || line.startsWith('//') || line.startsWith('/*')) continue;

    const raw = line.replace(/;$/, '').trim();

    if (raw.startsWith('OPENQASM')) continue;
    if (raw.startsWith('include'))  continue;
    if (raw.startsWith('creg'))     continue;

    // Gate definition blocks — try to reconstruct as DSL custom gates
    if (/^gate\b/.test(raw)) {
      // Parse: gate Name[(classical_params)] q0, q1, ... { body }
      const headerM = raw.match(/^gate\s+(\w+)\s*(?:\([^)]*\))?\s+([^{]+?)\s*(?:\{(.*))?$/);
      if (headerM) {
        const gName    = headerM[1].toLowerCase();
        const qParams  = headerM[2].trim().split(/[\s,]+/).filter(Boolean).map(s => s.toLowerCase());
        const inlineBody = (headerM[3] || '').trim();

        // Collect body lines until the matching closing brace
        let depth = (raw.match(/\{/g) || []).length - (raw.match(/\}/g) || []).length;
        const bodyLines = [];

        if (inlineBody && inlineBody !== '}') bodyLines.push(inlineBody);

        while (depth > 0 && i < qasmLines.length) {
          const bl = qasmLines[i].trim();
          i++;
          depth += (bl.match(/\{/g) || []).length;
          depth -= (bl.match(/\}/g) || []).length;
          const blStripped = bl.replace(/;$/, '').trim();
          if (blStripped && blStripped !== '{' && blStripped !== '}' && !blStripped.startsWith('//')) {
            bodyLines.push(bl);
          }
        }

        // Attempt to convert each body line to DSL
        const dslBody = [];
        let canConvert = true;
        for (const bl of bodyLines) {
          const dslLine = tryConvertBodyLine(bl, qParams);
          if (dslLine !== null) {
            dslBody.push('  ' + dslLine);
          } else {
            canConvert = false;
            break;
          }
        }

        if (canConvert && dslBody.length > 0) {
          dsl.push(`gate ${gName}(${qParams.join(', ')}):`)
          dsl.push(...dslBody);
          dsl.push('end');
          definedGates.add(gName);
        }
      } else {
        // Can't parse the gate header — skip the block
        let depth = (raw.match(/\{/g) || []).length - (raw.match(/\}/g) || []).length;
        while (depth > 0 && i < qasmLines.length) {
          const bl = qasmLines[i].trim();
          i++;
          depth += (bl.match(/\{/g) || []).length;
          depth -= (bl.match(/\}/g) || []).length;
        }
      }
      continue;
    }

    // qreg q[N] -> qubits N
    const qregM = raw.match(/^qreg\s+\w+\[(\d+)\]/);
    if (qregM) { dsl.push(`qubits ${qregM[1]}`); continue; }

    // measure q[x] -> c[y] -> measure x
    const measM = raw.match(/^measure\s+\w+\[(\d+)\]\s*->\s*\w+\[(\d+)\]/);
    if (measM) { dsl.push(`measure ${measM[1]}`); continue; }

    // barrier (any form) -> barrier
    if (/^barrier\b/.test(raw)) { dsl.push('barrier'); continue; }

    // Rotation gates: rx(angle) q[x]
    const rotM = raw.match(/^(rx|ry|rz)\(([^)]+)\)\s+\w+\[(\d+)\]/);
    if (rotM) {
      const angleStr = rotM[2].trim().toLowerCase();
      dsl.push(`${rotM[1]} ${angleStr} ${rotM[3]}`);
      continue;
    }

    // Single-qubit gates: h q[x]
    const sq = raw.match(/^(\w+)\s+\w+\[(\d+)\]$/);
    if (sq && QASM_SINGLE.has(sq[1].toLowerCase())) {
      dsl.push(`${sq[1].toLowerCase()} ${sq[2]}`);
      continue;
    }

    // Two-qubit gates: cx q[x],q[y]
    const twoM = raw.match(/^(\w+)\s+\w+\[(\d+)\]\s*,\s*\w+\[(\d+)\]$/);
    if (twoM && QASM_TWO.has(twoM[1].toLowerCase())) {
      dsl.push(`${twoM[1].toLowerCase()} ${twoM[2]} ${twoM[3]}`);
      continue;
    }

    // Three-qubit gates: ccx q[x],q[y],q[z]
    const threeM = raw.match(/^(\w+)\s+\w+\[(\d+)\]\s*,\s*\w+\[(\d+)\]\s*,\s*\w+\[(\d+)\]$/);
    if (threeM && QASM_THREE.has(threeM[1].toLowerCase())) {
      dsl.push(`${threeM[1].toLowerCase()} ${threeM[2]} ${threeM[3]} ${threeM[4]}`);
      continue;
    }

    // Custom gate calls (gates defined earlier in this file)
    if (raw) {
      const callM = raw.match(/^(\w+)\s+([\w\[\],\s]+)$/);
      if (callM && definedGates.has(callM[1].toLowerCase())) {
        const gName = callM[1].toLowerCase();
        const args = [...raw.matchAll(/\[(\d+)\]/g)].map(m => m[1]);
        if (args.length > 0) {
          dsl.push(`${gName} ${args.join(' ')}`);
          continue;
        }
      }
    }

    // Unknown non-empty line
    if (raw) dsl.push(`# unsupported: ${raw}`);
  }

  return dsl.join('\n');
}
