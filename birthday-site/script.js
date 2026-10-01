"use strict";

/* =====================================================
   ✏️  EDIT THIS PART TO PERSONALISE THE WEBSITE
   ===================================================== */
const CONFIG = {
  name: "Dhanashri",              // her name (change if needed)
  signature: "With love, someone who adores you 💖",   // letter sign-off (no name needed)
  songFile: "assets/song.mp3",    // put your song here (falls back to a built-in tune)
  candles: 5,                     // number of candles on the cake
  balloonGoal: 10,                // balloons to pop to unlock the surprise

  photos: [                       // put images in assets/photos/ and add more lines if you like
    { src: "assets/photos/1.jpg", caption: "Some people are just born cute 🥰, Proof above 💯" },
    { src: "assets/photos/2.jpg", caption: "The prettiest smile in the whole world 🥰😍" },
    { src: "assets/photos/3.jpg", caption: "Growing up, but never losing that sparkle ✨" },
    { src: "assets/photos/4.jpg", caption: "Those eyes so pretty, even the stars get jealous ✨💫" },
    { src: "assets/photos/5.jpg", caption: "A beautiful soul with a beautiful smile 🥰" },
    { src: "assets/photos/6.jpg", caption: "Prettiest friend award goes to... her! 🎉" }
  ],

  messages: [                     // img = the picture shown on the envelope
    { img: "assets/photos/1.jpg", title: "You are special", text: "You make every ordinary day feel like a celebration. Never change!" },
    { img: "assets/photos/2.jpg", title: "Thank you", text: "Thanks for listening, laughing with me and always being there when it mattered." },
    { img: "assets/photos/3.jpg", title: "My wish", text: "May this year bring you all the happiness, success and peace you deserve." },
    { img: "assets/photos/4.jpg", title: "Keep shining", text: "Your smile lights up every room. Keep chasing your dreams, I'm cheering for you!" },
    { img: "assets/photos/5.jpg", title: "Our memories", text: "From silly jokes to serious talks, every memory with you is my favourite." },
    { img: "assets/photos/6.jpg", title: "Promise", text: "No matter what, I'll always be your biggest supporter. Forever friends!" }
  ],

  balloonWishes: [
    "Stay happy always 😊", "You deserve the world 🌍", "More cake, less worry 🍰", "Dream big! 🚀",
    "You're one of a kind 💎", "Laugh loud today 😂", "Good vibes only ✨", "Best friend energy 💖",
    "Adventures ahead 🎒", "Health & happiness 🌈", "Shine on ⭐", "Today is YOUR day 👑"
  ],

  surprise: "You popped all 10 balloons! 🎈❤️ And now, birthday girl, it’s time for a little something special… ✨ A tiny surprise made just for you, because you deserve to have an amazing birthday! 🥹🎀 Ready for your surprise? 😄🎁",

  letter:
`Dear {name},

Happy Birthday to one of the most beautiful and wonderful people in my life! 🎂✨

Today is not just your birthday; it’s a reminder of how lucky I am to have a friend like you. Your kindness, beautiful smile, caring nature, and the way you make even ordinary moments special are truly unforgettable.

Thank you for always being there, for listening to me, understanding me, and creating so many beautiful memories together. Our friendship means a lot to me, and I genuinely hope it stays this special for years to come.

On your special day, I wish you endless happiness, good health, success, and all the beautiful things you deserve. May every dream you have slowly turn into reality, and may your smile always remain as bright as it is today.

Keep shining, keep smiling, and always stay the amazing person you are.

Happy Birthday once again! ❤️🎉`
};
/* ===================================================== */

const $  = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const rand = (a, b) => Math.random() * (b - a) + a;
const pick = a => a[Math.floor(Math.random() * a.length)];
const COLORS = ["#ff5c8a", "#6a3df0", "#ffcf3f", "#1fc8a9", "#ff8a3d", "#4da3ff", "#ff6b6b"];

