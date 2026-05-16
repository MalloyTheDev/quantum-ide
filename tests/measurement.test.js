/**
 * Measurement tests - Born rule, state collapse, normalization.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  createState,
  applySingleQubitGate,
  applyCNOT,
  measureQubit,
  measureAll,
  getProbabilities,
} from '../src/engine/simulator.js';
import { FIXED_GATES } from '../src/engine/gates.js';

const EPS = 1e-10;

function near(a, b) {
  return Math.abs(a - b) < EPS;
}

// ── Deterministic measurements ───────────────────────────────────────────────

describe('Measuring a definite state', () => {
  it('always returns 0 for |0>', () => {
    for (let trial = 0; trial < 20; trial++) {
      const { outcome } = measureQubit(createState(1), 0, 1);
      assert.equal(outcome, 0);
    }
  });

  it('always returns 1 for |1>', () => {
    const state = applySingleQubitGate(createState(1), FIXED_GATES.x, 0, 1);
    for (let trial = 0; trial < 20; trial++) {
      const { outcome } = measureQubit(state, 0, 1);
      assert.equal(outcome, 1);
    }
  });
});

// ── State collapse ───────────────────────────────────────────────────────────

describe('State collapse after measurement', () => {
  it('collapses to |0> sub-space', () => {
    // Prepare |+> = (|0>+|1>)/sqrt(2), measure, force outcome 0
    const sup = applySingleQubitGate(createState(1), FIXED_GATES.h, 0, 1);
    // Run many times - at least one outcome=0 expected; check that state collapses correctly
    let gotZero = false;
    for (let t = 0; t < 100; t++) {
      const { state: collapsed, outcome } = measureQubit(sup, 0, 1);
      if (outcome === 0) {
        assert.ok(near(collapsed[0][0], 1), 'Collapsed state must be |0> when outcome=0');
        assert.ok(near(collapsed[1][0], 0));
        gotZero = true;
        break;
      }
    }
    assert.ok(gotZero, 'Expected at least one outcome=0 in 100 trials');
  });

  it('collapses to |1> sub-space', () => {
    const sup = applySingleQubitGate(createState(1), FIXED_GATES.h, 0, 1);
    let gotOne = false;
    for (let t = 0; t < 100; t++) {
      const { state: collapsed, outcome } = measureQubit(sup, 0, 1);
      if (outcome === 1) {
        assert.ok(near(collapsed[0][0], 0));
        assert.ok(near(collapsed[1][0], 1), 'Collapsed state must be |1> when outcome=1');
        gotOne = true;
        break;
      }
    }
    assert.ok(gotOne, 'Expected at least one outcome=1 in 100 trials');
  });

  it('post-measurement state is normalized', () => {
    const sup = applySingleQubitGate(createState(1), FIXED_GATES.h, 0, 1);
    const { state: collapsed } = measureQubit(sup, 0, 1);
    const probs = getProbabilities(collapsed);
    const total = probs.reduce((s, p) => s + p, 0);
    assert.ok(near(total, 1), `Norm after measurement: ${total}`);
  });
});

// ── measureAll ───────────────────────────────────────────────────────────────

describe('measureAll', () => {
  it('returns nQubits outcomes', () => {
    const s = createState(3);
    const { outcomes } = measureAll(s, 3);
    assert.equal(outcomes.length, 3);
  });

  it('all-zero state always yields [0,0,0]', () => {
    for (let t = 0; t < 10; t++) {
      const { outcomes } = measureAll(createState(3), 3);
      assert.deepEqual(
        outcomes.map((o) => o.outcome),
        [0, 0, 0]
      );
    }
  });

  it('Bell state collapses both qubits to same value', () => {
    // Prepare Bell state: H on q0, CNOT(q0,q1)
    let s = applySingleQubitGate(createState(2), FIXED_GATES.h, 0, 2);
    s = applyCNOT(s, 0, 1, 2);
    const counts = { '00': 0, 11: 0, other: 0 };
    for (let t = 0; t < 40; t++) {
      const { outcomes } = measureAll(s, 2);
      const bits = outcomes.map((o) => o.outcome).join('');
      if (bits === '00') counts['00']++;
      else if (bits === '11') counts['11']++;
      else counts.other++;
    }
    assert.equal(counts.other, 0, 'Bell state should only produce 00 or 11');
  });
});
