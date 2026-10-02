# Visual Preview直接境界の検証

成果物種別: 検証結果
変更ID: `CHG-000082`
検証項目: `ERB-IT-018`（QA-000006）
基準Commit: `f866df61189bbc4db97dd91ce6a747c0cc92497a`
基準Tree: `8d837f252e6a4f279c421fa19dcae7758746d662`
記録日: 2026-10-02
維持責任者: Qual-Lab

## 結論

製品Sourceを変更せず、Visual Previewの公開Libraryから実localhost HTTPへ到達する直接境界を再検証した。Formatter、型、Lintの後に三試験を実行し、3／3 Pass、Skip 0、Fail 0。未完了HTTP Connectionを保持した状態からの終了、接続拒否とFixture不存在を追加観測した。**技術・文書・品質の独立確認は限定Pass。現在投影の件数更新は別の固定差分として扱い、ここでは変更しない。**

Docker、Provider、旧Host三領域、再起動、署名、実Browserまたは外部公開は使用しない。この結果をそれらの成立、全回帰、Quality ReadyまたはRelease可能へ拡張しない。

## 経路と保持する条件

今回の変更は試験・根拠の補強である。正本は[Visual Preview詳細設計](../../../../06_Architecture/Details/visual-preview/01_Architecture.md)と[QA-000006](../../../../07_Quality/Definitions/QA-000006/quality_definition.md)の`ERB-IT-018`。localhost限定、読取り専用、Path拒否と終了後条件を維持し、実装・公開契約・Local Item・Authorityは変更しない。

着手前に親が正本、公開Export、製品Source、既存三試験とSymbol Relationを照合した。通常GET／HEAD、禁止Path／Method、Root拒否、保持Connectionの終了、timeout／未知Errorを不存在へしない条件を確認し、不足していた内容不変と終了後直接観測を試験へ追加した。技術・品質の独立レビューと根拠文書の確認を同じ固定差分で行う。準拠基準、工程契約、Release範囲を変更しないため準拠監査、全工程監査、再署名とProvider E2Eは今回の確認集合へ含めない。

## 初回実行の固定入力・環境（是正前の履歴）

以下は独立確認で検証器の再識別不足が見つかった初回実行の記録である。現行試験のHeader是正後のHashや検証器Hashを遡及適用しない。正式な再実行は後節へ分ける。

| 項目 | 記録 |
|---|---|
| 実行区間 | UTC `2026-10-02T06:55:29.2844296Z`から`2026-10-02T06:56:03.6652349Z`までの前後snapshot区間。各commandの実時間はTool結果に保持する。 |
| Node | Windows、`v24.19.0`、実行物SHA-256 `3602f2bb1a10f2cbab4c36886218a33c1ab3db87290e73b033c46c77147d0237`。前後一致。 |
| 固定入力 | 公開入口、Preview Server、Listener Observer、二試験、package／lock、tsconfig、Biome設定、QA定義、Architectureの十一fileのPath別SHA-256を前後取得し、全件一致。 |
| 変更した試験 | `visual-preview-server.contract.test.ts`、SHA-256 `6bb1ca7127970538d24f1708d34e8e73da8948c3fc8c1b252198eb973b0e9568`。基準Commitとの差分を原記録へ保持。 |
| 変更しないSource | Preview Server SHA-256 `c7ace10f4c65f440622a1cde9f2101f1f90212f5aef3146c471b037dcf27a47d`、Listener Observerを含むModule `8d016365498fdc107b5fa0cc68ab7bee2d1a7a98e1975020eaf05fc566b55abf`。 |
| 検証器 | 固定package-lock上のTypeScript `7.0.2`とBiome `2.5.6`。各binary個別Hashは未取得であり、Nodeの前後Hashとは区別する。 |
| 原記録 | Repository-local `.crdd/verification/chg-000082-visual-preview-261002/run.json`、SHA-256 `dd1ac0849e26e7c2ac72e3b609fc0330297ccb0bf3781151ec516dd5fcff442d`。前後snapshot、差分、Tool結合出力、終了Code、確認範囲と限界を保持する。 |
| 保持 | Phase 5結論固定まで保持する。原記録喪失、対象Source／試験／検証器／実行環境の変更時は再評価し、再実行なしに現在結果へ流用しない。 |

## 条件と実際の観測

