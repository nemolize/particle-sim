/* v8 ignore file -- @preserve */
/*
 * Typed-array reads under `noUncheckedIndexedAccess`; callers keep indices in
 * range, so the `?? 0` fallback is unreachable.
 */
export const at = (array: Float32Array, index: number): number =>
  array[index] ?? 0;
