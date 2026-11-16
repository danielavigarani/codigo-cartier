import LZString from "lz-string";

/**
 * Calcula hash SHA-256 hexadecimal usando Web Crypto API (com fallback determinístico caso indisponível).
 */
export async function computeSha256Hex(input: string): Promise<string> {
  if (typeof globalThis.crypto?.subtle?.digest === "function") {
    const bytes = new TextEncoder().encode(input);
    const digest = await globalThis.crypto.subtle.digest("SHA-256", bytes);
    return Array.from(new Uint8Array(digest))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
  }
  // Fallback determinístico apenas para ambientes sem SubtleCrypto
  let h1 = 0x811c9dc5;
  let h2 = 0x9e3779b9;
  for (let i = 0; i < input.length; i++) {
    const c = input.charCodeAt(i);
    h1 = Math.imul(h1 ^ c, 0x01000193) >>> 0;
    h2 = Math.imul(h2 ^ (c + i), 0x85ebca6b) >>> 0;
  }
  return `${h1.toString(16).padStart(8, "0")}${h2.toString(16).padStart(8, "0")}`;
}

export function encodeSharePayload(cipherCode: string): string {
  return LZString.compressToEncodedURIComponent(cipherCode);
}

export function decodeSharePayload(compressed: string): string | null {
  if (!compressed) return null;
  try {
    const result = LZString.decompressFromEncodedURIComponent(compressed);
    return result && result.length > 0 ? result : null;
  } catch {
    return null;
  }
}

export function buildShareUrl(
  cipherCode: string,
  baseUrl = typeof window !== "undefined"
    ? `${window.location.origin}${window.location.pathname}`
    : "https://danielavigarani.github.io/codigo-cartier/"
): string {
  const payload = encodeSharePayload(cipherCode);
  return `${baseUrl}#c=${payload}`;
}

export function extractCodeFromHash(hash: string): string | null {
  if (!hash) return null;
  const clean = hash.startsWith("#") ? hash.slice(1) : hash;
  const params = new URLSearchParams(clean);
  const compressed = params.get("c");
  if (!compressed) return null;
  return decodeSharePayload(compressed);
}

const PAYLOAD_PREFIX = "CARTIER-PAYLOAD:";

/**
 * Monta marcador verificável para metadados e rodapé discreto de PDFs.
 */
export async function buildCartierPayloadMarker(
  cipherCode: string
): Promise<string> {
  const compressed = encodeSharePayload(cipherCode);
  const fullHash = await computeSha256Hex(cipherCode);
  return `${PAYLOAD_PREFIX}${compressed}|${fullHash.slice(0, 16)}`;
}

/**
 * Extrai e valida o marcador CARTIER-PAYLOAD de um texto ou metadado de PDF.
 */
export async function parseCartierPayloadMarker(
  rawText: string
): Promise<{ code: string; hashValid: boolean } | null> {
  const regex = /CARTIER-PAYLOAD:([A-Za-z0-9+\-$_]+)\|([0-9a-fA-F]{8,64})/;
  const match = rawText.replace(/\s+/g, "").match(regex);
  if (!match) {
    // Tenta também recuperar diretamente caso o texto tenha um cabeçalho #cartier visível
    const direct = rawText.match(/#cartier\s+v[12][^\r\n]*/i);
    if (direct) {
      const start = rawText.indexOf(direct[0]);
      return {
        code: rawText.slice(start).trim(),
        hashValid: false,
      };
    }
    return null;
  }

  const compressed = match[1];
  const expectedPrefix = match[2].toLowerCase();
  const code = decodeSharePayload(compressed);
  if (!code) return null;

  const actualHash = (await computeSha256Hex(code)).toLowerCase();
  return {
    code,
    hashValid: actualHash.startsWith(expectedPrefix),
  };
}
