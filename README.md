# NUMBER BENCH — 確率も体感時間も、すぐ計算

当たる確率や人生の体感時間など、ふと気になった数をすぐ計算する道具を集めた箱。つまみを動かすと、答えとグラフがその場で変わる。

## 🔗 リンク

- 遊ぶ: https://t-of.github.io/number-bench/
- 制作: [T.OF...](https://t-of.github.io/)

## 遊び方

1. 一覧から道具を選ぶ。
2. 数字の横の − ＋ を押すか、数字をタップして打つ。答えとグラフはすぐ変わる（「計算」ボタンはない）。− ＋ は長押しで続けて動く。
3. 左上の「← 一覧」で戻る。入れた数は道具ごとに覚えておく。

| 道具 | できること |
|---|---|
| 当たる確率 | 当たる確率が ◯ % のくじを n 回引いて、k 回以上当たる確率（二項分布）。ねらう確率で当てるには何回引けばよいかも出す |
| 人生の体感時間 | 1 年の長さは（年齢 + 1）に反比例して感じる、という説（ジャネーの法則）で、何歳から何歳までが体感で人生の何 % にあたるかの目安 |

## アプリとして入れる（PWA）

- iPhone / iPad: Safari で開き、共有 → 「ホーム画面に追加」
- Android / PC の Chrome・Edge: 画面の「アプリにする」ボタン、またはアドレスバーのインストールボタン

## 開発

ビルド不要。フォルダをそのまま静的サーバで開く。

```sh
python3 -m http.server 8000   # → http://localhost:8000/
node test.mjs                 # 道具の計算のテスト
```

### 道具を足す

道具 1 つ = ファイル 1 つ（`tools/<道具の id>.js`）。

1. `tools/<id>.js` に `NumberBench.add({ id, name, lead, mark, color, defaults, valid, calc, mount })` を書く。
   `calc` は DOM を触らない計算の関数だけ。`mount(el, kit, state)` で画面を作り、値が変わったら `kit.save(state)`。
2. `index.html` の道具の `<script>` の並びに 1 行足す（並び順 = 一覧の順）。
3. `sw.js` の `SHELL` に 1 行足す。
4. `test.mjs` にその道具の確かめ用の値を足す。

`kit`（app.js）にある部品: 数の行 `row`、対数目盛りのスライダー `slider`、SVG グラフの下地 `chart`、音 `sound`、保存 `load` / `save`（キーは `number-bench.<道具の id>`）、共有 `share`、数の書き方 `pct` / `num`。
