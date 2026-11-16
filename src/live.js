// Gemini Live API client over a raw WebSocket. No SDK, no build step.
// Mic -> 16 kHz PCM -> realtimeInput.audio. Model audio (24 kHz PCM) -> speaker.
// Tool calls -> ZenMode ledger -> toolResponse. Interruptions stop playback.

import { systemInstruction, TOOL_DECLARATIONS } from './agent.js';

const HOST = 'wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService';

function b64FromBytes(bytes) {
  let s = '';
  const CH = 0x8000;
  for (let i = 0; i < bytes.length; i += CH) s += String.fromCharCode.apply(null, bytes.subarray(i, i + CH));
  return btoa(s);
}
function bytesFromB64(b64) {
  const s = atob(b64);
  const out = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
  return out;
}

export class LiveSession extends EventTarget {
  constructor({ apiKey, token, model, voice, ledger, user = 'Kamal', vadSilenceMs = 600, host }) {
    super();
    this.host = host || HOST; // host override is only for local protocol tests
    this.apiKey = apiKey;
    this.token = token;
    this.model = model;
    this.voice = voice;
    this.ledger = ledger;
    this.user = user;
    this.vadSilenceMs = vadSilenceMs;
    this.ws = null;
    this.ready = false;
    this.playCtx = null;
    this.micCtx = null;
    this.sources = new Set();
    this.nextPlay = 0;
    this.muted = false;
    this.lastVoiceAt = 0;      // last mic frame with speech energy
    this.speaking = false;     // local VAD state
    this.awaitingFirstAudio = false;
    this.turnStartedAt = 0;
    this.inText = '';
    this.outText = '';
    this.inLang = '';
  }

  emit(type, detail = {}) { this.dispatchEvent(new CustomEvent(type, { detail })); }

  url() {
    if (this.token) return `${this.host}.BidiGenerateContentConstrained?access_token=${encodeURIComponent(this.token)}`;
    return `${this.host}.BidiGenerateContent?key=${encodeURIComponent(this.apiKey)}`;
  }

