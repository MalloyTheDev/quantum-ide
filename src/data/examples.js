/**
 * Example quantum programs for the IDE.
 * Each entry: { name, description, code }
 */

const EXAMPLES = {
  "Bell State": {
    description: "Creates a maximally entangled EPR pair: (|00⟩ + |11⟩)/√2",
    code: `# Bell State (EPR Pair)
# Creates maximally entangled |Φ+⟩ state
qubits 2
h 0
cx 0 1
measure all`,
  },

  "GHZ State": {
    description: "3-qubit Greenberger-Horne-Zeilinger state",
    code: `# GHZ State (3-qubit entanglement)
# Produces (|000⟩ + |111⟩) / √2
qubits 3
h 0
cx 0 1
cx 0 2
measure all`,
  },

  "Superposition": {
    description: "Equal superposition of all basis states",
    code: `# Equal superposition of all states
# Each basis state has probability 1/8
qubits 3
h 0
h 1
h 2`,
  },

  "Grover (2-qubit)": {
    description: "Grover's search algorithm finding |11⟩",
    code: `# Grover's search - oracle marks |11⟩
qubits 2
# Initialize superposition
h 0
h 1
# Oracle: phase-flip |11⟩ (CZ = H·CNOT·H)
h 1
cx 0 1
h 1
# Diffusion operator
h 0
h 1
x 0
x 1
h 1
cx 0 1
h 1
x 0
x 1
h 0
h 1
measure all`,
  },

  "Quantum Teleportation": {
    description: "Teleport a quantum state from q0 to q2 via entanglement",
    code: `# Quantum Teleportation Protocol
# Teleports q0's state to q2
qubits 3
# Prepare q0 in state to teleport
h 0
t 0
# Create Bell pair between q1 and q2
h 1
cx 1 2
# Bell measurement on q0, q1
cx 0 1
h 0
measure 0
measure 1
# NOTE: Classical feed-forward is not yet supported in this IDE.
# In a full implementation, the corrections below are applied to q2
# conditioned on the measurement outcomes above:
#   if measure 1 == 1: x 2
#   if measure 0 == 1: z 2
# Without these corrections the circuit is illustrative only.`,
  },

  "Phase Kickback": {
    description: "Demonstrates phase kickback - key to many quantum algorithms",
    code: `# Phase Kickback
# The phase from the target kicks back to the control
qubits 2
x 1
h 0
h 1
cx 0 1
h 0
measure 0`,
  },

  "Swap Test": {
    description: "Tests equality of two quantum states",
    code: `# Swap Test
# Measures overlap between q1 and q2
qubits 3
# Prepare identical states to compare
x 1
x 2
# Swap test circuit
h 0
cswap 0 1 2
h 0
measure 0`,
  },

  "Deutsch-Jozsa": {
    description: "Determines if a function is constant or balanced in one query",
    code: `# Deutsch-Jozsa Algorithm (2-qubit)
# Determines f is balanced (oracle: CNOT)
qubits 2
# Initialize: |0⟩|1⟩
x 1
# Hadamard both
h 0
h 1
# Oracle (balanced function = CNOT)
cx 0 1
# Hadamard input qubit
h 0
# Measure: 1 = balanced, 0 = constant
measure 0`,
  },

  "Quantum Fourier Transform": {
    description: "2-qubit QFT circuit",
    code: `# Quantum Fourier Transform (2-qubit)
qubits 2
# Start with a test state: |10>
x 0
# QFT circuit
# Step 1: Hadamard on q0
h 0
# Step 2: Controlled-S (control=q1, target=q0)
cs 1 0
# Step 3: Bit-reversal swap
swap 0 1
# Step 4: Hadamard on q1
h 1`,
  },

  "Entanglement Swapping": {
    description: "Create entanglement between qubits that never interact directly",
    code: `# Entanglement Swapping
# q0-q1 entangled, q2-q3 entangled
# After Bell measurement on q1,q2: q0,q3 become entangled
qubits 4
# Create two Bell pairs
h 0
cx 0 1
h 2
cx 2 3
# Bell measurement on q1, q2
cx 1 2
h 1
measure 1
measure 2`,
  },

  "Toffoli (AND Gate)": {
    description: "Toffoli (CCX): q2 flips only when both q0=1 and q1=1 - quantum AND",
    code: `# Toffoli Gate - Quantum AND
# q2 (ancilla, starts |0⟩) flips iff q0=1 AND q1=1
qubits 3
# Set both controls to |1⟩
x 0
x 1
# Toffoli: flip target only if both controls are |1⟩
ccx 0 1 2
# Expect q0=1, q1=1, q2=1
measure all`,
  },

  "Bell State - Statistics": {
    description: "Bell state with measurement statistics - set Shots to 1000 and Run",
    code: `# Bell State - Measurement Statistics
# ★  Set Shots to 1000 (or any N) and click Run to see the histogram!
#
# A Bell state produces |00⟩ and |11⟩ with exactly 50% probability each.
# A single run gives one random outcome; many shots reveal the full
# probability distribution - both bars should settle near 50%.
qubits 2
h 0        # Put q0 into equal superposition: (|0⟩ + |1⟩)/√2
cx 0 1     # Entangle q1 with q0  →  (|00⟩ + |11⟩)/√2
measure all`,
  },

  "Custom Gate": {
    description: "Define a reusable Bell gate and apply it to two qubit pairs",
    code: `# Custom Gate Definition Example
# Define a 'Bell' gate that creates a Bell pair
gate Bell(a, b):
  H a
  CNOT a b
end

# Allocate 4 qubits and create two Bell pairs
qubits 4
Bell 0 1
Bell 2 3
measure all`,
  },
};

export default EXAMPLES;
