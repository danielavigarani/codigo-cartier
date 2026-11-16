import { useEffect, useRef, useState } from "react";
import { Note } from "tonal";
import {
  Annotation,
  Barline,
  Dot,
  Formatter,
  GhostNote,
  Renderer,
  Stave,
  StaveConnector,
  StaveNote,
  StaveTie,
  Voice,
} from "vexflow";
import type {
  MeasureData,
  MusicalMode,
  RhythmEvent,
  SunMoonMode,
} from "../../types/music";

interface VexFlowScoreProps {
  lines: MeasureData[][];
  mode: MusicalMode;
  visualTheme?: SunMoonMode;
  secretMode?: boolean;
  showLettersUnderNotes?: boolean;
  activeEventId?: string | null;
  variant?: "dark" | "print";
  onNoteClick?: (cipherNote: string) => void;
  scoreContainerRef?: React.RefObject<HTMLDivElement | null>;
}

function durationCodeToVex(ev: RhythmEvent): {
  duration: string;
  dots: number;
} {
  const code = ev.durationCode;
  const isRest = ev.kind === "rest";
  const base = code.replace(/[r.]/g, "");
  const dotted = code.includes(".");
  if (isRest) {
    return { duration: `${base}r`, dots: dotted ? 1 : 0 };
  }
  return { duration: dotted ? `${base}d` : base, dots: dotted ? 1 : 0 };
}

function cipherNoteToVexKey(cipherNote: string): {
  key: string;
  clef: "treble" | "bass";
} {
  const match = cipherNote.match(/^([A-Ga-g])(\d)$/);
  if (!match) return { key: "c/4", clef: "treble" };
  const letter = match[1].toLowerCase();
  const octave = match[2];
  const midi = Note.midi(cipherNote) ?? 60;
  // Troca automática de clave em C4 (MIDI 60)
  const clef: "treble" | "bass" = midi >= 60 ? "treble" : "bass";
  return { key: `${letter}/${octave}`, clef };
}

interface LineScoreProps {
  lineIndex: number;
  measures: MeasureData[];
  totalLines: number;
  mode: MusicalMode;
  visualTheme: SunMoonMode;
  secretMode: boolean;
  showLettersUnderNotes: boolean;
  activeEventId: string | null;
  variant: "dark" | "print";
  onNoteClick?: (cipherNote: string) => void;
}

