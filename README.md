# Quantum IDE

A desktop quantum computing IDE built with Electron, React, and Vite. Write circuits in a custom assembly language, simulate them with a hand-rolled JavaScript state-vector engine, and inspect results through a live circuit diagram, probability bars, Bloch sphere, and measurement histogram. No cloud account, no Python, no third-party quantum libraries required.

## Features

- **Custom DSL** -- line-based quantum assembly with gates, rotations, measurement, barriers, and user-defined reusable gates
- **State-vector simulator** -- pure JavaScript, up to 8 qubits, all gate math written from the unitary definitions
- **Circuit diagram** -- SVG auto-generated from parsed instructions, highlights the active gate during step-through
- **Step-through debugger** -- execute one instruction at a time and watch amplitudes update live
- **Bloch sphere** -- per-qubit visualization computed by partial trace, shown as a 2D SVG projection
- **Multi-shot histogram** -- run the circuit up to 10,000 times and plot outcome statistics
- **OpenQASM 2.0 import/export** -- convert to and from the standard format used by IBM Quantum and others
- **Undo/redo** -- full editor history (100 states)
- **File I/O** -- native save/open dialogs for `.qs` and `.qasm` files via Electron
- **Extended gate set** -- CZ, CS, CT, CCX (Toffoli), CSWAP (Fredkin), plus all standard single-qubit and rotation gates
- **Custom gate definitions** -- define named sub-circuits inline and call them like built-in gates
- **Noise simulation** -- density matrix mode with depolarizing, amplitude damping, and phase flip channels
- **13 built-in examples** -- Bell state, GHZ, Grover search, teleportation, Deutsch-Jozsa, QFT, and more

## Getting Started

Requires Node.js 18+.

```bash
git clone https://github.com/malloythedev/quantum-ide.git
cd quantum-ide
npm install

# Run in the browser (Vite dev server at localhost:3000)
npm run dev

# Run as a desktop app (Electron + Vite, both hot-reload)
npm run electron:dev

# Production build
npm run build
```

## DSL Quick Reference

```
# Comments start with # or //
qubits N           # allocate N qubits (1-8); inferred if omitted

# Single-qubit gates
h 0                # Hadamard
x 0                # Pauli-X (NOT)
y 0  z 0           # Pauli-Y, Pauli-Z
s 0  t 0           # S (pi/2 phase), T (pi/4 phase)
sdg 0  tdg 0       # S-dagger, T-dagger

# Rotation gates
rx pi/2 0          # rotate about X axis
ry pi/4 0
rz pi 0

# Two-qubit gates
cx 0 1             # CNOT (control, target)
cz 0 1             # Controlled-Z
swap 0 1

# Three-qubit gates
ccx 0 1 2          # Toffoli
cswap 0 1 2        # Fredkin (controlled SWAP)

# Measurement
measure 0          # measure qubit 0
measure all        # measure all qubits

# Barrier (visual separator, no computation)
barrier

# Custom gate definition
gate Bell(a, b):
  h a
  cx a b
end

Bell 0 1           # call it like any built-in gate
```

Supported angle formats: `pi`, `pi/2`, `pi/4`, `pi/8`, `pi/3`, `pi/6`, `2*pi`, negated variants, and raw numeric radians.

## Keyboard Shortcuts

| Shortcut | Action |
|---|---|
| `Ctrl+Enter` | Run |
| `Ctrl+Shift+Enter` | Step one gate |
| `Ctrl+R` | Reset |
| `Ctrl+Z` | Undo |
| `Ctrl+Shift+Z` | Redo |
| `Ctrl+S` | Save |
| `Ctrl+Shift+S` | Save As |
| `Ctrl+O` | Open file |

## Project Structure

```
src/
  engine/             # Pure JS quantum engine -- no React, no DOM dependencies
    complex.js        # Complex number arithmetic ([re, im] tuples)
    gates.js          # Gate matrix definitions
    parser.js         # DSL text -> instruction objects + custom gate registry
    simulator.js      # State-vector simulation, measurement, multi-shot, Bloch vectors
    densityMatrix.js  # Density matrix operations and Kraus noise channels
    qasm.js           # OpenQASM 2.0 import/export
  components/         # React UI components
  data/examples.js    # Built-in example programs
  styles/
    tokens.js         # Design tokens (colors, spacing, typography)
    index.css         # Global styles

electron/
  main.cjs            # Electron main process
  preload.cjs         # contextBridge (file dialogs, window title)
```

The engine and UI are fully decoupled -- `src/engine/` has zero React imports and works in Node.js or any browser context unchanged.

## Adding a Gate

1. Define the 2x2 matrix in `src/engine/gates.js` and register it in `FIXED_GATES` (or `ROTATION_GATES` for parameterized gates)
2. Add the name to the relevant set in `src/engine/parser.js`
3. Add a `case` in `executeInstruction` in `simulator.js` if it needs custom dispatch logic
4. Add a symbol renderer in `CircuitDiagram.jsx`

## Built-in Examples

| Name | What it shows |
|---|---|
| Bell State | Maximally entangled EPR pair |
| GHZ State | 3-qubit entanglement |
| Superposition | H gate on all qubits |
| Grover (2-qubit) | Search algorithm with oracle marking |11> |
| Quantum Teleportation | Full 3-qubit teleportation protocol |
| Deutsch-Jozsa | Constant vs. balanced function in one query |
| Quantum Fourier Transform | 2-qubit QFT circuit |
| Toffoli (AND Gate) | Reversible AND gate |
| Custom Gate | Defining and calling a reusable Bell gate |
| Bell State -- Statistics | 1000-shot run showing the 50/50 histogram |

## How the Simulator Works

The state vector is an array of `2^n` complex amplitudes stored as `[re, im]` pairs. Qubit ordering is little-endian (qubit 0 = least significant bit), matching Qiskit's convention.

Gate application iterates over amplitude pairs that differ only in the target qubit's bit position -- O(2^n) per gate instead of O(4^n) for full matrix multiplication. Measurement follows the Born rule and collapses the state in place.

The density matrix engine handles noise simulation using Kraus operators. Gate application becomes `U * rho * U†`, and noise channels (depolarizing, amplitude damping, phase flip) are applied after each gate.

## License

MIT
