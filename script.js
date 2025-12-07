// --- CONFIGURAÇÃO E DADOS ---

// MUDANÇA PRINCIPAL: Escala de Lá Menor (A Minor)
// Apenas notas naturais (teclas brancas). Impossível soar desafinado.
const NOTES = ['A', 'B', 'C', 'D', 'E', 'F', 'G'];

// Começamos na Oitava 2 para ter graves profundos no Cello
const START_OCTAVE = 2; 

const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split('');
const codeMap = {};   
const reverseMap = {};

let currentNoteIndex = 0;
let currentOctave = START_OCTAVE;

// Construindo o mapa
alphabet.forEach(letter => {
    const noteName = NOTES[currentNoteIndex];
    const fullNote = `${noteName}${currentOctave}`;
    
    codeMap[letter] = fullNote;
    reverseMap[fullNote] = letter;

    currentNoteIndex++;
    // Se acabou as 7 notas da escala, sobe uma oitava
    if (currentNoteIndex >= NOTES.length) {
        currentNoteIndex = 0;
        currentOctave++;
    }
});

// --- SISTEMA DE ÁUDIO (TONE.JS COM SAMPLER) ---
let pianoSampler;
let celloSampler;
let currentSynth; 
let isAudioInit = false;
let currentInstrument = 'piano';

async function initAudio() {
    if (isAudioInit) return;
    await Tone.start();
    
    // Reverb mais longo para dar clima de "Catedral/Mistério"
    const reverb = new Tone.Reverb({
        decay: 4, 
        wet: 0.5
    }).toDestination();

    // 1. PIANO (Salamander)
    pianoSampler = new Tone.Sampler({
        urls: {
            "A2": "A2.mp3",
            "C3": "C3.mp3",
            "D#3": "Ds3.mp3",
            "F#3": "Fs3.mp3",
            "A3": "A3.mp3",
            "C4": "C4.mp3",
            "D#4": "Ds4.mp3",
            "F#4": "Fs4.mp3",
            "A4": "A4.mp3",
            "C5": "C5.mp3",
            "A5": "A5.mp3"
        },
        release: 1,
        baseUrl: "https://tonejs.github.io/audio/salamander/",
        onload: () => { console.log("Piano Carregado!"); }
    }).connect(reverb);

    // 2. VIOLONCELO (Sons reais)
    celloSampler = new Tone.Sampler({
        urls: {
            "A2": "A2.mp3",
            "C3": "C3.mp3",
            "E3": "E3.mp3",
            "A3": "A3.mp3",
            "C4": "C4.mp3",
            "E4": "E4.mp3",
            "A4": "A4.mp3"
        },
        release: 2, 
        baseUrl: "https://raw.githubusercontent.com/nbrosowsky/tonejs-instruments/master/samples/cello/",
        onload: () => { console.log("Cello Carregado!"); }
    }).connect(reverb);

    currentSynth = pianoSampler;
    isAudioInit = true;

    document.getElementById('audio-overlay').classList.add('hidden');
    const controls = document.getElementById('audio-controls');
    controls.classList.remove('hidden');
    controls.classList.add('flex');
}

function setInstrument(inst) {
    currentInstrument = inst;
    const btnPiano = document.getElementById('btn-piano');
    const btnCello = document.getElementById('btn-cello');
    
    if(inst === 'piano') {
        currentSynth = pianoSampler;
        btnPiano.classList.remove('text-slate-400', 'hover:text-white', 'bg-transparent');
        btnPiano.classList.add('bg-amber-600', 'text-white');
        btnCello.classList.add('text-slate-400', 'hover:text-white');
        btnCello.classList.remove('bg-amber-600', 'text-white');
    } else {
        currentSynth = celloSampler;
        btnCello.classList.remove('text-slate-400', 'hover:text-white', 'bg-transparent');
        btnCello.classList.add('bg-amber-600', 'text-white');
        btnPiano.classList.add('text-slate-400', 'hover:text-white');
        btnPiano.classList.remove('bg-amber-600', 'text-white');
    }
}

function playNote(note) {
    if (!isAudioInit || !currentSynth) return;
    try {
        // Humanização leve no volume (Velocity)
        const vel = 0.6 + (Math.random() * 0.4);
        currentSynth.triggerAttackRelease(note, currentInstrument === 'cello' ? "1n" : "2n", Tone.now(), vel);
    } catch(e) { console.error(e); }
}

// --- FUNÇÕES DA INTERFACE (UI) ---
function switchTab(tab) {
    ['encrypt', 'decrypt', 'legend'].forEach(t => {
        document.getElementById(`panel-${t}`).classList.add('hidden');
        const btn = document.getElementById(`tab-${t}`);
        btn.classList.remove('border-amber-500', 'text-amber-500', 'font-bold');
        btn.classList.add('border-transparent', 'text-slate-400');
    });

    document.getElementById(`panel-${tab}`).classList.remove('hidden');
    const activeBtn = document.getElementById(`tab-${tab}`);
    activeBtn.classList.remove('border-transparent', 'text-slate-400');
    activeBtn.classList.add('border-amber-500', 'text-amber-500', 'font-bold');
}

// --- LÓGICA DE CIFRAGEM (ENCRYPT) ---
let currentSequence = [];

