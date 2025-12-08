// --- CONFIGURAÇÃO E DADOS ---
const NOTES = ["A", "B", "C", "D", "E", "F", "G"];
const START_OCTAVE = 2;

const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");
const codeMap = {};
const reverseMap = {};

let currentNoteIndex = 0;
let currentOctave = START_OCTAVE;

// Construindo o mapa
alphabet.forEach((letter) => {
  const noteName = NOTES[currentNoteIndex];
  const fullNote = `${noteName}${currentOctave}`;
  codeMap[letter] = fullNote;
  reverseMap[fullNote] = letter;
  currentNoteIndex++;
  if (currentNoteIndex >= NOTES.length) {
    currentNoteIndex = 0;
    currentOctave++;
  }
});

// --- SISTEMA DE ÁUDIO ---
let pianoSampler;
let celloSampler;
let currentSynth;
let isAudioInit = false;
let currentInstrument = "piano";
let isPlaying = false;
let isMuted = false;

let revealTimeouts = []; // Array para guardar os timeouts da revelação

function clearTimeouts() {
  revealTimeouts.forEach(id => clearTimeout(id));
  revealTimeouts = [];
}

async function initAudio() {
  if (isAudioInit) return;
  await Tone.start();

  const reverb = new Tone.Reverb({ decay: 4, wet: 0.5 }).toDestination();

  pianoSampler = new Tone.Sampler({
    urls: {
      A2: "A2.mp3", C3: "C3.mp3", "D#3": "Ds3.mp3", "F#3": "Fs3.mp3",
      A3: "A3.mp3", C4: "C4.mp3", "D#4": "Ds4.mp3", "F#4": "Fs4.mp3",
      A4: "A4.mp3", C5: "C5.mp3", A5: "A5.mp3",
    },
    release: 1,
    baseUrl: "https://tonejs.github.io/audio/salamander/",
  }).connect(reverb);

  celloSampler = new Tone.Sampler({
    urls: {
      A2: "A2.mp3", C3: "C3.mp3", E3: "E3.mp3",
      A3: "A3.mp3", C4: "C4.mp3", E4: "E4.mp3", A4: "A4.mp3",
    },
    release: 2,
    baseUrl: "https://raw.githubusercontent.com/nbrosowsky/tonejs-instruments/master/samples/cello/",
  }).connect(reverb);

  currentSynth = pianoSampler;
  isAudioInit = true;

  document.getElementById("audio-overlay").classList.add("hidden");
  document.getElementById("audio-controls").classList.remove("hidden");
  document.getElementById("audio-controls").classList.add("flex");
}

function stopSequence() {
  clearTimeouts(); // Limpa timeouts de revelação pendentes
  Tone.Transport.stop();
  Tone.Transport.cancel();
  isPlaying = false;
  updatePlayButtonUI();
  // Garante que o botão de pular seja escondido ao parar
  document.getElementById('btn-skip-reveal').classList.add('hidden');
}

function setInstrument(inst) {
  if (isPlaying) stopSequence();

  currentInstrument = inst;
  const btnPiano = document.getElementById("btn-piano");
  const btnCello = document.getElementById("btn-cello");
  const slider = document.getElementById("instrument-slider");

  if (inst === "piano") {
    currentSynth = pianoSampler;
    slider.style.transform = "translateX(0)";
    btnPiano.classList.replace("text-slate-400", "text-white");
    btnCello.classList.replace("text-white", "text-slate-400");
  } else {
    currentSynth = celloSampler;
    slider.style.transform = "translateX(100%)";
    slider.style.left = "6px"; 

    btnCello.classList.replace("text-slate-400", "text-white");
    btnPiano.classList.replace("text-white", "text-slate-400");
  }
}

function toggleMute() {
  isMuted = !isMuted;
  Tone.Destination.mute = isMuted;

  const iconOn = document.getElementById("icon-sound-on");
  const iconOff = document.getElementById("icon-sound-off");

  if (isMuted) {
    iconOn.classList.add("hidden");
    iconOff.classList.remove("hidden");
  } else {
    iconOn.classList.remove("hidden");
    iconOff.classList.add("hidden");
  }
}

function playNote(note) {
  if (!isAudioInit || !currentSynth || isMuted) return;
  try {
    const vel = 0.6 + Math.random() * 0.4;
    const dur = currentInstrument === "cello" ? "2n" : "2n";
    currentSynth.triggerAttackRelease(note, dur, Tone.now(), vel);
  } catch (e) { console.error(e); }
}

