import { useEffect, useMemo, useState } from "react";
import { Note } from "tonal";
import { ALPHABET, getCipherTables } from "../../constants/cipherRules";
import { toSoundingNote } from "../../engine/HarmonyEngine";
import type {
  CipherVersion,
  MusicalMode,
  SunMoonMode,
} from "../../types/music";

interface GrandPianoProps {
  version: CipherVersion;
  mode?: MusicalMode;
  visualTheme?: SunMoonMode;
  showHints: boolean;
  onKeyPress: (cipherNote: string, soundingNote: string, letter: string) => void;
  activeMelodyNote?: string | null;
  activeAccompanimentNotes?: string[];
  enablePhysicalKeyboard?: boolean;
  enableWebMidi?: boolean;
}

const HAS_BLACK_KEY_AFTER = new Set(["C", "D", "F", "G", "A"]);
const SOL_ACTIVE_SHARPS = new Set(["C#", "F#", "G#"]);

function normalizeSharp(noteName: string): string {
  const midi = Note.midi(noteName);
  if (midi == null) return noteName.toUpperCase();
  return Note.fromMidiSharps(midi).toUpperCase();
}

export function GrandPiano({
  version,
  mode = "lua",
  visualTheme = mode,
  showHints,
  onKeyPress,
  activeMelodyNote = null,
  activeAccompanimentNotes = [],
  enablePhysicalKeyboard = true,
  enableWebMidi = true,
}: GrandPianoProps) {
  const [pressedKey, setPressedKey] = useState<string | null>(null);
  const [midiConnectedCount, setMidiConnectedCount] = useState(0);
  const { letterToNote, noteToLetter } = getCipherTables(version);

  const whiteKeys = useMemo(() => {
    return ALPHABET.map((letter) => {
      const cipherNote = letterToNote[letter];
      const match = cipherNote.match(/^([A-G])(\d)$/);
      const pitchClass = match?.[1] ?? "C";
      const octave = match?.[2] ?? "4";
      const hasBlackAfter = HAS_BLACK_KEY_AFTER.has(pitchClass);
      const sharpNote = hasBlackAfter ? `${pitchClass}#${octave}` : null;
      const sharpPitchClass = hasBlackAfter ? `${pitchClass}#` : null;
      const isSharpActiveInSol =
        mode === "sol" &&
        sharpPitchClass !== null &&
        SOL_ACTIVE_SHARPS.has(sharpPitchClass);

      return {
        letter,
        cipherNote,
        pitchClass,
        octave,
        sharpNote,
        isSharpActiveInSol,
      };
    });
  }, [letterToNote, mode]);

  const activeMelodyNormalized = useMemo(
    () => (activeMelodyNote ? normalizeSharp(activeMelodyNote) : null),
    [activeMelodyNote]
  );

  const activeAccSet = useMemo(
    () => new Set(activeAccompanimentNotes.map((n) => normalizeSharp(n))),
    [activeAccompanimentNotes]
  );

  const triggerKey = (
    cipherNote: string,
    letter: string,
    explicitSounding?: string
  ) => {
    const sounding = explicitSounding ?? toSoundingNote(cipherNote, mode);
    setPressedKey(normalizeSharp(sounding));
    onKeyPress(cipherNote, sounding, letter);
    window.setTimeout(() => {
      setPressedKey((prev) =>
        prev === normalizeSharp(sounding) ? null : prev
      );
    }, 190);
  };

  // Atalhos pelo teclado físico (A–Z) quando não estiver digitando em input/textarea
  useEffect(() => {
    if (!enablePhysicalKeyboard) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey || e.repeat) return;
      const target = e.target as HTMLElement | null;
      const tag = target?.tagName?.toLowerCase();
      if (
        tag === "input" ||
        tag === "textarea" ||
        tag === "select" ||
        target?.isContentEditable
      ) {
        return;
      }
      const upper = e.key.toUpperCase();
      if (/^[A-Z]$/.test(upper) && letterToNote[upper]) {
        const cipherNote = letterToNote[upper];
        triggerKey(cipherNote, upper);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  });

  // Controlador MIDI opcional (Web MIDI API)
  useEffect(() => {
    if (!enableWebMidi) return;
    const nav = navigator as Navigator & {
      requestMIDIAccess?: () => Promise<MIDIAccess>;
    };
    if (typeof nav.requestMIDIAccess !== "function") return;

    let cancelled = false;
    let midiAccessRef: MIDIAccess | null = null;

    const bindInputs = (access: MIDIAccess) => {
      const inputs = Array.from(access.inputs.values());
      setMidiConnectedCount(inputs.length);
      inputs.forEach((input) => {
        input.onmidimessage = (msg: MIDIMessageEvent) => {
          const data = msg.data;
          if (!data || data.length < 3) return;
          const [status, midiNumber, velocity] = data;
          const isNoteOn = (status & 0xf0) === 0x90 && velocity > 0;
          if (!isNoteOn) return;

          const sharpName = Note.fromMidiSharps(midiNumber).toUpperCase();
          // Mapeia C#->C, F#->F, G#->G quando em Modo Sol
          const naturalCandidate = sharpName.replace("#", "");
          const letter =
            noteToLetter[sharpName] ??
            (mode === "sol" ? noteToLetter[naturalCandidate] : undefined);
          if (letter && letterToNote[letter]) {
            triggerKey(letterToNote[letter], letter, sharpName);
          }
        };
      });
    };

    nav
      .requestMIDIAccess()
      .then((access) => {
        if (cancelled) return;
        midiAccessRef = access;
        bindInputs(access);
        access.onstatechange = () => bindInputs(access);
      })
      .catch(() => {
        // Permissão MIDI negada ou indisponível — falha silenciosa segura
      });

    return () => {
      cancelled = true;
      if (midiAccessRef) {
        midiAccessRef.inputs.forEach((input) => {
          input.onmidimessage = null;
        });
      }
    };
  }, [enableWebMidi, letterToNote, noteToLetter, mode]);

  const melodyGlowClass =
    visualTheme === "sol"
      ? "bg-gradient-to-b from-amber-300 to-amber-500 border-amber-700 text-stone-950 shadow-[0_0_20px_rgba(212,175,55,0.85)] translate-y-0.5"
      : visualTheme === "eclipse"
      ? "bg-gradient-to-b from-amber-200 via-violet-300 to-cyan-300 border-violet-700 text-slate-950 shadow-[0_0_22px_rgba(167,139,250,0.85)] translate-y-0.5"
      : "bg-gradient-to-b from-cyan-200 to-slate-300 border-cyan-500 text-slate-950 shadow-[0_0_20px_rgba(103,232,249,0.8)] translate-y-0.5";

  const accGlowClass =
    visualTheme === "sol"
      ? "bg-amber-100 border-amber-400 text-stone-900"
      : "bg-cyan-50 border-cyan-300 text-slate-900";

  return (
    <div className="w-full">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-2 px-1 text-[11px] text-slate-400">
        <span>
          Extensão: <strong className="font-mono">{whiteKeys[0]?.cipherNote}–{whiteKeys[whiteKeys.length - 1]?.cipherNote}</strong> (26 teclas)
          {mode === "sol"
            ? " · Modo Sol: C#, F#, G# ativos na armadura"
            : " · Modo Lua: teclas naturais ativas"}
        </span>
        <span className="font-mono text-[10px] opacity-80">
          Atalho: teclado A–Z{midiConnectedCount > 0 ? ` · MIDI (${midiConnectedCount})` : ""}
        </span>
      </div>

      <div className="relative w-full overflow-x-auto pb-4">
        <div
          className="relative flex justify-start md:justify-center min-w-max select-none px-2 pt-1"
          role="group"
          aria-label="Piano Interativo Código Cartier"
        >
          {whiteKeys.map((wk, index) => {
            const soundingForWhite = toSoundingNote(wk.cipherNote, mode);
            const normCipher = normalizeSharp(wk.cipherNote);
            const normSounding = normalizeSharp(soundingForWhite);

            const isMelodyHit =
              pressedKey === normSounding ||
              pressedKey === normCipher ||
              activeMelodyNormalized === normCipher ||
              activeMelodyNormalized === normSounding;

            const isAccHit =
              !isMelodyHit &&
              (activeAccSet.has(normCipher) || activeAccSet.has(normSounding));

            const showBlackKey =
              wk.sharpNote !== null && index < whiteKeys.length - 1;

            const sharpNorm = wk.sharpNote ? normalizeSharp(wk.sharpNote) : "";
            const isBlackMelodyHit =
              wk.sharpNote !== null &&
              (pressedKey === sharpNorm || activeMelodyNormalized === sharpNorm);
            const isBlackAccHit =
              wk.sharpNote !== null && !isBlackMelodyHit && activeAccSet.has(sharpNorm);

            return (
              <div key={`${version}-${wk.letter}`} className="relative flex-shrink-0">
                <button
                  type="button"
                  onClick={() => triggerKey(wk.cipherNote, wk.letter)}
                  aria-label={`Tecla ${wk.cipherNote} (${wk.letter})`}
                  className={`relative flex flex-col justify-end items-center mx-[1.5px] pb-2 rounded-b-lg border border-t-2 border-b-4 w-10 h-32 sm:w-11 sm:h-36 md:w-12 md:h-40 transition-all duration-100 focus:outline-none focus:ring-2 focus:ring-amber-400 ${
                    isMelodyHit
                      ? melodyGlowClass
                      : isAccHit
                      ? accGlowClass
                      : "bg-gradient-to-b from-slate-100 to-slate-200 border-slate-400 text-slate-900 hover:from-white hover:to-slate-100 shadow-md"
                  }`}
                >
                  <span className="font-bold text-xs sm:text-sm font-mono tracking-tight">
                    {wk.cipherNote}
                  </span>
                  <span
                    className={`text-[11px] font-bold font-mono mt-1 pt-1 border-t w-4/5 text-center transition-opacity ${
                      isMelodyHit
                        ? "border-slate-900/30 text-slate-950"
                        : visualTheme === "sol"
                        ? "border-slate-300 text-amber-700"
                        : "border-slate-300 text-cyan-800"
                    } ${showHints ? "opacity-100" : "opacity-0"}`}
                  >
                    {wk.letter}
                  </span>
                </button>

                {showBlackKey && wk.sharpNote && (
                  <button
                    type="button"
                    disabled={!wk.isSharpActiveInSol}
                    onClick={(e) => {
                      e.stopPropagation();
                      if (!wk.isSharpActiveInSol) return;
                      triggerKey(wk.cipherNote, wk.letter, wk.sharpNote!);
                    }}
                    aria-label={
                      wk.isSharpActiveInSol
                        ? `Tecla sustenida ${wk.sharpNote} (Modo Sol, Letra ${wk.letter})`
                        : `Tecla ${wk.sharpNote} (inativa no Modo Lua)`
                    }
                    className={`absolute top-0 -right-3 z-20 w-6 h-20 sm:h-22 md:h-24 rounded-b-md border-x border-b-4 flex flex-col justify-end items-center pb-1.5 transition-all duration-100 ${
                      wk.isSharpActiveInSol
                        ? isBlackMelodyHit
                          ? "bg-gradient-to-b from-amber-300 to-amber-500 border-amber-700 text-stone-950 shadow-[0_0_16px_rgba(245,158,11,0.9)] translate-y-0.5 cursor-pointer"
                          : isBlackAccHit
                          ? "bg-amber-800 border-amber-950 text-amber-100 cursor-pointer"
                          : "bg-gradient-to-b from-stone-800 to-stone-950 border-amber-500/60 text-amber-300 hover:from-amber-950 hover:to-stone-900 cursor-pointer shadow-lg"
                        : "bg-gradient-to-b from-slate-800 to-slate-950 border-slate-950 text-slate-600 opacity-90 cursor-default shadow-md"
                    }`}
                  >
                    {wk.isSharpActiveInSol && (
                      <span className="text-[8px] font-mono font-bold leading-none">
                        {wk.sharpNote}
                      </span>
                    )}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