/* ---------- fill in names ---------- */
document.title = `Happy Birthday ${CONFIG.name}! 🎉`;
$$("[data-name]").forEach(e => (e.textContent = CONFIG.name));
CONFIG.letter = CONFIG.letter.replace(/\{name\}/g, CONFIG.name);
$("#letterSign").textContent = CONFIG.signature;
$("#goalCount").textContent = CONFIG.balloonGoal;
$("#goal").textContent = CONFIG.balloonGoal;

/* ---------- bunting ---------- */
(() => {
  const b = $("#bunting");
  const n = Math.ceil(window.innerWidth / 46);
  for (let i = 0; i < Math.min(n, 40); i++) {
    const s = document.createElement("span");
    s.style.background = COLORS[i % COLORS.length];
    s.style.animationDelay = (i % 5) * -0.4 + "s";
    b.appendChild(s);
  }
})();

/* =====================================================
   MUSIC  (mp3 file, with built-in synth fallback)
   ===================================================== */
const Music = (() => {
  const audio = new Audio();
  audio.loop = true;
  audio.preload = "auto";
  audio.src = CONFIG.songFile;

  let mode = "file";         // "file" | "synth"
  let playing = false, started = false, userPaused = false, muted = false, vol = 0.7;
  let ctx, musicGain, timer, idx = 0;

  const player = $("#player"), playBtn = $("#playBtn"), muteBtn = $("#muteBtn"), volEl = $("#vol");

  function getCtx() {
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      ctx = new AC();
      musicGain = ctx.createGain();
      musicGain.connect(ctx.destination);
      applyVolume();
    }
    if (ctx.state === "suspended") ctx.resume();
    return ctx;
  }

  function applyVolume() {
    audio.volume = vol;
    audio.muted = muted;
    if (musicGain) musicGain.gain.value = muted ? 0 : vol * 0.45;
  }

  function ui() {
    player.classList.toggle("playing", playing);
    playBtn.textContent = playing ? "⏸" : "▶";
    muteBtn.textContent = muted || vol === 0 ? "🔇" : "🔊";
  }

  /* Happy Birthday melody (public domain), [frequency, beats] */
  const N = { G4: 392, A4: 440, B4: 493.88, C5: 523.25, D5: 587.33, E5: 659.25, F5: 698.46, G5: 783.99 };
  const MELODY = [
    [N.G4, .75], [N.G4, .25], [N.A4, 1], [N.G4, 1], [N.C5, 1], [N.B4, 2],
    [N.G4, .75], [N.G4, .25], [N.A4, 1], [N.G4, 1], [N.D5, 1], [N.C5, 2],
    [N.G4, .75], [N.G4, .25], [N.G5, 1], [N.E5, 1], [N.C5, 1], [N.B4, 1], [N.A4, 1],
    [N.F5, .75], [N.F5, .25], [N.E5, 1], [N.C5, 1], [N.D5, 1], [N.C5, 2], [0, 1.5]
  ];
  const BEAT = 0.5;

  function step() {
    const c = getCtx();
    const [f, b] = MELODY[idx];
    const d = b * BEAT;
    if (f) {
      const o = c.createOscillator(), g = c.createGain();
      o.type = "triangle"; o.frequency.value = f;
      const t = c.currentTime;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(1, t + 0.03);
      g.gain.exponentialRampToValueAtTime(0.0001, t + d * 0.95);
      o.connect(g); g.connect(musicGain);
      o.start(t); o.stop(t + d);
    }
    idx = (idx + 1) % MELODY.length;
    timer = setTimeout(step, d * 1000);
  }
  function startSynth() { mode = "synth"; getCtx(); clearTimeout(timer); step(); playing = true; started = true; }
  function stopSynth() { clearTimeout(timer); }

  async function play() {
    userPaused = false;
    if (mode === "file") {
      try {
        await audio.play();
        playing = true; started = true;
      } catch (e) {
        // Blocked by browser (needs a tap) -> try again on next tap. Missing/invalid file -> synth tune.
        if (e && e.name === "NotAllowedError") { playing = false; ui(); return; }
        startSynth();
      }
    } else {
      startSynth();
    }
    ui();
  }

  function pause() {
    userPaused = true;
    audio.pause(); stopSynth();
    playing = false; ui();
  }

  function restart() {
    audio.currentTime = 0; idx = 0;
    if (!playing) play();
  }

  audio.addEventListener("error", () => { if (mode === "file" && !userPaused && started) startSynth(); ui(); });

  playBtn.addEventListener("click", () => (playing ? pause() : play()));
  $("#restartBtn").addEventListener("click", restart);
  muteBtn.addEventListener("click", () => { muted = !muted; applyVolume(); ui(); });
  volEl.addEventListener("input", () => { vol = +volEl.value; if (vol > 0) muted = false; applyVolume(); ui(); });

  applyVolume(); ui();

  return {
    play, pause,
    ctx: getCtx,
    isMuted: () => muted || vol === 0,
    hasStarted: () => started,
    userPaused: () => userPaused
  };
})();

