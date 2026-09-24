# NUMBER BENCH

T.OF... のアプリ。https://t-of.github.io/number-bench/

- ルールは本部の `~/GitHub/tof/t-of.github.io/RULES.md` に従う（全アプリ共通）。ブランドは `docs/BRAND.md`。
- 直したら本部で `npm run audit:browser -- number-bench` を通す。
- 公開は本部の `docs/RELEASE.md` の手順。大きな作業は本部で Claude を起動すると、役割を分けて進められる。
- localStorage のキーは `number-bench.` で始める。SW のキャッシュ名は `number-bench-` で始める。
- 道具 1 つ = `tools/<道具の id>.js` 1 つ。足すときは index.html に `<script>` を 1 行、sw.js の SHELL に 1 行、test.mjs にその道具の表を足す。
- 道具のファイルは `NumberBench.add({ id, name, lead, mark, color, defaults, valid, calc, mount })` の形だけを守る。calc は DOM を触らない関数だけ（test.mjs が node:vm で呼ぶ）。
- アプリの名前は app.js の `APP_NAME` / `APP_TITLE` にまとめてある。`<head>`・manifest・README の名前は別に直す。
