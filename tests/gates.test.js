/**
 * Gate correctness tests - single-qubit, multi-qubit, controlled gates.
 *
 * Verifies that the state-vector simulator produces correct amplitudes
 * for each gate by comparing against known analytical results.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  createState,
  applySingleQubitGate,
  applyCNOT,
  applySWAP,
  applyControlledGate,
  applyToffoli,
  applyCSWAP,
} from '../src/engine/simulator.js';
import { FIXED_GATES, ROTATION_GATES } from '../src/engine/gates.js';

const EPS = 1e-10;

function near(a, b) {
  return Math.abs(a - b) < EPS;
}

function assertAmplitude(state, index, re, im = 0) {
  assert.ok(
    near(state[index][0], re) && near(state[index][1], im),
    `state[${index}] expected [${re}, ${im}], got [${state[index][0]}, ${state[index][1]}]`
  );
}

// ── Single-qubit gates ───────────────────────────────────────────────────────

describe('Pauli-X gate', () => {
  it('flips |0> to |1>', () => {
    const s = applySingleQubitGate(createState(1), FIXED_GATES.x, 0, 1);
    assertAmplitude(s, 0, 0);
    assertAmplitude(s, 1, 1);
  });

  it('flips |1> to |0>', () => {
    let s = applySingleQubitGate(createState(1), FIXED_GATES.x, 0, 1); // |1>
    s = applySingleQubitGate(s, FIXED_GATES.x, 0, 1);
    assertAmplitude(s, 0, 1);
    assertAmplitude(s, 1, 0);
  });

  it('X^2 = I on qubit 0 of 2-qubit system', () => {
    let s = createState(2);
    s = applySingleQubitGate(s, FIXED_GATES.x, 0, 2);
    s = applySingleQubitGate(s, FIXED_GATES.x, 0, 2);
    assertAmplitude(s, 0, 1);
  });
});

describe('Hadamard gate', () => {
  it('maps |0> to (|0>+|1>)/sqrt(2)', () => {
    const s = applySingleQubitGate(createState(1), FIXED_GATES.h, 0, 1);
    const v = 1 / Math.sqrt(2);
    assertAmplitude(s, 0, v);
    assertAmplitude(s, 1, v);
  });

  it('H^2 = I', () => {
    let s = applySingleQubitGate(createState(1), FIXED_GATES.h, 0, 1);
    s = applySingleQubitGate(s, FIXED_GATES.h, 0, 1);
    assertAmplitude(s, 0, 1);
    assertAmplitude(s, 1, 0);
  });

  it('maps |1> to (|0>-|1>)/sqrt(2)', () => {
    let s = applySingleQubitGate(createState(1), FIXED_GATES.x, 0, 1); // |1>
    s = applySingleQubitGate(s, FIXED_GATES.h, 0, 1);
    const v = 1 / Math.sqrt(2);
    assertAmplitude(s, 0, v);
    assertAmplitude(s, 1, -v);
  });
});

describe('Pauli-Z gate', () => {
  it('leaves |0> unchanged', () => {
    const s = applySingleQubitGate(createState(1), FIXED_GATES.z, 0, 1);
    assertAmplitude(s, 0, 1);
    assertAmplitude(s, 1, 0);
  });

  it('flips phase of |1>', () => {
    let s = applySingleQubitGate(createState(1), FIXED_GATES.x, 0, 1); // |1>
    s = applySingleQubitGate(s, FIXED_GATES.z, 0, 1);
    assertAmplitude(s, 0, 0);
    assertAmplitude(s, 1, -1);
  });
});

describe('S gate', () => {
  it('applies pi/2 phase to |1>', () => {
    let s = applySingleQubitGate(createState(1), FIXED_GATES.x, 0, 1); // |1>
    s = applySingleQubitGate(s, FIXED_GATES.s, 0, 1);
    assertAmplitude(s, 1, 0, 1); // e^{i*pi/2} = i
  });

  it('S^2 = Z', () => {
    let s = applySingleQubitGate(createState(1), FIXED_GATES.x, 0, 1); // |1>
    s = applySingleQubitGate(s, FIXED_GATES.s, 0, 1);
    s = applySingleQubitGate(s, FIXED_GATES.s, 0, 1);
    assertAmplitude(s, 1, -1, 0); // Z|1> = -|1>
  });
});

describe('T gate', () => {
  it('applies pi/4 phase to |1>', () => {
    let s = applySingleQubitGate(createState(1), FIXED_GATES.x, 0, 1); // |1>
    s = applySingleQubitGate(s, FIXED_GATES.t, 0, 1);
    const v = 1 / Math.sqrt(2);
    assertAmplitude(s, 1, v, v); // e^{i*pi/4} = (1+i)/sqrt(2)
  });

  it('T^4 = Z', () => {
    let s = applySingleQubitGate(createState(1), FIXED_GATES.x, 0, 1);
    for (let k = 0; k < 4; k++) {
      s = applySingleQubitGate(s, FIXED_GATES.t, 0, 1);
    }
    assertAmplitude(s, 1, -1, 0);
  });
});

describe('SDG / TDG daggers', () => {
  it('S then SDG = I', () => {
    let s = applySingleQubitGate(createState(1), FIXED_GATES.x, 0, 1);
    s = applySingleQubitGate(s, FIXED_GATES.s, 0, 1);
    s = applySingleQubitGate(s, FIXED_GATES.sdg, 0, 1);
    assertAmplitude(s, 1, 1, 0);
  });

  it('T then TDG = I', () => {
    let s = applySingleQubitGate(createState(1), FIXED_GATES.x, 0, 1);
    s = applySingleQubitGate(s, FIXED_GATES.t, 0, 1);
    s = applySingleQubitGate(s, FIXED_GATES.tdg, 0, 1);
    assertAmplitude(s, 1, 1, 0);
  });
});

// ── Rotation gates ───────────────────────────────────────────────────────────

describe('Rotation gates', () => {
  it('RX(pi) = -i * X (up to global phase, X maps |0>->|1>)', () => {
    const s = applySingleQubitGate(createState(1), ROTATION_GATES.rx(Math.PI), 0, 1);
    // RX(pi)|0> = -i|1>
    assertAmplitude(s, 0, 0, 0);
    assertAmplitude(s, 1, 0, -1);
  });

  it('RY(pi) = Y-like rotation (|0> -> |1>)', () => {
    const s = applySingleQubitGate(createState(1), ROTATION_GATES.ry(Math.PI), 0, 1);
    // RY(pi)|0> = |1> (real)
    assertAmplitude(s, 0, 0, 0);
    assertAmplitude(s, 1, 1, 0);
  });

  it('RZ(pi) = Z (up to global phase)', () => {
    let s = applySingleQubitGate(createState(1), FIXED_GATES.x, 0, 1); // |1>
    s = applySingleQubitGate(s, ROTATION_GATES.rz(Math.PI), 0, 1);
    // RZ(pi)|1> = -i * Z|1> = i|1>... actually RZ(pi)|1> = e^{i*pi/2}|1> = i|1>
    assertAmplitude(s, 1, 0, 1);
  });

  it('RX(0) = Identity', () => {
    const s = applySingleQubitGate(createState(1), ROTATION_GATES.rx(0), 0, 1);
    assertAmplitude(s, 0, 1);
    assertAmplitude(s, 1, 0);
  });
});

// ── Multi-qubit gates ────────────────────────────────────────────────────────

describe('CNOT gate', () => {
  it('|00> -> |00> (control=0)', () => {
    const s = applyCNOT(createState(2), 1, 0, 2);
    assertAmplitude(s, 0, 1);
  });

  it('|10> -> |11> (control qubit 1, target qubit 0; little-endian)', () => {
    // State index 2 = binary 10 = qubit1=1, qubit0=0
    let s = applySingleQubitGate(createState(2), FIXED_GATES.x, 1, 2); // set qubit 1
    s = applyCNOT(s, 1, 0, 2);
    // |11> = index 3
    assertAmplitude(s, 3, 1);
  });

  it('CNOT^2 = I', () => {
    let s = applySingleQubitGate(createState(2), FIXED_GATES.h, 0, 2);
    const s0 = s.map((a) => [...a]);
    s = applyCNOT(s, 0, 1, 2);
    s = applyCNOT(s, 0, 1, 2);
    for (let j = 0; j < 4; j++) {
      assertAmplitude(s, j, s0[j][0], s0[j][1]);
    }
  });
});

describe('SWAP gate', () => {
  it('swaps qubit states', () => {
    let s = applySingleQubitGate(createState(2), FIXED_GATES.x, 0, 2); // qubit0=1, qubit1=0 -> index 1
    s = applySWAP(s, 0, 1, 2);
    // After swap: qubit0=0, qubit1=1 -> index 2
    assertAmplitude(s, 1, 0);
    assertAmplitude(s, 2, 1);
  });

  it('SWAP^2 = I', () => {
    let s = applySingleQubitGate(createState(2), FIXED_GATES.h, 0, 2);
    const s0 = s.map((a) => [...a]);
    s = applySWAP(s, 0, 1, 2);
    s = applySWAP(s, 0, 1, 2);
    for (let j = 0; j < 4; j++) {
      assertAmplitude(s, j, s0[j][0], s0[j][1]);
    }
  });
});

describe('Controlled-S (CS) gate', () => {
  it('applies S to target when control=1', () => {
    // |11> (index 3): control=0 (qubit 0), target=1 (qubit 1)
    let s = applySingleQubitGate(createState(2), FIXED_GATES.x, 0, 2);
    s = applySingleQubitGate(s, FIXED_GATES.x, 1, 2); // |11> = index 3
    s = applyControlledGate(s, FIXED_GATES.s, 0, 1, 2);
    // S adds phase i to |1> of target: result is i|11>
    assertAmplitude(s, 3, 0, 1);
  });

  it('does not affect target when control=0', () => {
    let s = applySingleQubitGate(createState(2), FIXED_GATES.x, 1, 2); // qubit1=1, qubit0=0 -> |01...> = index 2
    s = applyControlledGate(s, FIXED_GATES.s, 0, 1, 2);
    // control qubit 0 = 0, so no phase applied
    assertAmplitude(s, 2, 1, 0);
  });
});

describe('Toffoli (CCX) gate', () => {
  it('flips target when both controls are |1>', () => {
    // 3-qubit: set qubits 0 and 1 to |1>, target is qubit 2
    let s = applySingleQubitGate(createState(3), FIXED_GATES.x, 0, 3);
    s = applySingleQubitGate(s, FIXED_GATES.x, 1, 3);
    // State index 3 (binary 011) -> after CCX qubit2 flips -> index 7 (binary 111)
    s = applyToffoli(s, 0, 1, 2, 3);
    assertAmplitude(s, 7, 1);
  });

  it('does not flip target when only one control is |1>', () => {
    let s = applySingleQubitGate(createState(3), FIXED_GATES.x, 0, 3); // only qubit 0 set
    s = applyToffoli(s, 0, 1, 2, 3);
    assertAmplitude(s, 1, 1); // unchanged
  });
});

describe('CSWAP (Fredkin) gate', () => {
  it('swaps targets when control is |1>', () => {
    // Set control (q0=1), t1 (q1=1), t2 (q2=0): index = 0b011 = 3
    let s = applySingleQubitGate(createState(3), FIXED_GATES.x, 0, 3);
    s = applySingleQubitGate(s, FIXED_GATES.x, 1, 3);
    // After CSWAP(0,1,2): q1 and q2 swap -> q0=1,q1=0,q2=1 = 0b101 = 5
    s = applyCSWAP(s, 0, 1, 2, 3);
    assertAmplitude(s, 5, 1);
  });

  it('does not swap when control is |0>', () => {
    let s = applySingleQubitGate(createState(3), FIXED_GATES.x, 1, 3); // only q1=1
    // control q0=0, so no swap
    s = applyCSWAP(s, 0, 1, 2, 3);
    assertAmplitude(s, 2, 1);
  });
});
