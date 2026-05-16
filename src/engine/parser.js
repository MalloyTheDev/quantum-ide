/**
 * Quantum Assembly DSL Parser
 *
 * Parses a simple line-based quantum assembly language into an array
 * of instruction objects that the simulator can execute.
 *
 * ─── Syntax ───────────────────────────────────────────
 *
 *   qubits N          Allocate N qubits (1-16). Auto-inferred if omitted.
 *                     Memory note: statevector uses 2^n complex values (~1 MB at n=16).
 *                     Density matrix (noisy mode) uses 2^n x 2^n values (~256 MB at n=12);
 *                     keep n <= 12 for noisy simulation.
 *   h Q               Hadamard on qubit Q
 *   x Q               Pauli-X (NOT) on qubit Q
 *   y Q               Pauli-Y on qubit Q
 *   z Q               Pauli-Z on qubit Q
 *   s Q               S gate (π/2 phase) on qubit Q
 *   t Q               T gate (π/4 phase) on qubit Q
 *   sdg Q             S-dagger on qubit Q
 *   tdg Q             T-dagger on qubit Q
 *   cx C T            CNOT with control C, target T
 *   cnot C T          Alias for cx
 *   cz C T            Controlled-Z (dot-dot)
 *   cs C T            Controlled-S
 *   ct C T            Controlled-T
 *   swap A B          SWAP qubits A and B
 *   ccx C1 C2 T       Toffoli (double-controlled X)
 *   toffoli C1 C2 T   Alias for ccx
 *   cswap C T1 T2     Fredkin (controlled SWAP)
 *   rx ANGLE Q        RX rotation on qubit Q
 *   ry ANGLE Q        RY rotation on qubit Q
 *   rz ANGLE Q        RZ rotation on qubit Q
 *   u1 ANGLE Q        OpenQASM phase rotation on qubit Q
 *   measure Q         Measure qubit Q
 *   measure all       Measure all qubits
 *   if m[Q] == 1: x T Conditional gate using last measurement of qubit Q
 *   barrier           Visual separator (no-op)
 *   # comment         Line comment
 *   // comment        Line comment (alt syntax)
 *
 *   gate Name(p0, p1):    Define a reusable custom gate
 *     H p0
 *     CNOT p0 p1
 *   end
 *
 *   Name A B          Call a custom gate with actual qubit indices
 *
 * Angles: numeric literals, or symbolic: pi, pi/2, pi/4, -pi, -pi/2, -pi/4
 *
 * ─── Output ──────────────────────────────────────────
 *
 *   { instructions: Array, nQubits: number, errors: Array, customGates: Object }
 */

const SINGLE_GATES = new Set(['h', 'x', 'y', 'z', 's', 't', 'sdg', 'tdg', 'id']);

const ROTATION_NAMES = new Set(['rx', 'ry', 'rz', 'u1']);

/**
 * Parse an angle string into a numeric value.
 * Supports: pi, pi/2, pi/4, pi/8, -pi, -pi/2, numeric literals, 2*pi, etc.
 */

function stripInlineComment(line) {
  const hashIdx = line.indexOf('#');
  const slashIdx = line.indexOf('//');
  const indices = [hashIdx, slashIdx].filter((idx) => idx !== -1);
  if (indices.length === 0) return line;
  return line.slice(0, Math.min(...indices));
}

function expectArgCount(parts, expected, line, errors, label) {
  const actual = parts.length - 1;
  if (actual !== expected) {
    const noun = expected === 1 ? 'argument' : 'arguments';
    errors.push({ line, msg: `${label} expects ${expected} ${noun}, got ${actual}` });
    return false;
  }
  return true;
}

function hasDuplicateQubits(qubits) {
  return new Set(qubits).size !== qubits.length;
}

