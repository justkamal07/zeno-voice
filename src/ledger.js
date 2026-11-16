// ZenMode backend, mocked in the browser for the prototype.
// Every tool Zeno can call lands here. Each call writes a ledger row, moves the
// Zen Score by the rules in the Albeit brand book, and returns plain JSON that
// goes straight back to Gemini as the function response.
//
// Rules (Albeit · 08 Zen Score, 39 Weekly streak):
//   - One number, 0 to 10, that can go up. Deductions are information, not shame.
//   - Declared intent before a pickup earns. Sessions that end on time earn.
//   - Running past the minutes you asked for deducts. A good day is above 6.0.
//   - Four good days, Monday to Sunday, win the week.

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const round1 = (v) => Math.round(v * 10) / 10;

export const DEVICES = ['Pixel 9 Pro', 'MacBook Air', 'iPad Pro'];

export function createLedger(now = () => new Date()) {
  const state = {
    user: 'Kamal',
    promiseHours: 4,
    zenScore: 7.2,
    startScore: 7.2,
    goodDaysThisWeek: 3, // Mon, Tue, Thu; today is Friday
    weeklyStreak: 9,
    pickups: 41,
    pickupsWithIntent: 12,
    screenMinutes: 142,
    unintentionalMinutes: 38,
    minutesProtected: 0,
    sessions: [],
    focus: null,
    pauses: [],
    reflections: [],
    cards: [],
    circle: [
      { name: 'Srinivas', score: 8.4 },
      { name: 'Asha', score: 7.9 },
    ],
    rows: [],
  };
  const listeners = new Set();
  const emit = (evt) => listeners.forEach((fn) => fn(evt, state));

  function row(kind, note, delta = 0, meta = {}) {
    const r = { id: 'r' + (state.rows.length + 1), at: now().toISOString(), kind, note, delta: round1(delta), meta };
    if (delta) state.zenScore = round1(clamp(state.zenScore + delta, 0, 10));
    state.rows.push(r);
    return r;
  }

  const status = () => ({
    user: state.user,
    zen_score: state.zenScore,
    change_today: round1(state.zenScore - state.startScore),
    good_day_threshold: 6.0,
    good_days_this_week: state.goodDaysThisWeek,
    good_days_needed_to_win_week: 4,
    weekly_streak_weeks: state.weeklyStreak,
    promise_minutes: state.promiseHours * 60,
    screen_minutes_today: state.screenMinutes,
    minutes_left_in_promise: Math.max(0, state.promiseHours * 60 - state.screenMinutes),
    unintentional_minutes_today: state.unintentionalMinutes,
    pickups_today: state.pickups,
    pickups_with_intent: state.pickupsWithIntent,
    active_session: state.sessions.find((s) => !s.endedAt) || null,
    focus: state.focus,
    paused_apps: state.pauses.map((p) => p.app),
  });

  const tools = {
    get_zen_status() {
      row('read', 'Zen status read');
      return status();
    },

    record_pickup() {
      state.pickups += 1;
      return { pickups_today: state.pickups };
    },

    set_intent({ app = 'Phone', purpose = '', minutes = 5 } = {}) {
      minutes = clamp(Math.round(Number(minutes) || 5), 1, 180);
      const open = state.sessions.find((s) => !s.endedAt);
      if (open) tools.end_session({ session_id: open.id, reason: 'replaced' });
      const startedAt = now();
      const s = {
        id: 's' + (state.sessions.length + 1),
        app, purpose, minutes,
        startedAt: startedAt.toISOString(),
        endsAt: new Date(startedAt.getTime() + minutes * 60000).toISOString(),
        endedAt: null,
        onTime: null,
      };
      state.sessions.push(s);
      state.pickupsWithIntent += 1;
      const r = row('intent', `${app} · ${minutes} min · ${purpose || 'declared'}`, +0.1, { session: s.id });
      emit({ type: 'session', session: s, row: r });
      return { ok: true, session_id: s.id, app, minutes, ends_at: s.endsAt, zen_score: state.zenScore, earned: 0.1 };
    },

    end_session({ session_id, reason = 'ended', overrun_minutes = 0 } = {}) {
      const s = state.sessions.find((x) => x.id === session_id) || state.sessions.find((x) => !x.endedAt);
      if (!s) return { ok: false, error: 'no open session' };
      s.endedAt = now().toISOString();
      overrun_minutes = Math.max(0, Number(overrun_minutes) || 0);
      s.onTime = overrun_minutes === 0;
      let r;
      if (reason === 'replaced') {
        r = row('session', `${s.app} closed for a new intent`, 0, { session: s.id });
      } else if (s.onTime) {
        state.screenMinutes += s.minutes;
        state.minutesProtected += 3;
        r = row('session', `${s.app} ended on time`, +0.2, { session: s.id });
      } else {
        state.screenMinutes += s.minutes + overrun_minutes;
        state.unintentionalMinutes += overrun_minutes;
        r = row('session', `${s.app} ran ${overrun_minutes} min past the promise`, -0.1 * Math.min(5, overrun_minutes), { session: s.id });
      }
      emit({ type: 'session-end', session: s, row: r });
      return { ok: true, session_id: s.id, on_time: s.onTime, zen_score: state.zenScore };
    },

    start_focus({ minutes = 25, label = 'Focus', quiet_apps = [] } = {}) {
      minutes = clamp(Math.round(Number(minutes) || 25), 5, 240);
      const startedAt = now();
      state.focus = {
        id: 'f' + (state.rows.length + 1),
        label, minutes,
        startedAt: startedAt.toISOString(),
        endsAt: new Date(startedAt.getTime() + minutes * 60000).toISOString(),
        devices_quieted: DEVICES.slice(),
        quiet_apps,
      };
      state.minutesProtected += minutes;
      const r = row('focus', `${label} · ${minutes} min · ${DEVICES.length} screens quiet`, +0.3, { focus: state.focus.id });
      emit({ type: 'focus', focus: state.focus, row: r });
      return { ok: true, focus_id: state.focus.id, minutes, label, ends_at: state.focus.endsAt, devices_quieted: state.focus.devices_quieted, zen_score: state.zenScore, earned: 0.3 };
    },

    pause_app({ app = 'Instagram', seconds = 7 } = {}) {
      seconds = clamp(Math.round(Number(seconds) || 7), 3, 30);
      const existing = state.pauses.find((p) => p.app.toLowerCase() === String(app).toLowerCase());
      if (existing) existing.seconds = seconds; else state.pauses.push({ app, seconds });
      const r = row('pause', `${app} · ${seconds}-second pause before it opens`, +0.1);
      emit({ type: 'pause', app, seconds, row: r });
      return { ok: true, app, seconds, paused_apps: state.pauses.map((p) => p.app), zen_score: state.zenScore };
    },

    log_reflection({ summary = '', mood = 'pleasant', language = 'en', earned_back = '', drift = '' } = {}) {
      const ref = { id: 'n' + (state.reflections.length + 1), at: now().toISOString(), summary, mood, language, earned_back, drift };
      state.reflections.push(ref);
      const card = {
        id: 'c' + (state.cards.length + 1),
        tone: drift && !earned_back ? 'ember' : 'amber',
        question: 'What did you earn back today?',
        answer: (earned_back || summary).slice(0, 40),
        detail: (() => {
          const days = state.goodDaysThisWeek + (state.zenScore > 6 ? 1 : 0);
          return `Zen Score ${state.zenScore.toFixed(1)} · ${days} of 4 good days${days >= 4 ? ', week won' : ' this week'}`;
        })(),
        language,
      };
      state.cards.push(card);
      const r = row('reflection', `Evening note (${language}) · Zen Card made`, +0.2, { card: card.id });
      const days = state.goodDaysThisWeek + (state.zenScore > 6 ? 1 : 0);
      card.detail = `Zen Score ${state.zenScore.toFixed(1)} · ${days} of 4 good days${days >= 4 ? ', week won' : ' this week'}`;
      emit({ type: 'card', card, row: r });
      return { ok: true, card, zen_score: state.zenScore, earned: 0.2 };
    },

    share_with_circle({ note = '', include_score = true } = {}) {
      const card = state.cards[state.cards.length - 1] || null;
      const r = row('share', `Shared with circle · ${state.circle.map((c) => c.name).join(', ')}`);
      emit({ type: 'share', card, row: r });
      return { ok: true, shared_with: state.circle.map((c) => c.name), included_score: include_score ? state.zenScore : null, note, card_id: card && card.id };
    },
  };

  // Outcome numbers the dashboard shows. Each one comes from the ledger above.
  function outcomes() {
    const intentRate = state.pickups ? state.pickupsWithIntent / state.pickups : 0;
    return {
      zenScore: state.zenScore,
      delta: round1(state.zenScore - state.startScore),
      intentRate,
      actions: state.rows.filter((r) => r.kind !== 'read').length,
      minutesProtected: state.minutesProtected,
      goodDay: state.zenScore > 6,
    };
  }

  return {
    state,
    tools,
    status,
    outcomes,
    call(name, args) {
      const fn = tools[name];
      if (!fn) return { ok: false, error: `unknown tool ${name}` };
      try { return fn(args || {}); } catch (e) { return { ok: false, error: String(e && e.message || e) }; }
    },
    on(fn) { listeners.add(fn); return () => listeners.delete(fn); },
  };
}
