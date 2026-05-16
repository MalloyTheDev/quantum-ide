/**
 * Complex number arithmetic for quantum state simulation.
 *
 * All complex numbers are represented as [real, imaginary] tuples.
 * This avoids object allocation overhead and keeps the hot path
 * (gate application loops) as fast as possible in JS.
 */

/** Add two complex numbers */
export function cadd([ar, ai], [br, bi]) {
  return [ar + br, ai + bi];
}

/** Multiply two complex numbers */
export function cmul([ar, ai], [br, bi]) {
  return [ar * br - ai * bi, ar * bi + ai * br];
}

/** Squared magnitude |z|² */
export function cabs2([r, i]) {
  return r * r + i * i;
}

/** Magnitude |z| */
export function cabs([r, i]) {
  return Math.sqrt(r * r + i * i);
}

/** Scale a complex number by a real scalar */
export function cscale(s, [r, i]) {
  return [s * r, s * i];
}

/** Complex conjugate */
export function cconj([r, i]) {
  return [r, -i];
}

/** Create complex from polar form */
export function cfromPolar(mag, phase) {
  return [mag * Math.cos(phase), mag * Math.sin(phase)];
}

/** Zero */
export const CZERO = [0, 0];

/** One */
export const CONE = [1, 0];

/** Imaginary unit */
export const CI = [0, 1];

/**
 * Format a complex number for display.
 * Rounds near-zero components to zero for clean output.
 */
export function cfmt([r, i], precision = 4) {
  const rr = Math.abs(r) < 1e-8 ? 0 : r;
  const ii = Math.abs(i) < 1e-8 ? 0 : i;

  if (ii === 0) return rr.toFixed(precision);
  if (rr === 0) return `${ii.toFixed(precision)}i`;
  return `${rr.toFixed(precision)}${ii >= 0 ? '+' : ''}${ii.toFixed(precision)}i`;
}

/**
 * Format for compact display (fewer decimals).
 */
export function cfmtShort([r, i]) {
  return cfmt([r, i], 3);
}