function parseAngle(str) {
  if (!str) return NaN;

  const cleaned = str.replace(/[()]/g, '').trim().toLowerCase();

  // Symbolic angles
  const symbolics = {
    pi: Math.PI,
    '-pi': -Math.PI,
    'pi/2': Math.PI / 2,
    '-pi/2': -Math.PI / 2,
    'pi/4': Math.PI / 4,
    '-pi/4': -Math.PI / 4,
    'pi/8': Math.PI / 8,
    '-pi/8': -Math.PI / 8,
    '2*pi': 2 * Math.PI,
    '2pi': 2 * Math.PI,
    '-2*pi': -2 * Math.PI,
    'pi/3': Math.PI / 3,
    '-pi/3': -Math.PI / 3,
    'pi/6': Math.PI / 6,
    '-pi/6': -Math.PI / 6,
  };

  if (symbolics[cleaned] !== undefined) return symbolics[cleaned];

  // Try numeric
  const num = parseFloat(cleaned);
  return num;
}

/**
 * Parse one instruction from a custom gate body.
 * Parameter names in `params` map to local qubit indices (0-based position).
 * Returns an instruction object, or null on failure.
 */
function parseGateBodyLine(raw, params, lineNum, customGates = {}) {
  const parts = raw.split(/\s+/);
  const op = parts[0];

  // Resolve a parameter name to its index in the params list
  const resolve = (str) => {
    if (!str) return -1;
    return params.indexOf(str.toLowerCase());
  };

  if (SINGLE_GATES.has(op)) {
    const q = resolve(parts[1]);
    if (q < 0) return null;
    return { type: 'gate', gate: op, qubits: [q], line: lineNum };
  }

  if (ROTATION_NAMES.has(op)) {
    const angle = parseAngle(parts[1]);
    const q = resolve(parts[2]);
    if (isNaN(angle) || q < 0) return null;
    return { type: 'rotation', gate: op, angle, qubits: [q], line: lineNum };
  }

  if (op === 'cx' || op === 'cnot') {
    const c = resolve(parts[1]),
      t = resolve(parts[2]);
    if (c < 0 || t < 0) return null;
    return { type: 'cx', qubits: [c, t], line: lineNum };
  }

  if (op === 'cz') {
    const c = resolve(parts[1]),
      t = resolve(parts[2]);
    if (c < 0 || t < 0) return null;
    return { type: 'cz', qubits: [c, t], line: lineNum };
  }

  if (op === 'cs') {
    const c = resolve(parts[1]),
      t = resolve(parts[2]);
    if (c < 0 || t < 0) return null;
    return { type: 'cs', qubits: [c, t], line: lineNum };
  }

  if (op === 'ct') {
    const c = resolve(parts[1]),
      t = resolve(parts[2]);
    if (c < 0 || t < 0) return null;
    return { type: 'ct', qubits: [c, t], line: lineNum };
  }

  if (op === 'swap') {
    const a = resolve(parts[1]),
      b = resolve(parts[2]);
    if (a < 0 || b < 0) return null;
    return { type: 'swap', qubits: [a, b], line: lineNum };
  }

  if (op === 'ccx' || op === 'toffoli') {
    const c1 = resolve(parts[1]),
      c2 = resolve(parts[2]),
      t = resolve(parts[3]);
    if (c1 < 0 || c2 < 0 || t < 0) return null;
    return { type: 'ccx', qubits: [c1, c2, t], line: lineNum };
  }

  if (op === 'cswap') {
    const c = resolve(parts[1]),
      t1 = resolve(parts[2]),
      t2 = resolve(parts[3]);
    if (c < 0 || t1 < 0 || t2 < 0) return null;
    return { type: 'cswap', qubits: [c, t1, t2], line: lineNum };
  }

  if (customGates[op]) {
    const def = customGates[op];
    const qubits = [];
    for (let k = 0; k < def.params.length; k++) {
      const q = resolve(parts[k + 1]);
      if (q < 0) return null;
      qubits.push(q);
    }
    return { type: 'custom_gate', name: op, qubits, line: lineNum };
  }

  return null;
}

