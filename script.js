// --- CONFIGURAÇÃO E DADOS ---
const NOTES = ['A', 'B', 'C', 'D', 'E', 'F', 'G'];
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
let currentInstrument = 'piano';
let isPlaying = false; // Controle de estado

async function initAudio() {
    if (isAudioInit) return;
    await Tone.start();
    
    const reverb = new Tone.Reverb({ decay: 4, wet: 0.5 }).toDestination();

    pianoSampler = new Tone.Sampler({
        urls: {
            "A2": "A2.mp3", "C3": "C3.mp3", "D#3": "Ds3.mp3", "F#3": "Fs3.mp3",
            "A3": "A3.mp3", "C4": "C4.mp3", "D#4": "Ds4.mp3", "F#4": "Fs4.mp3",
            "A4": "A4.mp3", "C5": "C5.mp3", "A5": "A5.mp3"
        },
        release: 1,
        baseUrl: "https://tonejs.github.io/audio/salamander/",
    }).connect(reverb);

    celloSampler = new Tone.Sampler({
        urls: {
            "A2": "A2.mp3", "C3": "C3.mp3", "E3": "E3.mp3", "A3": "A3.mp3",
            "C4": "C4.mp3", "E4": "E4.mp3", "A4": "A4.mp3"
        },
        release: 2, 
        baseUrl: "https://raw.githubusercontent.com/nbrosowsky/tonejs-instruments/master/samples/cello/",
    }).connect(reverb);

    currentSynth = pianoSampler;
    isAudioInit = true;

    document.getElementById('audio-overlay').classList.add('hidden');
    document.getElementById('audio-controls').classList.remove('hidden');
    document.getElementById('audio-controls').classList.add('flex');
}

// FUNÇÃO MESTRA PARA PARAR TUDO
function stopSequence() {
    Tone.Transport.stop();
    Tone.Transport.cancel(); // Limpa as notas agendadas
    isPlaying = false;
    updatePlayButtonUI();
}

function setInstrument(inst) {
    // Para a música se trocar de instrumento
    if (isPlaying) stopSequence();

    currentInstrument = inst;
    const btnPiano = document.getElementById('btn-piano');
    const btnCello = document.getElementById('btn-cello');
    
    // Classes para manipulação segura (CORREÇÃO APLICADA AQUI)
    const activeClasses = ['bg-amber-600', 'text-white'];
    const inactiveClasses = ['bg-transparent', 'text-slate-400'];

    if(inst === 'piano') {
        currentSynth = pianoSampler;
        
        // Remove inativas e adiciona ativas para o Piano
        inactiveClasses.forEach(cls => btnPiano.classList.remove(cls));
        activeClasses.forEach(cls => btnPiano.classList.add(cls));
        
        // Remove ativas e adiciona inativas para o Cello
        activeClasses.forEach(cls => btnCello.classList.remove(cls));
        inactiveClasses.forEach(cls => btnCello.classList.add(cls));
        
    } else {
        currentSynth = celloSampler;
        
        // Remove inativas e adiciona ativas para o Cello
        inactiveClasses.forEach(cls => btnCello.classList.remove(cls));
        activeClasses.forEach(cls => btnCello.classList.add(cls));
        
        // Remove ativas e adiciona inativas para o Piano
        activeClasses.forEach(cls => btnPiano.classList.remove(cls));
        inactiveClasses.forEach(cls => btnPiano.classList.add(cls));
    }
}

function playNote(note) {
    if (!isAudioInit || !currentSynth) return;
    try {
        const vel = 0.6 + (Math.random() * 0.4);
        const dur = currentInstrument === 'cello' ? "2n" : "2n"; 
        currentSynth.triggerAttackRelease(note, dur, Tone.now(), vel);
    } catch(e) { console.error(e); }
}

