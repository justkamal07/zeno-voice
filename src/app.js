import { createLedger } from './ledger.js';
import { zenoSVG, MARK_PATH } from './zeno.js';
import { MODELS, VOICES } from './agent.js';
import { DEMO } from './demo.js';
import { LiveSession } from './live.js';

const $ = (id) => document.getElementById(id);
const params = new URLSearchParams(location.search);
const REC = params.has('record');
const SPEED = Number(params.get('speed')) || 1;
document.getElementById('markPath').setAttribute('d', MARK_PATH);
if (REC) document.body.classList.add('rec');
if (params.get('theme')) document.documentElement.dataset.theme = params.get('theme');

const LANG_LABEL = {
  en: 'English', ta: 'தமிழ் · Tamil', hi: 'हिन्दी · Hindi', 'ta-Latn': 'Tanglish', 'hi-Latn': 'Hinglish',
  te: 'Telugu', kn: 'Kannada', bn: 'Bengali', mr: 'Marathi', ml: 'Malayalam',
};

let ledger = createLedger(() => clockNow());
let simClock = null; // demo clock (Date) or null for real time
const clockNow = () => simClock || new Date();

/* ---------- island & phone ---------- */
const island = $('island');
$('islZeno').innerHTML = zenoSVG({ feeling: 'pleasant' });
const islZeno = () => island.querySelector('.zeno');

function setFeeling(f) { const z = islZeno(); if (z) z.dataset.feeling = f; }
function hop() { island.classList.remove('hop'); void island.offsetWidth; island.classList.add('hop'); }
function islandState(state, line = '', sub = '', right = null) {
  island.dataset.state = state;
  if (line) $('islLine').textContent = line;
  $('islSub').textContent = sub;
  $('islRight').textContent = right == null ? ledger.state.zenScore.toFixed(1) : right;
}
function restIsland() {
  const s = ledger.state;
  const open = s.sessions.find((x) => !x.endedAt);
  if (s.focus) return islandState('focus', s.focus.label, '', `${s.focus.minutes}:00`);
  if (open) return islandState('timer', `${open.app} · intent`, '', fmtLeft(open));
  islandState('compact');
}
function fmtLeft(sess) {
  const ms = Math.max(0, new Date(sess.endsAt) - clockNow());
  const m = Math.floor(ms / 60000), sec = Math.floor((ms % 60000) / 1000);
  return `${m}:${String(sec).padStart(2, '0')}`;
}

function renderWeek() {
  const s = ledger.state;
  const TODAY = 4; // Friday in the sample week. Mon, Tue and Thu were good days.
  const past = ['good', 'good', '', 'good'];
  const todayGood = s.zenScore > 6 && s.rows.some((r) => r.kind !== 'read');
  $('week').innerHTML = [0, 1, 2, 3, 4, 5, 6].map((i) => {
    const cls = i < TODAY ? past[i] : i === TODAY ? 'today' + (todayGood ? ' good' : '') : '';
    return `<span class="${cls}"></span>`;
  }).join('');
  $('weekLine').textContent = todayGood
    ? `Today makes ${s.goodDaysThisWeek + 1} of 4. The week is won.`
    : `${s.goodDaysThisWeek} of 4 good days. Keep today above 6 to win the week.`;
}