/**
 * Parse the instruction payload after `if m[q] == value:`.
 * Conditionals intentionally accept only one executable instruction, not
 * declarations or nested conditionals.
 */
function parseInlineInstruction(raw, line, errors, customGates = {}) {
  const parts = raw.toLowerCase().split(/\s+/).filter(Boolean);
  const op = parts[0];

  if (!op) {
    errors.push({ line, msg: `Conditional requires an instruction after ':'` });
    return null;
  }

  if (op === 'if' || op === 'gate' || op === 'qubits' || op === 'qreg') {
    errors.push({ line, msg: `Conditional cannot wrap '${op}'` });
    return null;
  }

  if (SINGLE_GATES.has(op)) {
    if (!expectArgCount(parts, 1, line, errors, op.toUpperCase())) return null;
    const q = parseInt(parts[1]);
    if (isNaN(q) || q < 0) {
      errors.push({ line, msg: `${op.toUpperCase()} requires a qubit index` });
      return null;
    }
    return { type: 'gate', gate: op, qubits: [q], line };
  }

  if (ROTATION_NAMES.has(op)) {
    if (!expectArgCount(parts, 2, line, errors, op.toUpperCase())) return null;
    const angle = parseAngle(parts[1]);
    const q = parseInt(parts[2]);
    if (isNaN(angle)) {
      errors.push({ line, msg: `${op.toUpperCase()}: invalid angle '${parts[1]}'` });
      return null;
    }
    if (isNaN(q) || q < 0) {
      errors.push({ line, msg: `${op.toUpperCase()}: invalid qubit '${parts[2]}'` });
      return null;
    }
    return { type: 'rotation', gate: op, angle, qubits: [q], line };
  }

  if (op === 'cx' || op === 'cnot') {
    if (!expectArgCount(parts, 2, line, errors, op.toUpperCase())) return null;
    const c = parseInt(parts[1]);
    const t = parseInt(parts[2]);
    if (isNaN(c) || isNaN(t) || c < 0 || t < 0) {
      errors.push({ line, msg: `CX requires two qubit indices` });
      return null;
    }
    if (c === t) {
      errors.push({ line, msg: `CX: control and target must differ` });
      return null;
    }
    return { type: 'cx', qubits: [c, t], line };
  }

  if (op === 'cz' || op === 'cs' || op === 'ct' || op === 'swap') {
    if (!expectArgCount(parts, 2, line, errors, op.toUpperCase())) return null;
    const a = parseInt(parts[1]);
    const b = parseInt(parts[2]);
    if (isNaN(a) || isNaN(b) || a < 0 || b < 0) {
      errors.push({ line, msg: `${op.toUpperCase()} requires two qubit indices` });
      return null;
    }
    if (a === b) {
      errors.push({ line, msg: `${op.toUpperCase()}: qubits must differ` });
      return null;
    }
    return { type: op, qubits: [a, b], line };
  }

  if (op === 'ccx' || op === 'toffoli') {
    if (!expectArgCount(parts, 3, line, errors, op.toUpperCase())) return null;
    const c1 = parseInt(parts[1]);
    const c2 = parseInt(parts[2]);
    const t = parseInt(parts[3]);
    if (isNaN(c1) || isNaN(c2) || isNaN(t) || c1 < 0 || c2 < 0 || t < 0) {
      errors.push({ line, msg: `CCX requires three qubit indices` });
      return null;
    }
    if (hasDuplicateQubits([c1, c2, t])) {
      errors.push({ line, msg: `CCX: control and target qubits must all differ` });
      return null;
    }
    return { type: 'ccx', qubits: [c1, c2, t], line };
  }

  if (op === 'cswap') {
    if (!expectArgCount(parts, 3, line, errors, op.toUpperCase())) return null;
    const c = parseInt(parts[1]);
    const t1 = parseInt(parts[2]);
    const t2 = parseInt(parts[3]);
    if (isNaN(c) || isNaN(t1) || isNaN(t2) || c < 0 || t1 < 0 || t2 < 0) {
      errors.push({ line, msg: `CSWAP requires three qubit indices` });
      return null;
    }
    if (hasDuplicateQubits([c, t1, t2])) {
      errors.push({ line, msg: `CSWAP: control and target qubits must all differ` });
      return null;
    }
    return { type: 'cswap', qubits: [c, t1, t2], line };
  }

  if (op === 'measure' || op === 'm') {
    if (!expectArgCount(parts, 1, line, errors, op.toUpperCase())) return null;
    if (parts[1] === 'all') return { type: 'measure_all', line };
    const q = parseInt(parts[1]);
    if (isNaN(q) || q < 0) {
      errors.push({ line, msg: `MEASURE requires qubit index or 'all'` });
      return null;
    }
    return { type: 'measure', qubits: [q], line };
  }

  if (op === 'barrier') {
    if (!expectArgCount(parts, 0, line, errors, op.toUpperCase())) return null;
    return { type: 'barrier', line };
  }

  if (customGates[op]) {
    const def = customGates[op];
    if (!expectArgCount(parts, def.params.length, line, errors, op.toUpperCase())) return null;
    const qubits = [];
    for (let k = 0; k < def.params.length; k++) {
      const q = parseInt(parts[k + 1]);
      if (isNaN(q) || q < 0) {
        errors.push({ line, msg: `${op.toUpperCase()}: expected qubit index for parameter '${def.params[k]}'` });
        return null;
      }
      qubits.push(q);
    }
    return { type: 'custom_gate', name: op, qubits, line };
  }

  errors.push({ line, msg: `Unknown conditional instruction: '${op}'` });
  return null;
}

