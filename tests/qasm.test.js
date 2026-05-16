/**
 * QASM import/export round-trip tests.
 *
 * Verifies that:
 *   - Standard gates export to valid QASM and re-import to equivalent DSL
 *   - CS and CT export as gate sequences (not comments)
 *   - Gate definition blocks in QASM are reconstructed on import
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { exportToQASM, importFromQASM, importFromQASMWithDiagnostics } from '../src/engine/qasm.js';
import { parse } from '../src/engine/parser.js';

function parseCode(code) {
  const { instructions, nQubits, customGates } = parse(code);
  return { instructions, nQubits, customGates };
}

// ── CS/CT export ─────────────────────────────────────────────────────────────

describe('CS/CT QASM export', () => {
  it('CS exports as gate sequence, not a comment', () => {
    const { instructions, nQubits, customGates } = parseCode('cs 0 1');
    const qasm = exportToQASM(instructions, nQubits, customGates);
    assert.ok(!qasm.includes('// unsupported'), `CS exported as comment:\n${qasm}`);
    assert.ok(qasm.includes('cx'), `CS should use CX in decomposition:\n${qasm}`);
    assert.ok(qasm.includes('tdg'), `CS should use TDG in decomposition:\n${qasm}`);
  });

  it('CT exports as gate sequence, not a comment', () => {
    const { instructions, nQubits, customGates } = parseCode('ct 0 1');
    const qasm = exportToQASM(instructions, nQubits, customGates);
    assert.ok(!qasm.includes('// unsupported'), `CT exported as comment:\n${qasm}`);
    assert.ok(qasm.includes('cx'), `CT should use CX in decomposition:\n${qasm}`);
    assert.ok(qasm.includes('u1'), `CT should use U1 in decomposition:\n${qasm}`);
  });

  it('CS export contains valid QASM header', () => {
    const { instructions, nQubits, customGates } = parseCode('cs 0 1');
    const qasm = exportToQASM(instructions, nQubits, customGates);
    assert.ok(qasm.startsWith('OPENQASM 2.0;'));
    assert.ok(qasm.includes('include "qelib1.inc";'));
  });
});

// ── Standard gate round-trips ─────────────────────────────────────────────────

describe('Standard gate round-trips', () => {
  function roundTrip(code) {
    const { instructions, nQubits, customGates } = parseCode(code);
    const qasm = exportToQASM(instructions, nQubits, customGates);
    return importFromQASM(qasm);
  }

  it('H gate round-trips', () => {
    const dsl = roundTrip('h 0');
    assert.ok(dsl.includes('h 0'), `DSL after round-trip: ${dsl}`);
  });

  it('X gate round-trips', () => {
    const dsl = roundTrip('x 0');
    assert.ok(dsl.includes('x 0'));
  });

  it('CX gate round-trips', () => {
    const dsl = roundTrip('cx 0 1');
    assert.ok(dsl.includes('cx 0 1'));
  });

  it('CCX (Toffoli) round-trips', () => {
    const dsl = roundTrip('ccx 0 1 2');
    assert.ok(dsl.includes('ccx 0 1 2'));
  });

  it('RX rotation round-trips', () => {
    const dsl = roundTrip('rx pi/2 0');
    assert.ok(dsl.includes('rx') && dsl.includes('0'));
  });

  it('U1 phase gate round-trips', () => {
    const dsl = roundTrip('u1 pi/4 0');
    assert.ok(dsl.includes('u1 pi/4 0'), `DSL after round-trip: ${dsl}`);
  });

  it('SWAP gate round-trips', () => {
    const dsl = roundTrip('swap 0 1');
    assert.ok(dsl.includes('swap 0 1'));
  });

  it('measure round-trips', () => {
    const dsl = roundTrip('h 0\nmeasure 0');
    assert.ok(dsl.includes('measure 0'));
  });

  it('S and T gates round-trip', () => {
    const dsl = roundTrip('s 0\nt 1');
    assert.ok(dsl.includes('s 0'));
    assert.ok(dsl.includes('t 1'));
  });
});

// ── QASM import - gate definition reconstruction ─────────────────────────────

describe('QASM import gate definition reconstruction', () => {
  it('reconstructs a simple gate definition', () => {
    const qasm = [
      'OPENQASM 2.0;',
      'include "qelib1.inc";',
      'qreg q[2];',
      'creg c[2];',
      'gate mybell a,b {',
      '  h a;',
      '  cx a,b;',
      '}',
      'mybell q[0],q[1];',
    ].join('\n');

    const dsl = importFromQASM(qasm);
    assert.ok(dsl.includes('gate mybell'), `Missing gate definition:\n${dsl}`);
    assert.ok(dsl.includes('end'), `Missing 'end' keyword:\n${dsl}`);
    // Body uses parameter names (a, b) not numeric indices
    assert.ok(dsl.includes('h a'), `Missing h in body:\n${dsl}`);
    assert.ok(dsl.includes('cx a b'), `Missing cx in body:\n${dsl}`);
  });

  it('reconstructed gate is callable in DSL', () => {
    const qasm = [
      'OPENQASM 2.0;',
      'include "qelib1.inc";',
      'qreg q[2];',
      'creg c[2];',
      'gate flip q0 {',
      '  x q0;',
      '}',
      'flip q[0];',
    ].join('\n');

    const dsl = importFromQASM(qasm);
    assert.ok(dsl.includes('gate flip'), `Missing gate definition:\n${dsl}`);
    assert.ok(dsl.includes('flip 0'), `Missing gate call:\n${dsl}`);

    // Verify the DSL parses without errors
    const { errors } = parse(dsl);
    assert.equal(errors.length, 0, `Parse errors: ${errors.map((e) => e.msg).join(', ')}`);
  });

  it('single-line gate definition is parsed correctly', () => {
    const qasm = [
      'OPENQASM 2.0;',
      'include "qelib1.inc";',
      'qreg q[1];',
      'creg c[1];',
      'gate flip q0 { x q0; }',
      'flip q[0];',
    ].join('\n');
    const dsl = importFromQASM(qasm);
    assert.ok(dsl.includes('gate flip'), `Gate definition missing:\n${dsl}`);
    assert.ok(dsl.includes('x q0'), `Gate body missing:\n${dsl}`);
    assert.ok(dsl.includes('flip 0'), `Gate call missing:\n${dsl}`);
    const { errors } = parse(dsl);
    assert.equal(errors.length, 0, `Parse errors: ${errors.map((e) => e.msg).join(', ')}`);
  });

  it('gate with unsupported body operations is silently skipped', () => {
    const qasm = [
      'OPENQASM 2.0;',
      'include "qelib1.inc";',
      'qreg q[1];',
      'creg c[1];',
      'gate exotic q0 {',
      '  unknown_gate q0;',
      '}',
      'h q[0];',
    ].join('\n');

    const dsl = importFromQASM(qasm);
    // The unsupported gate definition should be skipped (not error)
    // But h should still be imported
    assert.ok(dsl.includes('h 0'), `H gate missing from import:\n${dsl}`);
    // No 'exotic' definition should appear (body has unknown gate)
    assert.ok(!dsl.includes('gate exotic'), `Unsupported gate should not be reconstructed:\n${dsl}`);
  });
});

// ── Full export structure ─────────────────────────────────────────────────────

describe('QASM export structure', () => {
  it('includes correct header and register declarations', () => {
    const { instructions, nQubits, customGates } = parseCode('qubits 3\nh 0');
    const qasm = exportToQASM(instructions, nQubits, customGates);
    assert.ok(qasm.includes('qreg q[3]'));
    assert.ok(qasm.includes('creg c[3]'));
  });

  it('custom gate body is inlined (not emitted as gate definition)', () => {
    const code = ['gate myh(q0):', '  h q0', 'end', 'myh 0'].join('\n');
    const { instructions, nQubits, customGates } = parseCode(code);
    const qasm = exportToQASM(instructions, nQubits, customGates);
    // Custom gates are inlined (body expanded), no "gate myh" definition in output
    assert.ok(!qasm.includes('gate myh'), `Should not emit gate definitions:\n${qasm}`);
    assert.ok(qasm.includes('h q[0]'), `Inlined body should contain h:\n${qasm}`);
  });

  it('conditional gates export as visible unsupported comments', () => {
    const { instructions, nQubits, customGates } = parseCode('measure 0\nif m[0] == 1: x 0');
    const qasm = exportToQASM(instructions, nQubits, customGates);
    assert.ok(qasm.includes('unsupported conditional'), `Conditional limitation should be visible:\n${qasm}`);
  });
});

describe('QASM import diagnostics', () => {
  it('returns diagnostics for unsupported lines', () => {
    const { code, diagnostics } = importFromQASMWithDiagnostics(
      ['OPENQASM 2.0;', 'include "qelib1.inc";', 'qreg q[1];', 'opaque mystery q;'].join('\n')
    );

    assert.ok(code.includes('# unsupported: opaque mystery q'), `Unsupported line should be visible:\n${code}`);
    assert.equal(diagnostics.length, 1);
    assert.ok(diagnostics[0].msg.includes('Unsupported QASM line'));
  });
});
