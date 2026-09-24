'use strict';
// 道具: 当たる確率。毎回同じ確率 p のくじを n 回引いて、k 回以上当たる確率（二項分布）と、
// x の確率で k 回以上当てるのに要る回数。
(() => {
  // [k 回以上当たる確率, k 回に届かない確率]。p は 0〜1。
  // 小さいほうの側を足して出す（1 から引くと、小さい確率の桁が落ちるため）。
  // 各項は対数で持ち、最大の項でくくって足す（n が大きいと 0.8^n などがそのままでは 0 に落ちる）
  function tails(p, n, k) {
    if (k <= 0) return [1, 0];
    if (k > n || p <= 0) return [0, 1];
    if (p >= 1) return [1, 0];
    if (k === 1) {
      const miss = Math.exp(n * Math.log1p(-p));
      return [-Math.expm1(n * Math.log1p(-p)), miss];
    }
    const r = Math.log(p / (1 - p));
    let L = n * Math.log1p(-p);   // i = 0 の項
    const terms = [];
    const low = k <= (n + 1) * p;
    if (low) {
      // 山の頂上は k より上。0〜k−1 回を足して 1 から引く
      terms.push(L);
      for (let i = 1; i < k; i++) { L += Math.log((n - i + 1) / i) + r; terms.push(L); }
    } else {
      // 山の頂上は k より下。k 回から上を、項が十分小さくなるまで足す
      for (let i = 1; i <= k; i++) L += Math.log((n - i + 1) / i) + r;
      for (let i = k; i <= n; i++) {
        terms.push(L);
        if (L < terms[0] - 40) break;   // e^−40 ≈ 4 × 10^−18。これより先は足しても変わらない
        L += Math.log((n - i) / (i + 1)) + r;
      }
    }
    const m = Math.max(...terms);
    let sum = 0;
    for (const t of terms) sum += Math.exp(t - m);
    const s = Math.min(1, Math.exp(m) * sum);
    return low ? [1 - s, s] : [s, 1 - s];
  }
  const atLeast = (p, n, k) => tails(p, n, k)[0];

  const MAX_PULLS = 1000000;
  // x の確率で k 回以上当てるのに要る最小の回数。届かない・100 万回を超えるときは null
  function pullsFor(p, k, x) {
    if (p <= 0) return null;
    if (p >= 1) return k;
    if (x >= 1) return null;
    if (x <= 0) return k;
    if (k === 1) {
      let n = Math.ceil(Math.log1p(-x) / Math.log1p(-p));
      if (n > 1 && atLeast(p, n - 1, 1) >= x) n--;   // 割り算の誤差で 1 多くなるのを防ぐ
      return n > MAX_PULLS ? null : n;
    }
    let lo = k - 1, hi = k;
    while (atLeast(p, hi, k) < x) {
      if (hi >= MAX_PULLS) return null;
      lo = hi;
      hi = Math.min(hi * 2, MAX_PULLS);
    }
    while (hi - lo > 1) {
      const mid = Math.floor((lo + hi) / 2);
      if (atLeast(p, mid, k) >= x) hi = mid; else lo = mid;
    }
    return hi;
  }

  const P_STEPS = [0.01, 0.02, 0.05, 0.1, 0.2, 0.3, 0.5, 1, 2, 3, 5, 10, 20, 25, 30, 40, 50, 60, 70, 75, 80, 90, 100];
  const X_STEPS = [50, 60, 70, 80, 90, 95, 99, 99.9];
  const int = (v) => Number.isInteger(v);

  MathTools.add({
    id: 'chance',
    name: '当たる確率',
    lead: '当たる確率が ◯ % のくじを何回か引いたとき、何回以上当たる確率はどれくらいか。何回引けばよいかも出す。',
    mark: '%',
    color: '#e0603f',
    defaults: { p: 1, n: 100, k: 1, x: 90 },
    valid: (s) => s.p >= 0.01 && s.p <= 100 && int(s.n) && s.n >= 1 && s.n <= 10000
      && int(s.k) && s.k >= 1 && s.k <= Math.min(1000, s.n) && s.x >= 1 && s.x <= 99.9,
    calc: { atLeast, tails, pullsFor },

    mount(el, kit, state) {
      el.innerHTML = `
        <div class="answer">
          <p class="answer__lead" data-o="lead"></p>
          <p class="answer__big" data-o="big"></p>
          <p class="answer__sub" data-o="sub"></p>
          <p class="answer__sub" data-o="rev"></p>
        </div>
        <svg class="chart" data-o="chart" role="img" aria-label="引く回数と、当たる確率のグラフ"></svg>
        <div class="inputs" data-o="inputs"></div>
        <p class="note">毎回同じ確率で、前の結果に左右されないくじの計算です。回数で確率が変わるくじ（途中で必ず当たる仕組みなど）には合いません。</p>
        <button class="btn" data-o="share">この結果を共有</button>`;
      const o = (name) => el.querySelector(`[data-o="${name}"]`);
      let hit = 0;
      const ding = () => kit.sound('answer', hit);
      const set = (key) => (v) => {
        state[key] = v;
        if (state.k > state.n) state.k = state.n;
        render();
      };
      const rows = [
        kit.row({ label: '1 回で当たる確率', unit: '%', min: 0.01, max: 100, steps: P_STEPS, digits: 2, get: () => state.p, set: set('p'), commit: ding }),
        kit.row({ label: '引く回数', unit: '回', min: 1, max: 10000, get: () => state.n, set: set('n'), commit: ding }),
        kit.slider({ label: '引く回数', min: 1, max: 10000, get: () => state.n, set: set('n'), commit: ding }),
        kit.row({ label: '当たってほしい回数', unit: '回', min: 1, max: () => Math.min(1000, state.n), get: () => state.k, set: set('k'), commit: ding }),
        kit.row({ label: 'ねらう確率', unit: '%', min: 1, max: 99.9, steps: X_STEPS, digits: 1, get: () => state.x, set: set('x'), commit: ding }),
      ];
      for (const r of rows) o('inputs').append(r.el);

      // 確率の文字。99.95 % 以上 100 % 未満は「99.9 % 以上」。
      // 当たる確率が 100 % でなければ、計算の桁の外でも 0 / 100 % ちょうどにはならない
      const sure = () => state.p === 100;
      const small = (v) => kit.pct(sure() ? v : Math.max(v, 1e-300));
      const big = (v) => (!sure() && v >= 0.9995 ? '99.9 % 以上' : small(v));
      const times = (v) => (v >= 0.1 || v === 0 ? kit.num(v, 1) : String(Number(v.toPrecision(2))));

      let text = '';
      function render() {
        for (const r of rows) r.show();
        const { p, n, k, x } = state;
        const [h, miss] = tails(p / 100, n, k);
        hit = h;
        const pulls = pullsFor(p / 100, k, x / 100);
        o('lead').textContent = `${kit.num(n)} 回引いて ${kit.num(k)} 回以上当たる確率`;
        o('big').textContent = big(hit);
        // 折り返すときは 2 つの間で折り返す
        o('sub').innerHTML = `<span class="nowrap">${k === 1 ? '1 回も当たらない' : `${kit.num(k)} 回に届かない`}確率 ${small(miss)}</span> ・ <span class="nowrap">平均で当たる回数 ${times(n * p / 100)} 回</span>`;
        const need = pulls === null ? (p > 0 ? '100 万回を超える' : '何回引いても届かない') : `${kit.num(pulls)} 回`;
        o('rev').innerHTML = `${x} % の確率で ${kit.num(k)} 回以上当てるには <b></b>`;
        o('rev').querySelector('b').textContent = need;
        text = `${p} % のくじを ${kit.num(n)} 回引くと、${kit.num(k)} 回以上当たる確率は ${big(hit)}。${x} % で当てるには ${need}。`;

        // グラフ: 横 = 引く回数、縦 = k 回以上当たる確率
        const xmax = Math.min(10000, Math.max(n, pulls || 0) * 1.5);
        const c = kit.chart(o('chart'), { xmax, xlabel: '回' });
        const pts = [];
        const count = Math.min(160, Math.floor(xmax));
        for (let i = 0; i <= count; i++) {
          const m = Math.round(xmax * i / count);
          pts.push([m, atLeast(p / 100, m, k)]);
        }
        c.draw(`<path class="curve" d="${c.line(pts)}"/>
          <line class="target" x1="${c.X(0)}" x2="${c.X(xmax)}" y1="${c.Y(x / 100)}" y2="${c.Y(x / 100)}"/>
          <line class="now" x1="${c.X(n)}" x2="${c.X(n)}" y1="${c.Y(0)}" y2="${c.Y(1)}"/>
          <circle class="dot" cx="${c.X(n)}" cy="${c.Y(hit)}" r="4.5"/>`);
        kit.save(state);
      }
      o('share').addEventListener('click', () => kit.share(text));
      render();
    },
  });
})();