/**
 * Parse quantum assembly source code into instructions.
 */
export function parse(code) {
  const lines = code.split('\n');
  const instructions = [];
  const errors = [];
  const customGates = {};
  let nQubits = 0;

  for (let i = 0; i < lines.length; i++) {
    const raw = stripInlineComment(lines[i]).trim();

    // Skip empty lines and comments
    if (!raw || raw.startsWith('#') || raw.startsWith('//')) continue;

    const parts = raw.toLowerCase().split(/\s+/);
    const op = parts[0];

    // ── Conditional execution using last measurement memory ──
    const conditionalMatch = raw.match(/^if\s+m\[(\d+)\]\s*==\s*([01])\s*:\s*(.+)$/i);
    if (conditionalMatch) {
      const measuredQubit = parseInt(conditionalMatch[1]);
      const value = parseInt(conditionalMatch[2]);
      const innerRaw = conditionalMatch[3].trim();
      const instruction = parseInlineInstruction(innerRaw, i, errors, customGates);
      if (instruction) {
        instructions.push({
          type: 'conditional',
          condition: { source: 'm', qubit: measuredQubit, value },
          instruction,
          qubits: instruction.qubits ? [...instruction.qubits] : undefined,
          line: i,
        });
      }
      continue;
    }

    // ── Custom gate definition ──
    if (op === 'gate') {
      const match = raw.match(/^gate\s+(\w+)\s*\(([^)]*)\)\s*:/i);
      if (!match) {
        errors.push({ line: i, msg: `Invalid gate definition. Expected: gate Name(p0, p1):` });
        continue;
      }
      const name = match[1].toLowerCase();
      const params = match[2]
        .split(',')
        .map((p) => p.trim().toLowerCase())
        .filter(Boolean);
      const body = [];

      i++; // advance to first body line
      let foundEnd = false;
      while (i < lines.length) {
        const bodyRaw = stripInlineComment(lines[i]).trim();
        if (bodyRaw.toLowerCase() === 'end') {
          foundEnd = true;
          break;
        }
        if (bodyRaw && !bodyRaw.startsWith('#') && !bodyRaw.startsWith('//')) {
          const bodyInst = parseGateBodyLine(bodyRaw.toLowerCase(), params, i, customGates);
          if (bodyInst) {
            body.push(bodyInst);
          } else {
            errors.push({ line: i, msg: `Invalid instruction in gate '${name}': '${bodyRaw}'` });
          }
        }
        i++;
      }

      if (!foundEnd) {
        errors.push({ line: i - 1, msg: `Unterminated gate definition '${name}': missing 'end'` });
        continue;
      }
      // i points to "end"; for-loop i++ moves past it

      customGates[name] = { params, body };
      continue;
    }

    // ── Qubit allocation ──
    if (op === 'qubits' || op === 'qreg') {
      if (!expectArgCount(parts, 1, i, errors, op.toUpperCase())) continue;
      const n = parseInt(parts[1]);
      if (isNaN(n) || n < 1 || n > 16) {
        errors.push({ line: i, msg: `Invalid qubit count: must be 1-16 (keep <= 12 for noisy/density-matrix mode)` });
        continue;
      }
      nQubits = n;
      instructions.push({ type: 'qubits', n, line: i });
      continue;
    }

    // ── Single-qubit gates ──
    if (SINGLE_GATES.has(op)) {
      if (!expectArgCount(parts, 1, i, errors, op.toUpperCase())) continue;
      const q = parseInt(parts[1]);
      if (isNaN(q) || q < 0) {
        errors.push({ line: i, msg: `${op.toUpperCase()} requires a qubit index` });
        continue;
      }
      instructions.push({ type: 'gate', gate: op, qubits: [q], line: i });
      continue;
    }

    // ── Rotation gates ──
    if (ROTATION_NAMES.has(op)) {
      if (!expectArgCount(parts, 2, i, errors, op.toUpperCase())) continue;
      const angleStr = parts[1];
      const qubitStr = parts[2];
      const angle = parseAngle(angleStr);
      const qubit = parseInt(qubitStr);

      if (isNaN(angle)) {
        errors.push({ line: i, msg: `${op.toUpperCase()}: invalid angle '${angleStr}'` });
        continue;
      }
      if (isNaN(qubit) || qubit < 0) {
        errors.push({ line: i, msg: `${op.toUpperCase()}: invalid qubit '${qubitStr}'` });
        continue;
      }

      instructions.push({
        type: 'rotation',
        gate: op,
        angle,
        qubits: [qubit],
        line: i,
      });
      continue;
    }

    // ── Two-qubit gates ──
    if (op === 'cx' || op === 'cnot') {
      if (!expectArgCount(parts, 2, i, errors, op.toUpperCase())) continue;
      const c = parseInt(parts[1]);
      const t = parseInt(parts[2]);
      if (isNaN(c) || isNaN(t) || c < 0 || t < 0) {
        errors.push({ line: i, msg: `CX requires two qubit indices` });
        continue;
      }
      if (c === t) {
        errors.push({ line: i, msg: `CX: control and target must differ` });
        continue;
      }
      instructions.push({ type: 'cx', qubits: [c, t], line: i });
      continue;
    }

    if (op === 'cz') {
      if (!expectArgCount(parts, 2, i, errors, op.toUpperCase())) continue;
      const c = parseInt(parts[1]);
      const t = parseInt(parts[2]);
      if (isNaN(c) || isNaN(t) || c < 0 || t < 0) {
        errors.push({ line: i, msg: `CZ requires two qubit indices` });
        continue;
      }
      if (c === t) {
        errors.push({ line: i, msg: `CZ: control and target must differ` });
        continue;
      }
      instructions.push({ type: 'cz', qubits: [c, t], line: i });
      continue;
    }

    if (op === 'cs') {
      if (!expectArgCount(parts, 2, i, errors, op.toUpperCase())) continue;
      const c = parseInt(parts[1]);
      const t = parseInt(parts[2]);
      if (isNaN(c) || isNaN(t) || c < 0 || t < 0) {
        errors.push({ line: i, msg: `CS requires two qubit indices` });
        continue;
      }
      if (c === t) {
        errors.push({ line: i, msg: `CS: control and target must differ` });
        continue;
      }
      instructions.push({ type: 'cs', qubits: [c, t], line: i });
      continue;
    }

    if (op === 'ct') {
      if (!expectArgCount(parts, 2, i, errors, op.toUpperCase())) continue;
      const c = parseInt(parts[1]);
      const t = parseInt(parts[2]);
      if (isNaN(c) || isNaN(t) || c < 0 || t < 0) {
        errors.push({ line: i, msg: `CT requires two qubit indices` });
        continue;
      }
      if (c === t) {
        errors.push({ line: i, msg: `CT: control and target must differ` });
        continue;
      }
      instructions.push({ type: 'ct', qubits: [c, t], line: i });
      continue;
    }

    if (op === 'swap') {
      if (!expectArgCount(parts, 2, i, errors, op.toUpperCase())) continue;
      const a = parseInt(parts[1]);
      const b = parseInt(parts[2]);
      if (isNaN(a) || isNaN(b) || a < 0 || b < 0) {
        errors.push({ line: i, msg: `SWAP requires two qubit indices` });
        continue;
      }
      if (a === b) {
        errors.push({ line: i, msg: `SWAP: qubits must differ` });
        continue;
      }
      instructions.push({ type: 'swap', qubits: [a, b], line: i });
      continue;
    }

    // ── Three-qubit gates ──
    if (op === 'ccx' || op === 'toffoli') {
      if (!expectArgCount(parts, 3, i, errors, op.toUpperCase())) continue;
      const c1 = parseInt(parts[1]);
      const c2 = parseInt(parts[2]);
      const t = parseInt(parts[3]);
      if (isNaN(c1) || isNaN(c2) || isNaN(t) || c1 < 0 || c2 < 0 || t < 0) {
        errors.push({ line: i, msg: `CCX requires three qubit indices` });
        continue;
      }
      if (hasDuplicateQubits([c1, c2, t])) {
        errors.push({ line: i, msg: `CCX: control and target qubits must all differ` });
        continue;
      }
      instructions.push({ type: 'ccx', qubits: [c1, c2, t], line: i });
      continue;
    }

    if (op === 'cswap') {
      if (!expectArgCount(parts, 3, i, errors, op.toUpperCase())) continue;
      const c = parseInt(parts[1]);
      const t1 = parseInt(parts[2]);
      const t2 = parseInt(parts[3]);
      if (isNaN(c) || isNaN(t1) || isNaN(t2) || c < 0 || t1 < 0 || t2 < 0) {
        errors.push({ line: i, msg: `CSWAP requires three qubit indices` });
        continue;
      }
      if (hasDuplicateQubits([c, t1, t2])) {
        errors.push({ line: i, msg: `CSWAP: control and target qubits must all differ` });
        continue;
      }
      instructions.push({ type: 'cswap', qubits: [c, t1, t2], line: i });
      continue;
    }

    // ── Measurement ──
    if (op === 'measure' || op === 'm') {
      if (!expectArgCount(parts, 1, i, errors, op.toUpperCase())) continue;
      if (parts[1] === 'all') {
        instructions.push({ type: 'measure_all', line: i });
      } else {
        const q = parseInt(parts[1]);
        if (isNaN(q) || q < 0) {
          errors.push({ line: i, msg: `MEASURE requires qubit index or 'all'` });
          continue;
        }
        instructions.push({ type: 'measure', qubits: [q], line: i });
      }
      continue;
    }

    // ── Barrier ──
    if (op === 'barrier') {
      if (!expectArgCount(parts, 0, i, errors, op.toUpperCase())) continue;
      instructions.push({ type: 'barrier', line: i });
      continue;
    }

    // ── Custom gate call ──
    if (customGates[op]) {
      const def = customGates[op];
      if (!expectArgCount(parts, def.params.length, i, errors, op.toUpperCase())) continue;
      const qubits = [];
      let valid = true;
      for (let k = 0; k < def.params.length; k++) {
        const q = parseInt(parts[k + 1]);
        if (isNaN(q) || q < 0) {
          errors.push({ line: i, msg: `${op.toUpperCase()}: expected qubit index for parameter '${def.params[k]}'` });
          valid = false;
          break;
        }
        qubits.push(q);
      }
      if (valid) {
        instructions.push({ type: 'custom_gate', name: op, qubits, line: i });
      }
      continue;
    }

    // ── Unknown ──
    errors.push({ line: i, msg: `Unknown instruction: '${op}'` });
  }

  // Auto-infer qubit count if not specified
  if (nQubits === 0 && instructions.length > 0) {
    let maxQubit = 0;
    for (const inst of instructions) {
      if (inst.qubits) {
        for (const q of inst.qubits) {
          if (q > maxQubit) maxQubit = q;
        }
      }
      if (inst.condition?.source === 'm' && inst.condition.qubit > maxQubit) {
        maxQubit = inst.condition.qubit;
      }
    }
    nQubits = maxQubit + 1;
    instructions.unshift({ type: 'qubits', n: nQubits, line: -1 });
  }

  // Validate qubit indices
  for (const inst of instructions) {
    if (inst.qubits) {
      for (const q of inst.qubits) {
        if (q >= nQubits) {
          errors.push({
            line: inst.line,
            msg: `Qubit ${q} out of range (${nQubits} qubits allocated: 0-${nQubits - 1})`,
          });
        }
      }
    }
    if (inst.condition?.source === 'm' && inst.condition.qubit >= nQubits) {
      errors.push({
        line: inst.line,
        msg: `Measurement memory m[${inst.condition.qubit}] out of range (${nQubits} qubits allocated: 0-${nQubits - 1})`,
      });
    }
  }

  return { instructions, nQubits, errors, customGates };
}