function encryptText() {
    let input = document.getElementById('input-text').value.toUpperCase();
    input = input.normalize("NFD").replace(/[\u0300-\u036f]/g, "");

    const outputDiv = document.getElementById('encrypt-output');
    const container = document.getElementById('encrypt-result-container');
    
    outputDiv.innerHTML = '';
    currentSequence = []; 
    container.classList.remove('hidden');

    if (!input.trim()) {
        outputDiv.innerHTML = '<span class="text-slate-500 w-full text-center">Digite algo para cifrar...</span>';
        return;
    }

    for (let char of input) {
        if (codeMap[char]) {
            const note = codeMap[char];
            currentSequence.push(note);
            
            const span = document.createElement('div');
            span.className = "flex flex-col items-center mx-1 group cursor-pointer p-2 rounded hover:bg-slate-800 transition-all";
            span.title = "Clique para ouvir";
            span.onclick = () => playNote(note);
            
            const noteText = document.createElement('span');
            noteText.className = "text-amber-400 font-bold group-hover:text-amber-200 transition-colors text-lg";
            noteText.innerText = note;

            const letterText = document.createElement('span');
            letterText.className = "text-[10px] text-slate-500 mt-1 uppercase font-bold";
            letterText.innerText = char;

            span.appendChild(noteText);
            span.appendChild(letterText);
            
            // Barra simples
            const bar = document.createElement('span');
            bar.className = "text-slate-700 mx-0 select-none font-thin text-2xl opacity-30";
            bar.innerText = "|";

            outputDiv.appendChild(span);
            outputDiv.appendChild(bar);
        } else if (char === ' ') {
            const space = document.createElement('div');
            space.className = "w-6 h-1 bg-slate-700 mx-2 self-center rounded opacity-30";
            outputDiv.appendChild(space);
            currentSequence.push(null); 
        }
    }
}

async function playSequence() {
    if (!isAudioInit || !currentSynth) {
        alert("Por favor, ative o áudio no botão e aguarde o carregamento.");
        return;
    }
    if (currentSequence.length === 0) return;

    const now = Tone.now();
    let timeOffset = 0;
    
    // Ritmo mais lento e cadenciado para soar como música
    const step = currentInstrument === 'cello' ? 0.8 : 0.5; 
    const duration = currentInstrument === 'cello' ? "2n" : "4n";

    currentSequence.forEach((note) => {
        if (note) {
            // HUMANIZAÇÃO: Pequenas imperfeições de tempo e força
            const humanize = (Math.random() * 0.05);
            const velocity = 0.6 + (Math.random() * 0.4);

            currentSynth.triggerAttackRelease(note, duration, now + timeOffset + humanize, velocity);
        }
        timeOffset += step;
    });
}

function clearEncrypt() {
    document.getElementById('input-text').value = '';
    document.getElementById('encrypt-output').innerHTML = '';
    document.getElementById('encrypt-result-container').classList.add('hidden');
    currentSequence = [];
}

// --- LÓGICA DE DECIFRAGEM / TECLADO (ATUALIZADA) ---
function generateKeyboard() {
    const container = document.getElementById('piano-container');
    container.innerHTML = '';
    
    const orderedNotes = Object.values(codeMap); 
    
    orderedNotes.forEach(note => {
        // Agora todas são teclas "Brancas" (Naturais)
        const letter = reverseMap[note];
        
        const btn = document.createElement('button');
        
        // Estilo unificado (apenas teclas brancas elegantes)
        let cssClasses = "note-key flex-shrink-0 flex flex-col justify-center items-center m-1 rounded-md shadow-lg border-b-4 focus:outline-none white-key-style w-14 h-32";
        
        btn.className = cssClasses;
        
        const noteLabel = document.createElement('span');
        noteLabel.innerText = note;
        noteLabel.className = "font-bold text-lg mb-2 z-10 text-slate-800"; // Texto escuro para contraste
        
        const hintLabel = document.createElement('span');
        hintLabel.innerText = letter;
        hintLabel.className = "hint-text text-sm font-bold text-amber-600 opacity-60 font-mono border-t border-slate-300 pt-2 w-full text-center transition-opacity";
        
        btn.appendChild(noteLabel);
        btn.appendChild(hintLabel);

        btn.onclick = () => {
            playNote(note);
            const output = document.getElementById('decrypt-output');
            output.value += letter;
            
            // Efeito visual
            btn.style.backgroundColor = "#d97706"; // Amber
            btn.style.color = "white";
            setTimeout(() => {
                btn.style.backgroundColor = "#e2e8f0"; // Volta pro branco
                btn.style.color = "#0f172a";
            }, 200);
        };

        container.appendChild(btn);
    });
}

function toggleHints() {
    const show = document.getElementById('show-hints').checked;
    const hints = document.querySelectorAll('.hint-text');
    hints.forEach(h => {
        h.style.opacity = show ? '1' : '0';
    });
}

function populateReferenceTable() {
    const table = document.getElementById('reference-table');
    table.innerHTML = ''; // Limpa antes de preencher
    
    alphabet.forEach(letter => {
        const div = document.createElement('div');
        div.className = "bg-slate-700/30 p-2 rounded flex flex-col items-center border border-slate-600 hover:bg-slate-700 transition-colors";
        div.innerHTML = `
            <span class="text-amber-500 font-bold text-sm mb-1">${codeMap[letter]}</span>
            <span class="text-slate-400 text-[10px] border-t border-slate-600 w-full pt-1">${letter}</span>
        `;
        table.appendChild(div);
    });
}

window.addEventListener('DOMContentLoaded', () => {
    generateKeyboard();
    populateReferenceTable();
});