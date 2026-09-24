'use strict';
// 器: 一覧を作る・ハッシュで道具を切り替える・道具が使う共通の部品（kit）。
// 道具は tools/<id>.js に 1 つずつあり、NumberBench.add({...}) で自分を登録する。

// アプリの名前はここだけに書く（画面の見出し・タブの題・共有の文に使う）。
// <head>・manifest・README の名前は別に書いてあるので、名前を変えるときはそちらも直す。
const APP_NAME = 'NUMBER BENCH';
const APP_TITLE = '確率も体感時間も、すぐ計算';
const APP_TEXT = '当たる確率や人生の体感時間など、ふと気になった数をすぐ計算する道具を集めた箱。つまみを動かすと、答えとグラフがその場で変わる。';

// localStorage はほかのアプリと共有される（同じ t-of.github.io のため）。
// キーは必ず 'number-bench.' で始める。道具の値は 'number-bench.<道具の id>'。
const STORE = 'number-bench.';

function load(key) {
  try { return JSON.parse(localStorage.getItem(STORE + key)); } catch { return null; }
}
function save(key, value) {
  try { localStorage.setItem(STORE + key, JSON.stringify(value)); } catch { /* 保存できなくても使える */ }
}

const TOOLS = [];
window.NumberBench = { add: (tool) => TOOLS.push(tool) };

WebAppKit.init({ title: APP_NAME, text: APP_TEXT });

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('./sw.js');
}

const $ = (id) => document.getElementById(id);
const settings = (() => {
  const s = load('settings');
  return s && s.v === 1 ? { v: 1, sound: s.sound !== false, seenHelp: !!s.seenHelp } : { v: 1, sound: true, seenHelp: false };
})();

// ---- 音 ----
// 音声ファイルは使わず Web Audio で作る。小さく短く、数字が変わるたびに鳴らしっぱなしにしない

// iPhone のマナーモードでも鳴らす（Safari 16.4 以降）。
// 'playback' にすると音楽アプリの曲が止まるので、アプリの音がオンのときだけにする。
function setAudioSession(soundOn) {
  try { if (navigator.audioSession) navigator.audioSession.type = soundOn ? 'playback' : 'auto'; } catch { /* 対応していない */ }
}
setAudioSession(settings.sound);

let actx = null, master = null;
// ブラウザは触る前の音を止めるので、AudioContext は最初に触ったときに作る
function unlockAudio() {
  if (!settings.sound) return;
  setAudioSession(true);
  if (!actx) {
    try { actx = new (window.AudioContext || window.webkitAudioContext)(); } catch { return; }
    master = actx.createGain();
    master.gain.value = 0.5;
    master.connect(actx.destination);
  }
  if (actx.state === 'suspended') actx.resume();
}
addEventListener('pointerdown', unlockAudio, true);
addEventListener('keydown', unlockAudio, true);

// notes = [[周波数, 開始の遅れ(秒)], …]
function tone(notes, dur, type = 'sine', gain = 0.06) {
  if (!settings.sound || !actx) return;
  const now = actx.currentTime;
  for (const [f, at = 0] of notes) {
    const t = now + at;
    const o = actx.createOscillator(), g = actx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(f, t);
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(gain, t + 0.006);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(master);
    o.start(t);
    o.stop(t + dur + 0.03);
  }
}
const SOUNDS = {
  tick: () => tone([[1400]], 0.03, 'sine', 0.03),
  edge: () => tone([[160]], 0.09, 'triangle', 0.08),
  // v = 答え（0〜1）。0 で低く、1 で高く（2 オクターブ）
  answer: (v) => tone([[330 * 4 ** Math.min(1, Math.max(0, v || 0))]], 0.08, 'triangle', 0.06),
  open: () => tone([[523.25], [783.99, 0.08]], 0.09, 'triangle', 0.05),
  back: () => tone([[783.99], [523.25, 0.08]], 0.09, 'triangle', 0.05),
  on: () => tone([[660]], 0.07, 'triangle', 0.06),
};

function renderSound() {
  $('soundBtn').setAttribute('aria-pressed', String(settings.sound));
  $('soundBtn').setAttribute('aria-label', settings.sound ? '音: オン' : '音: オフ');
  $('soundIcon').innerHTML = settings.sound
    ? '<path d="M11 5 6 9H3v6h3l5 4z"/><path d="M15.5 8.8a4.5 4.5 0 0 1 0 6.4M18.3 6a8.5 8.5 0 0 1 0 12"/>'
    : '<path d="M11 5 6 9H3v6h3l5 4z"/><path d="m16 9.5 5 5m0-5-5 5"/>';
}
$('soundBtn').addEventListener('click', () => {
  settings.sound = !settings.sound;
  save('settings', settings);
  setAudioSession(settings.sound);
  renderSound();
  if (settings.sound) { unlockAudio(); SOUNDS.on(); }
});
renderSound();

