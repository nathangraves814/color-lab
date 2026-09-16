/* Color Lab — real paint mixing for small humans.
   Mixing happens in RYB pigment space (so blue + yellow really makes green),
   with white and black tracked separately as tint and shade. */
(function () {
'use strict';

/* Bump on every deploy, and bump VERSION in sw.js to match so the old cache is
   dropped. This string is rendered bottom-right: if it has not changed on the
   device, the device is still running the old build. */
var VERSION = 'v1.3.1';

/* ---------------------------------------------------------------- mixing */

// RYB cube corners -> display RGB. Trilinear blend between them (Gossett & Chen),
// with the corners hand-tuned so results land where a child's eye expects them.
var CORNERS = [
  [0,0,0, 1.00,1.00,1.00],  // nothing        -> white
  [1,0,0, 0.91,0.09,0.18],  // red
  [0,1,0, 1.00,0.90,0.05],  // yellow
  [0,0,1, 0.10,0.31,0.86],  // blue
  [1,1,0, 0.98,0.48,0.03],  // red + yellow   -> orange
  [1,0,1, 0.46,0.13,0.55],  // red + blue     -> purple
  [0,1,1, 0.00,0.63,0.25],  // yellow + blue  -> green
  [1,1,1, 0.36,0.23,0.11]   // all three      -> brown
];
var SHADE = [0.07, 0.06, 0.07]; // what "black paint" pulls toward

function rybToRgb(r, y, b) {
  var out = [0, 0, 0];
  for (var i = 0; i < CORNERS.length; i++) {
    var c = CORNERS[i];
    var w = (c[0] ? r : 1 - r) * (c[1] ? y : 1 - y) * (c[2] ? b : 1 - b);
    out[0] += w * c[3]; out[1] += w * c[4]; out[2] += w * c[5];
  }
  return out;
}
function lerp(a, b, t) { return [a[0]+(b[0]-a[0])*t, a[1]+(b[1]-a[1])*t, a[2]+(b[2]-a[2])*t]; }

/* Mix any number of paints. Each paint is {c:[r,y,b], w:whiteAmount, k:blackAmount}.
   The chroma vectors are averaged, then re-scaled back up so the hue stays as strong
   as the paints that went in — otherwise every mix would drift pale toward white. */
function mixPaints(paints) {
  var n = paints.length, c = [0, 0, 0], w = 0, k = 0, chromaticSum = 0, chromatic = 0;
  for (var i = 0; i < n; i++) {
    var p = paints[i];
    c[0] += p.c[0]; c[1] += p.c[1]; c[2] += p.c[2];
    w += p.w || 0; k += p.k || 0;
    var m = Math.max(p.c[0], p.c[1], p.c[2]);
    if (m > 1e-6) { chromaticSum += m; chromatic++; }
  }
  c = [c[0]/n, c[1]/n, c[2]/n]; w /= n; k /= n;

  var peak = Math.max(c[0], c[1], c[2]);
  if (chromatic > 0 && peak > 1e-6) {
    var s = (chromaticSum / chromatic) / peak;
    c = [c[0]*s, c[1]*s, c[2]*s];
  }
  var rgb = peak > 1e-6 ? rybToRgb(c[0], c[1], c[2]) : [1, 1, 1];
  return lerp(lerp(rgb, [1, 1, 1], w), SHADE, k);
}

function toHex(rgb) {
  return '#' + rgb.map(function (v) {
    var n = Math.round(Math.max(0, Math.min(1, v)) * 255);
    return (n < 16 ? '0' : '') + n.toString(16);
  }).join('');
}
function hexToRgb(h) {
  h = h.replace('#', '');
  return [parseInt(h.slice(0,2),16)/255, parseInt(h.slice(2,4),16)/255, parseInt(h.slice(4,6),16)/255];
}

/* ------------------------------------------------------------ the paints */

var PAINTS = [
  { id:'red',       name:'red',        c:[1,0,0] },
  { id:'orange',    name:'orange',     c:[1,1,0] },
  { id:'yellow',    name:'yellow',     c:[0,1,0] },
  { id:'green',     name:'green',      c:[0,1,1] },
  { id:'blue',      name:'blue',       c:[0,0,1] },
  { id:'purple',    name:'purple',     c:[1,0,1] },

  { id:'pink',      name:'pink',       c:[1,0,0],       w:0.60 },
  { id:'peach',     name:'peach',      c:[1,0.55,0],    w:0.50 },
  { id:'gold',      name:'gold',       c:[0.40,1,0] },
  { id:'lime',      name:'lime',       c:[0,1,0.30] },
  { id:'skyblue',   name:'sky blue',   c:[0,0.15,1],    w:0.55 },
  { id:'lavender',  name:'lavender',   c:[1,0,1],       w:0.65 },

  { id:'magenta',   name:'magenta',    c:[1,0,0.25] },
  { id:'teal',      name:'teal',       c:[0,0.50,1] },
  { id:'mint',      name:'mint',       c:[0,1,1],       w:0.60 },
  { id:'brown',     name:'brown',      c:[1,0.80,0.50], k:0.15 },
  { id:'darkgreen', name:'dark green', c:[0,1,1],       k:0.45 },
  { id:'navy',      name:'navy',       c:[0,0,1],       k:0.50 },

  { id:'darkred',   name:'dark red',   c:[1,0,0],       k:0.45 },
  { id:'tan',       name:'tan',        c:[1,0.80,0.50], w:0.50 },
  { id:'white',     name:'white',      c:[0,0,0],       w:1.00 },
  { id:'silver',    name:'silver',     c:[0,0,0],       w:0.80, k:0.12 },
  { id:'gray',      name:'gray',       c:[0,0,0],       w:0.50, k:0.45 },
  { id:'black',     name:'black',      c:[0,0,0],       k:1.00 }
];
var BY_ID = {};
PAINTS.forEach(function (p) { p.hex = toHex(mixPaints([p])); BY_ID[p.id] = p; });

/* ------------------------------------------------------------- the names */

var NAMES = [
  ['red','#e0202a','🍎'],['scarlet','#c81912','🌹'],['crimson','#a5102a','🍒'],
  ['dark red','#7d1418','🍷'],['maroon','#5e1a1e','🫘'],['brick red','#a5452f','🧱'],
  ['pink','#f4a0b0','🌸'],['light pink','#f9cdd8','🌷'],['hot pink','#f0428c','💗'],
  ['rose','#d94f6e','🌺'],['salmon','#f0857a','🐟'],['coral','#f4796a','🪸'],
  ['peach','#f9b48e','🍑'],['blush','#efc0b6','🌼'],['magenta','#c2185b','💐'],
  ['orange','#f57c11','🍊'],['dark orange','#c25a08','🎃'],['light orange','#fbb268','🥕'],
  ['apricot','#f5b35e','🥭'],['amber','#e8962a','🍯'],['rust','#9c4a1a','🍂'],
  ['yellow','#ffe61a','🌻'],['light yellow','#fbef9a','🌼'],['lemon','#f2ec52','🍋'],
  ['gold','#e8b31f','🏅'],['mustard','#c8a01c','🌾'],['cream','#f7f0d8','🍦'],
  ['olive','#7d7a1e','🫒'],['khaki','#b8a563','🪨'],
  ['green','#12a148','🌿'],['light green','#7ed194','🍏'],['dark green','#136b30','🌲'],
  ['lime','#a8d41c','🦎'],['mint','#9adfb8','🍃'],['forest green','#1c4f26','🌳'],
  ['grass green','#4caf28','🌱'],['sea green','#1d9e7a','🌊'],['emerald','#12a67a','💎'],
  ['sage','#a3b58c','🪴'],['olive green','#5c6b24','🥬'],
  ['blue','#1a4fdb','💧'],['light blue','#8ca9ee','🩵'],['sky blue','#63b8e8','☁️'],
  ['dark blue','#152f77','🌌'],['navy','#10204f','⚓'],['royal blue','#2247b8','👑'],
  ['teal','#127d8e','🐬'],['turquoise','#31c0c4','🐠'],['cyan','#5fd8e0','💦'],
  ['periwinkle','#9aa8e8','🦋'],['steel blue','#5a7fa5','🔩'],['slate blue','#4a5c7d','🗿'],
  ['purple','#7a2a91','🍇'],['light purple','#b98ac6','🪻'],['lavender','#cdb4de','💜'],
  ['violet','#6b34c4','🔮'],['plum','#6e2a55','🫐'],['orchid','#bd62c4','🌸'],
  ['mauve','#a58399','🌫️'],['grape','#4e1f6b','🍇'],
  ['brown','#8a5228','🐻'],['light brown','#b5804f','🪵'],['dark brown','#4f2f18','🌰'],
  ['chocolate','#5e3a20','🍫'],['caramel','#b0752f','🍮'],['tan','#cda877','🥔'],
  ['beige','#e0d0ad','🍞'],['taupe','#8a7a68','🪨'],['copper','#b06a35','🥉'],
  ['mud brown','#6b4a2a','🪱'],['olive brown','#6b5c2a','🍄'],
  ['gray','#949394','🐘'],['light gray','#c8c7c8','🌫️'],['dark gray','#5c5b5c','🪨'],
  ['silver','#d6d5d6','🥈'],['charcoal','#3a393a','⬛'],['slate','#6e7278','🗻'],
  ['white','#fdfdfd','☁️'],['black','#151515','🌑']
];
// Words a five-year-old already owns get pulled toward; the fancy ones only win
// when they're clearly, unmistakably right.
var CORE = 'red blue yellow green orange purple pink brown gray white black'.split(' ');
var FAMILIAR = ('light blue,dark blue,light green,dark green,light pink,dark red,light purple,navy,teal,' +
  'turquoise,lime,gold,tan,silver,peach,mint,lavender,light gray,dark gray,dark brown,light brown,' +
  'cream,magenta,sky blue,light yellow,light orange,dark orange').split(',');
var ACHRO_SET = { white:1, black:1, 'gray':1, 'light gray':1, 'dark gray':1, silver:1, charcoal:1, slate:1 };

function rgbToLab(rgb) {
  function inv(u) { return u <= 0.04045 ? u / 12.92 : Math.pow((u + 0.055) / 1.055, 2.4); }
  var r = inv(rgb[0]), g = inv(rgb[1]), b = inv(rgb[2]);
  var X = (0.4124*r + 0.3576*g + 0.1805*b) / 0.95047;
  var Y = (0.2126*r + 0.7152*g + 0.0722*b);
  var Z = (0.0193*r + 0.1192*g + 0.9505*b) / 1.08883;
  function f(t) { return t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116; }
  var fx = f(X), fy = f(Y), fz = f(Z);
  return [116*fy - 16, 500*(fx - fy), 200*(fy - fz)];
}
var NAMED = NAMES.map(function (n) {
  var bonus = CORE.indexOf(n[0]) >= 0 ? 8 : (FAMILIAR.indexOf(n[0]) >= 0 ? 5 : 0);
  return { name: n[0], hex: n[1], emoji: n[2], lab: rgbToLab(hexToRgb(n[1])), bonus: bonus };
});
function deltaE(a, b) {
  return Math.sqrt((a[0]-b[0])*(a[0]-b[0]) + (a[1]-b[1])*(a[1]-b[1]) + (a[2]-b[2])*(a[2]-b[2]));
}
function nameOf(rgb) {
  var lab = rgbToLab(rgb), chroma = Math.sqrt(lab[1]*lab[1] + lab[2]*lab[2]);
  var best = NAMED[0], bestScore = Infinity;
  for (var i = 0; i < NAMED.length; i++) {
    var n = NAMED[i];
    var bonus = (ACHRO_SET[n.name] && chroma > 10) ? 0 : n.bonus;
    var score = deltaE(lab, n.lab) - bonus;
    if (score < bestScore) { bestScore = score; best = n; }
  }
  return best;
}

/* ----------------------------------------------------------- the missions */

var MISSIONS = [
  { id:'green',  label:'Make green',      hint:'two colors', hex:'#00a140' },
  { id:'orange', label:'Make orange',     hint:'two colors', hex:'#fa7a08' },
  { id:'purple', label:'Make purple',     hint:'two colors', hex:'#75218c' },
  { id:'pink',   label:'Make pink',       hint:'add white',  hex:'#f48b96' },
  { id:'ltblue', label:'Make light blue', hint:'add white',  hex:'#8ca9ee' },
  { id:'dkred',  label:'Make dark red',   hint:'add black',  hex:'#7d1320' },
  { id:'gray',   label:'Make gray',       hint:'two colors', hex:'#888788' },
  { id:'brown',  label:'Make brown',      hint:'try three!', hex:'#5c3b1c' },
  { id:'olive',  label:'Make olive',      hint:'add black',  hex:'#887a0f' }
];
MISSIONS.forEach(function (m) { m.lab = rgbToLab(hexToRgb(m.hex)); });

/* -------------------------------------------------------------- storage */

var K_ALBUM = 'colorlab.album.v1', K_MISSIONS = 'colorlab.missions.v1',
    K_SOUND = 'colorlab.sound.v1', K_MODE = 'colorlab.mode.v1';
function load(key, fallback) {
  try { var v = localStorage.getItem(key); return v ? JSON.parse(v) : fallback; }
  catch (e) { return fallback; }
}
function save(key, value) { try { localStorage.setItem(key, JSON.stringify(value)); } catch (e) {} }

var album = load(K_ALBUM, {});
var missionsDone = load(K_MISSIONS, {});
var soundOn = load(K_SOUND, true);
var mode = load(K_MODE, 3) === 2 ? 2 : 3;   // how many colours she can stack

/* ---------------------------------------------------------------- voice */
/* Pre-recorded clips, not live synthesis. iOS Safari hides its good voices from
   speechSynthesis, so the whole vocabulary is baked into voice/ by
   tools/generate-voice.py. speechSynthesis stays only as a fallback. */

var CLIP_GAP = 0.12;                 // seconds of air between stitched clips
var audioCtx = null, gainNode = null;
var buffers = {}, sources = [], playToken = 0;

function slugOf(s) { return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''); }
function paintClip(id) { return 'paints/' + id + '.m4a'; }
function uiClip(key) { return 'ui/' + key + '.m4a'; }
function resultClip(name) {
  return 'results/' + slugOf(name) + '-' + (Math.random() < 0.5 ? 0 : 1) + '.m4a';
}

function initAudio() {
  var AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return;
  try {
    audioCtx = new AC();
    gainNode = audioCtx.createGain();
    gainNode.connect(audioCtx.destination);
  } catch (e) { audioCtx = null; }
}

function loadClip(rel) {
  if (Object.prototype.hasOwnProperty.call(buffers, rel)) return Promise.resolve(buffers[rel]);
  return fetch('voice/' + rel).then(function (r) {
    if (!r.ok) throw new Error('missing');
    return r.arrayBuffer();
  }).then(function (raw) {
    return new Promise(function (resolve, reject) {
      audioCtx.decodeAudioData(raw, resolve, reject);   // callback form for older Safari
    });
  }).then(function (buf) {
    buffers[rel] = buf; return buf;
  }).catch(function () { buffers[rel] = null; return null; });
}

function stopSources() {
  sources.forEach(function (s) { try { s.stop(); } catch (e) {} });
  sources = [];
}

function speakFallback(text) {
  if (!text || !('speechSynthesis' in window)) return;
  try {
    speechSynthesis.cancel();
    var u = new SpeechSynthesisUtterance(text);
    u.lang = 'en-US'; u.rate = 0.85; u.pitch = 1.15;
    speechSynthesis.speak(u);
  } catch (e) {}
}

/* Play a run of clips back to back. `text` is both the screen-reader line and
   the fallback if the clips cannot be loaded. */
function say(clips, text) {
  var live = document.getElementById('live');
  if (live && text) live.textContent = text;
  if (!soundOn) return;
  if (!audioCtx) { speakFallback(text); return; }
  if (audioCtx.state === 'suspended') audioCtx.resume();

  var token = ++playToken;
  stopSources();
  Promise.all(clips.map(loadClip)).then(function (bufs) {
    if (token !== playToken) return;                 // a newer line took over
    if (!bufs.some(Boolean)) { speakFallback(text); return; }
    var t = audioCtx.currentTime + 0.04;
    bufs.forEach(function (buf) {
      if (!buf) return;
      var src = audioCtx.createBufferSource();
      src.buffer = buf;
      src.connect(gainNode);
      src.start(t);
      sources.push(src);
      t += buf.duration + CLIP_GAP;
    });
  });
}

/* Warm the cache in the background: the words she can tap first, then the rest. */
function preloadVoice() {
  if (!audioCtx) return;
  var urgent = PAINTS.map(function (p) { return paintClip(p.id); })
    .concat(['welcome', 'reset', 'sound-on', 'album', 'missions', 'mission-complete',
             'two-colors', 'three-colors', 'pick-one-more'].map(uiClip));
  var rest = [];
  NAMES.forEach(function (n) {
    rest.push('results/' + slugOf(n[0]) + '-0.m4a', 'results/' + slugOf(n[0]) + '-1.m4a');
  });
  var queue = urgent.concat(rest), i = 0;
  (function next() {
    if (i >= queue.length) return;
    var batch = queue.slice(i, i + 6); i += 6;
    Promise.all(batch.map(loadClip)).then(function () { setTimeout(next, 30); });
  })();
}

/* ---------------------------------------------------------------- state */

var slots = [null, null, null];   // paint ids
var current = null;               // { hex, name, emoji, ids }

var $ = function (id) { return document.getElementById(id); };
var els = {};

function filled() { return slots.slice(0, mode).filter(Boolean); }

function recompute() {
  var ids = filled();
  if (ids.length < 2) { current = null; return; }
  var rgb = mixPaints(ids.map(function (id) { return BY_ID[id]; }));
  var n = nameOf(rgb);
  current = { hex: toHex(rgb), name: n.name, emoji: n.emoji, lab: rgbToLab(rgb), ids: ids.slice() };
}

function sentence() {
  if (!current) return '';
  var names = current.ids.map(function (id) { return BY_ID[id].name; });
  var distinct = names.filter(function (v, i) { return names.indexOf(v) === i; });
  if (distinct.length === 1) return 'Still ' + current.name + '!';
  var list = names.length === 2
    ? names[0] + ' and ' + names[1]
    : names[0] + ', ' + names[1] + ' and ' + names[2];
  return list + ' make ' + current.name + '!';
}

/* -------------------------------------------------------------- render */

function render() {
  slots.forEach(function (id, i) {
    var el = els.slots[i];
    if (id) {
      el.classList.add('filled');
      el.style.background = BY_ID[id].hex;
    } else {
      el.classList.remove('filled');
      el.style.background = '';
    }
  });

  els.bowl.style.backgroundColor = current ? current.hex : '';
  els.bowlHint.style.display = current ? 'none' : '';
  els.say.disabled = !current;

  if (current) {
    els.label.classList.remove('empty');
    els.emoji.textContent = current.emoji;
    els.name.textContent = current.name;
  } else {
    els.label.classList.add('empty');
    els.emoji.textContent = '';
    els.name.textContent = filled().length === 1 ? 'Pick one more!' : 'Tap two colors';
  }

  els.albumCount.textContent = Object.keys(album).length;
  els.missionCount.textContent = Object.keys(missionsDone).length;
}

function sparkle() {
  var pool = ['✨', '⭐', '💫', '🌟'];
  for (var i = 0; i < 7; i++) {
    var s = document.createElement('i');
    var a = (Math.PI * 2 * i) / 7 + Math.random() * 0.5;
    var d = 90 + Math.random() * 70;
    s.textContent = pool[i % pool.length];
    s.style.setProperty('--dx', Math.cos(a) * d + 'px');
    s.style.setProperty('--dy', Math.sin(a) * d + 'px');
    els.sparkles.appendChild(s);
    setTimeout(function (n) { return function () { n.remove(); }; }(s), 1000);
  }
}

function flyDrop(fromEl, toEl, hex) {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  var a = fromEl.getBoundingClientRect(), b = toEl.getBoundingClientRect();
  var drop = document.createElement('div');
  drop.className = 'fly';
  drop.style.setProperty('--c', hex);
  drop.style.width = a.width + 'px';
  drop.style.height = a.height + 'px';
  drop.style.left = a.left + 'px';
  drop.style.top = a.top + 'px';
  els.fly.appendChild(drop);
  var dx = (b.left + b.width / 2) - (a.left + a.width / 2);
  var dy = (b.top + b.height / 2) - (a.top + a.height / 2);
  var scale = b.width / a.width;
  var anim = drop.animate(
    [{ transform: 'translate(0,0) scale(1)', opacity: 1 },
     { transform: 'translate(' + dx * 0.55 + 'px,' + (dy * 0.5 - 40) + 'px) scale(' + (scale * 1.1) + ')', opacity: 1, offset: 0.55 },
     { transform: 'translate(' + dx + 'px,' + dy + 'px) scale(' + scale + ')', opacity: 0.85 }],
    { duration: 380, easing: 'cubic-bezier(.4,.1,.3,1)' });
  anim.onfinish = function () { drop.remove(); };
}

/* --------------------------------------------------------------- actions */

function addPaint(id, sourceEl) {
  var slot = -1;
  for (var i = 0; i < mode; i++) { if (!slots[i]) { slot = i; break; } }
  if (slot === -1) { slots = [id, null, null]; slot = 0; }   // full, so start fresh
  else slots[slot] = id;

  recompute();
  // Snapshot now: a fast tapper can fire again before the drop lands, and the
  // discovery must be banked even if the fanfare below gets superseded.
  var snap = current;
  var outcome = recordMix(snap);
  var target = els.slots[slot];

  // The last colour the recipe can hold gets the answer instead of its own name.
  var isFinal = filled().length >= mode;
  if (sourceEl) flyDrop(sourceEl, target, BY_ID[id].hex);
  if (!isFinal) say([paintClip(id)], BY_ID[id].name);

  setTimeout(function () {
    render();
    target.classList.remove('pop'); void target.offsetWidth; target.classList.add('pop');
    if (!snap || snap !== current) return;   // a newer tap already took over
    els.bowl.classList.remove('swirl'); void els.bowl.offsetWidth; els.bowl.classList.add('swirl');
    els.label.classList.remove('bounce'); void els.label.offsetWidth; els.label.classList.add('bounce');
    if (outcome.fresh || outcome.won.length) sparkle();
    if (isFinal) sayResult(snap, outcome.won.length > 0);
  }, sourceEl ? 340 : 0);
}

/* Bank a mix into the album and check it against the missions. */
function recordMix(mix) {
  if (!mix) return { fresh: false, won: [] };
  var key = mix.ids.slice().sort().join('+');
  var fresh = !album[key];
  if (fresh) {
    album[key] = { hex: mix.hex, name: mix.name, emoji: mix.emoji, ids: mix.ids.slice() };
    save(K_ALBUM, album);
  }
  var won = [];
  MISSIONS.forEach(function (m) {
    if (!missionsDone[m.id] && deltaE(mix.lab, m.lab) < 20) { missionsDone[m.id] = true; won.push(m); }
  });
  if (won.length) save(K_MISSIONS, missionsDone);
  if (fresh || won.length) {
    els.albumCount.textContent = Object.keys(album).length;
    els.missionCount.textContent = Object.keys(missionsDone).length;
  }
  return { fresh: fresh, won: won };
}

function clearSlot(i) {
  if (!slots[i]) return;
  slots[i] = null;
  slots = [slots[0], slots[1], slots[2]].filter(Boolean).concat([null, null, null]).slice(0, 3);
  recompute(); render();
}

/* Just the answer. Played when she drops in the last colour the recipe has room for,
   because she has already heard each paint named as she tapped it. */
function sayResult(mix, won) {
  if (!mix) return;
  var clips = [resultClip(mix.name)];
  if (won) clips.push(uiClip('mission-complete'));
  say(clips, "That's " + mix.name + '!' + (won ? ' Mission complete!' : ''));
}

/* The whole recipe read back: "Blue. Yellow. That's green!" This is what the
   Say it button does, and what replaying a mix from the album does. */
function sayMix(mix, won) {
  if (!mix) return;
  var clips = mix.ids.map(paintClip);
  clips.push(resultClip(mix.name));
  if (won) clips.push(uiClip('mission-complete'));
  say(clips, sentence() + (won ? ' Mission complete!' : ''));
}

function reset() {
  slots = [null, null, null]; current = null;
  render();
  say([uiClip('reset')], "Let's start over!");
}

function setMode(next, announce) {
  mode = next === 2 ? 2 : 3;
  save(K_MODE, mode);
  document.body.setAttribute('data-mode', String(mode));
  if (mode === 2 && slots[2]) { slots[2] = null; recompute(); }
  render();
  if (announce) say([uiClip(mode === 2 ? 'two-colors' : 'three-colors')],
                    mode === 2 ? 'Two colors!' : 'Three colors!');
}

function loadRecipe(ids) {
  slots = [ids[0] || null, ids[1] || null, ids[2] || null];
  if (ids.length > 2) setMode(3, false);
  recompute(); recordMix(current); render();
  closeSheet();
  els.bowl.classList.remove('swirl'); void els.bowl.offsetWidth; els.bowl.classList.add('swirl');
  sayMix(current, false);
}

/* ---------------------------------------------------------------- sheets */

function openSheet(title, html, onClick) {
  els.sheetTitle.textContent = title;
  els.sheetBody.innerHTML = html;
  els.sheet.hidden = false;
  els.sheetBody.onclick = onClick || null;
}
function closeSheet() { els.sheet.hidden = true; els.sheetBody.onclick = null; }

function showAlbum() {
  var keys = Object.keys(album);
  var html;
  if (!keys.length) {
    html = '<p class="empty-note">No colors yet. Mix two paints and they will show up here!</p>';
  } else {
    var items = keys.map(function (k) { return album[k]; });
    items.sort(function (a, b) {
      var la = rgbToLab(hexToRgb(a.hex)), lb = rgbToLab(hexToRgb(b.hex));
      return Math.atan2(la[2], la[1]) - Math.atan2(lb[2], lb[1]);
    });
    html = '<div class="found-grid">' + items.map(function (it) {
      var recipe = it.ids.map(function (id) { return BY_ID[id].name; }).join(' + ');
      return '<button class="found" data-ids="' + it.ids.join(',') + '">' +
        '<span class="fc" style="--c:' + it.hex + '"></span>' +
        '<span class="fn">' + it.emoji + ' ' + it.name + '</span>' +
        '<span class="fr">' + recipe + '</span></button>';
    }).join('') + '</div>';
  }
  openSheet('Colors I found (' + keys.length + ')', html, function (e) {
    var btn = e.target.closest ? e.target.closest('.found') : null;
    if (btn) loadRecipe(btn.dataset.ids.split(','));
  });
  say([uiClip('album')], 'Here are the colors you found!');
}

function showMissions() {
  var html = '<div class="mission-grid">' + MISSIONS.map(function (m) {
    var done = !!missionsDone[m.id];
    return '<div class="mission' + (done ? ' done' : '') + '">' +
      '<span class="mc" style="--c:' + m.hex + '"></span>' +
      '<span><span class="mt">' + m.label + '</span><br>' +
      '<span class="ms">' + (done ? '✓ found it!' : m.hint) + '</span></span></div>';
  }).join('') + '</div>';
  openSheet('Missions (' + Object.keys(missionsDone).length + ' of ' + MISSIONS.length + ')', html);
  say([uiClip('missions')], 'Can you make these colors?');
}

/* ------------------------------------------------------------------ boot */

function buildPalette() {
  els.palette.innerHTML = PAINTS.map(function (p) {
    var light = rgbToLab(hexToRgb(p.hex))[0] > 80;
    return '<button class="paint' + (light ? ' light' : '') + '" data-id="' + p.id + '">' +
      '<span class="chip" style="--c:' + p.hex + '"></span>' +
      '<span class="nm">' + p.name + '</span></button>';
  }).join('');
}

function init() {
  els = {
    slots: [].slice.call(document.querySelectorAll('.slot')),
    bowl: $('bowl'), bowlHint: $('bowl-hint'), label: $('label'),
    emoji: $('result-emoji'), name: $('result-name'), palette: $('palette'),
    sparkles: $('sparkles'), fly: $('fly-layer'), say: $('btn-say'),
    sheet: $('sheet'), sheetTitle: $('sheet-title'), sheetBody: $('sheet-body'),
    albumCount: $('album-count'), missionCount: $('mission-count'),
    soundBtn: $('btn-sound'), soundIcon: $('sound-icon')
  };

  buildPalette();
  var stamp = $('build');
  if (stamp) stamp.textContent = VERSION;

  els.palette.addEventListener('click', function (e) {
    var btn = e.target.closest('.paint');
    if (btn) addPaint(btn.dataset.id, btn.querySelector('.chip'));
  });
  els.slots.forEach(function (el, i) { el.addEventListener('click', function () { clearSlot(i); }); });
  $('btn-mode').addEventListener('click', function () { setMode(mode === 2 ? 3 : 2, true); });

  $('btn-reset').addEventListener('click', reset);
  els.say.addEventListener('click', function () { sayMix(current, false); });
  $('btn-album').addEventListener('click', showAlbum);
  $('btn-missions').addEventListener('click', showMissions);
  $('sheet-close').addEventListener('click', closeSheet);
  els.sheet.addEventListener('click', function (e) { if (e.target === els.sheet) closeSheet(); });

  els.soundBtn.addEventListener('click', function () {
    soundOn = !soundOn;
    save(K_SOUND, soundOn);
    els.soundBtn.setAttribute('aria-pressed', String(soundOn));
    els.soundIcon.textContent = soundOn ? '🔊' : '🔇';
    if (soundOn) say([uiClip('sound-on')], 'Sound on!');
    else {
      stopSources();
      if ('speechSynthesis' in window) speechSynthesis.cancel();
    }
  });
  els.soundBtn.setAttribute('aria-pressed', String(soundOn));
  els.soundIcon.textContent = soundOn ? '🔊' : '🔇';

  // iOS only lets speech start from inside a real tap, so the splash button unlocks it.
  $('btn-start').addEventListener('click', function () {
    $('splash').classList.add('gone');
    $('app').hidden = false;
    setTimeout(function () { $('splash').remove(); }, 500);
    initAudio();
    if (audioCtx && audioCtx.state === 'suspended') audioCtx.resume();
    say([uiClip('welcome')], 'Tap two colors to mix them!');
    preloadVoice();
    render();
  });

  document.addEventListener('gesturestart', function (e) { e.preventDefault(); });
  setMode(mode, false);
  render();
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
else init();

if ('serviceWorker' in navigator) {
  // updateViaCache:'none' stops the browser serving a cached sw.js, which is how a
  // device can otherwise pin itself to an old build indefinitely.
  var hadController = !!navigator.serviceWorker.controller;
  var reloading = false;
  navigator.serviceWorker.addEventListener('controllerchange', function () {
    if (!hadController || reloading) return;   // first install needs no reload
    reloading = true;
    location.reload();
  });
  window.addEventListener('load', function () {
    navigator.serviceWorker.register('sw.js', { updateViaCache: 'none' })
      .then(function (reg) { reg.update(); })
      .catch(function () {});
  });
}
})();
