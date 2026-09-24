'use strict';
// 道具: 人生の体感時間。1 年の長さは（年齢 + 1）に反比例して感じる、とする説（ジャネーの法則）での目安。
(() => {
  // a 歳の誕生日から b 歳の誕生日までが、体感で 0 歳〜寿命 L 歳の何割か（0〜1）
  const feel = (a, b, L) => (Math.log(b + 1) - Math.log(a + 1)) / Math.log(L + 1);
  // 実際の年数での割合
  const real = (a, b, L) => (b - a) / L;

  // すぐ選べるボタン。to が null なら寿命まで
  const PRESETS = [['20 歳まで', 0, 20], ['小学校の 6 年', 6, 12], ['20 歳から先', 20, null], ['65 歳から先', 65, null]];
  const int = (v) => Number.isInteger(v);

  MathTools.add({
    id: 'life-time',
    name: '人生の体感時間',
    lead: '年をとるほど 1 年が短く感じる（ジャネーの法則）とすると、何歳から何歳までが、体感で人生の何 % にあたるか。',
    mark: '年',
    color: '#1f9a86',
    defaults: { life: 80, from: 0, to: 20 },
    valid: (s) => int(s.life) && int(s.from) && int(s.to) && s.life >= 50 && s.life <= 120 && s.from >= 0 && s.from <= s.to && s.to <= s.life,
    calc: { feel, real },

    mount(el, kit, state) {
      el.innerHTML = `
        <div class="answer">
          <p class="answer__lead" data-o="lead"></p>
          <p class="answer__big" data-o="big"></p>
          <p class="answer__sub" data-o="sub"></p>
        </div>
        <svg class="chart" data-o="chart" role="img" aria-label="年齢と、それまでの体感の割合のグラフ"></svg>
        <div class="inputs" data-o="inputs"></div>
        <div class="presets" data-o="presets"></div>
        <p class="note">ジャネーの法則は心理学の説で、確かめられた法則ではありません。ここでは「1 年の長さは（年齢 + 1）に反比例して感じる」として計算した目安です。</p>
        <button class="btn" data-o="share">この結果を共有</button>`;
      const o = (name) => el.querySelector(`[data-o="${name}"]`);
      let f = 0;
      const ding = () => kit.sound('answer', f);
      // a を b より上げたら b も上げる、b を a より下げたら a も下げる、寿命を下げたら a・b を収める
      const set = (key) => (v) => {
        state[key] = v;
        if (key === 'from' && state.to < v) state.to = v;
        if (key === 'to' && state.from > v) state.from = v;
        state.to = Math.min(state.to, state.life);
        state.from = Math.min(state.from, state.life);
        render();
      };
      const rows = [
        kit.row({ label: '寿命', unit: '歳', min: 50, max: 120, get: () => state.life, set: set('life'), commit: ding }),
        kit.row({ label: '何歳から', unit: '歳', min: 0, max: () => state.life, get: () => state.from, set: set('from'), commit: ding }),
        kit.row({ label: '何歳まで', unit: '歳', min: 0, max: () => state.life, get: () => state.to, set: set('to'), commit: ding }),
      ];
      for (const r of rows) o('inputs').append(r.el);
      for (const [label, a, b] of PRESETS) {
        const btn = document.createElement('button');
        btn.className = 'preset';
        btn.textContent = label;
        btn.addEventListener('click', () => {
          state.from = Math.min(a, state.life);
          state.to = b === null ? state.life : Math.min(b, state.life);
          render();
          ding();
        });
        o('presets').append(btn);
      }

      let text = '';
      function render() {
        for (const r of rows) r.show();
        const { life: L, from: a, to: b } = state;
        f = feel(a, b, L);
        const r = real(a, b, L);
        o('lead').textContent = `${a} 歳から ${b} 歳までは、体感で人生の`;
        o('big').textContent = kit.pct(f);
        o('sub').textContent = `実際の年数では ${kit.pct(r)}（${b - a} 年 / ${L} 年）`;
        text = `寿命 ${L} 歳なら、${a}〜${b} 歳は体感で人生の ${kit.pct(f)}（実際の年数では ${kit.pct(r)}）。`;

        // グラフ: 横 = 年齢、縦 = 生まれてからその年齢までの体感の割合。右に a〜b の幅を 2 本並べる
        const c = kit.chart(o('chart'), { xmax: L, xlabel: '歳', right: 96 });
        const curve = [];
        for (let t = 0; t <= L; t++) curve.push([t, feel(0, t, L)]);
        const area = curve.slice(a, b + 1);
        const fill = b > a ? `<path class="area" d="${c.line(area)}L${c.X(b)} ${c.Y(0)}L${c.X(a)} ${c.Y(0)}Z"/>` : '';
        const span = (x, y0, y1, cls, name, v) => {
          const mid = Math.min(Math.max((c.Y(y0) + c.Y(y1)) / 2, c.Y(1) + 12), c.Y(0) - 12);   // 字がグラフの外に出ないように
          return `<line class="span ${cls}" x1="${x}" x2="${x}" y1="${c.Y(y0)}" y2="${c.Y(y1)}"/>
            <text class="span-label" x="${x + 7}" y="${mid - 2}">${name}</text>
            <text class="span-label span-value" x="${x + 7}" y="${mid + 11}">${v}</text>`;
        };
        const gx = c.X(L) + 10;
        c.draw(`${fill}
          <path class="straight" d="${c.line([[0, 0], [L, 1]])}"/>
          <path class="curve" d="${c.line(curve)}"/>
          <line class="now" x1="${c.X(a)}" x2="${c.X(a)}" y1="${c.Y(0)}" y2="${c.Y(1)}"/>
          <line class="now" x1="${c.X(b)}" x2="${c.X(b)}" y1="${c.Y(0)}" y2="${c.Y(1)}"/>
          ${span(gx, feel(0, a, L), feel(0, b, L), '', '体感', kit.pct(f))}
          ${span(gx + 48, a / L, b / L, 'is-real', '実際', kit.pct(r))}`);
        kit.save(state);
      }
      o('share').addEventListener('click', () => kit.share(text));
      render();
    },
  });
})();
