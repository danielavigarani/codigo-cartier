import { OFFICIAL_CREDITS } from "../constants/cipherRules";
import type { SunMoonMode } from "../types/music";

/**
 * Serializa os SVGs da partitura VexFlow para uma imagem PNG em alta resolução
 * pronta para compartilhar no Discord.
 */
export async function exportScoreAsPng(
  container: HTMLDivElement | null,
  visualTheme: SunMoonMode,
  filenameBase = "partitura-cartier"
): Promise<boolean> {
  if (!container) return false;
  const svgs = Array.from(
    container.querySelectorAll<SVGSVGElement>('svg[data-cartier-score-svg="true"]')
  );
  if (svgs.length === 0) return false;

  const scale = 2;
  const padX = 48;
  const headerH = 84;
  const footerH = 44;
  const gap = 24;

  const parsedSvgs = svgs.map((svg) => {
    const vb = svg.viewBox.baseVal;
    const width = vb && vb.width > 0 ? vb.width : svg.clientWidth || 760;
    const height = vb && vb.height > 0 ? vb.height : svg.clientHeight || 280;
    const clone = svg.cloneNode(true) as SVGSVGElement;
    clone.setAttribute("width", String(width));
    clone.setAttribute("height", String(height));
    clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
    return { clone, width, height };
  });

  const maxW = Math.max(...parsedSvgs.map((s) => s.width));
  const totalSvgH =
    parsedSvgs.reduce((acc, s) => acc + s.height, 0) +
    gap * (parsedSvgs.length - 1);

  const canvasW = maxW + padX * 2;
  const canvasH = headerH + totalSvgH + footerH;

  const canvas = document.createElement("canvas");
  canvas.width = canvasW * scale;
  canvas.height = canvasH * scale;
  const ctx = canvas.getContext("2d");
  if (!ctx) return false;

  ctx.scale(scale, scale);

  // Fundo temático elegante
  ctx.fillStyle =
    visualTheme === "sol"
      ? "#140F0B"
      : visualTheme === "eclipse"
      ? "#0D0919"
      : "#070B1A";
  ctx.fillRect(0, 0, canvasW, canvasH);

  // Moldura sutil
  ctx.strokeStyle =
    visualTheme === "sol"
      ? "rgba(212, 175, 55, 0.45)"
      : "rgba(103, 232, 249, 0.35)";
  ctx.lineWidth = 1.5;
  ctx.strokeRect(16, 16, canvasW - 32, canvasH - 32);

  // Cabeçalho
  ctx.fillStyle = visualTheme === "sol" ? "#D4AF37" : "#E2E8F0";
  ctx.font = 'bold 28px "Cormorant Garamond", Georgia, serif';
  ctx.textAlign = "center";
  ctx.fillText("Código Cartier — Partitura", canvasW / 2, 54);

  let yCursor = headerH;
  const serializer = new XMLSerializer();

  for (const item of parsedSvgs) {
    const svgStr = serializer.serializeToString(item.clone);
    const svgBlob = new Blob([svgStr], {
      type: "image/svg+xml;charset=utf-8",
    });
    const url = URL.createObjectURL(svgBlob);

    await new Promise<void>((resolve) => {
      const img = new Image();
      img.onload = () => {
        ctx.drawImage(
          img,
          padX + (maxW - item.width) / 2,
          yCursor,
          item.width,
          item.height
        );
        URL.revokeObjectURL(url);
        resolve();
      };
      img.onerror = () => {
        URL.revokeObjectURL(url);
        resolve();
      };
      img.src = url;
    });

    yCursor += item.height + gap;
  }

  ctx.fillStyle = "rgba(148, 163, 184, 0.7)";
  ctx.font = '11px "JetBrains Mono", monospace';
  ctx.textAlign = "center";
  ctx.fillText(OFFICIAL_CREDITS, canvasW / 2, canvasH - 22);

  const pngUrl = canvas.toDataURL("image/png");
  const a = document.createElement("a");
  a.href = pngUrl;
  a.download = `${filenameBase}.png`;
  a.click();
  return true;
}