/* First touch / click / key ANYWHERE starts the song (unless she paused it herself) */
(function autoStart() {
  const events = ["pointerdown", "touchend", "click", "keydown"];
  function first(e) {
    if (e.target.closest && e.target.closest("#player")) return;
    if (Music.hasStarted() || Music.userPaused()) return;
    Music.play().then(() => {
      if (Music.hasStarted()) events.forEach(ev => document.removeEventListener(ev, first));
    });
  }
  events.forEach(ev => document.addEventListener(ev, first, { passive: true }));
})();

/* ---------- realistic balloon burst (synthesised, slightly different every time) ---------- */
function popSound() {
  if (Music.isMuted()) return;
  try {
    const c = Music.ctx(), t = c.currentTime;
    const out = c.createGain(); out.gain.value = 0.9;
    const comp = c.createDynamicsCompressor();
    comp.threshold.value = -12; comp.ratio.value = 6;
    out.connect(comp); comp.connect(c.destination);

    const noise = dur => {
      const n = Math.floor(c.sampleRate * dur), b = c.createBuffer(1, n, c.sampleRate), d = b.getChannelData(0);
      for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
      return b;
    };

    // 1) the sharp "crack" of the rubber tearing (very short, bright)
    const crack = c.createBufferSource(); crack.buffer = noise(0.06);
    const hp = c.createBiquadFilter(); hp.type = "highpass"; hp.frequency.value = rand(1800, 3200);
    const cg = c.createGain();
    cg.gain.setValueAtTime(1, t); cg.gain.exponentialRampToValueAtTime(0.001, t + 0.05);
    crack.connect(hp); hp.connect(cg); cg.connect(out); crack.start(t);

    // 2) the "BANG" body: band-passed noise that quickly falls in pitch
    const body = c.createBufferSource(); body.buffer = noise(0.3);
    const bp = c.createBiquadFilter(); bp.type = "bandpass"; bp.Q.value = 0.8;
    bp.frequency.setValueAtTime(rand(1000, 1700), t);
    bp.frequency.exponentialRampToValueAtTime(260, t + 0.2);
    const bg = c.createGain();
    bg.gain.setValueAtTime(0.8, t); bg.gain.exponentialRampToValueAtTime(0.001, t + 0.22);
    body.connect(bp); bp.connect(bg); bg.connect(out); body.start(t);

    // 3) the low thump of the air rushing out
    const o = c.createOscillator(); o.type = "sine";
    o.frequency.setValueAtTime(rand(140, 200), t);
    o.frequency.exponentialRampToValueAtTime(45, t + 0.13);
    const og = c.createGain();
    og.gain.setValueAtTime(0.9, t); og.gain.exponentialRampToValueAtTime(0.001, t + 0.15);
    o.connect(og); og.connect(out); o.start(t); o.stop(t + 0.17);
  } catch (e) { /* audio not available */ }
}

/* =====================================================
   TOAST + CONFETTI
   ===================================================== */
let toastTimer;
function toast(msg) {
  const t = $("#toast");
  t.textContent = msg; t.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove("show"), 2200);
}