function switchTab(tab) {
  if (isPlaying) stopSequence();
  ["encrypt", "decrypt", "legend"].forEach((t) => {
    document.getElementById(`panel-${t}`).classList.add("hidden");
    const btn = document.getElementById(`tab-${t}`);
    btn.classList.remove("border-amber-500", "text-amber-500", "font-bold");
    btn.classList.add("border-transparent", "text-slate-400");
  });
  document.getElementById(`panel-${tab}`).classList.remove("hidden");
  const activeBtn = document.getElementById(`tab-${tab}`);
  activeBtn.classList.remove("border-transparent", "text-slate-400");
  activeBtn.classList.add("border-amber-500", "text-amber-500", "font-bold");
}

// --- CIFRAGEM (Multi-linhas) ---
let currentSequence = [];

function encryptText() {
  let rawInput = document.getElementById("input-text").value;
  const lines = rawInput.split("\n");
  const wrapper = document.getElementById("encrypt-output-wrapper");
  const container = document.getElementById("encrypt-result-container");

  wrapper.innerHTML = "";
  currentSequence = [];
  container.classList.remove("hidden");

  if (!rawInput.trim()) {
    if (isPlaying) stopSequence();
    container.classList.add("hidden");
    return;
  }

  lines.forEach((lineText, lineIndex) => {
    if (!lineText.trim()) return;

    const lineContainer = document.createElement("div");
    lineContainer.className = "bg-[#1a1a1a] p-4 rounded-lg border-2 border-slate-600 shadow-inner";

    if (lines.length > 1) {
      const label = document.createElement("h4");
      label.innerText = `Partitura ${lineIndex + 1}`;
      label.className = "text-[10px] uppercase text-amber-600 font-bold mb-2 tracking-widest";
      lineContainer.appendChild(label);
    }

    const notesDiv = document.createElement("div");
    notesDiv.className = "flex flex-wrap gap-2 items-center justify-start overflow-x-auto";

    let processedLine = lineText.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase();

    for (let char of processedLine) {
      if (codeMap[char]) {
        const note = codeMap[char];
        currentSequence.push(note);

        const span = document.createElement("div");
        span.className = "flex flex-col items-center group cursor-pointer p-1 rounded hover:bg-slate-800 transition-all min-w-[30px]";
        span.onclick = () => playNote(note);

        const noteText = document.createElement("span");
        noteText.className = "text-amber-400 font-bold group-hover:text-amber-200 transition-colors text-base";
        noteText.innerText = note;

        const letterText = document.createElement("span");
        letterText.className = "decrypted-hint text-[8px] text-slate-500 mt-1 uppercase font-bold transition-all";
        letterText.innerText = char;

        span.appendChild(noteText);
        span.appendChild(letterText);
        notesDiv.appendChild(span);

        const bar = document.createElement("span");
        bar.className = "text-slate-700 mx-0 select-none font-thin text-xl opacity-30";
        bar.innerText = "|";
        notesDiv.appendChild(bar);
      } else if (char === " ") {
        const space = document.createElement("div");
        space.className = "w-6 h-1 bg-slate-600 mx-1 self-center rounded opacity-50";
        notesDiv.appendChild(space);
        currentSequence.push(null);
      }
    }
    lineContainer.appendChild(notesDiv);
    wrapper.appendChild(lineContainer);
    
    // Pausa entre linhas
    currentSequence.push(null);
    currentSequence.push(null);
  });
}

function copyToClipboard(type) {
  let rawInput = document.getElementById("input-text").value;
  const lines = rawInput.split("\n");

  const processedLines = lines.map(line => {
    if (!line.trim()) {
      return ""; // Preserva a linha vazia
    }
    const lineResult = [];
    const processed = line.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase();
    for (const char of processed) {
      if (codeMap[char]) {
        lineResult.push(type === "full" ? `${codeMap[char]} (${char})` : codeMap[char]);
      } else if (char === " ") {
        lineResult.push("|");
      }
    }
    return lineResult.join(" ");
  });

  const textToCopy = processedLines.join("\n");
  
  navigator.clipboard.writeText(textToCopy).then(() => {
    toggleCopyMenu(); // Fecha o menu
    alert("Copiado!");
  }).catch((err) => console.error("Falha ao copiar: ", err));
}

function togglePlay() {
  if (!isAudioInit) { alert("Ative o áudio primeiro!"); return; }
  if (isPlaying) stopSequence(); else playSequence();
}

function updatePlayButtonUI() {
  const icon = document.getElementById("icon-play");
  const text = document.getElementById("text-play");
  const btn = document.getElementById("btn-play-action");

  if (isPlaying) {
    icon.innerText = "stop_circle";
    text.innerText = "Parar";
    btn.classList.add("bg-red-900/50", "border-red-500");
    btn.classList.remove("bg-slate-900", "border-amber-900");
  } else {
    icon.innerText = "play_circle";
    text.innerText = "Tocar";
    btn.classList.remove("bg-red-900/50", "border-red-500");
    btn.classList.add("bg-slate-900", "border-amber-900");
  }
}