  setupMessage() {
    return {
      setup: {
        model: `models/${this.model}`,
        generationConfig: {
          responseModalities: ['AUDIO'],
          speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: this.voice } } },
        },
        systemInstruction: { parts: [{ text: systemInstruction(this.user) }] },
        tools: [{ functionDeclarations: TOOL_DECLARATIONS }],
        realtimeInputConfig: {
          automaticActivityDetection: { silenceDurationMs: this.vadSilenceMs },
          activityHandling: 'START_OF_ACTIVITY_INTERRUPTS',
        },
        inputAudioTranscription: {},
        outputAudioTranscription: {},
        contextWindowCompression: { slidingWindow: {} },
      },
    };
  }

  async connect() {
    this.playCtx = new AudioContext({ sampleRate: 24000 });
    await this.playCtx.resume();
    await new Promise((resolve, reject) => {
      const ws = new WebSocket(this.url());
      this.ws = ws;
      let settled = false;
      ws.onopen = () => ws.send(JSON.stringify(this.setupMessage()));
      ws.onmessage = async (ev) => {
        const text = typeof ev.data === 'string' ? ev.data : await ev.data.text();
        let msg;
        try { msg = JSON.parse(text); } catch { return; }
        if (msg.setupComplete !== undefined && !settled) {
          settled = true;
          this.ready = true;
          this.emit('ready', { model: this.model });
          resolve();
          return;
        }
        this.onServer(msg);
      };
      ws.onerror = () => this.emit('log', { level: 'error', text: 'WebSocket error' });
      ws.onclose = (ev) => {
        this.ready = false;
        const reason = ev.reason || (ev.code === 1006 ? 'connection dropped' : '');
        this.emit('closed', { code: ev.code, reason });
        if (!settled) { settled = true; reject(new Error(`Closed before setup (${ev.code}) ${reason}`)); }
      };
    });
  }

  async startMic() {
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true, autoGainControl: true },
    });
    this.stream = stream;
    if (this.tapDest && !this.micTap) { this.micTap = this.playCtx.createMediaStreamSource(stream); this.micTap.connect(this.tapDest); }
    this.micCtx = new AudioContext();
    await this.micCtx.audioWorklet.addModule(new URL('./mic-worklet.js', import.meta.url));
    const src = this.micCtx.createMediaStreamSource(stream);
    const node = new AudioWorkletNode(this.micCtx, 'mic-capture');
    node.port.onmessage = ({ data }) => this.onMicChunk(data);
    src.connect(node);
    // The worklet has no outputs we need; keep the graph alive without echoing the mic.
    const sink = this.micCtx.createGain();
    sink.gain.value = 0;
    node.connect(sink).connect(this.micCtx.destination);
  }

  onMicChunk({ pcm, rms }) {
    this.emit('level', { rms });
    const now = performance.now();
    const voiced = rms > 0.02;
    if (voiced) {
      this.lastVoiceAt = now;
      if (!this.speaking) { this.speaking = true; this.emit('user-speaking', {}); }
    } else if (this.speaking && now - this.lastVoiceAt > 250) {
      this.speaking = false;
      this.awaitingFirstAudio = true;
      this.turnStartedAt = this.lastVoiceAt; // end of the user's speech
    }
    if (!this.ready || this.muted) return;
    this.send({ realtimeInput: { audio: { data: b64FromBytes(new Uint8Array(pcm)), mimeType: 'audio/pcm;rate=16000' } } });
  }

  send(obj) { if (this.ws && this.ws.readyState === 1) this.ws.send(JSON.stringify(obj)); }

  // A text cue, e.g. "the user just picked up the phone". Used for the greeting.
  cue(text) {
    this.turnStartedAt = performance.now();
    this.awaitingFirstAudio = true;
    this.send({ clientContent: { turns: [{ role: 'user', parts: [{ text }] }], turnComplete: true } });
  }

  setMuted(m) {
    this.muted = m;
    if (m) this.send({ realtimeInput: { audioStreamEnd: true } });
  }

  onServer(msg) {
    if (msg.toolCall) return this.onToolCall(msg.toolCall);
    if (msg.toolCallCancellation) {
      this.emit('tool-cancel', { ids: msg.toolCallCancellation.ids || [] });
      return;
    }
    if (msg.goAway) this.emit('log', { level: 'warn', text: `Server will close in ${msg.goAway.timeLeft}` });
    if (msg.usageMetadata) this.emit('usage', msg.usageMetadata);
    const sc = msg.serverContent;
    if (!sc) return;

    if (sc.interrupted) {
      this.stopPlayback();
      this.emit('interrupted', { partial: this.outText });
      this.outText = '';
    }
    if (sc.inputTranscription && sc.inputTranscription.text) {
      this.inText += sc.inputTranscription.text;
      if (sc.inputTranscription.languageCode) this.inLang = sc.inputTranscription.languageCode;
      this.emit('user-text', { text: this.inText, lang: this.inLang, final: false });
    }
    if (sc.outputTranscription && sc.outputTranscription.text) {
      this.outText += sc.outputTranscription.text;
      this.emit('zeno-text', { text: this.outText, final: false });
    }
    const parts = (sc.modelTurn && sc.modelTurn.parts) || [];
    for (const p of parts) {
      if (p.inlineData && p.inlineData.data && /audio/.test(p.inlineData.mimeType || 'audio')) {
        if (this.awaitingFirstAudio) {
          this.awaitingFirstAudio = false;
          const ms = Math.round(performance.now() - this.turnStartedAt);
          this.emit('latency', { ms });
          if (this.inText) { this.emit('user-text', { text: this.inText, lang: this.inLang, final: true }); this.inText = ''; }
        }
        this.play(p.inlineData.data);
      }
    }
    if (sc.turnComplete) {
      if (this.inText) { this.emit('user-text', { text: this.inText, lang: this.inLang, final: true }); this.inText = ''; }
      if (this.outText) this.emit('zeno-text', { text: this.outText, final: true });
      this.outText = '';
      this.emit('turn-complete', {});
    }
  }

  async onToolCall({ functionCalls = [] }) {
    const responses = [];
    for (const fc of functionCalls) {
      const before = this.ledger.state.zenScore;
      const t0 = performance.now();
      const result = this.ledger.call(fc.name, fc.args || {});
      const ms = +(performance.now() - t0).toFixed(1);
      const delta = +(this.ledger.state.zenScore - before).toFixed(1);
      this.emit('tool', { id: fc.id, name: fc.name, args: fc.args || {}, result, ms, delta });
      responses.push({ id: fc.id, name: fc.name, response: { result } });
    }
    // Latency stays measured from the end of the user's speech, so it includes the tool round trip.
    if (!this.awaitingFirstAudio) { this.awaitingFirstAudio = true; this.turnStartedAt = performance.now(); }
    this.send({ toolResponse: { functionResponses: responses } });
  }

  play(b64) {
    const bytes = bytesFromB64(b64);
    const pcm = new Int16Array(bytes.buffer, bytes.byteOffset, bytes.byteLength >> 1);
    const f32 = new Float32Array(pcm.length);
    for (let i = 0; i < pcm.length; i++) f32[i] = pcm[i] / 0x8000;
    const buf = this.playCtx.createBuffer(1, f32.length, 24000);
    buf.copyToChannel(f32, 0);
    const src = this.playCtx.createBufferSource();
    src.buffer = buf;
    src.connect(this.playCtx.destination);
    if (this.tapDest) src.connect(this.tapDest);
    const at = Math.max(this.playCtx.currentTime + 0.02, this.nextPlay);
    src.start(at);
    this.nextPlay = at + buf.duration;
    this.sources.add(src);
    this.emit('zeno-speaking', { until: this.nextPlay });
    src.onended = () => {
      this.sources.delete(src);
      if (!this.sources.size) this.emit('zeno-quiet', {});
    };
  }

  // One audio stream with the user's mic and Zeno's voice, for recording a live demo.
  audioTap() {
    if (!this.tapDest) {
      this.tapDest = this.playCtx.createMediaStreamDestination();
      if (this.stream) { this.micTap = this.playCtx.createMediaStreamSource(this.stream); this.micTap.connect(this.tapDest); }
    }
    return this.tapDest.stream;
  }

  stopPlayback() {
    for (const s of this.sources) { try { s.stop(); } catch {} }
    this.sources.clear();
    this.nextPlay = 0;
    this.emit('zeno-quiet', {});
  }

  close() {
    try { this.ws && this.ws.close(); } catch {}
    try { this.stream && this.stream.getTracks().forEach((t) => t.stop()); } catch {}
    try { this.micCtx && this.micCtx.close(); } catch {}
    try { this.playCtx && this.playCtx.close(); } catch {}
    this.ready = false;
  }
}