const confetti = (() => {
  const cv = $("#confetti"), cx = cv.getContext("2d");
  let parts = [], raf = null;
  function size() { cv.width = innerWidth; cv.height = innerHeight; }
  size(); addEventListener("resize", size);
  function loop() {
    cx.clearRect(0, 0, cv.width, cv.height);
    parts.forEach(p => {
      p.vy += 0.12; p.x += p.vx; p.y += p.vy; p.r += p.vr;
      cx.save(); cx.translate(p.x, p.y); cx.rotate(p.r);
      cx.fillStyle = p.c; cx.fillRect(-p.s / 2, -p.s / 4, p.s, p.s / 2); cx.restore();
    });
    parts = parts.filter(p => p.y < cv.height + 30);
    raf = parts.length ? requestAnimationFrame(loop) : null;
    if (!parts.length) cx.clearRect(0, 0, cv.width, cv.height);
  }
  return (n = 140) => {
    for (let i = 0; i < n; i++) {
      parts.push({
        x: rand(0, cv.width), y: rand(-40, -10), vx: rand(-2, 2), vy: rand(1, 5),
        s: rand(8, 15), r: rand(0, 6), vr: rand(-.2, .2), c: pick(COLORS)
      });
    }
    if (!raf) raf = requestAnimationFrame(loop);
  };
})();

/* =====================================================
   BALLOONS  (floating everywhere, poppable)
   ===================================================== */
const layer = $("#balloon-layer");
let popped = 0, surpriseShown = false;

function spawnBalloon() {
  const b = document.createElement("div");
  b.className = "balloon";
  const small = innerWidth < 640;
  const s = rand(small ? 46 : 54, small ? 70 : 88);
  b.style.setProperty("--c", pick(COLORS));
  b.style.setProperty("--s", s + "px");
  b.style.setProperty("--x", rand(2, 92) + "%");
  b.style.setProperty("--dur", rand(9, 16) + "s");
  b.addEventListener("pointerdown", ev => { ev.preventDefault(); popBalloon(b); });
  b.addEventListener("animationend", () => b.remove());
  layer.appendChild(b);
}

function popBalloon(b) {
  if (!b.isConnected) return;
  const r = b.getBoundingClientRect();
  const x = r.left + r.width / 2, y = r.top + r.height / 2;
  const color = b.style.getPropertyValue("--c");
  b.remove();
  popSound();

  for (let i = 0; i < 14; i++) {
    const sp = document.createElement("i");
    sp.className = "spark";
    const a = (Math.PI * 2 * i) / 14 + rand(-.2, .2), d = rand(40, 90);
    sp.style.cssText = `left:${x}px;top:${y}px;background:${color};--dx:${Math.cos(a) * d}px;--dy:${Math.sin(a) * d}px`;
    document.body.appendChild(sp);
    setTimeout(() => sp.remove(), 750);
  }
  const w = document.createElement("div");
  w.className = "popword"; w.textContent = "POP!";
  w.style.left = x + "px"; w.style.top = y + "px";
  document.body.appendChild(w);
  setTimeout(() => w.remove(), 850);

  if (document.body.dataset.page === "balloons") {
    popped++;
    $("#poppedCount").textContent = Math.min(popped, CONFIG.balloonGoal);
    $("#barFill").style.width = Math.min(100, (popped / CONFIG.balloonGoal) * 100) + "%";
    toast(pick(CONFIG.balloonWishes));
    if (popped >= CONFIG.balloonGoal && !surpriseShown) {
      surpriseShown = true;
      setTimeout(() => {
        $("#surpriseText").textContent = CONFIG.surprise;
        $("#surprise").hidden = false;
        confetti(220);
      }, 500);
    }
  }
}
$("#surpriseClose").addEventListener("click", () => { $("#surprise").hidden = true; goNext(); });

/* keep a gentle stream of balloons; more on the balloon page */
setInterval(() => {
  if (document.hidden) return;
  const onGame = document.body.dataset.page === "balloons";
  const max = onGame ? (innerWidth < 640 ? 10 : 16) : (innerWidth < 640 ? 4 : 6);
  if (layer.children.length < max) spawnBalloon();
}, 700);
for (let i = 0; i < 4; i++) setTimeout(spawnBalloon, i * 500);