| 条件 | 実行した入力／操作 | 判定と直接観測 |
|---|---|---|
| 許可された読取り | 公開Libraryで一時Portを開始し、HTML GET、CSS HEAD、HealthをHTTP Clientから要求。 | loopback URL、Status 200、期待内容／MIME、HEAD本文0、no-store、nosniff、CORS許可なし、Pathを含まないHealthをassertした。 |
| Path・Method拒否 | 生Request TargetのTraversal三種、Junction、Directory、POST。 | Pathは404、POSTは405とGET／HEAD Allow。公開拒否本文に内部Pathがないことをassertした。 |
| Root拒否 | 越境相対Root、絶対Root、Junction Rootを指定。 | 公開Libraryが既存拒否理由で失敗し、開始Handleを返さない。Network発行0の帰結は開始前同期Root検証のSource照合によるもので、全Network監視とは主張しない。 |
| 読取り専用 | 操作前に用意した二fileとJunctionを、HTTP操作後／close後に再読取り。 | file内容、Directory集合、Linkの種別と解決先が不変。当該Fixture以外のRepository全域の無書込み観測ではない。 |
| Connection回収 | 実TCP接続を確立し、未完了HTTP Headerを送ってConnectionを保持。 | close直前の未終了を確認し、製品closeの後に同Connectionのclose Eventとdestroyedを直接確認。Fixture側のdestroyを成功根拠へ使わない。 |
| Listener不存在 | 製品closeの後、同Portへ三値Observerと生HTTP Clientを接続。 | Observerは`absent`、HTTP Errorはexact `ECONNREFUSED`。timeout／不明Errorは合格にしない。closeを再度呼び、冪等終了も確認。 |
| Fixture清掃 | 終了後に検証済みRepository内の一意な`.crdd/tests/visual-preview-*`を清掃。 | 削除対象の包含と非Linkを再確認し、削除後lstatの`ENOENT`をassert。実行後列挙で同Prefixの残存集合は空。旧Host資源へ転用しない。 |

期待値は試験前の固定内容・正本条件から導出し、製品の結果から期待値を作っていない。Fixtureの作成・削除は試験OwnerのEffectであり、製品の「Repository書込み0」と混同しない。

## 初回実行結果（是正前の履歴）

cwdは`40_Develop/visual-preview`。初回原記録はTool出力と結果を保持するが、各commandとcwdの明示Fieldが不足していた。以下の表は実行時のTool呼出しとの照合であり、初回原記録のFieldとして存在すると主張しない。

| 順 | command | 結果 |
|---|---|---|
| 1 | `npm run check` | Exit 0。Formatter→型→Lint。六file確認、書換えなし。 |
| 2 | `node --test --test-concurrency=1 ./tests/integration/visual-preview-server.contract.test.ts` | Exit 0、3／3 Pass、Skip 0、Fail 0、208.9385ms。 |
| 3 | Repository Rootで`git diff --check` | Exit 0。 |

最初のFormatter確認では整形一箇所が未適用と検出され、試験を開始せず局所修正した。上表はその修正後、独立確認での是正前の実行である。整形前の結果へ現在Hashを遡及適用しない。

## 独立確認の指摘と固定版再実行

初回の技術・文書・品質三観点を全て完了後、二指摘の是正方針を確認者へ再提示し、整合を確認した。Fixture Objectの二つの独立責務へHeaderを付与し、試験の操作・Oracleは変更していない。検証器の実行物を固定し、新しい実行記録を別に保存した。

| 指摘 | 是正 | 現在状態 |
|---|---|---|
| VP-D01 | `assertUnchanged`と`cleanup`へ責務・Local Item Trace・観測・Oracle・清掃境界のHeaderを追加した。 | 独立再確認でResolved。 |
| VP-Q01 | command、絶対cwd、各開始・終了観測、ExitとTool結合出力を明示Fieldで保存。実際に解決されるNode／TypeScript／Biomeの入口・package・Native実行物を前後固定した。 | 独立再確認でResolved。 |

