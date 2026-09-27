# Workbench実Browser Zoom検証

状態: PASS

## 1. 結論

WorkbenchのHero 2案とSecondary 3画面を、専用Chrome Profileの実Browser Zoom 100%／200%／400%で全数確認した。15条件すべてで指定倍率を観測し、横Overflow、12px未満の可視文字、32px未満の操作対象、正の`tabindex`および画像読込失敗は0件だった。Browser Process Tree、DevTools Listener、Preview ListenerおよびRepository-local一時Profileの終了後不存在も個別に確認した。

Workbench左上の代替文字MarkをCRDD公式ロゴ原本へ置換した後に、同じ15条件を再実行した。ロゴ画像の読込み、配置、拡大時のReflowおよびcleanupに新しい不適合はなかった。

狭幅Viewportの結果を実Browser Zoomへ読み替えていない。1280×960のBrowser Windowに対し、実効CSS Viewport幅は100%で1258px、200%で629px、400%で314pxへ変化した。

## 2. 対象と方法

| 項目 | 固定値 |
|---|---|
| 観測時HEAD | `8ffe6d1f66118c9b45f176ed7f745b520216d016` |
| 候補Identity | 下表の入力File SHA-256。未Commit差分をHEADだけで固定しない |
| Preview Root | `04_UI` |
| 対象 | `Details/Visual/workbench-hero/direction-a.html`、`direction-b.html`、`topic-detail.html`、`repository-worktree.html`、`project-portfolio.html` |
| Browser Window | 1280×960 |
| Browser Zoom | 100%／200%／400% |
| Browser | Google Chrome `153.0.8010.53` |
| 実行入口 | `node template/tools/crdd-visual-preview.ts verify-zoom` |
| Quality Local Item | `ERB-ST-019` |
| 再検証の契機 | CRDD公式ロゴ原本のWorkbench左上への適用 |

検証器はRepository内の許可Rootをlocalhostへ読取り専用で公開し、条件ごとに専用Chrome Profileを作成する。ChromiumのZoom Profile値を設定してHeadless Chromeを起動し、DevToolsから実効倍率、Viewport、Rendered DOMのComputed StyleおよびBounding Rectangleを観測した。通常の利用者Profile、Browser拡張、CSS `zoom`または外部Networkは使用していない。

### 入力Manifest

| 入力 | SHA-256 |
|---|---|
| 公式ロゴ | `1ca7f8bff82c7d0be39f4c202837e24550d7da4aecbd54ee2d698b73a9f8894c` |
| `direction-a.html` | `0a7339b27cfe254777e71564349b4b5c14dee7592a5a5f61987d6432e5f81755` |
| `direction-b.html` | `dbb87df6a965e132b2584ec03346d0efbcdef2220c36941377902b8271cd3f05` |
| `topic-detail.html` | `df3df9110500f5fe8d36a7d5739ab9643563f05e57e6cb32a309e4977aa11b2b` |
| `repository-worktree.html` | `cc932e6dd825f9b65bedfa42e79648dc3ae7e3e5a75127b6b26c5da5f773d0eb` |
| `project-portfolio.html` | `6d804b02d7ac2062b4cc63384b7b30625ed143397a30306cb5943316de2cfb9b` |
| `workbench-hero.css` | `40d236325430f9a9062cb07261c3b3560f9d3c168ac6044ce4fd6d584e9c86e2` |
| 配布CLI入口 `template/tools/crdd-visual-preview.ts` | `bad7d9c48caf564365403905220f2ef8d3c17aa1192db6f8be86d5a61b2f8ab8` |
| CLI引数搬送 `40_Develop/visual-preview/bin/visual-preview.ts` | `1b2852408397ffad9bcddd63f4d585e9aa31ab9d5529db8609be0c65b9807c75` |
| 公開実行境界 `40_Develop/visual-preview/src/index.ts` | `c4172e895f2034cc03eba8918956b481b6f455f2ff1b5cacb1b4f36e63bab935` |
| Preview Server | `c7ace10f4c65f440622a1cde9f2101f1f90212f5aef3146c471b037dcf27a47d` |
| Browser Zoom検証器 | `906a337b5e65b235a8e5bd3ef8ce86df8157435734b6f6385c33d9e16928cb86` |
| Browser Lifecycle直接境界IT | `ff95069dce0051712277ea57f7ebe271c11ec2b8c554849f06b7888f8490a3d5` |