function renderPhone() {
  const s = ledger.state;
  $('score').textContent = s.zenScore.toFixed(1);
  const d = +(s.zenScore - s.startScore).toFixed(1);
  const pill = $('delta');
  pill.textContent = `${d >= 0 ? '+' : '−'}${Math.abs(d).toFixed(1)} today`;
  pill.classList.toggle('ember', d < 0);
  const items = [];
  const open = s.sessions.find((x) => !x.endedAt);
  if (open) {
    const pct = Math.min(100, 100 * (clockNow() - new Date(open.startedAt)) / (open.minutes * 60000));
    items.push(`<div class="now-item"><span class="ic" style="background:#E1306C">IG</span><span class="tx"><b>${esc(open.app)} · ${open.minutes} min</b><span>${esc(open.purpose || 'Intent set')}</span><div class="bar"><i style="width:${pct}%"></i></div></span><span class="num" style="font-size:13px">${fmtLeft(open)}</span></div>`);
  }
  if (s.focus) items.push(`<div class="now-item"><span class="ic" style="background:#0F7A18">◷</span><span class="tx"><b>Focus · ${s.focus.minutes} min</b><span>${esc(s.focus.label)} · ${s.focus.devices_quieted.length} screens quiet</span></span></div>`);
  if (s.pauses.length) items.push(`<div class="now-item"><span class="ic" style="background:#B34700">7s</span><span class="tx"><b>Pause before opening</b><div class="chips" style="margin-top:4px">${s.pauses.map((p) => `<span class="chip">${esc(p.app)} · ${p.seconds}s</span>`).join('')}</div></span></div>`);
  const done = s.sessions.filter((x) => x.endedAt && x.onTime);
  if (done.length && !open) items.push(`<div class="now-item"><span class="ic" style="background:#2AA136">✓</span><span class="tx"><b>${done.length} intent${done.length > 1 ? 's' : ''} kept on time</b><span>${esc(done.map((x) => x.app).join(', '))}</span></span></div>`);
  $('nowList').innerHTML = items.join('') || '<div class="empty">Nothing running. Pick up the phone and tell Zeno why.</div>';
  const used = s.screenMinutes, prom = s.promiseHours * 60;
  $('promiseLabel').textContent = `${Math.floor(used / 60)}h ${used % 60}m of your ${s.promiseHours}h promise`;
  $('promiseBar').style.width = Math.min(100, (100 * used) / prom) + '%';
  renderWeek();
  const card = s.cards[s.cards.length - 1];
  if (card && !$('cardSlot').dataset.card) {
    $('cardSlot').dataset.card = card.id;
    $('cardSlot').innerHTML = zenCard(card);
  }
  renderKpis();
}

function zenCard(c) {
  return `<div class="zcard" id="zcard"><svg class="hz" viewBox="0 0 300 64" preserveAspectRatio="none" aria-hidden="true">
    <rect width="300" height="64" fill="#FBF1D6"/>
    <path d="M0 40 C40 30 70 34 100 28 C140 20 170 30 210 24 C250 18 280 26 300 22 V64 H0Z" fill="#E9D9A6"/>
    <path d="M0 50 C50 40 90 46 140 40 C190 34 240 44 300 38 V64 H0Z" fill="#D9C27F"/>
    <path d="M0 58 C60 52 120 56 170 52 C220 48 260 54 300 50 V64 H0Z" fill="#B99B4A"/>
    <rect x="218" y="12" width="10" height="10" rx="2" fill="#FFC800"/><rect x="214" y="8" width="18" height="18" rx="4" fill="none" stroke="#FFC800" stroke-opacity=".5"/>
  </svg>
  <div class="q">${esc(c.question)}</div>
  <div class="a">${esc(c.answer)}</div>
  <div class="d">${esc(c.detail)}</div>
  <div class="sig"><span>KAMAL · NOV 2026</span><span>ZENMODE OS</span></div>
  <span class="stamp">SHARED · 2 ZEN BROS</span></div>`;
}

function renderKpis() {
  const o = ledger.outcomes();
  $('kScore').textContent = `${o.delta >= 0 ? '+' : '−'}${Math.abs(o.delta).toFixed(1)}`;
  $('kIntent').textContent = Math.round(o.intentRate * 100) + '%';
  $('kMin').textContent = o.minutesProtected;
}