function LineScore({
  lineIndex,
  measures,
  totalLines,
  mode,
  visualTheme,
  secretMode,
  showLettersUnderNotes,
  activeEventId,
  variant,
  onNoteClick,
}: LineScoreProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(760);

  useEffect(() => {
    const el = hostRef.current;
    if (!el) return;
    const update = () => {
      const w = Math.floor(el.clientWidth);
      if (w > 120) setContainerWidth(w);
    };
    update();
    if (typeof ResizeObserver === "undefined") return;
    const obs = new ResizeObserver(update);
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  useEffect(() => {
    const host = hostRef.current;
    if (!host || measures.length === 0) return;
    host.innerHTML = "";

    const inkColor =
      variant === "print"
        ? "#1e1b18"
        : visualTheme === "sol"
        ? "#FDE68A"
        : "#E2E8F0";
    const chordColor =
      variant === "print"
        ? "#78350f"
        : visualTheme === "sol"
        ? "#F59E0B"
        : visualTheme === "eclipse"
        ? "#FBBF24"
        : "#67E8F9";
    const subtleColor =
      variant === "print" ? "#57534e" : "rgba(148, 163, 184, 0.72)";

    const leftMargin = 26;
    const rightMargin = 16;
    const usableWidth = Math.max(300, containerWidth - leftMargin - rightMargin);
    const measuresPerRow =
      containerWidth < 520 ? 1 : containerWidth < 860 ? 2 : 3;

    const rows: MeasureData[][] = [];
    for (let i = 0; i < measures.length; i += measuresPerRow) {
      rows.push(measures.slice(i, i + measuresPerRow));
    }

    const systemHeight = 235;
    const topPad = 40;
    const totalHeight = topPad + rows.length * systemHeight + 16;

    const renderer = new Renderer(host, Renderer.Backends.SVG);
    renderer.resize(containerWidth, totalHeight);
    const context = renderer.getContext();
    context.setFillStyle(inkColor);
    context.setStrokeStyle(inkColor);

    const svgEl = host.querySelector("svg");
    if (svgEl) {
      svgEl.setAttribute("viewBox", `0 0 ${containerWidth} ${totalHeight}`);
      svgEl.setAttribute("data-cartier-score-svg", "true");
      svgEl.setAttribute("data-line-index", String(lineIndex));
      svgEl.style.width = "100%";
      svgEl.style.height = "auto";
      svgEl.style.overflow = "visible";
    }

    const keySpec = mode === "sol" ? "A" : "Am";

    // Mapa para ligar notas com tie mesmo entre sistemas/compassos
    const drawnNoteByEventId = new Map<
      string,
      { note: StaveNote; rowIdx: number; clef: "treble" | "bass" }
    >();
    const tieLinks: Array<{ fromId: string; toId: string }> = [];

    // Identifica pares consecutivos de segmentos com tie
    const allLineEvents = measures.flatMap((m) => m.events);
    for (let i = 0; i < allLineEvents.length - 1; i++) {
      const curr = allLineEvents[i];
      const next = allLineEvents[i + 1];
      if (
        curr.kind === "note" &&
        next.kind === "note" &&
        (curr.tie === "start" || curr.tie === "continue") &&
        (next.tie === "continue" || next.tie === "end") &&
        curr.letterIndex === next.letterIndex
      ) {
        tieLinks.push({ fromId: curr.id, toId: next.id });
      }
    }

    rows.forEach((rowMeasures, rowIdx) => {
      const trebleY = topPad + rowIdx * systemHeight;
      const bassY = trebleY + 95;
      const rowMeasureCount = rowMeasures.length;
      const baseMeasureWidth = Math.floor(usableWidth / rowMeasureCount);

      rowMeasures.forEach((measure, idxInRow) => {
        const isFirstInRow = idxInRow === 0;
        const isFirstMeasureOverall = rowIdx === 0 && idxInRow === 0;
        const isLastMeasureOverall = measure.isFinalMeasure;

        const x = leftMargin + idxInRow * baseMeasureWidth;
        const width =
          idxInRow === rowMeasureCount - 1
            ? leftMargin + usableWidth - x
            : baseMeasureWidth;

        const trebleStave = new Stave(x, trebleY, width);
        const bassStave = new Stave(x, bassY, width);

        trebleStave.setStyle({ strokeStyle: subtleColor, fillStyle: inkColor });
        bassStave.setStyle({ strokeStyle: subtleColor, fillStyle: inkColor });

        if (isFirstInRow) {
          trebleStave.addClef("treble");
          bassStave.addClef("bass");
          if (mode === "sol") {
            trebleStave.addKeySignature(keySpec);
            bassStave.addKeySignature(keySpec);
          }
        }
        if (isFirstMeasureOverall) {
          trebleStave.addTimeSignature(measure.timeSignature);
          bassStave.addTimeSignature(measure.timeSignature);
        }
        if (isLastMeasureOverall) {
          trebleStave.setEndBarType(Barline.type.END);
          bassStave.setEndBarType(Barline.type.END);
        }

        trebleStave.setContext(context).draw();
        bassStave.setContext(context).draw();

        if (isFirstInRow) {
          const brace = new StaveConnector(trebleStave, bassStave)
            .setType("brace")
            .setStyle({ strokeStyle: subtleColor, fillStyle: subtleColor });
          const leftLine = new StaveConnector(trebleStave, bassStave)
            .setType("singleLeft")
            .setStyle({ strokeStyle: subtleColor });
          brace.setContext(context).draw();
          leftLine.setContext(context).draw();
        }
        const rightLine = new StaveConnector(trebleStave, bassStave)
          .setType(isLastMeasureOverall ? "boldDoubleRight" : "singleRight")
          .setStyle({ strokeStyle: subtleColor });
        rightLine.setContext(context).draw();

        // Cifra de acorde acima da pauta (nunca escreve notas do acompanhamento)
        if (measure.chord && svgEl) {
          const chordText = document.createElementNS(
            "http://www.w3.org/2000/svg",
            "text"
          );
          chordText.setAttribute("x", String(trebleStave.getNoteStartX() + 2));
          chordText.setAttribute("y", String(trebleY + 14));
          chordText.setAttribute("fill", chordColor);
          chordText.setAttribute(
            "font-family",
            '"Cormorant Garamond", Georgia, serif'
          );
          chordText.setAttribute("font-size", "16");
          chordText.setAttribute("font-weight", "700");
          chordText.textContent = measure.chord.symbol;
          svgEl.appendChild(chordText);
        }

        // Constroi vozes sincronizadas (Clave de Sol + Clave de Fá) com GhostNotes
        const trebleTickables: Array<StaveNote | GhostNote> = [];
        const bassTickables: Array<StaveNote | GhostNote> = [];
        const attachedEvents: Array<{
          ev: RhythmEvent;
          staveNote: StaveNote;
          clef: "treble" | "bass";
        }> = [];

        let lastUsedClef: "treble" | "bass" = "treble";

        measure.events.forEach((ev) => {
          const { duration, dots } = durationCodeToVex(ev);
          const ghostDur = duration.replace("r", "");

          if (ev.kind === "rest") {
            const restClef = lastUsedClef;
            const restNote = new StaveNote({
              keys: [restClef === "treble" ? "b/4" : "d/3"],
              duration,
              clef: restClef,
            });
            restNote.setStyle({ fillStyle: inkColor, strokeStyle: inkColor });
            const ghost = new GhostNote({ duration: ghostDur });

            if (restClef === "treble") {
              trebleTickables.push(restNote);
              bassTickables.push(ghost);
            } else {
              trebleTickables.push(ghost);
              bassTickables.push(restNote);
            }
            return;
          }

          const { key, clef } = cipherNoteToVexKey(ev.cipherNote ?? "C4");
          lastUsedClef = clef;

          const staveNote = new StaveNote({
            keys: [key],
            duration,
            clef,
          });
          staveNote.setStyle({ fillStyle: inkColor, strokeStyle: inkColor });
          if (dots > 0) {
            Dot.buildAndAttach([staveNote], { all: true });
          }

          if (showLettersUnderNotes && !secretMode && ev.isTieHead && ev.letter) {
            const ann = new Annotation(ev.letter)
              .setVerticalJustification(Annotation.VerticalJustify.BOTTOM)
              .setFont('"JetBrains Mono", monospace', 10, "bold");
            staveNote.addModifier(ann, 0);
          }

          const ghost = new GhostNote({ duration: ghostDur });
          if (clef === "treble") {
            trebleTickables.push(staveNote);
            bassTickables.push(ghost);
          } else {
            trebleTickables.push(ghost);
            bassTickables.push(staveNote);
          }

          attachedEvents.push({ ev, staveNote, clef });
          drawnNoteByEventId.set(ev.id, { note: staveNote, rowIdx, clef });
        });

        const [numBeats, beatValue] = measure.timeSignature
          .split("/")
          .map(Number);

        const trebleVoice = new Voice({
          num_beats: numBeats,
          beat_value: beatValue,
        })
          .setMode(Voice.Mode.SOFT)
          .addTickables(trebleTickables);

        const bassVoice = new Voice({
          num_beats: numBeats,
          beat_value: beatValue,
        })
          .setMode(Voice.Mode.SOFT)
          .addTickables(bassTickables);

        const noteStartX = Math.max(
          trebleStave.getNoteStartX(),
          bassStave.getNoteStartX()
        );
        const formatWidth = Math.max(
          80,
          trebleStave.getNoteEndX() - noteStartX - 14
        );

        new Formatter()
          .joinVoices([trebleVoice])
          .joinVoices([bassVoice])
          .format([trebleVoice, bassVoice], formatWidth);

        trebleVoice.draw(context, trebleStave);
        bassVoice.draw(context, bassStave);

        // Marca os grupos SVG de cada nota para cursor luminoso e clique interativo
        attachedEvents.forEach(({ ev, staveNote }) => {
          const el = staveNote.getSVGElement();
          if (!el) return;
          el.setAttribute("data-event-id", ev.id);
          if (ev.cipherNote) {
            el.setAttribute("data-cipher-note", ev.cipherNote);
            if (onNoteClick) {
              el.style.cursor = "pointer";
              el.addEventListener("click", () => onNoteClick(ev.cipherNote!));
            }
          }
        });
      });
    });

    // Desenha ligaduras de prolongamento (ties) entre notas consecutivas divididas
    tieLinks.forEach(({ fromId, toId }) => {
      const from = drawnNoteByEventId.get(fromId);
      const to = drawnNoteByEventId.get(toId);
      if (!from || !to) return;

      if (from.rowIdx === to.rowIdx) {
        const tie = new StaveTie({
          first_note: from.note,
          last_note: to.note,
          first_indices: [0],
          last_indices: [0],
        });
        tie.setStyle({ strokeStyle: inkColor, fillStyle: inkColor });
        tie.setContext(context).draw();
      } else {
        const tieOut = new StaveTie({
          first_note: from.note,
          last_note: null,
          first_indices: [0],
        });
        tieOut.setStyle({ strokeStyle: inkColor, fillStyle: inkColor });
        tieOut.setContext(context).draw();

        const tieIn = new StaveTie({
          first_note: null,
          last_note: to.note,
          last_indices: [0],
        });
        tieIn.setStyle({ strokeStyle: inkColor, fillStyle: inkColor });
        tieIn.setContext(context).draw();
      }
    });
  }, [
    measures,
    containerWidth,
    mode,
    visualTheme,
    secretMode,
    showLettersUnderNotes,
    variant,
    lineIndex,
    onNoteClick,
  ]);

  // Atualiza cursor luminoso em O(1) sem re-renderizar o SVG do VexFlow
  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const prevActives = host.querySelectorAll(".vf-note-active");
    prevActives.forEach((el) => el.classList.remove("vf-note-active"));

    if (activeEventId) {
      const match = host.querySelector(
        `[data-event-id="${CSS.escape(activeEventId)}"]`
      );
      if (match) {
        match.classList.add("vf-note-active");
      }
    }
  }, [activeEventId]);

  if (measures.length === 0) return null;

  return (
    <div
      className={`rounded-xl border p-3 sm:p-4 transition-colors ${
        variant === "print"
          ? "bg-amber-50 border-amber-200"
          : visualTheme === "sol"
          ? "bg-[#19120c]/85 border-amber-500/25"
          : "bg-[#090d1e]/85 border-slate-700/70"
      }`}
    >
      {totalLines > 1 && (
        <div className="flex items-center justify-between mb-1 px-1">
          <span
            className={`text-[10px] uppercase font-bold tracking-[0.22em] ${
              visualTheme === "sol" ? "text-amber-400" : "text-cyan-300"
            }`}
          >
            Partitura {lineIndex + 1}
          </span>
        </div>
      )}
      <div
        ref={hostRef}
        className={`w-full overflow-hidden ${
          secretMode ? "secret-score-mask" : ""
        }`}
      />
    </div>
  );
}

export function VexFlowScore({
  lines,
  mode,
  visualTheme = mode,
  secretMode = false,
  showLettersUnderNotes = true,
  activeEventId = null,
  variant = "dark",
  onNoteClick,
  scoreContainerRef,
}: VexFlowScoreProps) {
  const nonEmptyLines = lines
    .map((measures, lineIndex) => ({ measures, lineIndex }))
    .filter((entry) => entry.measures.length > 0);

  if (nonEmptyLines.length === 0) return null;

  return (
    <div ref={scoreContainerRef} className="space-y-4">
      {nonEmptyLines.map(({ measures, lineIndex }) => (
        <LineScore
          key={`score-line-${lineIndex}`}
          lineIndex={lineIndex}
          measures={measures}
          totalLines={nonEmptyLines.length}
          mode={mode}
          visualTheme={visualTheme}
          secretMode={secretMode}
          showLettersUnderNotes={showLettersUnderNotes}
          activeEventId={activeEventId}
          variant={variant}
          onNoteClick={onNoteClick}
        />
      ))}
    </div>
  );
}