このManifestは現在候補の再構成用要約であり、各正本の代替ではない。画像原本、Visual Source、CSSおよび検証器のいずれかが変わった場合は本結果を流用しない。

## 3. 結果

| Zoom | 条件数 | 観測DPR | 実効CSS幅 | 横Overflow | 12px未満 | 32px未満操作対象 | 正の`tabindex` | 画像失敗 |
|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| 100% | 5 | 1 | 1258px | 0 | 0 | 0 | 0 | 0 |
| 200% | 5 | 2 | 629px | 0 | 0 | 0 | 0 | 0 |
| 400% | 5 | 4 | 314px | 0 | 0 | 0 | 0 | 0 |

15条件すべてで`zoomObserved=true`、`horizontalOverflow=false`、`normalBrowserCloseAccepted=true`、`browserCloseMode=normal`、`forcedBrowserCloseRequired=false`、`browserProcessTreeExitConfirmed=true`、`browserDevToolsUnavailableAfterClose=true`、`profileCleanupConfirmed=true`および`passed=true`だった。最小可視文字は全条件12px、最小操作対象高は32px以上だった。公式ロゴを表示する4画面×3倍率では`imageCount=1`、`loadedImageCount=1`、`failedImageCount=0`、ロゴを持たないDirection Bでは0／0／0だった。

最終候補の再確認では、初回の15条件実行中にDirection B 200%だけが、Chrome子Processの終了を10秒以内に確認できず`browser_process_tree_remaining_or_unobserved`でFailした。検証器は観測不能をPassへ畳まず全体Failを返した。Sourceを変更せず同条件を単独再実行するとProcess Tree 0でPassし、その後の全15条件再実行も全件Passした。初回Failを消去せず、終了観測が一時的に収束しない場合は実行全体を再確認する必要がある事実として保持する。

`ERB-IT-020`の局所反例5件もPassした。応答しないが接続を受理するListenerを`present`、close後の接続拒否を`absent`、不正Portを`unknown`に分類し、100ms後の自然終了を`normal`、残存ProcessへのFallbackを`sigterm`として区別した。この局所ITは`ERB-ST-019`の実Browser 15条件を代替しない。

Sandbox内の実Chrome起動はDevTools接続を実行環境に拒否されたため、製品合否の根拠に使用していない。実環境Profileで同じ公開入口を使用し、専用Profile、実Zoom、観測値およびcleanupを確認した結果だけをPASSの根拠とした。

## 4. 終了後状態

| 確認 | 結果 |
|---|---|
| Preview Listener | close後のTCP接続拒否を確認。timeoutまたは分類不能Errorを不存在へ畳まず、`previewListenerClosed=true` |
| Browser正常終了 | 15条件すべて`normalBrowserCloseAccepted=true`、`browserCloseMode=normal`、強制終了Fallback 0件 |
| Browser Process Tree | 終了前に固定した所有PID閉包が15条件すべて0件 |
| DevTools Listener | 15条件すべて終了後TCP接続拒否。timeoutまたは分類不能Errorを不存在へ畳んでいない |
| 一時Profile | 15条件すべて不存在確認済み |
| 操作一時Root | 不存在確認済み。`temporaryRootRemoved=true` |
| Repository正本へのBrowser書込み | 0 |
| 通常Browser Profileの利用 | 0 |
| 外部Network | 0 |

## Checklist

- [x] 実Browser Zoomと狭幅Viewportを分離した。
- [x] 100%／200%／400%で実効倍率を観測した。
- [x] Hero 2案とSecondary 3画面を全数処置した。
- [x] 横Overflow、文字下限、操作対象およびFocus順を確認した。
- [x] 画像の完了、自然幅・高さおよび失敗数を確認した。
- [x] 正常終了受理、強制終了Fallback、所有Process Tree、DevTools、専用ProfileおよびPreview Listenerを別々に確認した。
- [x] 現在候補をHEADだけに畳まず、入力ManifestとBrowser版を記録した。
- [x] Host絶対Path、Profile Path、DevTools EndpointおよびDOM本文をEvidenceへ保存していない。
- [x] 公式ロゴ原本の参照後に全15条件を再検証した。
- [x] Sandbox内のBrowser起動拒否と実環境の品質結果を分けた。