/**
 * Get gate instructions only (filter out qubits declaration).
 */
export function getGateInstructions(instructions) {
  return instructions.filter((i) => i.type !== 'qubits');
}

/**
 * Format an instruction for display in the log.
 */
export function formatInstruction(inst) {
  switch (inst.type) {
    case 'gate':
      return `${inst.gate.toUpperCase()} q${inst.qubits[0]}`;
    case 'rotation':
      return `${inst.gate.toUpperCase()}(${inst.angle.toFixed(4)}) q${inst.qubits[0]}`;
    case 'cx':
      return `CX q${inst.qubits[0]} → q${inst.qubits[1]}`;
    case 'cz':
      return `CZ q${inst.qubits[0]} · q${inst.qubits[1]}`;
    case 'cs':
      return `CS q${inst.qubits[0]} → q${inst.qubits[1]}`;
    case 'ct':
      return `CT q${inst.qubits[0]} → q${inst.qubits[1]}`;
    case 'swap':
      return `SWAP q${inst.qubits[0]} ↔ q${inst.qubits[1]}`;
    case 'ccx':
      return `CCX q${inst.qubits[0]},q${inst.qubits[1]} → q${inst.qubits[2]}`;
    case 'cswap':
      return `CSWAP q${inst.qubits[0]}: q${inst.qubits[1]} ↔ q${inst.qubits[2]}`;
    case 'custom_gate':
      return `${inst.name.toUpperCase()} ${inst.qubits.map((q) => `q${q}`).join(' ')}`;
    case 'measure':
      return `MEASURE q${inst.qubits[0]}`;
    case 'measure_all':
      return `MEASURE ALL`;
    case 'barrier':
      return `BARRIER`;
    case 'conditional':
      return `IF m[${inst.condition.qubit}]==${inst.condition.value}: ${formatInstruction(inst.instruction)}`;
    default:
      return inst.type.toUpperCase();
  }
}
