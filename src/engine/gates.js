/**
 * Quantum gate definitions.
 *
 * Each gate is a 2x2 matrix of complex numbers: [[a, b], [c, d]]
 * where each element is a [real, imag] tuple.
 *
 * Matrix layout:
 *   | a  b |   applied to   | α |   =   | a·α + b·β |
 *   | c  d |                 | β |       | c·α + d·β |
 *
 * No third-party libraries - all matrices defined by hand from
 * their mathematical definitions.
 */

const S2 = 1 / Math.sqrt(2);
const PI = Math.PI;

// Single-Qubit Gates

/** Hadamard - creates equal superposition */
export const H = [
  [
    [S2, 0],
    [S2, 0],
  ],
  [
    [S2, 0],
    [-S2, 0],
  ],
];

/** Pauli-X (NOT gate) - bit flip */
export const X = [
  [
    [0, 0],
    [1, 0],
  ],
  [
    [1, 0],
    [0, 0],
  ],
];

/** Pauli-Y - bit + phase flip */
export const Y = [
  [
    [0, 0],
    [0, -1],
  ],
  [
    [0, 1],
    [0, 0],
  ],
];

/** Pauli-Z - phase flip */
export const Z = [
  [
    [1, 0],
    [0, 0],
  ],
  [
    [0, 0],
    [-1, 0],
  ],
];

/** S gate (√Z) - π/2 phase */
export const S = [
  [
    [1, 0],
    [0, 0],
  ],
  [
    [0, 0],
    [0, 1],
  ],
];

/** S† (S-dagger) - -π/2 phase */
export const SDG = [
  [
    [1, 0],
    [0, 0],
  ],
  [
    [0, 0],
    [0, -1],
  ],
];

/** T gate (√S) - π/4 phase */
export const T = [
  [
    [1, 0],
    [0, 0],
  ],
  [
    [0, 0],
    [Math.cos(PI / 4), Math.sin(PI / 4)],
  ],
];

/** T† (T-dagger) - -π/4 phase */
export const TDG = [
  [
    [1, 0],
    [0, 0],
  ],
  [
    [0, 0],
    [Math.cos(PI / 4), -Math.sin(PI / 4)],
  ],
];

/** Identity (for completeness) */
export const I = [
  [
    [1, 0],
    [0, 0],
  ],
  [
    [0, 0],
    [1, 0],
  ],
];

// Parameterized Rotation Gates

/**
 * RX(θ) - Rotation about X-axis
 *
 *   | cos(θ/2)    -i·sin(θ/2) |
 *   | -i·sin(θ/2)  cos(θ/2)   |
 */
export function RX(theta) {
  const c = Math.cos(theta / 2);
  const s = Math.sin(theta / 2);
  return [
    [
      [c, 0],
      [0, -s],
    ],
    [
      [0, -s],
      [c, 0],
    ],
  ];
}

/**
 * RY(θ) - Rotation about Y-axis
 *
 *   | cos(θ/2)  -sin(θ/2) |
 *   | sin(θ/2)   cos(θ/2) |
 */
export function RY(theta) {
  const c = Math.cos(theta / 2);
  const s = Math.sin(theta / 2);
  return [
    [
      [c, 0],
      [-s, 0],
    ],
    [
      [s, 0],
      [c, 0],
    ],
  ];
}

/**
 * RZ(θ) - Rotation about Z-axis
 *
 *   | e^(-iθ/2)    0       |
 *   |    0       e^(iθ/2)  |
 */
export function RZ(theta) {
  return [
    [
      [Math.cos(theta / 2), -Math.sin(theta / 2)],
      [0, 0],
    ],
    [
      [0, 0],
      [Math.cos(theta / 2), Math.sin(theta / 2)],
    ],
  ];
}

/**
 * U1(lambda) - OpenQASM phase gate
 *
 *   | 1      0          |
 *   | 0   e^(i lambda) |
 *
 * This is equivalent to RZ(lambda) up to a global phase, but keeping it
 * explicit preserves OpenQASM import/export fidelity.
 */
export function U1(lambda) {
  return [
    [
      [1, 0],
      [0, 0],
    ],
    [
      [0, 0],
      [Math.cos(lambda), Math.sin(lambda)],
    ],
  ];
}

// Gate Registry

/** Map of gate name → matrix for fixed (non-parameterized) gates */
export const FIXED_GATES = {
  h: H,
  x: X,
  y: Y,
  z: Z,
  s: S,
  t: T,
  sdg: SDG,
  tdg: TDG,
  id: I,
};

/** Map of rotation gate name → factory function */
export const ROTATION_GATES = {
  rx: RX,
  ry: RY,
  rz: RZ,
  u1: U1,
};

/**
 * Get a gate matrix by name, with optional angle for rotations.
 * Returns null if gate not found.
 */
export function getGate(name, angle = null) {
  const lower = name.toLowerCase();
  if (FIXED_GATES[lower]) return FIXED_GATES[lower];
  if (ROTATION_GATES[lower] && angle !== null) return ROTATION_GATES[lower](angle);
  return null;
}

/** All recognized single-qubit gate names */
export const SINGLE_QUBIT_GATES = ['h', 'x', 'y', 'z', 's', 't', 'sdg', 'tdg', 'id', 'rx', 'ry', 'rz', 'u1'];

/** All recognized two-qubit gate names */
export const TWO_QUBIT_GATES = ['cx', 'cnot', 'swap', 'cz', 'cs', 'ct'];

/** All recognized three-qubit gate names */
export const THREE_QUBIT_GATES = ['ccx', 'toffoli', 'cswap'];
