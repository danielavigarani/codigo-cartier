import { Note } from "tonal";
import { OFFICIAL_CREDITS } from "../constants/cipherRules";
import type {
  MeasureData,
  MusicalMode,
  NoteDurationCode,
  PlaybackTimeline,
  RestDurationCode,
} from "../types/music";

function escapeXml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function durationCodeToXml(code: NoteDurationCode | RestDurationCode): {
  type: string;
  dots: number;
  durationDivisions: number;
} {
  const clean = code.replace(/[r.]/g, "");
  const dots = code.includes(".") ? 1 : 0;

  // divisions = 4 por semínima (1 semicolcheia = 1 divisão)
  switch (clean) {
    case "1":
      return { type: "whole", dots, durationDivisions: dots ? 24 : 16 };
    case "2":
      return { type: "half", dots, durationDivisions: dots ? 12 : 8 };
    case "4":
      return { type: "quarter", dots, durationDivisions: dots ? 6 : 4 };
    case "8":
      return { type: "eighth", dots, durationDivisions: dots ? 3 : 2 };
    default:
      return { type: "16th", dots, durationDivisions: 1 };
  }
}

function chordToHarmonyXml(symbol: string): string {
  const rootMatch = symbol.match(/^([A-G])(#|b)?(.*)$/);
  if (!rootMatch) return "";
  const rootStep = rootMatch[1];
  const alter = rootMatch[2] === "#" ? 1 : rootMatch[2] === "b" ? -1 : 0;
  const suffix = rootMatch[3] ?? "";

  let kind = "major";
  if (suffix === "m") kind = "minor";
  else if (suffix === "dim") kind = "diminished";
  else if (suffix === "7") kind = "dominant";
  else if (suffix === "m7") kind = "minor-seventh";

  return `      <harmony>
        <root>
          <root-step>${rootStep}</root-step>${
    alter !== 0 ? `\n          <root-alter>${alter}</root-alter>` : ""
  }
        </root>
        <kind>${kind}</kind>
      </harmony>`;
}

export interface GenerateMusicXmlOptions {
  title?: string;
  mode: MusicalMode;
}

/**
 * Gera documento MusicXML 4.0 compatível com MuseScore contendo APENAS a melodia
 * em pauta dupla (troca automática em C4) e as cifras de acorde (<harmony>).
 * Nunca escreve acompanhamento em notas na partitura exportada.
 */
export function generateMusicXml(
  timeline: PlaybackTimeline,
  options: GenerateMusicXmlOptions
): string {
  const title = options.title ?? "Código Cartier — Partitura";
  const fifths = options.mode === "sol" ? 3 : 0; // Lá Maior (3#) vs Lá Menor (0)

  const allMeasures: MeasureData[] = timeline.measuresByLine.flat();

  const measuresXml = allMeasures
    .map((measure, idx) => {
      const [beats, beatType] = measure.timeSignature.split("/").map(Number);
      const isFirst = idx === 0;

      const attributesBlock = isFirst
        ? `      <attributes>
        <divisions>4</divisions>
        <key>
          <fifths>${fifths}</fifths>
          <mode>${options.mode === "sol" ? "major" : "minor"}</mode>
        </key>
        <time>
          <beats>${beats}</beats>
          <beat-type>${beatType}</beat-type>
        </time>
        <staves>2</staves>
        <clef number="1">
          <sign>G</sign>
          <line>2</line>
        </clef>
        <clef number="2">
          <sign>F</sign>
          <line>4</line>
        </clef>
      </attributes>`
        : "";

      const harmonyBlock = measure.chord
        ? chordToHarmonyXml(measure.chord.symbol)
        : "";

      const notesBlock = measure.events
        .map((ev) => {
          const { type, dots, durationDivisions } = durationCodeToXml(
            ev.durationCode
          );
          const dotXml = dots > 0 ? "\n        <dot/>" : "";

          if (ev.kind === "rest") {
            return `      <note>
        <rest/>
        <duration>${durationDivisions}</duration>
        <type>${type}</type>${dotXml}
        <staff>1</staff>
      </note>`;
          }

          const cipherNote = ev.cipherNote ?? "C4";
          const match = cipherNote.match(/^([A-G])(\d)$/);
          const step = match?.[1] ?? "C";
          const octave = match?.[2] ?? "4";
          const midi = Note.midi(cipherNote) ?? 60;
          const staff = midi >= 60 ? 1 : 2;
          const alter =
            options.mode === "sol" &&
            (step === "C" || step === "F" || step === "G")
              ? 1
              : 0;

          const tieStart = ev.tie === "start" || ev.tie === "continue";
          const tieEnd = ev.tie === "end" || ev.tie === "continue";
          const tieXml = `${
            tieEnd ? '\n        <tie type="stop"/>' : ""
          }${tieStart ? '\n        <tie type="start"/>' : ""}`;

          const notationsXml =
            tieStart || tieEnd
              ? `\n        <notations>${
                  tieEnd ? '\n          <tied type="stop"/>' : ""
                }${
                  tieStart ? '\n          <tied type="start"/>' : ""
                }\n        </notations>`
              : "";

          const lyricXml =
            ev.isTieHead && ev.letter
              ? `\n        <lyric number="1">\n          <syllabic>single</syllabic>\n          <text>${escapeXml(
                  ev.letter
                )}</text>\n        </lyric>`
              : "";

          return `      <note>
        <pitch>
          <step>${step}</step>${
            alter !== 0 ? `\n          <alter>${alter}</alter>` : ""
          }
          <octave>${octave}</octave>
        </pitch>
        <duration>${durationDivisions}</duration>${tieXml}
        <type>${type}</type>${dotXml}
        <staff>${staff}</staff>${notationsXml}${lyricXml}
      </note>`;
        })
        .join("\n");

      const barlineXml = measure.isFinalMeasure
        ? `      <barline location="right">
        <bar-style>light-heavy</bar-style>
      </barline>`
        : "";

      return `    <measure number="${idx + 1}">
${[attributesBlock, harmonyBlock, notesBlock, barlineXml]
  .filter(Boolean)
  .join("\n")}
    </measure>`;
    })
    .join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE score-partwise PUBLIC "-//Recordare//DTD MusicXML 4.0 Partwise//EN" "http://www.musicxml.org/dtds/partwise.dtd">
<score-partwise version="4.0">
  <work>
    <work-title>${escapeXml(title)}</work-title>
  </work>
  <identification>
    <creator type="composer">Daniela Vigarani &amp; Bah Duarte</creator>
    <rights>${escapeXml(OFFICIAL_CREDITS)}</rights>
  </identification>
  <part-list>
    <score-part id="P1">
      <part-name>Código Cartier</part-name>
    </score-part>
  </part-list>
  <part id="P1">
${measuresXml}
  </part>
</score-partwise>`;
}

export function downloadMusicXml(
  timeline: PlaybackTimeline,
  options: GenerateMusicXmlOptions,
  filenameBase = "codigo-cartier"
) {
  const xml = generateMusicXml(timeline, options);
  const blob = new Blob([xml], {
    type: "application/vnd.recordare.musicxml+xml;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${filenameBase}.musicxml`;
  a.click();
  URL.revokeObjectURL(url);
}