// ---- 使い方 ----
function showHelp(open) { $('help').hidden = !open; }
$('helpBtn').addEventListener('click', () => showHelp(true));
$('helpClose').addEventListener('click', () => {
  showHelp(false);
  if (!settings.seenHelp) { settings.seenHelp = true; save('settings', settings); }
});
$('help').addEventListener('click', (e) => { if (e.target === $('help')) $('helpClose').click(); });
addEventListener('keydown', (e) => { if (e.key === 'Escape' && !$('help').hidden) $('helpClose').click(); });

// ---- 数の書き方 ----
// 0〜1 の確率を「63.4 %」の形にする。
// 小数 1 桁。0.1 % 未満は有効数字 2 桁。ちょうど 0 と 1 はそのまま
function pct(v) {
  if (v <= 0) return '0 %';
  if (v >= 1) return '100 %';
  const x = v * 100;
  if (x >= 0.1) return `${x.toFixed(1)} %`;
  if (x < 1e-6) return '0.000001 % 未満';   // これより小さいと桁が長すぎて画面に入らない
  return `${x.toFixed(1 - Math.floor(Math.log10(x)))} %`;
}
// 3 桁ごとに , を入れる。digits = 小数の桁
const num = (v, digits = 0) => v.toLocaleString('ja-JP', { minimumFractionDigits: digits, maximumFractionDigits: digits });

// ---- 部品（kit） ----
// 道具ごとに作る。保存のキーと共有の URL に道具の id を使う

// 押しっぱなしで続けて動かす。fn() が false を返したら止める
function holdRepeat(btn, fn) {
  let timer = null;
  const stop = () => { clearTimeout(timer); timer = null; };
  btn.addEventListener('pointerdown', (e) => {
    if (e.button) return;
    e.preventDefault();
    stop();
    if (fn(0) === false) return;
    let count = 1;
    const again = () => { timer = setTimeout(() => (fn(count++) === false ? stop() : again()), 70); };
    timer = setTimeout(again, 380);
  });
  for (const ev of ['pointerup', 'pointerleave', 'pointercancel']) btn.addEventListener(ev, stop);
  btn.addEventListener('click', (e) => { if (e.detail === 0) fn(0); });   // キーボード
  btn.addEventListener('contextmenu', (e) => e.preventDefault());
}

