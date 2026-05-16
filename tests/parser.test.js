import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { parse } from '../src/engine/parser.js';

function messages(code) {
  return parse(code).errors.map((e) => e.msg);
}

describe('Parser validation', () => {
  it('allows inline comments after instructions', () => {
    const result = parse('qubits 2 # register size\nh 0 // prepare superposition\ncx 0 1 # entangle');
    assert.deepEqual(result.errors, []);
    assert.equal(result.nQubits, 2);
  });

  it('rejects extra arguments on fixed-arity gates', () => {
    const errs = messages('qubits 2\nh 0 1');
    assert.ok(errs.some((msg) => msg.includes('H expects 1 argument, got 2')));
  });

  it('rejects missing arguments on fixed-arity gates', () => {
    const errs = messages('qubits 2\ncx 0');
    assert.ok(errs.some((msg) => msg.includes('CX expects 2 arguments, got 1')));
  });

  it('rejects duplicate qubits for CCX', () => {
    const errs = messages('qubits 3\nccx 0 0 2');
    assert.ok(errs.some((msg) => msg.includes('CCX: control and target qubits must all differ')));
  });

  it('rejects duplicate qubits for CSWAP', () => {
    const errs = messages('qubits 3\ncswap 0 1 1');
    assert.ok(errs.some((msg) => msg.includes('CSWAP: control and target qubits must all differ')));
  });

  it('rejects unterminated custom gate definitions', () => {
    const result = parse('gate Bell(a, b):\n  h a\n  cx a b\nBell 0 1');
    assert.ok(result.errors.some((e) => e.msg.includes("Unterminated gate definition 'bell': missing 'end'")));
    assert.equal(result.customGates.bell, undefined);
  });

  it('rejects custom gate calls with too many arguments', () => {
    const code = ['gate flip(a):', '  x a', 'end', 'qubits 2', 'flip 0 1'].join('\n');

    const errs = messages(code);
    assert.ok(errs.some((msg) => msg.includes('FLIP expects 1 argument, got 2')));
  });
});