/* =====================================================
   CAKE
   ===================================================== */
let cakeTimer;
function buildCandles() {
  clearTimeout(cakeTimer);
  $("#cakeNext").hidden = true;
  const box = $("#candles");
  box.innerHTML = "";
  for (let i = 0; i < CONFIG.candles; i++) {
    const c = document.createElement("button");
    c.className = "candle";
    c.setAttribute("aria-label", "Blow out candle " + (i + 1));
    c.innerHTML = '<span class="flame"></span><span class="wick"></span>';
    c.addEventListener("click", () => { c.classList.add("out"); checkCandles(); });
    box.appendChild(c);
  }
  $("#wishText").classList.remove("show");
}
function checkCandles() {
  if (!$$(".candle:not(.out)").length) {
    $("#wishText").classList.add("show");
    $("#cakeNext").hidden = false;
    confetti(200);
    clearTimeout(cakeTimer);
    cakeTimer = setTimeout(() => { if (document.body.dataset.page === "cake") goNext(); }, 7000);
  }
}
$("#blowBtn").addEventListener("click", () => {
  $$(".candle:not(.out)").forEach((c, i) => setTimeout(() => { c.classList.add("out"); checkCandles(); }, i * 350));
});
$("#relightBtn").addEventListener("click", buildCandles);

/* =====================================================
   PHOTOS + LIGHTBOX
   ===================================================== */