// --- FUNÇÕES DE REVELAÇÃO (DECIFRAR) ---

function translateCipher(inputText) {
  const lines = inputText.trim().toUpperCase().split('\n');
  const translatedLines = lines.map(line => {
    const tokens = line.split(/\s+/).filter(token => token.trim() !== '');
    return tokens.map(token => {
      if (token === '|') {
        return ' ';
      }
      const letter = reverseMap[token];
      return letter || '';
    }).join('');
  });
  return translatedLines.join('\n');
}

function skipReveal() {
  if (!isPlaying) return;
  
  const inputText = document.getElementById("decrypt-input").value;
  const outputElement = document.getElementById("decrypt-output");
  
  // Para a animação e preenche o texto completo imediatamente
  outputElement.value = translateCipher(inputText);
  
  // Para o áudio e reseta a UI
  stopSequence();
}

function revealCode() {
  if (!isAudioInit) { alert("Ative o áudio primeiro!"); return; }
  if (isPlaying) { stopSequence(); return; }

  const inputText = document.getElementById("decrypt-input").value;
  const outputElement = document.getElementById("decrypt-output");
  outputElement.value = ""; // Limpa antes de começar
  clearTimeouts(); // Limpa qualquer timeout de revelação anterior

  const lines = inputText.trim().toUpperCase().split('\n');

  if (lines.length === 0 || (lines.length === 1 && lines[0] === '')) return;

  // Mostra o botão de pular animação
  document.getElementById('btn-skip-reveal').classList.remove('hidden');
  
  const step = currentInstrument === "cello" ? 0.8 : 0.25;
  const duration = currentInstrument === "cello" ? "2n" : "8n";
  let currentTime = 0;

  Tone.Transport.stop();
  Tone.Transport.cancel();

  lines.forEach((line, lineIndex) => {
    const tokens = line.split(/\s+/).filter(token => token.trim() !== '');

    tokens.forEach(token => {
      // Se for barra |, é um espaço no texto
      if (token === '|') {
        const timeoutId = setTimeout(() => { outputElement.value += ' '; }, currentTime * 1000);
        revealTimeouts.push(timeoutId);
        currentTime += step; // Consome tempo como uma pausa
        return;
      }

      const letter = reverseMap[token];
      if (letter) {
        // Agenda o som
        Tone.Transport.schedule(time => {
          if (!isMuted) {
            const vel = 0.6 + Math.random() * 0.4;
            currentSynth.triggerAttackRelease(token, duration, time, vel);
          }
        }, currentTime);
        
        // Agenda a letra com setTimeout para evitar duplicação
        const timeoutId = setTimeout(() => { outputElement.value += letter; }, currentTime * 1000);
        revealTimeouts.push(timeoutId);
        
        currentTime += step;
      }
    });

    // Após processar todos os tokens de uma linha, adiciona a quebra de linha se não for a última
    if (lineIndex < lines.length - 1) {
      const timeoutId = setTimeout(() => { outputElement.value += '\n'; }, currentTime * 1000);
      revealTimeouts.push(timeoutId);
      currentTime += step * 2.0; // Pausa maior para quebra de linha
    }
  });

  // Agenda o fim para parar o botão
  Tone.Transport.schedule(() => {
    stopSequence();
  }, currentTime + 0.5);

  isPlaying = true;
  updatePlayButtonUI();
  Tone.Transport.start();
}

function copyDecryptedText() {
  const outputElement = document.getElementById("decrypt-output");
  const textToCopy = outputElement.value;

  if (!textToCopy) {
    alert("Não há nada para copiar!");
    return;
  }

  navigator.clipboard.writeText(textToCopy).then(() => {
    alert("Texto revelado copiado para a área de transferência!");
  }).catch(err => {
    console.error("Falha ao copiar texto: ", err);
  });
}

function playSequence() {
  if (currentSequence.length === 0) return;
  stopSequence();

  const step = currentInstrument === "cello" ? 0.8 : 0.25;
  const duration = currentInstrument === "cello" ? "2n" : "8n";
  let currentTime = 0;

  currentSequence.forEach((note) => {
    if (note) {
      Tone.Transport.schedule((time) => {
        if (!isMuted) {
          const vel = 0.6 + Math.random() * 0.4;
          currentSynth.triggerAttackRelease(note, duration, time, vel);
        }
      }, currentTime);
      currentTime += step;
    } else {
      currentTime += step * 2.0;
    }
  });

  Tone.Transport.schedule(() => { stopSequence(); }, currentTime + 0.5);
  isPlaying = true;
  updatePlayButtonUI();
  Tone.Transport.start();
}