// --- INTERFACE ---
function switchTab(tab) {
    // Para a música se trocar de aba
    if (isPlaying) stopSequence();

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

// --- CIFRAGEM E PLAYBACK ---
let currentSequence = [];

function encryptText() {
    let rawInput = document.getElementById('input-text').value;
    let input = rawInput.replace(/[\n\t]/g, ' ').normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase();

    const outputDiv = document.getElementById('encrypt-output');
    const container = document.getElementById('encrypt-result-container');
    
    outputDiv.innerHTML = '';
    currentSequence = []; 
    container.classList.remove('hidden');

    if (!input.trim()) {
        if(isPlaying) stopSequence();
        outputDiv.innerHTML = '<span class="text-slate-500 w-full text-center">Digite algo para cifrar...</span>';
        return;
    }

    for (let char of input) {
        if (codeMap[char]) {
            const note = codeMap[char];
            currentSequence.push(note);
            
            const span = document.createElement('div');
            span.className = "flex flex-col items-center mx-1 group cursor-pointer p-2 rounded hover:bg-slate-800 transition-all";
            span.onclick = () => playNote(note);
            
            const noteText = document.createElement('span');
            noteText.className = "text-amber-400 font-bold group-hover:text-amber-200 transition-colors text-lg";
            noteText.innerText = note;

            const letterText = document.createElement('span');
            letterText.className = "decrypted-hint text-[10px] text-slate-500 mt-1 uppercase font-bold transition-all";
            letterText.innerText = char;

            span.appendChild(noteText);
            span.appendChild(letterText);
            outputDiv.appendChild(span);
            
            const bar = document.createElement('span');
            bar.className = "text-slate-700 mx-0 select-none font-thin text-2xl opacity-30";
            bar.innerText = "|";
            outputDiv.appendChild(bar);

        } else if (char === ' ') {
            const space = document.createElement('div');
            space.className = "w-10 h-1 bg-slate-600 mx-2 self-center rounded opacity-50"; 
            outputDiv.appendChild(space);
            currentSequence.push(null); 
        }
    }
}

// --- LÓGICA PLAY/PAUSE ---
function togglePlay() {
    if (!isAudioInit) {
        alert("Ative o áudio primeiro!");
        return;
    }
    
    if (isPlaying) {
        stopSequence(); // Se está tocando, PARA.
    } else {
        playSequence(); // Se está parado, TOCA.
    }
}

function updatePlayButtonUI() {
    const icon = document.getElementById('icon-play');
    const text = document.getElementById('text-play');
    const btn = document.getElementById('btn-play-action');

    if (isPlaying) {
        icon.innerText = "stop_circle";
        text.innerText = "Parar Sequência";
        btn.classList.add('bg-red-900/50', 'border-red-500');
        btn.classList.remove('bg-slate-900', 'border-amber-900');
    } else {
        icon.innerText = "play_circle";
        text.innerText = "Tocar Sequência";
        btn.classList.remove('bg-red-900/50', 'border-red-500');
        btn.classList.add('bg-slate-900', 'border-amber-900');
    }
}

function playSequence() {
    if (currentSequence.length === 0) return;

    // Reseta antes de começar
    stopSequence();

    const step = currentInstrument === 'cello' ? 0.8 : 0.25; 
    const duration = currentInstrument === 'cello' ? "2n" : "8n";
    let currentTime = 0;

    // Agenda as notas na linha do tempo
    currentSequence.forEach((note) => {
        if (note) {
            Tone.Transport.schedule((time) => {
                const vel = 0.6 + (Math.random() * 0.4);
                currentSynth.triggerAttackRelease(note, duration, time, vel);
            }, currentTime);
            currentTime += step;
        } else {
            currentTime += (step * 2.0); // Pausa
        }
    });

    // Agenda o fim para resetar o botão automaticamente
    Tone.Transport.schedule(() => {
        stopSequence();
    }, currentTime + 0.5);

    isPlaying = true;
    updatePlayButtonUI();
    Tone.Transport.start();
}

function clearEncrypt() {
    if(isPlaying) stopSequence();
    document.getElementById('input-text').value = '';
    document.getElementById('encrypt-output').innerHTML = '';
    document.getElementById('encrypt-result-container').classList.add('hidden');
    currentSequence = [];
}

// --- TECLADO E UTILITÁRIOS ---
function generateKeyboard() {
    const container = document.getElementById('piano-container');
    container.innerHTML = '';
    const orderedNotes = Object.values(codeMap); 
    
    orderedNotes.forEach(note => {
        const letter = reverseMap[note];
        const btn = document.createElement('button');
        btn.className = "note-key flex-shrink-0 flex flex-col justify-center items-center m-1 rounded-md shadow-lg border-b-4 focus:outline-none white-key-style w-14 h-32";
        
        btn.innerHTML = `
            <span class="font-bold text-lg mb-2 z-10 text-slate-800">${note}</span>
            <span class="hint-text text-sm font-bold text-amber-600 opacity-60 font-mono border-t border-slate-300 pt-2 w-full text-center transition-opacity">${letter}</span>
        `;

        btn.onclick = () => {
            playNote(note);
            const output = document.getElementById('decrypt-output');
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
    const table = document.getElementById('reference-table');
    table.innerHTML = ''; 
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

function toggleSecretMode() {
    const input = document.getElementById('input-text');
    const outputContainer = document.getElementById('encrypt-output');
    const icon = document.getElementById('icon-secret');
    const text = document.getElementById('text-secret');
    
    input.classList.toggle('secret-mode');
    outputContainer.classList.toggle('secret-output');
    
    if (input.classList.contains('secret-mode')) {
        icon.innerText = 'visibility_off';
        text.innerText = 'Modo Sigilo (Ativo)';
        text.classList.remove('text-slate-500');
        text.classList.add('text-amber-500');    
    } else {
        icon.innerText = 'visibility';
        text.innerText = 'Modo Público';
        text.classList.add('text-slate-500');
        text.classList.remove('text-amber-500');
    }
}

let areHintsVisible = true;
function toggleHints() {
    areHintsVisible = !areHintsVisible;
    document.querySelectorAll('.hint-text').forEach(h => {
        h.style.opacity = areHintsVisible ? '1' : '0';
    });

    const icon = document.getElementById('icon-hints');
    const text = document.getElementById('text-hints');

    if (areHintsVisible) {
        icon.innerText = 'visibility';
        text.innerText = 'Ocultar "Cola"';
        icon.classList.remove('text-slate-500');
        icon.classList.add('text-amber-500');
        text.classList.remove('text-slate-500');
        text.classList.add('text-amber-500');
    } else {
        icon.innerText = 'visibility_off';
        text.innerText = 'Mostrar "Cola"';
        icon.classList.remove('text-amber-500');
        icon.classList.add('text-slate-500');
        text.classList.remove('text-amber-500');
        text.classList.add('text-slate-500');
    }
}

window.addEventListener('DOMContentLoaded', () => {
    generateKeyboard();
    populateReferenceTable();
});