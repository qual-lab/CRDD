# Phase 5 Workbench純粋CSR移行検証

検証日時: 2026-09-28 17:45 JST
対象変更: `CHG-000082`
対象範囲: Workbench全画面、JSON Read Model、固定Document Shell、Vite Browser Build、既存HTTP操作境界

## 結論

Workbenchの表示OwnerをClient-side Reactへ一本化した。Node Serverは固定Document Shell、固定Asset、JSON Read Model、認証・AuthorityおよびRepository Effectを所有し、画面DOMを生成しない。JSONはCredential verifier、Remote接続Bearer、Private Key、Host Pathおよび永続Authorityを含まず、Process限定Action TokenとCredential操作直後の一回表示Tokenだけを用途限定Fieldで扱う。

旧構造にあったReact Server Rendering、Hydration、Server生成HTML FragmentおよびBrowserによる既存DOM再読取りは削除した。15 Logical Screen、既存Form、Action Token、同一Origin、CSPおよびServer Effectは維持した。

## 構造

```text
Node Workbench Server
├ 固定Document Shell
├ 固定Vite Asset
├ 安全なJSON Read Model
├ 認証／Authority
└ Action POST／Repository Effect
              │
              ▼
Browser
└ Client-side React
   └ 全画面DOMの唯一のOwner
```

## 確認結果

| 確認対象 | 結果 | 観測 |
|---|---|---|
| Formatter | PASS | Biome 19 files、修正後に差分なし |
| 型検査 | PASS | `tsc -p ./tsconfig.json` |
| Lint | PASS | Biome 19 files、警告・Error 0 |
| Vite Build | PASS | 19 Moduleを変換し、`workbench-client.js`を生成 |
| Workbench統合試験 | PASS | 19件中19件成功。Document Shell、Runtime JSON検証、POST後の一回表示結果、Remote CROS、Credential、Topic／Meeting、Git、AIおよびRuntimeを直接観測 |
| SSR／Hydration不在 | PASS | Production Sourceに`renderToString`、`hydrateRoot`、`dangerouslySetInnerHTML`および`innerHTML`なし |
| 実Browser Visual | PASS | 15 Logical Screen、Desktop／Tablet／Mobile、100%／200%／400%の27条件をProduction DOMで再観測 |
| Browser資源清掃 | PASS | cold相当と連続実行の2回で、各27条件のBrowser Process、Profile、Listenerおよび試験Fixtureの終了後不存在を確認 |
| Browser終了後観測の再現性 | PASS | 終了要求直前に所有Treeを再取得し、正常終了後5秒の猶予、OS固有のexactな世代Identity再照合による深度順限定Fallback、最終30秒の不存在確認を順に適用する。Lifecycle局所IT 7件では親終了後に残る子ProcessへのFallback実発行と最終0件、世代Identity不一致／未検証時のEffect 0、孫→子→親の処置順、およびcleanup前段失敗後の後続段実行とError集約を確認した。最終再実行した実Browser 27条件では終了処理最大1589ms・Tree観測最大668ms、Fallback 0回で全件成功した |
| 実Browser操作 | 参考観測 | Topic NavigationのHashと選択表示、Meetingの状態・並び順およびGET絞込み後の選択保持をProduction DOMで手動確認した。再実行可能な自動Gateではないため、正式PASS根拠には使用しない |

## 検出して是正した事項

最初の実Browser再確認では、CSR完了を示すDOM標識`workbench-client-ready`がMain Screenへ接続されていなかった。React Shellへ明示的に接続し、同じ27条件を再実行して全件成功を確認した。

試験側に残っていたServer描画HTML文字列の検索は、JSON Read Modelおよび操作結果の直接検証へ変更した。Visual文言、画面TargetおよびDOM成立は実Browser System試験が所有する。

初回の独立レビューと監査では、POST後のShell GETが一回表示結果を先に消費する問題、Meetingの状態・並び順契約差、Hash Navigationの選択表示、受信JSONのRuntime検証、React Consumer試験、Source／Test Header、Symbol Manifestおよび現行投影の不足を検出した。結果消費を`/api/workbench-view`へ限定し、正規語彙、Hash追従、Runtime Inspector、Consumer契約、Traceabilityおよび投影を同じ固定候補で是正した。

再レビューでは、Runtime Inspectorが外枠を検査していても、計画項目、品質理由、Topic／Meeting判別、Git差分およびRuntime Eventの入れ子値にObjectが混入するとReact childまで到達できる不足を検出した。各表示値のPrimitive、配列要素、閉じた状態語彙および判別Unionを入れ子まで検査し、正常なProduction Modelに各破損を注入して描画前拒否を確認する反証試験を追加した。

