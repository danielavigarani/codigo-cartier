import { jsPDF } from "jspdf";
import { svg2pdf } from "svg2pdf.js";
import { OFFICIAL_CREDITS, TEMPO_LABELS } from "../constants/cipherRules";
import type { MusicalMode, TempoPreset, TimeSignature } from "../types/music";
import { buildCartierPayloadMarker, parseCartierPayloadMarker } from "./share";

export type PaperStyle = "pergaminho" | "urtext";

export interface ManuscriptPdfOptions {
  opusTitle: string;
  subtitle: string;
  composers: string;
  paperStyle: PaperStyle;
  mode: MusicalMode;
  tempo: TempoPreset;
  timeSignature: TimeSignature;
  cipherCode: string;
  scoreContainer: HTMLDivElement;
}

function drawPageBackground(doc: jsPDF, paperStyle: PaperStyle) {
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();

  if (paperStyle === "pergaminho") {
    doc.setFillColor(250, 243, 224); // pergaminho envelhecido
    doc.rect(0, 0, pageW, pageH, "F");
    doc.setDrawColor(168, 130, 74);
    doc.setLineWidth(1.2);
    doc.rect(24, 24, pageW - 48, pageH - 48);
    doc.setLineWidth(0.4);
    doc.rect(29, 29, pageW - 58, pageH - 58);
  } else {
    doc.setFillColor(255, 255, 255); // Urtext clássico
    doc.rect(0, 0, pageW, pageH, "F");
    doc.setDrawColor(40, 40, 45);
    doc.setLineWidth(0.6);
    doc.rect(26, 26, pageW - 52, pageH - 52);
  }
}

/**
 * Gera PDF 100% vetorial convertendo os SVGs do VexFlow via svg2pdf.js + jsPDF.
 * Nunca usa html2canvas. Embute CARTIER-PAYLOAD comprimido + SHA-256.
 */
export async function exportManuscriptPdf(
  options: ManuscriptPdfOptions
): Promise<void> {
  const svgs = Array.from(
    options.scoreContainer.querySelectorAll<SVGSVGElement>(
      'svg[data-cartier-score-svg="true"]'
    )
  );
  if (svgs.length === 0) {
    throw new Error("Nenhuma partitura SVG disponível para exportação.");
  }

  const marker = await buildCartierPayloadMarker(options.cipherCode);

  const doc = new jsPDF({
    orientation: "portrait",
    unit: "pt",
    format: "a4",
    compress: true,
  });

  doc.setProperties({
    title: options.opusTitle,
    subject: marker,
    keywords: `CodigoCartier, ${marker}`,
    author: options.composers,
    creator: "Código Cartier v3 — Symphonic Edition",
  });

  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const marginX = 44;
  const maxContentW = pageW - marginX * 2;
  const bottomLimit = pageH - 64;

  drawPageBackground(doc, options.paperStyle);

  // Cabeçalho Editorial
  doc.setTextColor(32, 26, 22);
  doc.setFont("times", "bold");
  doc.setFontSize(20);
  doc.text(options.opusTitle, pageW / 2, 66, { align: "center" });

  doc.setFont("times", "italic");
  doc.setFontSize(11);
  doc.setTextColor(92, 74, 58);
  doc.text(options.subtitle, pageW / 2, 84, { align: "center" });

  doc.setFont("times", "normal");
  doc.setFontSize(10);
  doc.text(options.composers, pageW - marginX, 106, { align: "right" });

  const modeLabel =
    options.mode === "lua"
      ? "Modo Lua — Lá Menor Natural"
      : "Modo Sol — Lá Maior (3#)";
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.text(
    `${modeLabel} · ${TEMPO_LABELS[options.tempo]} · Compasso ${options.timeSignature}`,
    marginX,
    106
  );

  doc.setDrawColor(145, 118, 82);
  doc.setLineWidth(0.6);
  doc.line(marginX, 114, pageW - marginX, 114);

  let cursorY = 128;

  for (let i = 0; i < svgs.length; i++) {
    const svg = svgs[i];
    const vb = svg.viewBox.baseVal;
    const rawW = vb && vb.width > 0 ? vb.width : svg.clientWidth || 720;
    const rawH = vb && vb.height > 0 ? vb.height : svg.clientHeight || 260;

    const scale = maxContentW / rawW;
    const renderW = maxContentW;
    const renderH = rawH * scale;

    if (cursorY + renderH > bottomLimit && i > 0) {
      doc.addPage();
      drawPageBackground(doc, options.paperStyle);
      cursorY = 52;
    }

    if (svgs.length > 1) {
      doc.setFont("times", "bold");
      doc.setFontSize(9);
      doc.setTextColor(110, 82, 48);
      doc.text(`Partitura ${i + 1}`, marginX, cursorY + 8);
      cursorY += 12;
    }

    const clone = svg.cloneNode(true) as SVGSVGElement;
    clone.setAttribute("width", String(rawW));
    clone.setAttribute("height", String(rawH));

    await svg2pdf(clone, doc, {
      x: marginX,
      y: cursorY,
      width: renderW,
      height: renderH,
    });

    cursorY += renderH + 14;
  }

  // Rodapé discreto na página 1 contendo créditos e marcador CARTIER-PAYLOAD verificável
  doc.setPage(1);
  doc.setFont("courier", "normal");
  doc.setFontSize(6.5);
  doc.setTextColor(125, 112, 96);
  doc.text(OFFICIAL_CREDITS, pageW / 2, pageH - 42, { align: "center" });

  doc.setFontSize(5.5);
  doc.text(marker, pageW / 2, pageH - 33, {
    align: "center",
    maxWidth: maxContentW,
  });

  const safeFile =
    options.opusTitle
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "") || "manuscrito-cartier";

  doc.save(`${safeFile}.pdf`);
}

