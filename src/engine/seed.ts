/**
 * Hash FNV-1a 32-bit determinístico para semente musical a partir do código.
 */
export function hashString(input: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

/**
 * Gerador pseudoaleatório Mulberry32 determinístico (nunca usa Math.random).
 */
export function createDeterministicPRNG(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Calcula humanização sutil e 100% determinística de velocity com base no hash do código
 * e no índice da nota.
 */
export function getDeterministicVelocity(
  codeHash: number,
  noteIndex: number,
  baseVelocity: number,
  variance = 0.08
): number {
  const combinedSeed = (codeHash ^ Math.imul(noteIndex + 1, 0x9e3779b1)) >>> 0;
  const rand = createDeterministicPRNG(combinedSeed)();
  const offset = (rand * 2 - 1) * variance;
  return Math.max(0.2, Math.min(1, Number((baseVelocity + offset).toFixed(4))));
}