function clearEncrypt() {
  if (isPlaying) stopSequence();
  document.getElementById("input-text").value = "";
  document.getElementById("encrypt-output-wrapper").innerHTML = "";
  document.getElementById("encrypt-result-container").classList.add("hidden");
  currentSequence = [];
}

function generateKeyboard() {
  const container = document.getElementById("piano-container");
  container.innerHTML = "";
  const orderedNotes = Object.values(codeMap);

  orderedNotes.forEach((note) => {
    const letter = reverseMap[note];
    const btn = document.createElement("button");
    btn.className = "note-key flex-shrink-0 flex flex-col justify-center items-center m-0.5 rounded-md shadow-lg border-b-4 focus:outline-none white-key-style w-9 h-20 sm:w-12 sm:h-28 md:w-14 md:h-32 transition-all";
    btn.innerHTML = `<span class="font-bold text-lg mb-2 z-10 text-slate-800">${note}</span><span class="hint-text text-sm font-bold text-amber-600 opacity-60 font-mono border-t border-slate-300 pt-2 w-full text-center transition-opacity">${letter}</span>`;
    btn.onclick = () => {
      playNote(note);
      const output = document.getElementById("decrypt-output");
      output.value += letter;
      btn.style.backgroundColor = "#d97706";
      btn.style.color = "white";
      setTimeout(() => {
        btn.style.backgroundColor = "#e2e8f0";
        btn.style.color = "#0f172a";
      }, 200);
    };
    container.appendChild(btn);
  });
}

function populateReferenceTable() {
  const table = document.getElementById("reference-table");
  table.innerHTML = "";
  alphabet.forEach((letter) => {
    const div = document.createElement("div");
    div.className = "bg-slate-700/30 p-2 rounded flex flex-col items-center border border-slate-600 hover:bg-slate-700 transition-colors";
    div.innerHTML = `<span class="text-amber-500 font-bold text-sm mb-1">${codeMap[letter]}</span><span class="text-slate-400 text-[10px] border-t border-slate-600 w-full pt-1">${letter}</span>`;
    table.appendChild(div);
  });
}

function toggleSecretMode() {
  const input = document.getElementById("input-text");
  const outputContainer = document.getElementById("encrypt-output-wrapper");
  const icon = document.getElementById("icon-secret");
  const text = document.getElementById("text-secret");

  input.classList.toggle("secret-mode");
  outputContainer.classList.toggle("secret-output");

  if (input.classList.contains("secret-mode")) {
    icon.innerText = "visibility_off";
    text.innerText = "Modo Sigilo (Ativo)";
    text.classList.remove("text-slate-500"); text.classList.add("text-amber-500");
  } else {
    icon.innerText = "visibility";
    text.innerText = "Modo Público";
    text.classList.add("text-slate-500"); text.classList.remove("text-amber-500");
  }
}

let areHintsVisible = true;
function toggleHints() {
  areHintsVisible = !areHintsVisible;
  document.querySelectorAll(".hint-text").forEach((h) => {
    h.style.opacity = areHintsVisible ? "1" : "0";
  });
  const icon = document.getElementById("icon-hints");
  const text = document.getElementById("text-hints");
  if (areHintsVisible) {
    icon.innerText = "visibility"; text.innerText = 'Ocultar "Cola"';
    icon.classList.remove("text-slate-500"); icon.classList.add("text-amber-500");
    text.classList.remove("text-slate-500"); text.classList.add("text-amber-500");
  } else {
    icon.innerText = "visibility_off"; text.innerText = 'Mostrar "Cola"';
    icon.classList.remove("text-amber-500"); icon.classList.add("text-slate-500");
    text.classList.remove("text-amber-500"); text.classList.add("text-slate-500");
  }
}

function toggleCopyMenu() {
  const menu = document.getElementById("copy-menu");
  if(menu) menu.classList.toggle("hidden");
}

document.addEventListener("click", function (event) {
  const menu = document.getElementById("copy-menu");
  const btn = event.target.closest('button[onclick="toggleCopyMenu()"]');
  if (!btn && menu && !menu.classList.contains("hidden")) {
    menu.classList.add("hidden");
  }
});

// Inicialização segura
window.addEventListener("DOMContentLoaded", () => {
  generateKeyboard();
  populateReferenceTable();
  // Garante que a dica começa OCULTA (false)
  areHintsVisible = true; // Inverte para chamar a função e setar false visualmente
  toggleHints(); 
});