export interface ImportedPdfResult {
  cipherCode?: string;
  pageImages: string[];
  message: string;
}

/**
 * Lê PDF usando pdfjs-dist (sem OMR): extrai metadados e texto procurando CARTIER-PAYLOAD
 * e renderiza as páginas para visualização e Modo Leitura no piano.
 */
export async function importCartierPdf(
  file: File
): Promise<ImportedPdfResult> {
  const pdfjs = await import("pdfjs-dist");
  const workerModule = await import(
    "pdfjs-dist/build/pdf.worker.min.mjs?url"
  );
  pdfjs.GlobalWorkerOptions.workerSrc = workerModule.default;

  const buffer = await file.arrayBuffer();
  const loadingTask = pdfjs.getDocument({ data: buffer });
  const pdf = await loadingTask.promise;

  const metadataChunks: string[] = [];
  try {
    const meta = await pdf.getMetadata();
    const info = (meta.info ?? {}) as Record<string, unknown>;
    if (info.Subject) metadataChunks.push(String(info.Subject));
    if (info.Keywords) metadataChunks.push(String(info.Keywords));
    if (info.Title) metadataChunks.push(String(info.Title));
  } catch {
    // continua para leitura de texto das páginas
  }

  const pageTexts: string[] = [];
  const pageImages: string[] = [];
  const maxPreviewPages = Math.min(4, pdf.numPages);

  for (let p = 1; p <= pdf.numPages; p++) {
    const page = await pdf.getPage(p);
    const textContent = await page.getTextContent();
    const textJoined = textContent.items
      .map((item) => ("str" in item ? item.str : ""))
      .join(" ");
    pageTexts.push(textJoined);

    if (p <= maxPreviewPages && typeof document !== "undefined") {
      const viewport = page.getViewport({ scale: 1.35 });
      const canvas = document.createElement("canvas");
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      const ctx = canvas.getContext("2d");
      if (ctx) {
        await page.render({ canvasContext: ctx, viewport }).promise;
        pageImages.push(canvas.toDataURL("image/png"));
      }
    }
  }

  const combinedText = [...metadataChunks, ...pageTexts].join("\n");
  const parsed = await parseCartierPayloadMarker(combinedText);

  if (parsed) {
    return {
      cipherCode: parsed.code,
      pageImages,
      message: parsed.hashValid
        ? "Partitura PDF importada com integridade verificada (SHA-256 válido)! Pronta para Ouvir & Revelar."
        : "Código Cartier recuperado do PDF! Clique em Ouvir & Revelar.",
    };
  }

  return {
    pageImages,
    message:
      "Este PDF não possui metadados Cartier embutidos (pode ser imagem escaneada). Use a visualização abaixo no Modo Leitura clicando no piano virtual!",
  };
}