次の再レビューでは、個別Fieldが妥当でもRecordの外側Identityと本文Identity、Project Contextの五場面集合・順序、Federated Project状態とSource状態、観測状態と理由・Projectionが矛盾できる相関不足を検出した。Producerの正規契約と同じ相関をInspectorへ反映し、Identity不一致、場面欠落・重複・順序違い、Federation状態矛盾および理由誤型を拒否する反証試験を追加した。この確認により、既存Portfolio試験Fixture自身が`complete` Projectへ`missing` Sourceを含めていたことも検出し、正規の`partial`へ是正した。

Visual再実行では、専用Chrome Process不存在観測が固定10秒内に確定しない事象を二回の検証Roundで各一回観測した。期限を30秒へ延長しただけの試行でも、親Browserは約0.16秒で正常終了した一方、所有子Process Identityが30秒後まで残り失敗した。このため、単なる待機時間不足ではなく、Windowsで親Process終了が子Process Tree回収を保証しないことを原因と判定した。

Visual Runnerは、終了要求直前に所有Treeを再取得し、正常終了後5秒の猶予内にTree不存在を確認する。残存時はWindowsのCreationDateまたはLinuxのprocfs開始tickを含む同一の世代Identityだけを子孫から限定終了要求し、最終30秒以内の不存在を確認する。安全な世代Identityを取得できない環境ではSignal Effect 0で失敗し、PID一致だけで別Processへ波及させない。Process観測または終了要求が失敗しても、DevTools不存在確認とProfile削除まで独立して試行し、Errorを集約する。

React表示は、必須画面Targetがcommitされるまで最大10秒待ち、その後に画像集合を取得して`load`／`error`確定を最大5秒待つ。これによりServer ShellやReact描画途中を完成画面へ読み替えず、後から追加された画像も見落とさない。Lifecycle局所IT 7件は全件成功し、親終了後に残る子ProcessへのFallback実発行、最終Tree 0、世代Identity不一致／未検証時のEffect 0、親子Graph深度順およびcleanup前段失敗後の後続段実行・Error集約を確認した。Visual Preview全体は10件すべて成功した。さらにProduction Workbenchの27条件を最終再実行し、全件成功、終了処理最大1589ms、Tree観測最大668ms、子ProcessFallback 0回を確認した。期限超過、Identity観測不能、終了要求失敗または最終残存は失敗とする。

Topic Navigation、Meetingの状態・並び順およびGET絞込み後の選択保持は、Production Serverを用いた手動の実Browser探索でも確認した。ただし、この観測は自動再実行できるEvidenceではない。状態語彙、Query保持、POST結果およびJSON Read ModelはWorkbench統合試験が正式に検証し、実Browser System試験は画面到達、表示、Responsive、Zoom、Focus、Overflowおよび終了後資源を正式に検証する。

## 保持した境界

- Project Context、Topic、Meeting、Git、Credential、AIおよびRuntimeの正本とAuthorityはClientへ移していない。
- Credential verifier、接続Token、Host PathおよびApplication関数をJSON Read Modelへ含めない。
- 上記の「接続Token」はRemote CROS接続Bearerを指す。管理者がCredentialを発行・更新した直後の生Tokenは、`no-store`応答の最初のJSON結果に限り一回表示し、Registryへ保持しない。
- POST Route、Action Token、CSP、同一Originおよび固定Asset allowlistを維持した。
- Next.js、Server Action、Electron、SSRおよびDesktop包装は追加していない。
- Vite生成物は派生物としてGit管理しない。

`260928-1535_phase5-react-vite-shell-migration.md`はSSR／Hydrationを使用していた移行途中の履歴Evidenceである。現行の表示Architectureは本Evidenceの純粋CSR構造が置き換え、旧Evidenceを現在状態として使用しない。

## 残る処置

- 本変更範囲の独立レビュー、文書監査およびGap／Impact監査は、固定差分Git Object ID `00c29f79f46aa3d09c75fb4e374947e377a808c3`に対してFinding 0で完了した。
- 実Provider E2EとAI関連2画面のProduction Closureは、Phase 5全体の既存残件として維持する。
- 本移行後の固定候補を作る場合は、旧署名候補を再利用せず新しい配布Treeで署名する。

## Checklist

- [x] Client-side Reactだけが画面DOMを所有する。
- [x] Node Serverの認証・Authority・Effect責務を維持した。
- [x] 固定Document ShellとJSON Read Modelを分離した。
- [x] SSR、Hydration、Raw HTML FragmentおよびDOM再読取りを削除した。
- [x] 既存15画面と操作契約を回帰確認した。
- [x] 実Browserで全表示ProfileとZoomを再評価した。
- [x] 初回Visual Findingを是正し、同じ検証を再実行した。
- [x] 独立レビューと必要な監査を完了した。