| 再識別項目 | 新しい実行の記録 |
|---|---|
| 前後観測区間 | UTC `2026-10-02T07:02:31.8988861Z`〜`2026-10-02T07:05:00.6214490Z`。各commandの開始・終了観測は原記録に保持する。 |
| 固定母集団 | 前記十一入力に検証器十二fileを加えた計二十三file。前後Path別Hash、Node、HEAD／Tree、Worktree状態と実行設定が全件一致。試験Fixtureの残存集合は前後とも空。 |
| 現行試験 | SHA-256 `b48848c3f1dd9d796b21b52a6ad8349bb7845ebd925f73b8311ff6fe8581c8fd`。初回Hashとは区別する。 |
| TypeScript実行物 | Windows x64、`tsc.cmd`→`typescript/bin/tsc`→`lib/tsc.js`→`lib/getExePath.js`からplatform packageを解決。実際の`tsc.exe` SHA-256 `f9ecfbdc93753d2c972d66a8d0d75f5bd737fd4a5f88b422d9091ea282bcb2c7`。入口・解決Module・packageも前後固定。 |
| Biome実行物 | `biome.cmd`→`@biomejs/biome/bin/biome`からwin32-x64 packageを解決。実際の`biome.exe` SHA-256 `47b7c8f59181870782dbeb26bfa45a51229a277ffd458f5cf852dc96dfd3999c`。入口・packageも前後固定。 |
| 実行設定 | `NODE_OPTIONS`、`NODE_PATH`、`BIOME_BINARY`は前後とも不存在。Wrapper Directory内の別Node実行物も不存在。Node実行物Hashは前記と一致。npmを経由せず、固定wrapperを直接実行した。 |
| 新原記録 | Repository-local `.crdd/verification/chg-000082-visual-preview-261002/rerun.json`、SHA-256 `838bde3d7e5183a5bf47fb3f7e93622587a0a591bcf7ec0406ffde939b0c0ca5`。UTF-8、Toolが返したUnicode結合出力であり、分離した生stdout／stderr bytesとは主張しない。初回`run.json`は変更せず保持する。 |

新しい全commandのcwdは`40_Develop/visual-preview`。静的確認三段階の成功後に試験を実行した。

| 順 | command | 結果 |
|---|---|---|
| 1 | `./node_modules/.bin/biome.cmd format .` | Exit 0、六file、書換えなし。 |
| 2 | `./node_modules/.bin/tsc.cmd -p ./tsconfig.json` | Exit 0。 |
| 3 | `./node_modules/.bin/biome.cmd lint . --error-on-warnings` | Exit 0、六file、書換えなし。 |
| 4 | `node --test --test-concurrency=1 ./tests/integration/visual-preview-server.contract.test.ts` | Exit 0、3／3 Pass、Skip 0、Fail 0、202.0554ms。 |

その後Repository Rootで`git diff --check`もExit 0。新記録の保持・無効化条件は前記と同じであり、記録の前後一致を独立確認の代替にしない。

## 未証明範囲と独立確認

実Browser、署名配布物、公開CLI、外部公開、悪意ある同時Filesystem差替え、全Repositoryの書込み監視はこの直接境界の実行対象外。終了後観測は今回所有したListener／Connection／Fixtureに限定する。既存Host残存三件とNative試験のHome／Workspace清掃は未解決のまま保持する。

作成担当と別の確認者が技術・文書・品質の三観点を全て完了し、限定Pass、新規Finding 0、VP-D01／VP-Q01はResolvedとした。固定対象は試験SHA-256 `b48848c3f1dd9d796b21b52a6ad8349bb7845ebd925f73b8311ff6fe8581c8fd`、結果書戻し前の本文`d816f734fec508fdae2aae878fa2a50b1b3d4d9c39c6170094a4558f269d6b25`、新原記録`838bde3d7e5183a5bf47fb3f7e93622587a0a591bcf7ec0406ffde939b0c0ca5`。全開始・終了Hashが一致し、初回原記録も不変であった。

確認者はHeader以外の試験操作・Oracleが初回と不変であること、二十三入力と実検証器の前後一致、実行順序・出力と終了後観測を確認した。定義されたLibrary→localhost→Browser相当Consumerの直接境界について`ERB-IT-018`の観測根拠へ算入可能と判定した。ただし、Quality Centerの件数更新は別の固定差分として確認する。確認者自身は再実行・実Root操作を行っていない。

全結果の統合後、解消状態、結論、本節とChecklistだけを整合済みの結果書戻しとして更新した。対象試験、原記録、Source、他のOPENと許可範囲は変更せず、確認対象のHashをこの追記後のHashへ置き換えない。

## Checklist

- [x] 正本条件、既存試験と不足観測を照合した。
- [x] Formatter、型、Lintを試験前に通した。
- [x] 実HTTP、保持Connection、接続拒否とFixture不存在を直接観測した。
- [x] 実装変更、Provider実行、Docker操作、旧Host清掃と署名を行っていない。
- [x] 前後の固定入力Hashと原記録を保持した。
- [x] 三観点の固定版独立確認を完了し、二指摘の解消とLocal Itemの直接境界への適用可否を記録した。
- [ ] OPEN: Quality Centerへの件数反映は別の固定差分で確認する。現在の正式投影件数は変更していない。