let rowSeq = 0;
function makeKit(tool) {
  const kit = {
    sound: (name, v) => SOUNDS[name]?.(v),
    pct,
    num,

    // 保存した値。読めない・範囲の外なら defaults
    load() {
      const s = load(tool.id);
      if (s && s.v === 1) {
        const { v, ...rest } = s;
        const merged = { ...tool.defaults, ...rest };
        if (tool.valid(merged)) return merged;
      }
      return { ...tool.defaults };
    },
    save: (state) => save(tool.id, { v: 1, ...state }),

    share(text) {
      WebAppKit.share({ text: `${text}（${APP_NAME}）`, url: location.origin + location.pathname + '#' + tool.id });
    },

    // 数の行: 名前・− ＋・数字をタップして打つ。
    // o = { label, unit, min, max, steps(− ＋ で動く先の一覧。なければ 1 ずつ), digits(小数の桁), get, set, commit }
    // set(v) は範囲に収めた値で呼ぶ。min / max は関数でもよい（ほかの値で変わるとき）
    row(o) {
      const el = document.createElement('div');
      el.className = 'row';
      el.innerHTML = `<label class="row__label"></label>
        <button class="step" aria-label="へらす">−</button>
        <span class="row__value"><input type="text" autocomplete="off"><small></small></span>
        <button class="step" aria-label="ふやす">＋</button>`;
      const [label, minus, , plus] = el.children;
      const input = el.querySelector('input');
      input.id = `row${++rowSeq}`;
      label.htmlFor = input.id;
      label.textContent = o.label;
      el.querySelector('small').textContent = o.unit;
      input.inputMode = o.digits ? 'decimal' : 'numeric';
      const lo = () => (typeof o.min === 'function' ? o.min() : o.min);
      const hi = () => (typeof o.max === 'function' ? o.max() : o.max);
      const round = (v) => Number(v.toFixed(o.digits || 0));
      const show = () => { input.value = String(o.get()); };

      const bump = (dir, i) => {
        const now = o.get();
        let next;
        if (o.steps) {
          next = dir > 0 ? o.steps.find((s) => s > now) : [...o.steps].reverse().find((s) => s < now);
          if (next !== undefined) next = Math.min(hi(), Math.max(lo(), next));
        } else next = now + dir;
        if (next === undefined || next === now || next < lo() || next > hi()) {
          if (i === 0) kit.sound('edge');
          return false;
        }
        o.set(next);
        if (i % 4 === 0) kit.sound('tick');
      };
      holdRepeat(minus, (i) => bump(-1, i));
      holdRepeat(plus, (i) => bump(1, i));

      input.addEventListener('focus', () => input.select());
      input.addEventListener('keydown', (e) => { if (e.key === 'Enter') input.blur(); });
      input.addEventListener('change', () => {
        // 全角の数字も読む
        const v = parseFloat(input.value.replace(/[０-９．]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0)).replace(/[,，]/g, ''));
        if (Number.isFinite(v)) o.set(round(Math.min(hi(), Math.max(lo(), v))));
        show();
        o.commit?.();
      });
      return { el, show };
    },

    // 対数目盛りのスライダー（min〜max の整数）
    slider(o) {
      const el = document.createElement('input');
      el.type = 'range';
      el.className = 'slider';
      el.min = 0; el.max = 1000;
      el.setAttribute('aria-label', o.label);
      const a = Math.log(o.min), b = Math.log(o.max);
      el.addEventListener('input', () => o.set(Math.round(Math.exp(a + (b - a) * el.value / 1000))));
      el.addEventListener('change', () => o.commit?.());
      const show = () => { el.value = Math.round((Math.log(o.get()) - a) / (b - a) * 1000); };
      return { el, show };
    },

    // SVG の折れ線グラフの下地。横 0〜xmax、縦 0〜1（0〜100 %）。
    // 軸と目盛りを描き、点を画面の座標にする X()・Y() と、点の列を path の d にする line() を返す。
    // right = グラフの右にあける幅（道具が自分で何かを置く）
    chart(svg, { xmax, xlabel, right = 0 }) {
      const W = 360, H = 170, L = 34, T = 8, B = 26;
      const R = W - 12 - right;
      svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
      const X = (x) => L + (R - L) * x / xmax;
      const Y = (y) => H - B - (H - B - T) * y;
      const line = (pts) => pts.map(([x, y], i) => `${i ? 'L' : 'M'}${X(x).toFixed(1)} ${Y(y).toFixed(1)}`).join('');
      // 横の目盛り: 1・2・5 × 10ⁿ で 3〜5 本
      const raw = xmax / 4, mag = 10 ** Math.floor(Math.log10(raw));
      const tick = Math.max(1, [1, 2, 5, 10].map((m) => m * mag).find((t) => t >= raw));   // 横はいつも整数
      let g = '';
      for (const y of [0, 0.5, 1]) {
        g += `<line class="grid" x1="${L}" x2="${R}" y1="${Y(y)}" y2="${Y(y)}"/>`;
        g += `<text class="axis" x="${L - 5}" y="${Y(y) + 4}" text-anchor="end">${y * 100}%</text>`;
      }
      for (let x = 0; x <= xmax + 1e-9; x += tick) {
        const end = X(x) > R - 16;   // 右端の目盛りは右をそろえる（はみ出さないように）
        g += `<text class="axis" x="${end ? R + 4 : X(x)}" y="${H - B + 15}" text-anchor="${end ? 'end' : 'middle'}">${num(x)}</text>`;
      }
      g += `<text class="axis" x="${L - 8}" y="${H - B + 15}" text-anchor="end">${xlabel}</text>`;
      return { X, Y, line, draw: (inner) => { svg.innerHTML = g + inner; } };
    },
  };
  return kit;
}

// ---- 一覧と切り替え ----
let current = null;   // 開いている道具

function renderList() {
  $('toolList').innerHTML = '';
  for (const t of TOOLS) {
    const li = document.createElement('li');
    li.innerHTML = `<a class="card" href="#${t.id}"><span class="card__mark"></span><span class="card__text"><b></b><small></small></span></a>`;
    const mark = li.querySelector('.card__mark');
    mark.textContent = t.mark;
    mark.style.background = t.color;
    li.querySelector('b').textContent = t.name;
    li.querySelector('small').textContent = t.lead;
    $('toolList').append(li);
  }
}

function route() {
  const tool = TOOLS.find((t) => '#' + t.id === location.hash);
  const was = current;
  current = tool || null;
  $('home').hidden = !!tool;
  $('tool').hidden = !tool;
  $('backBtn').hidden = !tool;
  $('barTitle').textContent = tool ? tool.name : APP_NAME;
  document.title = tool ? `${tool.name} — ${APP_NAME}` : `${APP_NAME} — ${APP_TITLE}`;
  document.documentElement.style.setProperty('--tool', tool ? tool.color : '');
  if (tool) {
    const el = $('tool');
    el.innerHTML = '';
    const kit = makeKit(tool);
    tool.mount(el, kit, kit.load());
  }
  if (tool !== was) {
    scrollTo(0, 0);
    if (tool) SOUNDS.open(); else if (was) SOUNDS.back();
  }
}

let cameFromList = false;
$('toolList').addEventListener('click', (e) => { if (e.target.closest('a')) cameFromList = true; });
$('backBtn').addEventListener('click', () => {
  // 一覧から来たならブラウザの戻ると同じにする（履歴を増やさない）
  if (cameFromList) history.back();
  else { history.pushState(null, '', location.pathname); route(); }
  cameFromList = false;
});
addEventListener('hashchange', route);

// 道具の <script> がすべて読まれてから始める
addEventListener('DOMContentLoaded', () => {
  renderList();
  route();
  if (!settings.seenHelp) showHelp(true);
});