const esc = (t) => String(t ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

/* ---------- side panels ---------- */
const convo = $('convo');
let liveUserRow = null, liveZenoRow = null;
function addMsg(who, text, { lang, tag, latency, cut } = {}) {
  const el = document.createElement('div');
  el.className = `msg ${who}${cut ? ' cut' : ''}`;
  const avatar = who === 'zeno' ? zenoSVG({ feeling: 'pleasant' }) : '<span class="me">K</span>';
  const label = tag || LANG_LABEL[lang] || lang || '';
  el.innerHTML = `<div class="who">${avatar}</div><div class="body"><div class="meta"><span>${who === 'zeno' ? 'ZENO' : 'KAMAL'}</span>${label ? `<span class="lang">${esc(label)}</span>` : ''}${latency ? `<span class="lat">first audio ${latency} ms</span>` : ''}</div><div class="text"></div></div>`;
  el.querySelector('.text').textContent = text;
  convo.appendChild(el);
  convo.scrollTop = convo.scrollHeight;
  return el;
}
function addSys(text, cls = '') {
  const el = document.createElement('div');
  el.className = 'sys ' + cls;
  el.textContent = text;
  convo.appendChild(el);
  convo.scrollTop = convo.scrollHeight;
}
function argStr(args) {
  return Object.entries(args || {}).map(([k, v]) => `${k}: ${typeof v === 'string' ? `"${v.length > 34 ? v.slice(0, 33) + '…' : v}"` : JSON.stringify(v)}`).join(', ');
}
function resultStr(name, r) {
  if (!r || r.ok === false) return `error · ${r && r.error}`;
  switch (name) {
    case 'set_intent': return `Session ${r.session_id} · ${r.app} for ${r.minutes} min · timer in the island`;
    case 'end_session': return `Session ${r.session_id} closed · ${r.on_time ? 'on time' : 'ran over'}`;
    case 'start_focus': return `Focus ${r.minutes} min · quiet on ${r.devices_quieted.join(', ')}`;
    case 'pause_app': return `${r.app} now waits ${r.seconds}s before opening`;
    case 'get_zen_status': return `Score ${r.zen_score} · ${r.minutes_left_in_promise} min left · ${r.good_days_this_week}/4 good days`;
    case 'log_reflection': return `Zen Card ${r.card.id}: "${r.card.answer}"`;
    case 'share_with_circle': return `Sent to ${r.shared_with.join(', ')}`;
    default: return JSON.stringify(r).slice(0, 90);
  }
}
function addAct(name, args, result, ms, delta) {
  const el = document.createElement('div');
  el.className = 'act';
  const d = delta ? `<span class="d ${delta > 0 ? 'up' : 'down'}">${delta > 0 ? '+' : '−'}${Math.abs(delta).toFixed(1)}</span>` : '<span class="d"></span>';
  el.innerHTML = `<code><b>${esc(name)}</b>(${esc(argStr(args))})</code>${d}<span class="res">${esc(resultStr(name, result))}</span><span class="ms">${ms} ms</span>`;
  $('acts').prepend(el);
}
function runTool(name, args) {
  const before = ledger.state.zenScore;
  const t0 = performance.now();
  const result = ledger.call(name, args);
  const ms = +(performance.now() - t0).toFixed(1);
  addAct(name, args, result, ms, +(ledger.state.zenScore - before).toFixed(1));
  renderPhone();
  return result;
}

/* ---------- demo replay ---------- */
const sleep = (ms) => new Promise((r) => setTimeout(r, ms / SPEED));
let playing = false, stopFlag = false;

async function typeInto(el, text, ms, onWord) {
  const t = el.querySelector('.text');
  const words = text.split(' ');
  const per = Math.max(40, ms / Math.max(1, words.length));
  t.textContent = '';
  for (let i = 0; i < words.length; i++) {
    if (stopFlag) return;
    t.textContent = words.slice(0, i + 1).join(' ');
    if (onWord) onWord(t.textContent);
    convo.scrollTop = convo.scrollHeight;
    await sleep(per);
  }
}

function caption(n, text) {
  const bar = $('capbar');
  if (!n) { bar.classList.remove('on'); return; }
  $('capN').textContent = n;
  $('capText').textContent = text;
  bar.classList.add('on');
}

/* ---------- replay voices (synthesized, see src/demo.js) ---------- */
const VOICE_BASE = 'demo/voice/';
let durations = {};
fetch(VOICE_BASE + 'durations.json').then((r) => (r.ok ? r.json() : {})).then((d) => { durations = d; }).catch(() => {});
let voicesOn = !params.has('mute');
let currentClip = null;
const mark = (kind, extra = '') => { if (REC) console.log(`EVT ${kind} ${Date.now()} ${extra}`); };
const clipMs = (step) => (step.clip && durations[step.clip] ? Math.round(durations[step.clip] * 1000) : step.ms);
function fadeOut(a) {
  if (!a) return;
  let v = a.volume;
  const t = setInterval(() => { v -= 0.25; if (v <= 0) { a.pause(); clearInterval(t); } else a.volume = v; }, 15);
}
function playClip(id, maxMs = 0) {
  if (!id) return null;
  mark('CLIP', `${id} ${maxMs}`);
  if (!voicesOn || REC) return null; // the recorder mixes the audio track afterwards
  const a = new Audio(VOICE_BASE + id + '.mp3');
  a.play().catch(() => {});
  currentClip = a;
  if (maxMs) setTimeout(() => fadeOut(a), maxMs / SPEED);
  return a;
}

async function playDemo() {
  if (playing) return;
  resetAll();
  playing = true; stopFlag = false;
  $('playBtn').disabled = true;
  simClock = new Date(2026, 10, 20, 22, 2, 0);
  tickClock();
  for (const step of DEMO) {
    if (stopFlag) break;
    switch (step.do) {
      case 'caption': caption(step.n, step.text); if (step.n) await sleep(900); break;
      case 'pickup': {
        ledger.call('record_pickup');
        addSys(`Phone picked up · ${step.clock}`);
        hop(); setFeeling('listening');
        islandState('expanded', '…', 'Zeno · Gemini Live');
        await sleep(700);
        break;
      }
      case 'zeno': {
        let text = step.text.replace('{score}', ledger.state.zenScore.toFixed(1)).replace('{delta}', (ledger.state.zenScore - ledger.state.startScore).toFixed(1));
        setFeeling(step.feel || 'pleasant');
        islandState('expanded', text, 'Zeno · speaking');
        island.classList.add('talking');
        const el = addMsg('zeno', '', { lang: step.lang });
        const dur = step.cut ? step.ms : clipMs(step);
        playClip(step.clip, step.cut ? step.ms : 0);
        await typeInto(el, text, Math.max(300, dur - 250));
        await sleep(step.cut ? 0 : 250);
        island.classList.remove('talking');
        if (step.cut) { el.classList.add('cut'); break; }
        hop();
        await sleep(900);
        restIsland();
        break;
      }
      case 'interrupt': {
        island.classList.remove('talking');
        setFeeling('listening');
        addSys('↯ Interrupted · Zeno stops mid-sentence and listens', 'int');
        islandState('expanded', 'Listening…', 'Zeno · listening');
        await sleep(150);
        break;
      }
      case 'user': {
        setFeeling('listening');
        islandState('expanded', '…', 'Zeno · listening');
        const el = addMsg('user', '', { lang: step.lang, tag: step.tag });
        const dur = clipMs(step);
        playClip(step.clip);
        await typeInto(el, step.text, Math.max(300, dur - 250), (sofar) => { $('islLine').textContent = sofar.length > 70 ? '…' + sofar.slice(-68) : sofar; });
        await sleep(250);
        setFeeling('thinking');
        islandState('expanded', 'On it…', 'Gemini · reasoning');
        await sleep(450);
        break;
      }
      case 'tool': {
        mark('TOOL', step.name);
        runTool(step.name, step.args);
        await sleep(650);
        break;
      }
      case 'skip': {
        addSys(`· · · ${step.label} · · ·`);
        if (step.clock) {
          const [h, m] = step.clock.split(':').map(Number);
          simClock = new Date(2026, 10, 20, h, m, 0);
          tickClock();
        }
        renderPhone(); restIsland();
        await sleep(900);
        break;
      }
    }
  }
  caption(0);
  $('zcard') && $('zcard').classList.add('shared');
  setFeeling('happy');
  restIsland();
  playing = false;
  $('playBtn').disabled = false;
  $('playBtn').textContent = 'Play again';
  if (REC) setTimeout(() => endCard(), 2200 / SPEED);
}

function tickClock() {
  const d = clockNow();
  $('clock').textContent = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function resetAll() {
  stopFlag = true;
  if (currentClip) { try { currentClip.pause(); } catch {} currentClip = null; }
  ledger = createLedger(() => clockNow());
  convo.innerHTML = '';
  $('acts').innerHTML = '';
  $('cardSlot').innerHTML = '';
  delete $('cardSlot').dataset.card;
  $('kLat').textContent = '—';
  latencies.length = 0;
  setFeeling('pleasant');
  islandState('compact');
  renderPhone();
}

/* ---------- live mode ---------- */
let live = null;
const latencies = [];
const modelSel = $('model'), voiceSel = $('voice');
MODELS.forEach((m) => modelSel.add(new Option(m.label, m.id)));
VOICES.forEach((v) => voiceSel.add(new Option(v, v)));
if (params.get('model')) modelSel.value = params.get('model');

function setStatus(text, cls = '') { const s = $('liveStatus'); s.textContent = text; s.className = 'status ' + cls; }

async function connectLive() {
  if (live) { live.close(); live = null; }
  const apiKey = $('apiKey').value.trim();
  let token = params.get('token') || '';
  if (!apiKey && !token && !params.get('ws')) {
    // When served by the Cloud Run token server, /token hands out a single-use ephemeral token.
    try {
      const ctl = new AbortController(); setTimeout(() => ctl.abort(), 4000);
      const r = await fetch('token', { signal: ctl.signal, cache: 'no-store' });
      if (r.ok) token = (await r.json()).token || '';
    } catch {}
    if (!token) { setStatus('Paste a Gemini API key first', 'err'); return; }
  }
  resetAll();
  stopFlag = false;
  simClock = null; tickClock();
  setStatus('Connecting…');
  live = new LiveSession({ apiKey, token, model: modelSel.value, voice: voiceSel.value, ledger, user: 'Kamal', host: params.get('ws') || undefined });
  wireLive(live);
  try {
    await live.connect();
    setStatus(`Connected · ${modelSel.value}`, 'ok');
    $('pickupBtn').disabled = false;
    $('micBtn').disabled = false;
    $('recBtn').disabled = false;
    $('connectBtn').textContent = 'Reconnect';
  } catch (e) {
    setStatus(e.message, 'err');
  }
}

function wireLive(s) {
  s.addEventListener('level', ({ detail }) => {
    $('meter').style.width = Math.min(100, detail.rms * 600) + '%';
  });
  s.addEventListener('user-speaking', () => { setFeeling('listening'); });
  s.addEventListener('user-text', ({ detail }) => {
    if (!liveUserRow) liveUserRow = addMsg('user', '', { lang: detail.lang });
    liveUserRow.querySelector('.text').textContent = detail.text;
    if (detail.lang) liveUserRow.querySelector('.meta').innerHTML = `<span>KAMAL</span><span class="lang">${esc(LANG_LABEL[detail.lang] || detail.lang)}</span>`;
    islandState('expanded', detail.text.slice(-60), 'Zeno · listening');
    if (detail.final) liveUserRow = null;
    convo.scrollTop = convo.scrollHeight;
  });
  s.addEventListener('zeno-text', ({ detail }) => {
    if (!liveZenoRow) liveZenoRow = addMsg('zeno', '', {});
    liveZenoRow.querySelector('.text').textContent = detail.text;
    islandState('expanded', detail.text.slice(-90), 'Zeno · speaking');
    if (detail.final) liveZenoRow = null;
    convo.scrollTop = convo.scrollHeight;
  });
  s.addEventListener('latency', ({ detail }) => {
    latencies.push(detail.ms);
    const sorted = [...latencies].sort((a, b) => a - b);
    $('kLat').textContent = sorted[Math.floor(sorted.length / 2)] + 'ms';
    $('kLatLabel').textContent = `First audio, median of ${latencies.length}`;
    if (!liveZenoRow) liveZenoRow = addMsg('zeno', '', { latency: detail.ms });
    else liveZenoRow.querySelector('.meta').insertAdjacentHTML('beforeend', `<span class="lat">first audio ${detail.ms} ms</span>`);
  });
  s.addEventListener('zeno-speaking', () => { island.classList.add('talking'); setFeeling('happy'); });
  s.addEventListener('zeno-quiet', () => { island.classList.remove('talking'); setTimeout(() => { if (!island.classList.contains('talking')) restIsland(); }, 1600); });
  s.addEventListener('interrupted', () => {
    if (liveZenoRow) { liveZenoRow.classList.add('cut'); liveZenoRow = null; }
    addSys('↯ Interrupted · Zeno stopped and is listening', 'int');
    setFeeling('listening');
  });
  s.addEventListener('tool', ({ detail }) => {
    addAct(detail.name, detail.args, detail.result, detail.ms, detail.delta);
    setFeeling('thinking');
    renderPhone();
  });
  s.addEventListener('closed', ({ detail }) => {
    setStatus(`Disconnected (${detail.code}) ${detail.reason || ''}`, detail.code === 1000 ? '' : 'err');
    $('pickupBtn').disabled = true; $('micBtn').disabled = true;
    if (recorder && recorder.state !== 'inactive') recorder.stop();
    $('recBtn').disabled = true;
    $('micBtn').classList.remove('on'); $('micLabel').textContent = 'Mic off';
  });
  s.addEventListener('log', ({ detail }) => addSys(detail.text, detail.level === 'error' ? 'int' : ''));
}

async function toggleMic() {
  if (!live) return;
  const btn = $('micBtn');
  if (!live.stream) {
    try { await live.startMic(); } catch (e) { setStatus('Microphone blocked: ' + e.message, 'err'); return; }
    btn.classList.add('on'); btn.setAttribute('aria-pressed', 'true'); $('micLabel').textContent = 'Mic on';
    return;
  }
  const m = !live.muted;
  live.setMuted(m);
  btn.classList.toggle('on', !m); btn.setAttribute('aria-pressed', String(!m));
  $('micLabel').textContent = m ? 'Mic muted' : 'Mic on';
}

async function pickup() {
  if (!live) return;
  if (!live.stream) await toggleMic();
  ledger.call('record_pickup');
  renderKpis();
  const t = new Date();
  addSys(`Phone picked up · ${t.toTimeString().slice(0, 5)}`);
  hop(); setFeeling('listening');
  islandState('expanded', '…', 'Zeno · Gemini Live');
  live.cue(`[ZenMode event] Kamal just picked up the phone at ${t.toTimeString().slice(0, 5)}. Greet him by name in one short line and ask what he is here for.`);
}

/* ---------- record a real live demo: this tab + your mic + Zeno's voice ---------- */
let recorder = null, recTimer = null;
async function toggleRecord() {
  if (recorder) { recorder.stop(); return; }
  if (!live || !live.ready) { setStatus('Connect first, then record', 'err'); return; }
  if (!live.stream) await toggleMic();
  let display;
  try {
    display = await navigator.mediaDevices.getDisplayMedia({ video: { frameRate: 30 }, audio: false, preferCurrentTab: true, selfBrowserSurface: 'include' });
  } catch (e) { setStatus('Screen capture was not allowed', 'err'); return; }
  const stream = new MediaStream([...display.getVideoTracks(), ...live.audioTap().getAudioTracks()]);
  const mime = ['video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm'].find((t) => MediaRecorder.isTypeSupported(t));
  const chunks = [];
  recorder = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 4000000 });
  recorder.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data); };
  recorder.onstop = () => {
    display.getTracks().forEach((t) => t.stop());
    clearInterval(recTimer);
    const blob = new Blob(chunks, { type: 'video/webm' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `zeno-voice-live-demo-${new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-')}.webm`;
    document.body.appendChild(a); a.click(); a.remove();
    addSys(`Recording saved · ${(blob.size / 1e6).toFixed(1)} MB · ${a.download}`);
    $('recBtn').classList.remove('on'); $('recLabel').textContent = 'Record live demo';
    recorder = null;
  };
  display.getVideoTracks()[0].addEventListener('ended', () => { if (recorder && recorder.state !== 'inactive') recorder.stop(); });
  recorder.start(1000);
  const t0 = Date.now();
  $('recBtn').classList.add('on');
  recTimer = setInterval(() => { const sec = Math.floor((Date.now() - t0) / 1000); $('recLabel').textContent = `Stop recording · ${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`; }, 500);
  addSys('● Recording this tab, your mic and Zeno. Press Pick up the phone and talk.');
}

/* ---------- mode switch ---------- */
function setMode(mode) {
  document.querySelectorAll('.seg button').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.mode === mode)));
  const isLive = mode === 'live';
  $('livePanel').hidden = !isLive;
  $('liveControls').hidden = !isLive;
  $('demoControls').hidden = isLive;
  $('convoMode').textContent = isLive ? 'live · Gemini transcripts' : 'replay · synthesized voices, real tool calls';
  if (!isLive && live) { live.close(); live = null; setStatus('Not connected'); }
  resetAll();
  if (isLive) { simClock = null; tickClock(); }
  history.replaceState(null, '', isLive ? '?mode=live' : location.pathname + (REC ? '?record=1' : ''));
}
document.querySelectorAll('.seg button').forEach((b) => b.addEventListener('click', () => setMode(b.dataset.mode)));
$('playBtn').addEventListener('click', playDemo);
$('voiceBtn').addEventListener('click', () => {
  voicesOn = !voicesOn;
  $('voiceBtn').setAttribute('aria-pressed', String(voicesOn));
  $('voiceBtn').textContent = voicesOn ? 'Voices on' : 'Voices off';
  if (!voicesOn && currentClip) currentClip.pause();
});
$('resetBtn').addEventListener('click', () => { resetAll(); playing = false; $('playBtn').disabled = false; $('playBtn').textContent = 'Play the demo'; });
$('connectBtn').addEventListener('click', connectLive);
$('micBtn').addEventListener('click', toggleMic);
$('pickupBtn').addEventListener('click', pickup);
$('recBtn').addEventListener('click', toggleRecord);
setInterval(() => { if (!simClock) tickClock(); if (live || ledger.state.sessions.some((x) => !x.endedAt)) { renderPhone(); if (island.dataset.state === 'timer') restIsland(); } }, 1000);

