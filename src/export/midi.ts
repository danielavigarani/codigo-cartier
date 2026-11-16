import { Midi } from "@tonejs/midi";
import { TEMPO_BPM } from "../constants/cipherRules";
import type { PlaybackTimeline, TempoPreset } from "../types/music";

export function buildMidiBytes(
  timeline: PlaybackTimeline,
  tempo: TempoPreset = "andante",
  includeAccompaniment = true
): Uint8Array {
  const midi = new Midi();
  midi.name = "Código Cartier — Edição Sinfônica";
  midi.header.setTempo(TEMPO_BPM[tempo]);

  const melodyTrack = midi.addTrack();
  melodyTrack.name = "Melodia Cartier";
  melodyTrack.channel = 0;

  for (const ev of timeline.melodyEvents) {
    if (!ev.isMelody || !ev.soundingNote) continue;
    melodyTrack.addNote({
      name: ev.soundingNote,
      time: ev.startTimeSeconds,
      duration: Math.max(0.08, ev.durationSeconds),
      velocity: ev.velocity,
    });
  }

  if (includeAccompaniment && timeline.accompanimentEvents.length > 0) {
    const accTrack = midi.addTrack();
    accTrack.name = "Acompanhamento Harmônico";
    accTrack.channel = 1;

    for (const ev of timeline.accompanimentEvents) {
      if (!ev.soundingNote) continue;
      accTrack.addNote({
        name: ev.soundingNote,
        time: ev.startTimeSeconds,
        duration: Math.max(0.08, ev.durationSeconds),
        velocity: ev.velocity,
      });
    }
  }

  return midi.toArray();
}

export function downloadMidi(
  timeline: PlaybackTimeline,
  tempo: TempoPreset,
  filenameBase = "codigo-cartier",
  includeAccompaniment = true
) {
  const bytes = buildMidiBytes(timeline, tempo, includeAccompaniment);
  const blob = new Blob([bytes.buffer as ArrayBuffer], {
    type: "audio/midi",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${filenameBase}.mid`;
  a.click();
  URL.revokeObjectURL(url);
}
