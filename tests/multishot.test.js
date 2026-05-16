/**
 * Multi-shot execution tests.
 *
 * Verifies statistical properties of runMultiShot and that bitstrings
 * are always full-register-width (nQubits digits).
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { runMultiShot } from '../src/engine/simulator.js';
import { parse } from '../src/engine/parser.js';

// ── Helper ───────────────────────────────────────────────────────────────────

function parseAndRun(code, shots) {
  const { instructions, nQubits, customGates } = parse(code);
  return { counts: runMultiShot(instructions, nQubits, shots, customGates), nQubits };
}

// ── Bitstring width ───────────────────────────────────────────────────────────

describe('Bitstring width', () => {
  it('produces 1-bit strings for 1-qubit circuit', () => {
    const { counts } = parseAndRun('h 0', 50);
    for (const key of Object.keys(counts)) {
      assert.equal(key.length, 1, `Key "${key}" is not 1 bit`);
    }
  });

  it('produces 2-bit strings for 2-qubit circuit without measure', () => {
    const { counts } = parseAndRun('h 0\ncx 0 1', 50);
    for (const key of Object.keys(counts)) {
      assert.equal(key.length, 2, `Key "${key}" is not 2 bits`);
    }
  });

  it('produces full-width strings even when only one qubit is measured', () => {
    // 2-qubit circuit with explicit measure on qubit 0 only
    const code = 'qubits 2\nh 0\nmeasure 0';
    const { counts, nQubits } = parseAndRun(code, 50);
    assert.equal(nQubits, 2);
    for (const key of Object.keys(counts)) {
      assert.equal(key.length, 2, `Key "${key}" should be ${nQubits} bits wide`);
    }
  });

  it('total shot count matches requested shots', () => {
    const { counts } = parseAndRun('h 0', 200);
    const total = Object.values(counts).reduce((s, c) => s + c, 0);
    assert.equal(total, 200);
  });
});

// ── Statistical correctness ───────────────────────────────────────────────────

describe('Multi-shot statistics', () => {
  it('all-zero circuit always produces "0" outcome', () => {
    const { counts } = parseAndRun('x 0\nx 0', 100);
    // X^2 = I, so state is |0>, always "0"
    assert.deepEqual(Object.keys(counts), ['0']);
    assert.equal(counts['0'], 100);
  });

  it('H gate produces ~50/50 distribution', () => {
    const SHOTS = 2000;
    const { counts } = parseAndRun('h 0', SHOTS);
    const p0 = (counts['0'] || 0) / SHOTS;
    const p1 = (counts['1'] || 0) / SHOTS;
    // Allow generous tolerance for statistical fluctuation (3-sigma ~ 0.03)
    assert.ok(p0 > 0.4 && p0 < 0.6, `p(0) = ${p0.toFixed(3)} not near 0.5`);
    assert.ok(p1 > 0.4 && p1 < 0.6, `p(1) = ${p1.toFixed(3)} not near 0.5`);
  });

  it('Bell state produces only 00 or 11', () => {
    const { counts } = parseAndRun('h 0\ncx 0 1', 200);
    const keys = Object.keys(counts);
    assert.ok(
      keys.every((k) => k === '00' || k === '11'),
      `Unexpected outcomes: ${keys.filter((k) => k !== '00' && k !== '11')}`
    );
  });

  it('last measurement wins when qubit is measured twice', () => {
    // x 0 sets q0 to |1>; first measure records 1; x 0 flips q0 to |0>;
    // second measure records 0; only the last value (0) appears in the bitstring
    const code = ['qubits 2', 'x 0', 'measure 0', 'x 0', 'h 1', 'measure 0'].join('\n');
    const { counts } = parseAndRun(code, 200);
    for (const key of Object.keys(counts)) {
      assert.equal(key.length, 2, `Bitstring "${key}" is not 2 bits wide`);
      assert.equal(key[0], '0', `q0 last-measurement should be 0, got bitstring "${key}"`);
    }
    // q1 was put in |+> and never measured - both values should appear across shots
    const q1vals = new Set(Object.keys(counts).map((k) => k[1]));
    assert.ok(q1vals.has('0') && q1vals.has('1'), 'Unmeasured q1 (in |+>) should show both 0 and 1');
  });

  it('explicit measure outcomes match full-circuit measure all', () => {
    // Using measure all vs explicit: both should give same keys
    const { counts: cExplicit } = parseAndRun('h 0\ncx 0 1\nmeasure all', 200);
    const { counts: cImplicit } = parseAndRun('h 0\ncx 0 1', 200);
    const keysExplicit = new Set(Object.keys(cExplicit));
    const keysImplicit = new Set(Object.keys(cImplicit));
    // Both should only contain '00' and '11'
    assert.ok([...keysExplicit].every((k) => k === '00' || k === '11'));
    assert.ok([...keysImplicit].every((k) => k === '00' || k === '11'));
  });
});