/* ---------- recording: title and end cards ---------- */
function titleCard() {
  const t = $('titleCard');
  t.innerHTML = `${zenoSVG({ feeling: 'happy' })}<div class="eb">ZenMode OS · Build with Google Gemini 2026 · Open Innovation</div><h1>Zeno Voice<span class="dot">.</span></h1><p>Say why you picked up your phone, in your own language. Gemini Live understands and ZenMode acts.</p><div class="small">Prototype walkthrough in demo replay mode: scripted turns with synthesized voices (Kokoro TTS),<br>and every tool call running on the real ZenMode ledger code. Live mode streams the same loop through the Gemini Live API.</div>`;
  t.classList.add('on');
  mark('TITLE');
}
function endCard() {
  const t = $('titleCard');
  t.innerHTML = `${zenoSVG({ feeling: 'happy', skin: 'gold' })}<h1>Quiet the noise<span class="dot">.</span></h1><p>5 moments · 4 languages · 1 interruption · 7 tool calls on the ZenMode backend.</p><div class="small">Try it: justkamal07.github.io/zeno-voice · Code: github.com/justkamal07/zeno-voice<br>Team YC Hackers · Kamalraaj Senthilkumar & Srinivas Thammana</div>`;
  t.classList.add('on');
  mark('END');
}

/* ---------- boot ---------- */
renderPhone();
islandState('compact');
if (params.get('mode') === 'live') setMode('live');
if (REC) {
  titleCard();
  setTimeout(() => { $('titleCard').classList.remove('on'); setTimeout(playDemo, 600 / SPEED); }, 4200 / SPEED);
}
window.__zv = { playDemo, ledger: () => ledger, ui: { islandState, setFeeling, runTool, renderPhone, addMsg, addSys } };