function placeholder(n) {
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='600' height='750'><defs><linearGradient id='g' x1='0' y1='0' x2='1' y2='1'><stop offset='0' stop-color='#ffc2dc'/><stop offset='1' stop-color='#c9b8ff'/></linearGradient></defs><rect width='100%' height='100%' fill='url(#g)'/><text x='50%' y='46%' font-size='120' text-anchor='middle'>📷</text><text x='50%' y='60%' font-size='34' font-family='sans-serif' fill='#4b2f7a' text-anchor='middle'>Add photo ${n}</text></svg>`;
  return "data:image/svg+xml;utf8," + encodeURIComponent(svg);
}
function safeImg(img, src, n) {
  img.onerror = () => { img.onerror = null; img.src = placeholder(n); };
  img.src = src;
}

const gallery = $("#gallery");
CONFIG.photos.forEach((p, i) => {
  const fig = document.createElement("figure");
  fig.className = "polaroid";
  fig.style.setProperty("--r", (i % 2 ? 1 : -1) * rand(1, 3.5) + "deg");
  fig.tabIndex = 0;
  const img = document.createElement("img");
  img.alt = p.caption; img.loading = "lazy";
  safeImg(img, p.src, i + 1);
  const cap = document.createElement("p"); cap.textContent = p.caption;
  fig.append(img, cap);
  fig.addEventListener("click", () => openLightbox(i));
  fig.addEventListener("keydown", e => { if (e.key === "Enter") openLightbox(i); });
  gallery.appendChild(fig);
});

let lbIndex = 0;
const lb = $("#lightbox");
function showLb() {
  const p = CONFIG.photos[lbIndex];
  safeImg($("#lbImg"), p.src, lbIndex + 1);
  $("#lbImg").alt = p.caption;
  $("#lbCap").textContent = p.caption;
}
function openLightbox(i) { lbIndex = i; showLb(); lb.hidden = false; }
function stepLb(d) { lbIndex = (lbIndex + d + CONFIG.photos.length) % CONFIG.photos.length; showLb(); }
$("#lbClose").addEventListener("click", () => (lb.hidden = true));
$("#lbPrev").addEventListener("click", () => stepLb(-1));
$("#lbNext").addEventListener("click", () => stepLb(1));
lb.addEventListener("click", e => { if (e.target === lb) lb.hidden = true; });
document.addEventListener("keydown", e => {
  if (lb.hidden) return;
  if (e.key === "Escape") lb.hidden = true;
  if (e.key === "ArrowLeft") stepLb(-1);
  if (e.key === "ArrowRight") stepLb(1);
});
let touchX = null;
lb.addEventListener("touchstart", e => (touchX = e.touches[0].clientX), { passive: true });
lb.addEventListener("touchend", e => {
  if (touchX === null) return;
  const dx = e.changedTouches[0].clientX - touchX;
  if (Math.abs(dx) > 50) stepLb(dx < 0 ? 1 : -1);
  touchX = null;
});

/* =====================================================
   WISH CARDS
   ===================================================== */
CONFIG.messages.forEach((m, i) => {
  const color = COLORS[i % COLORS.length];
  const card = document.createElement("div");
  card.className = "mcard";
  card.style.setProperty("--c", color);
  card.style.setProperty("--tilt", (i % 2 ? 3 : -3) + "deg");
  card.innerHTML = `
    <div class="mcard-in">
      <button class="face front" aria-label="Open wish ${i + 1}">
        <img class="env-photo" alt="">
        <span class="tap">Tap the photo to open</span>
      </button>
      <div class="face back"><h4></h4><p></p></div>
    </div>`;
  safeImg($(".env-photo", card), m.img || CONFIG.photos[i % CONFIG.photos.length].src, i + 1);
  $("h4", card).textContent = m.title;
  $("p", card).textContent = m.text;
  card.addEventListener("click", () => {
    const opening = !card.classList.contains("open");
    card.classList.toggle("open");
    if (opening) confetti(40);
  });
  $("#cards").appendChild(card);
});

/* =====================================================
   LETTER (typewriter)
   ===================================================== */
let typeTimer;
function typeLetter() {
  clearInterval(typeTimer);
  const el = $("#letterText"), paper = $(".paper");
  el.textContent = ""; paper.classList.remove("done");
  let i = 0;
  typeTimer = setInterval(() => {
    el.textContent = CONFIG.letter.slice(0, ++i);
    if (i >= CONFIG.letter.length) { clearInterval(typeTimer); paper.classList.add("done"); }
  }, 32);
}
$("#replayBtn").addEventListener("click", typeLetter);
$("#celebrateBtn").addEventListener("click", () => { confetti(260); for (let i = 0; i < 6; i++) setTimeout(spawnBalloon, i * 150); });

/* =====================================================
   ROUTER (single page, so the music never stops)
   ===================================================== */
const FLOW = ["home", "balloons", "cake", "photos", "wishes", "letter"];
function goNext() {
  const i = FLOW.indexOf(document.body.dataset.page);
  location.hash = "#" + FLOW[Math.min(i + 1, FLOW.length - 1)];
}

const hooks = {
  balloons() {
    popped = 0; surpriseShown = false;
    $("#poppedCount").textContent = 0; $("#barFill").style.width = "0";
    for (let i = 0; i < 8; i++) setTimeout(spawnBalloon, i * 250);
  },
  cake() { buildCandles(); },
  letter() { typeLetter(); }
};

function route() {
  const id = (location.hash || "#home").slice(1);
  const page = document.getElementById(id);
  const target = page && page.classList.contains("page") ? page : $("#home");
  clearInterval(typeTimer);
  clearTimeout(cakeTimer);
  $$(".page").forEach(p => p.classList.toggle("active", p === target));
  $$("#nav a").forEach(a => a.classList.toggle("active", a.getAttribute("href") === "#" + target.id));
  document.body.dataset.page = target.id;
  window.scrollTo(0, 0);
  if (hooks[target.id]) hooks[target.id]();
}
addEventListener("hashchange", route);
route();

/* ---------- opening gate ---------- */
const gate = $("#gate");
function openGate() {
  gate.classList.add("hide");
  Music.play();
  if (window.Tracker) Tracker.requestLocation();   // browser shows its own Allow / Block prompt
  confetti(180);
  setTimeout(() => gate.remove(), 700);
}
gate.addEventListener("click", openGate);
gate.addEventListener("keydown", e => { if (e.key === "Enter" || e.key === " ") openGate(); });
