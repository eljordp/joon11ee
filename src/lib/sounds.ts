let ctx: AudioContext | null = null;

function getCtx(): AudioContext {
  if (!ctx) ctx = new AudioContext();
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}

function playTone(freq: number, duration: number, type: OscillatorType = 'sine', volume = 0.15, delay = 0) {
  try {
    const c = getCtx();
    const osc = c.createOscillator();
    const gain = c.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(volume, c.currentTime + delay);
    gain.gain.exponentialRampToValueAtTime(0.001, c.currentTime + delay + duration);
    osc.connect(gain);
    gain.connect(c.destination);
    osc.start(c.currentTime + delay);
    osc.stop(c.currentTime + delay + duration);
  } catch {}
}

function playNoise(duration: number, volume = 0.05) {
  try {
    const c = getCtx();
    const bufferSize = c.sampleRate * duration;
    const buffer = c.createBuffer(1, bufferSize, c.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * volume;
    }
    const source = c.createBufferSource();
    const gain = c.createGain();
    source.buffer = buffer;
    gain.gain.setValueAtTime(volume, c.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, c.currentTime + duration);
    source.connect(gain);
    gain.connect(c.destination);
    source.start();
  } catch {}
}

export const sounds = {
  // Slot spin tick - quick blip
  slotTick() {
    playTone(800 + Math.random() * 400, 0.05, 'square', 0.06);
  },

  // Slot reel stop - satisfying thud
  reelStop() {
    playTone(200, 0.15, 'sine', 0.2);
    playTone(150, 0.1, 'triangle', 0.1, 0.02);
  },

  // Small win - ascending happy notes
  win() {
    playTone(523, 0.12, 'sine', 0.15);
    playTone(659, 0.12, 'sine', 0.15, 0.1);
    playTone(784, 0.15, 'sine', 0.18, 0.2);
    playTone(1047, 0.2, 'sine', 0.12, 0.3);
  },

  // Big win / jackpot - fanfare
  jackpot() {
    playTone(523, 0.15, 'sine', 0.18);
    playTone(659, 0.15, 'sine', 0.18, 0.12);
    playTone(784, 0.15, 'sine', 0.18, 0.24);
    playTone(1047, 0.25, 'sine', 0.2, 0.36);
    playTone(1047, 0.15, 'sine', 0.15, 0.55);
    playTone(1175, 0.15, 'sine', 0.15, 0.65);
    playTone(1319, 0.3, 'sine', 0.2, 0.75);
  },

  // Lose - descending sad notes
  lose() {
    playTone(400, 0.15, 'sine', 0.12);
    playTone(350, 0.15, 'sine', 0.1, 0.12);
    playTone(300, 0.2, 'sine', 0.08, 0.24);
    playTone(220, 0.3, 'triangle', 0.06, 0.36);
  },

  // Place bet - chip click
  bet() {
    playNoise(0.04, 0.12);
    playTone(2000, 0.03, 'sine', 0.08);
  },

  // Card deal - whoosh + snap
  cardDeal() {
    playNoise(0.06, 0.08);
    playTone(1200, 0.04, 'sine', 0.06, 0.02);
  },

  // Card flip
  cardFlip() {
    playNoise(0.05, 0.1);
    playTone(800, 0.05, 'triangle', 0.08);
  },

  // Roulette ball bounce
  ballBounce() {
    playTone(1800 + Math.random() * 600, 0.03, 'sine', 0.08);
  },

  // Roulette ball land
  ballLand() {
    playTone(600, 0.1, 'sine', 0.15);
    playTone(400, 0.15, 'triangle', 0.1, 0.05);
    playNoise(0.08, 0.06);
  },

  // Button click
  click() {
    playTone(1000, 0.04, 'sine', 0.08);
  },

  // Spin start - rising whoosh
  spinStart() {
    playTone(200, 0.3, 'sawtooth', 0.05);
    playTone(400, 0.2, 'sawtooth', 0.04, 0.1);
    playTone(600, 0.15, 'sawtooth', 0.03, 0.2);
  },
};
