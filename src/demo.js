// Demo replay: the same five moments the live agent handles, scripted so anyone
// can see and hear the flow without a microphone or an API key.
// The voices are synthesized (Kokoro TTS, an Indian female voice for Zeno and an
// Indian male voice for Kamal). Every tool call still runs through the real
// ZenMode ledger code. Live mode runs the same loop on the Gemini Live API.
//
// Steps: pickup | zeno | user | tool | interrupt | skip | caption
// `clip` names a file in demo/voice/; typing follows the clip's length.

export const DEMO = [
  { do: 'caption', n: 1, text: 'Pickup at 10:02 PM. Zeno asks one question.' },
  { do: 'pickup', clock: '10:02' },
  { do: 'zeno', lang: 'en', text: 'Hey Kamal. What are you here for?', feel: 'listening', ms: 1900, clip: 'z_hey' },

  { do: 'caption', n: 2, text: 'Tanglish in, action out: a 2-minute Instagram intent.' },
  { do: 'user', lang: 'ta-Latn', tag: 'Tanglish', text: 'Zeno, Arun anuppuna reel-a paakkanum. Insta-la rendu nimisham mattum.', ms: 3200, clip: 'k_insta' },
  { do: 'tool', name: 'set_intent', args: { app: 'Instagram', purpose: 'Watch the reel Arun sent', minutes: 2 } },
  { do: 'zeno', lang: 'ta-Latn', text: 'Seri, rendu nimisham. Mudinjadhum naan solren.', feel: 'happy', ms: 2300, clip: 'z_seri' },
  { do: 'skip', label: '2 minutes later', clock: '10:04' },
  { do: 'tool', name: 'end_session', args: {} },
  { do: 'zeno', lang: 'ta-Latn', text: 'Rendu nimisham, correct-a mudinjadhu. Super!', feel: 'happy', ms: 2000, clip: 'z_done' },

  { do: 'caption', n: 3, text: 'Hinglish, cut off mid-sentence. Zeno stops, takes the new number, acts.' },
  { do: 'user', lang: 'hi-Latn', tag: 'Hinglish', text: 'Kal subah client demo hai. Mujhe ek ghante ka focus chahiye, aur…', ms: 2900, clip: 'k_focus' },
  { do: 'zeno', lang: 'hi-Latn', text: 'Theek hai, ek ghante ka focus shu—', feel: 'pleasant', ms: 3400, clip: 'z_cut', cut: true },
  { do: 'interrupt' },
  { do: 'user', lang: 'hi-Latn', tag: 'Hinglish', text: 'Nahi nahi, 45 minute. Aur WhatsApp pe pause laga do.', ms: 2600, clip: 'k_nahi' },
  { do: 'tool', name: 'start_focus', args: { minutes: 45, label: 'Client demo prep' } },
  { do: 'tool', name: 'pause_app', args: { app: 'WhatsApp', seconds: 7 } },
  { do: 'zeno', lang: 'hi-Latn', text: 'Ho gaya. 45 minute focus, aur WhatsApp pe 7 second ka pause.', feel: 'happy', ms: 2800, clip: 'z_hogaya' },

  { do: 'caption', n: 4, text: 'A question about the day reads the live ledger.' },
  { do: 'user', lang: 'en', tag: 'English', text: "How's my day looking?", ms: 1500, clip: 'k_day' },
  { do: 'tool', name: 'get_zen_status', args: {} },
  { do: 'zeno', lang: 'en', text: 'Zen Score {score}, up {delta} today. Stay above 6 tonight, and the week is won.', feel: 'happy', ms: 3000, clip: 'z_score' },

  { do: 'caption', n: 5, text: 'Tamil evening note becomes a Zen Card, shared with the circle.' },
  { do: 'skip', label: 'Later that night', clock: '22:41' },
  { do: 'user', lang: 'ta', tag: 'தமிழ்', text: 'இன்னைக்கு காலையில வாக்கிங் போனேன். டின்னர் அப்போ ஃபோனை தொடவே இல்ல. சர்க்கிளுக்கு ஷேர் பண்ணு.', ms: 3600, clip: 'k_tamil' },
  { do: 'tool', name: 'log_reflection', args: { summary: 'காலையில வாக்கிங், டின்னர் அப்போ ஃபோன் இல்ல', mood: 'happy', language: 'ta', earned_back: 'A phone-free dinner', drift: '' } },
  { do: 'tool', name: 'share_with_circle', args: { note: 'Phone-free dinner tonight', include_score: true } },
  { do: 'zeno', lang: 'ta', text: 'சூப்பர்! உங்க Zen Card ரெடி. சர்க்கிளுக்கும் அனுப்பிட்டேன்.', feel: 'happy', ms: 2800, clip: 'z_tamil' },
  { do: 'caption', n: 0, text: '' },
];
