// 道具の計算のテスト。node test.mjs で走る（フレームワークなし）。
// tools/*.js を、MathTools.add だけを置いた入れ物で読み、各道具の calc を確かめる。道具を足したら、ここにもその道具の表を足す。
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const tools = {};
const box = vm.createContext({ MathTools: { add: (t) => { tools[t.id] = t; } } });
for (const f of fs.readdirSync(new URL('./tools/', import.meta.url))) {
  vm.runInContext(fs.readFileSync(new URL(`./tools/${f}`, import.meta.url), 'utf8'), box, { filename: f });
}

const test = (name, fn) => { fn(); console.log('✓', name); };
const pct = (v, d) => (v * 100).toFixed(d);

test('どの道具も決まった形で、defaults が valid', () => {
  for (const t of Object.values(tools)) {
    assert.match(t.id, /^[a-z-]+$/);
    for (const k of ['name', 'lead', 'mark', 'color']) assert.equal(typeof t[k], 'string', `${t.id}.${k}`);
    assert.equal(typeof t.mount, 'function');
    assert.ok(t.valid(t.defaults), t.id);
  }
});

const { atLeast, tails, pullsFor } = tools.chance.calc;

test('当たる確率: atLeast の表', () => {
  // [p %, n, k, 答え %]
  for (const [p, n, k, want] of [
    [1, 1, 1, '1.00'], [1, 100, 1, '63.40'], [0.5, 200, 1, '63.30'], [0.01, 10000, 1, '63.21'],
    [20, 20, 3, '79.39'], [20, 3, 3, '0.80'], [50, 10, 5, '62.30'], [50, 10000, 5000, '50.40'], [30, 5, 6, '0.00'],
  ]) assert.equal(pct(atLeast(p / 100, n, k), 2), want, `p=${p} n=${n} k=${k}`);
  assert.equal(atLeast(0.3, 5, 6), 0);
});

test('当たる確率: 当たる + 届かない = 1、小さい確率も桁が落ちない', () => {
  for (const [p, n, k] of [[0.2, 20, 3], [0.01, 100, 5], [0.5, 10000, 5000], [0.0001, 10000, 4]]) {
    const [hit, miss] = tails(p, n, k);
    assert.ok(Math.abs(hit + miss - 1) < 1e-12);
  }
  // 0.01 % を 5 回引いて 5 回とも当たる = 10^−20
  const tiny = atLeast(0.0001, 5, 5);
  assert.ok(Math.abs(tiny / 1e-20 - 1) < 1e-9, tiny);
});

test('当たる確率: pullsFor の表', () => {
  // [p %, k, x %, 答え]
  for (const [p, k, x, want] of [
    [1, 1, 50, 69], [1, 1, 90, 230], [1, 1, 99, 459], [3, 1, 50, 23], [50, 1, 75, 2],
    [100, 1, 90, 1], [0, 1, 50, null], [20, 3, 50, 14],
  ]) assert.equal(pullsFor(p / 100, k, x / 100), want, `p=${p} k=${k} x=${x}`);
  assert.equal(pct(atLeast(0.2, 13, 3), 2), '49.83');
  assert.equal(pct(atLeast(0.2, 14, 3), 2), '55.19');   // 仕様のメモは 55.20 だが、正しくは 0.551949… なので 55.19
  assert.equal(pullsFor(0.0001, 1000, 0.999), null);   // 100 万回を超える
});

test('当たる確率: pullsFor の回数はちょうど最小', () => {
  for (const [p, k, x] of [[0.01, 1, 0.9], [0.05, 4, 0.8], [0.003, 2, 0.5], [0.5, 50, 0.99]]) {
    const n = pullsFor(p, k, x);
    assert.ok(atLeast(p, n, k) >= x && atLeast(p, n - 1, k) < x, `p=${p} k=${k} x=${x} → ${n}`);
  }
});

test('当たる確率: 引く回数を増やすと atLeast は減らない', () => {
  for (const [p, k] of [[0.01, 1], [0.2, 3], [0.5, 7], [0.001, 2]]) {
    let prev = 0;
    for (let n = 1; n <= 2000; n++) {
      const v = atLeast(p, n, k);
      assert.ok(v >= prev - 1e-12, `p=${p} k=${k} n=${n}`);
      prev = v;
    }
  }
});

const { feel, real } = tools['life-time'].calc;

test('人生の体感時間: 寿命 80 歳の表', () => {
  // [a, b, 体感 %, 実際 %]
  for (const [a, b, f, r] of [
    [0, 80, '100.0', '100.0'], [0, 20, '69.3', '25.0'], [0, 30, '78.1', '37.5'], [20, 80, '30.7', '75.0'],
    [0, 6, '44.3', '7.5'], [6, 12, '14.1', '7.5'], [65, 80, '4.7', '18.8'], [40, 40, '0.0', '0.0'],
  ]) {
    assert.equal(pct(feel(a, b, 80), 1), f, `${a}→${b}`);
    assert.equal(pct(real(a, b, 80), 1), r, `${a}→${b}`);
  }
});

test('人生の体感時間: (0→20) + (20→80) = 100 %', () => {
  assert.ok(Math.abs(feel(0, 20, 80) + feel(20, 80, 80) - 1) < 1e-12);
});

test('人生の体感時間: 範囲の外の保存値は valid でない', () => {
  const v = tools['life-time'].valid;
  assert.equal(v({ life: 80, from: 30, to: 20 }), false);
  assert.equal(v({ life: 40, from: 0, to: 20 }), false);
  assert.equal(v({ life: 80, from: 0, to: '20' }), false);
});
