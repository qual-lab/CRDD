# Project Runtimeの世代・終了記録の縮小 — ②着手前確認

成果物種別: CHG調査・設計候補。
状態: 一体保存・共通4File構成の方針を確認済み。旧入力検証、State／Queue部分codec、短期排他と30日保持の履歴保存試行を確認済み。保存先の切替・旧記録の削除・移行は未実施。
対象: CHG-000082の記録縮小②。
基準Commit: `9f164a473f3a40fe682a65750d244b8b21ebcb15`。①の既存変更を保持した作業Treeで確認した。

## 1. 結論

旧世代を間引くだけでは縮小できない。現行の状態・Queue Readerは第1世代から最新世代までの連続性を必須とし、終了済みQueueも同じ依頼の二重受付を防ぐ。保存契約と利用側を変更せずに削除すると、読取り不能または再実行を引き起こす。

縮小候補は、現在値を固定位置へ保存し、終了済みの依頼については再受付を防ぐ最小情報と未受領結果だけを保持する方式である。判断の重複拒否や回復に必要な記録を診断ログのローテーションへ混ぜない。人間は一体保存と共通4File構成による検討継続を指示した。実装前に具体的な保存・移行契約を正本へ接続し、保護された判断の保証を無断撤去しない。

## 2. 実記録の観測

2026-10-05、日本時間。この表は保存ファイルの読取り観測であり、現在のOS資源不存在、回復成立、結果受領またはE2E成功を証明しない。本文、Prompt、候補Patch、認証情報は本記録へ複製しない。

| 保存範囲 | ファイル数 | 合計byte | 読取りで確認した意味 |
|---|---:|---:|---|
| `state/` | 205 | 459468 | 33仕事の状態世代。最新Taskはcompleted 19件、failed 4件、recovery_required 10件。 |
| `queues/` | 205 | 199286 | 33 Queueの状態世代。最新状態はcompleted 15件、integration_pending 4件、replan_required 4件、recovery_required 10件。 |
| `results/` | 20 | 23655 | integration 15件、adoption 5件。受領済みという判断は未実施。 |
| `recovery/leases/` | 86 | 49984 | acquired 43件、released 38件、recovered_after_owner_loss 5件。終端分類だけでは回収可能と判断しない。 |
| `work/` | 0 | 0 | ファイル観測0。旧Effectの不存在や全処理の終了へ読み替えない。 |
| 合計 | 516 | 732393 | 物理削除・移動・記録書換えを行っていない。 |

33 Queueの最新`ownerGeneration`はnull。対象Treeの再解析ポイント観測は0件。これはProcessの終了観測や非使用の証明ではない。

## 3. 保存・利用契約の対応

| 正本・実装 | 保持している保証 | 縮小時の予定処置 |
|---|---|---|
| [詳細設計のINV-DURABLE-RECORD-CLOSED](../../../../06_Architecture/Details/project-runtime/02_Detailed_Design.md) | exact Schema、File名と世代の結合、連続した不変世代履歴。 | 現在値保存へ変更する場合、意味を変更する不変条件として採否を明示する。Sourceだけ先に緩めない。 |
| `project-runtime-durable-foundation.ts`の`readEnvelopes`、状態Reader／Writer | 欠番・不正名・内容Hash不一致の拒否、expected generationの競合拒否。 | 読取り・書込み・再入場を一括移行する。旧形式の欠番拒否は維持する。 |
| 同FileのQueue受付・選択・更新・回復 | requestHashによる同一依頼再入場、異なる依頼のIdentity競合拒否、Queue優先順位と使用中の非割込み。 | 終了済みQueueを単に消さず、最小の再受付防止情報へ処置する。利用側の再取得を閉じる。 |
| 同FileのLease取得・解放・Owner喪失回復 | exact ownerGenerationに結合した取得／終了証拠と資源照合。 | Queue・候補採用の利用先ごとに消費終了を確認する。releasedだけで自動削除しない。 |
| `project-runtime-acceptance-decision-store.ts` | prepared／finalizedの2世代と連鎖、同じ判断の一回適用。 | 一記録の世代数は既に有限。状態履歴と同じ方法で間引かない。記録件数の終了条件を別途評価する。 |
| Decision Recovery Store／Windows Decision Store | 世代とpreviousHashの連鎖、状態Effect前後の同一判断再入場。 | 保護された決定・回復契約を保持する。通常診断へ移さない。 |
| Composition、Docker Project回復settlement、公開Project State参照 | 最新状態の取得とexact回復の再入場。 | 保存Adapterの公開Portを維持し、実Producerを用いて利用側を確認する。 |

基準実装履歴は`06d2efd4`、`23998b68`、`32e80042`の対象File変更を確認した。削除・置換前に、成立済み能力の具体的な過去Evidenceと新方式の検証を全数対応させる作業は未完了である。

## 4. 最小の変更候補

この節の状態・Queue別`current.json`案は初期案である。人間から「一連の処理を分散保存すると保存確定・回収が複雑になる」という指摘を受け、以下の第7節の一体保存案を現在の検討方針とする。どちらも未採用・未実装である。

新しい共通DB、履歴再生Framework、常設サービスは作らない。既存のRepository-local保存Adapterと既存排他を利用する。

| 種類 | 変更候補 | 保存終了条件 |
|---|---|---|
| 仕事の状態 | `state/<project-id>/current.json`の現在値。世代番号、Repository結合、内容Hashと未解決義務を保持する。 | 現在値更新で世代Snapshotを増やさない。仕事自体の退役には参照・未受領結果・未解決義務の処置が必要。 |
| Queue | `queues/<queue-id>/current.json`の現在値。既存requestHashと再入場のIdentityを保持する。 | 終了後は必要最小限の終了・再受付防止情報へ縮約する。期限だけで再受付防止を解除しない。 |
| 保存途中 | 既存Ownerの短命な保存途中領域。 | 保存・読戻しの確定と再入場を確認して回収する。再入場方式と実OS保証は実装前に確定する。 |
| 結果 | 現在の結果取得・候補Relationを維持する。 | Consumer受領と必要Evidenceの昇格後に回収する。受領の不存在を受領済みへしない。 |
| Lease終了証拠 | 新世代への再入場に必要な最小証拠。 | Queue／採用処理の確定とexact参照の終了後に回収する。未解決の取得・解放は残す。 |
| 通常の終了履歴 | 診断要約として上限付き保持。 | 制御、再受付防止、未受領結果を含めない。ログ方式は③と責務を分ける。 |

上記Pathは候補であり、作成済み・採用済みSchemaではない。現在値1Fileへの保存で、更新途中の破損を成功扱いしないこと、古いWriterの更新を拒否すること、再入場できることを実環境が提供する意味へ照合する。atomic replaceだけを耐久確定の証明にしない。

全Projectの終了記録を永久に残さないため、公開結果の保持と依頼Identityの再受付防止期間を結び付ける必要がある。現在の公開契約で再取得を無期限に保証しているか、期限後の同じIdentityを新しい仕事へ誤採用しないかを確認する。未確定のまま勝手な日数・件数を設定しない。

## 5. 代表例と検証予定

| ケース | 期待する処置・確認 |
|---|---|
| 正常更新を多数回行う | 現在値のファイル数は固定。世代は単調増加し、古いexpected generationを拒否する。 |
| 未解決回復・未受領結果がある | 現在値更新や容量制限で消えない。同じexact Identityを再入場と公開結果まで保持する。 |
| 保存途中または保存後・応答前のcrash | 旧値／新値／観測不能を区別する。成功へ丸めず、同じ依頼が二重実行されない。 |
| 終了済みQueueへ同じ依頼を再送する | 既存結果または明示した退役結果を返す。Providerを再実行しない。 |
| 同じIdentityへ別内容を送る | 内容不一致を拒否する。 |
| 旧形式が欠番・壊れたHash・別Repository結合 | 移行せず停止する。最新Fileだけを正解として救済しない。 |
| 移行後に旧Runtimeで読む | 混在・互換性の扱いを明示する。新版の現在値を旧版が不存在へ畳まない。 |
| 終端stateだがLease参照または候補が残る | 自動回収しない。参照終了を個別に処置する。 |
| 受領情報・資源観測・旧Ownerが不明 | 削除Effect 0で保持する。不明を未使用へ畳まない。 |

## 6. 着手前の経路と確認結果

変更分類は保存契約・移行に影響する非自明な変更。Project RuntimeとCoordinator保存Adapter、利用側、Runtime Dataを着手前に照合した。独立の読み取り確認者にも保存連鎖と利用側を確認へ渡した。

実装候補を固定した後はArchitecture／Qualityの独立レビュー、文書監査、不足／影響監査を行う。準拠表明やRelease判断は今回行わず、全E2Eや再署名は本確認の結果へ含めない。監査を始める前に対象候補と必須集合を固定する。

読み取り確認者`coordinator_retention_shrink_alignment`から、世代連続性、Queue二重受付防止、Lease終了証拠、Decisionの連鎖と回復受理について確認を得た。現在Snapshotと最小終了Identityへ分ける方向はOwner分離と整合するが、削除だけで②完了とはできないという結果である。これは着手前整合確認であり、完成後の独立レビューPassではない。

`npm test --prefix 40_Develop/project-runtime`はFormatter、型、Lint、単体68件、結合5件の順で成功した。これは基準状態の73試験であり、Coordinatorの実Filesystem保存、縮小後の移行、Docker、署名、Providerの実境界検証ではない。

## 24. 人間判断による刷新への変更

2026-10-05、人間は、この開発PCをまっさらにしているため、過去互換性より新形態への刷新を優先すると判断した。Coordinator／Project Runtime／Dockerの実行記録を長期の移行・互換対象にせず、マイグレーション時の整理をフロントAIが行う方針とする。

| 項目 | 更新後の処置 |
|---|---|
| Runtimeの旧形式互換 | 全世代変換、旧PathのReader／WriterとFallbackを製品完成条件から外し、新版だけへ切り替える。 |
| 旧記録のお掃除 | フロントAIが旧入口の停止、現在資源と未完了参照、必要成果物を確認し、検証済み用途別Rootを清掃する。新しいRuntime移行Frameworkは作らない。 |
| 保持する利用操作 | Queue進行、判断適用、結果保存、取消、現行未解決処置と再実行防止は新版で確認する。過去互換を外すことと既存利用操作の欠落を混同しない。 |
| 別Ownerの情報 | 認証、署名鍵、送信同意、保護された有効判断、候補本体と正式Evidenceは実行世代の清掃と分離する。 |
| 受付の刷新 | 新しい受付世代で開始し、旧Requestを新しい仕事として再受付しない。 |

この判断を受け、本ターンで追加しかけた旧判断・回復の全世代移行Readerと専用試験は撤回した。過去の§1〜23は当時の調査・試行のEvidenceとして保持し、旧形式の全面移行を現在の完成条件と読まない。局所レビューPassはその範囲だけの結果であり、②全体は未完了である。

更新後に残る作業は、新版LeaseのOwner観測・喪失後回収、終了項目の退役、受付発行、本番全利用側の切替、フロントAI向け清掃手順、回帰と②全体の独立確認である。

### 24.1. 刷新方針と局所更新の確認

新版のOwner参照取得は現在のv2記録から同じOwner・Queue結合を読み取るだけとし、Process終了や回収成功を推定しない。読取り前後の`state.json`が変わらず、通常Lease解放後に参照がなくなることを既存の結合試験へ追加した。

静的Gateと関連4契約89件が成功した。fail／cancelled／skipped／todoは0、実行時間は51.9714634秒。Windows、Node.js v24.19.0の自己所有fixtureで確認し、Provider送信、Docker操作、署名や実記録の削除は行っていない。

固定8ファイルの局所独立確認では、縮小計画§8.3に残った旧互換読取り要求を指摘された。これをフロントAIによる切替前確認・清掃へ修正し、更新した計画Hash `AAA4025941F3A83CD0E4A5AFD986BA5181D37E69A69F9DA6548E957860788C13`で再確認Passとなった。これはこの差分だけの結果であり、本番切替、Owner喪失回収、実移行・全回帰・②全体の独立確認の完了ではない。

## Checklist

- [x] 現在状態・未解決義務・未受領結果・診断を分けて調査した。
- [x] 古い世代の削除が現行Readerの連続性契約を破ることを特定した。
- [x] Queue削除による二重実行の可能性を処置対象へ含めた。
- [x] 実記録を読取り観測し、過去unknownを成功へ変更していない。
- [x] 基準の静的段階とProject Runtime 73試験を確認した。
- [x] 一体保存と共通4File構成について人間の方針確認を得た。
- [ ] OPEN: 移行Schema、実OS保証と全利用側対応を確定する。
- [ ] OPEN: 新方式の実装、局所反証、移行、旧記録回収と独立レビューは未実施。

## 7. 一連の仕事を一体保存する方針への修正

候補Patchの本体はRuntime Dataの`candidates/`が所有する。Project Runtimeへもう一つのPatch保存先を設けない。現行Candidate Storeの物理配置からの移行は別途確認するが、本体のOwnerをProject Runtimeへ移す理由にはしない。

現行`project-runtime-integration-record-adapter.ts`は統合・採用結果を`results/<kind>/<project-id>/<identity>.json`へ保存する。この結果は候補の本体ではなく、候補Identity、採用Receipt、結果の対応を保存するものであり、「大きなPatchだから別保存」という説明は誤りである。

### 7.1. 集約の第一候補

Repository内のProject Runtime現在状態を`.crdd/project-runtime/state.json`へ集約する案を第一候補とする。Project、依頼、Queue、Task、判断待ち・反映状態、結果受領、Leaseの論理状態、未解決回復と終了・重複防止情報を同じ更新単位で管理する。内部の意味上の区分は保持するが、区分ごとにFileへ分割しない。

Repository全体の単一FileとProjectごとの単一Fileを比較し、Writer、Queue選択、複数Projectの隔離、更新量と破損影響から最終単位を確定する。現在516Fileの合計は約0.7MiBであり、容量だけを理由に事前分割する根拠はない。単一Fileでも終了済み項目を永久に追加すれば増え続けるため、結果受領、退役、重複防止の終了契約は別途必要である。

### 7.2. 分離対象の実在理由

| 内容 | 一体保存の候補か | 分離が必要な理由・処置 |
|---|---|---|
| State／Queue／通常の判断反映／統合・採用結果 | はい | 現行のFile別Portを一体保存Adapterへ接続し、同じ仕事の更新・終了・回収をまとめる。結果IdentityとHashは保持する。 |
| Leaseの取得・解放・回復という論理状態 | はい | 86証跡を既定で残すのではなく、必要な現在状態を集約する。保存先横断を減らす候補とする。 |
| 未解決Decision Recovery Intent | 条件付き | 保護された判断状態を観測できない場合にも独立保存できる必要がある。「別File」が必須か、通常状態File内の独立した確定処理で満たせるかを反証する。現行配置を理由に温存しない。 |
| 判断を一回だけ使えることを保証する保護された継続記録 | 通常状態へ無条件には統合しない | 現行は検証済みOS保護Root、選択User、専用排他とCASで認可・再利用拒否を保証する。通常のRepository状態はその代替ではない。必要な保護保証を満たす最小別Ownerとして評価する。判断本文や結果すべてを別保存する理由にはしない。 |
| 実際のLockと保存途中の一時物 | いいえ | Lockは同時更新を止める実資源であり、JSONの使用中Flagだけでは代替できない。一時物は更新途中の破損を避ける短命な物で、通常履歴ではない。終了後の回収を要求する。 |
| 作業Workspace | いいえ | Source展開・比較・適用等に使う実ファイル。処理中だけ必要であり、候補本体を保全して終了後に回収する。 |
| 通常診断 | 状態に混ぜない | 読取り確認したProject Runtime保存Adapter群では、専用のJSONL診断保存は確認していない。今存在する必須外部Fileとして扱わず、③で実在する診断Ownerを確認する。必要なら制御状態とは独立にローテーションする。 |
| 正式な検証Evidence | いいえ | CHG／QualityのOwner成果物。Runtime状態へ複製しない。 |

一体保存の実装前に、各Portの更新を一つのWriter／保存確定へどう接続するか、応答前crash、同時更新、結果と状態の同時確定、保護された判断との二段階処理を確認する。単一Writerを表明するだけで多重入口を未処置にしない。新しい汎用Lock Frameworkは作らない。

### 7.3. 現在の確認範囲

これは人間の意図に合わせた調査・方針候補の修正であり、保護された記録の撤去、公開再入場契約の変更、旧記録削除の採用を意味しない。次は一体保存で各利用側の保証を満たせるかを具体化し、分離を残す場合は対象、保証と反証を示す。

## 8. 人間確認後の共通構成と終了契約

2026-10-05の対話で、一連の仕事を一体管理し、CoordinatorとProject Runtimeの情報構造を揃える方向を確認した。`staging/`、`logs/`、`project-runtime/work/`の新設案は撤回する。既存領域の手動削除を許可した記録ではない。

```text
<repository-root>/.crdd/
├ coordinator/
│  ├ state.json             AI実行の現在状態・未解決回復・未搬送結果
│  ├ state.lock             状態・履歴更新用の実排他
│  ├ state.pending.json     状態保存中だけ
│  └ history.jsonl          実行の終了要約・最小診断
├ project-runtime/
│  ├ state.json             Project・依頼・Queue・進行・判断・受領・回復
│  ├ state.lock             状態・履歴更新用の実排他
│  ├ state.pending.json     状態保存中だけ
│  └ history.jsonl          仕事全体の終了要約
├ candidates/<candidate-id>/  Candidate本体と処置情報
└ tmp/<operation-id>/work/    実作業中だけの再生成可能な中間物
```

認証Home、署名鍵、保護された判断の継続記録、正式Evidenceはこの現在状態へ混在させない。Projectは仕事・結果受領、CoordinatorはAI実行・資源回収を所有し、同じProvider資源の状態を複製しない。

### 8.1. 保存・終了・再入場

| 段階 | 必須条件 |
|---|---|
| 更新開始 | 実排他を取得する。File存在、経過時間、PIDだけで解放済みと判定しない。長時間のAI実行や判断待ちまで状態更新Lockを保持しない。 |
| pending保存 | 現在Writerだけが作成する。Owner、基準世代・次世代、内容Hashを検査し、保存・読戻しを確認する。 |
| 状態置換 | 同じDirectoryで`state.json`へ置換する。置換通知と耐久確定を同一視せず、必要なWindows保証を実装前に確認する。 |
| 異常残存 | 同じ排他下でstateとpendingのIdentity・世代・Hashを照合する。未置換、置換済み、破損・不明を区別し、上書きや一般tmp清掃をしない。 |
| 仕事終了 | 結果受領、必要な候補引渡し・判断反映、資源回収と回復の解決を確認する。実行完了だけで除去しない。 |
| 終了要約搬送 | 同じ終了Identityの未搬送要約をstateに保存し、historyへの追記・保存確認後にstateから除く。追記後・除去前の停止で重複記録を増殖させない。履歴回収が未搬送要約と衝突しないよう同じOwnerの排他下で順序付ける。 |
| 未完了 | 同じIdentityをstateへ保持し、次回起動・同じ依頼取得で未完了部分だけを再開する。完了済みProvider実行を繰り返さない。 |

履歴の保存不明は小さな未搬送義務として残し、無関係の仕事を永久停止させる条件へ広げない。重複実行防止は終了履歴と別契約である。公開再取得の保持期間と退役Identityの拒否方法は未確定であり、履歴削除後に同じ依頼が新規依頼になる経路を許可しない。

### 8.2. 履歴保持

両OwnerのhistoryはUTC時刻、対象Identity、終了分類、一次失敗、清掃結果と根拠参照を最小限で保持する。相関可能な順序値を持ち、時刻だけで実行順序を保証しない。Prompt、Provider出力全文、秘密値とPatch本体を含めず、履歴からAuthorityや仕事状態を復元しない。

人間確認により、Project Runtimeの通常履歴は直近30日を保持し、起動・更新時にそれより古い要約を除く。100件および合計Byteの削除上限は採用しない。未受領・未解決の仕事はstate側に残し、正式Evidenceをこの期限で削除しない。期限外の行も全行検証し、途中行破損、未来時刻・時計逆行、履歴再書込みと保存失敗を処置する。履歴更新の短命な置換用Fileは[詳細設計](../../../../06_Architecture/Details/project-runtime/02_Detailed_Design.md#compact-runtime-storage)に従う。通常の4File構成は、更新途中Fileが一切存在しない保証ではない。

### 8.3. Candidateの承認済み保持方針

人間は未採用候補を作成から1週間で自動破棄する方針を承認した。作成時刻と7日後の期限を保存し、閲覧・取得だけでは延長しない。明示保留だけ期限を延長し、無期限へ解釈しない。延長期間の既定値は未確定。

| 契機 | 処置 |
|---|---|
| 採用 | 適用、結果記録と必要な回復が確定し、参照を閉じた後に候補本体を回収する。 |
| 不採用 | 破棄を確定し、非使用と参照・回復を確認した後に本体を回収する。 |
| 作成から7日経過 | 次回起動または候補操作時に新規採用を止め、期限切れ処置を確定して自動回収する。常駐監視は作らない。 |
| 明示保留 | 新期限を保存する。旧期限の観測で並行する延長後の候補を削除しない。 |
| 使用中・適用中・rollback中・回復待ち・参照中 | 期限だけで削除せず、解決後の次回入口で回収する。 |
| Identity・時刻・非使用状態が不正または不明 | 削除せず理由を返す。名前や経過時間だけで処置しない。 |

削除途中の停止はCandidate Ownerから再入場し、不存在確認後だけ回収完了とする。Release入力、正式Evidence、認証情報、Projectの未受領結果はこの7日期限に含めない。Project Runtimeの履歴ローテーションからCandidateを直接削除しない。現行の保護Store配置、Token・Lock・rollback・Receiptと全利用側を照合してから有効化する。

### 8.4. 着手前の独立確認と次Gate

読み取り確認者`coordinator_retention_shrink_alignment`は、固定pendingと実排他、未搬送要約の保存・再搬送、Candidateの7日以降の安全な回収を確認した。上記条件の下で方針は成立し得るという結果であり、実装レビューPassではない。

次は既存入口とWriter母集団、Lock／OS保証、新旧Schema・移行、状態と履歴の保存順序、再入場と有限保持を具体化する。共通構造だけから旧保護保証の撤去を決めず、新しい汎用Storeや常設サービスを先に作らない。

## 9. 移行入力の局所実装

2026-10-05、旧State／Queueを全世代検証し、最新Envelopeと全世代の導出元を読み取る`readLegacyProjectRuntimeStateAndQueueInputs`を既存保存Adapterへ追加した。終了済みQueueも含め、回復義務や再受付防止情報を削らない。導出元Hashは`JSON.stringify`した読取りEnvelopeのUTF-8列に対するSHA-256であり、元Fileのbyte Hashではない。

この処理はDirectory作成、Snapshot確定、旧世代削除、Provider起動を行わない。排他を取得しないため、一貫Snapshot、旧Writer停止、移行可能または回収可能の証明として使わない。Lease、保護されたDecision、統合・採用結果の集約はまだ含まない。上位還元はN/A: 既存のSchema・世代連続性と結合検証を移行準備で再利用する内部処理であり、新しい業務契約や保存保証を確定していない。

### 9.1. 全Writerと利用側の具体化

| 対象 | 接続時に保持する処置 |
|---|---|
| State read／write | Projectごとのgeneration競合判定。Snapshot全体の改訂番号とは分ける。 |
| Queue受付・選択・更新・回復・Lease解放 | requestHash再入場、Binding隔離、使用中非割込み。Owner喪失回復による直接Writerも含める。 |
| Queue選択からの内部更新 | 同じ取得済み排他内の私的更新へ分け、二重Lock取得による自己競合を避ける。 |
| 統合・採用結果write | 同じIdentityと内容の再書込み成功、異なる内容の拒否。現在Portはwriteのみで受領APIがないため、期限だけで削除しない。 |
| Composition／Workbench | 既存同期Portを維持する。File集約だけで連続Port呼出しの一括確定を主張しない。 |
| Docker回復の直接State Reader | Ports経由だけでなく、直接Readerも新方式へ接続する。 |
| LeaseとDecision | 短時間の保存排他を、長時間Leaseや一回判断の保護に代用しない。 |

既存Kernel Lockは同期Portから取得できるが、実体はNamed Pipeであり、`state.lock`Fileの存在だけで排他を表明しない。Repository Identityへの結合、所有者喪失後の解放、Worker異常と解放失敗を具体化する。現行のmkdir／rmdir Lockを改名するだけでは、Process喪失後の再入場を閉じられない。

### 9.2. 局所確認の結果

| 確認 | 結果と限界 |
|---|---|
| Coordinator静的Gate | `npm run check --prefix 40_Develop/coordinator`成功。Formatter→型→Lint→Capability Graph／Runtime Traceability／Project Runtime設計対応を確認した。 |
| 局所試験 | 旧入力抽出3件と既存世代確認2件、計5件成功。正常な最新値・全導出元、読取り前後不変、旧世代のHash破損・欠番拒否、真正の不存在と不正親・alias・列挙後観測不能の区別を確認した。全回帰ではない。 |
| 実記録の読取り | State 33件、Queue 33件、元世代410件を検証して抽出した。`migrationCommitted=false`。実資源不存在、結果受領、Lease解放、移行成立を意味しない。 |

試験fixtureは検証済みRepository-local `.crdd/tmp/`内のRun固有Repositoryへ置き、試験終了時に自身のRootだけを回収する。局所試験commandは`node --test --test-concurrency=1 --test-name-pattern='旧State|旧世代|旧入力|PR-D-N-01|PR-D-A-01 rejects malformed' 40_Develop/coordinator/tests/integration/project-runtime-durable-foundation.contract.test.ts`。実行Node.jsはv24.19.0。

独立確認で親領域の観測不能を空入力へ畳む点と、読取り失敗へ手動Recovery表示を与える点を検出した。親領域の順次検証と列挙済み子の明示読取りへ是正し、不正・観測不能は入力確認の停止として`manualRecoveryRequired=false`で返す。既存の書込み・Lease・実Recoveryの表示は変更していない。

次は新Snapshotのcodec、Repository結合の実排他、固定pending保存と停止前後の再入場を局所実装し、その後に全Writer接続、実データ移行と旧世代回収へ進む。現在の局所成功を②完了、全回帰、E2EまたはRelease成立へ流用しない。

### 9.3. 局所実装の独立確認

2026-10-05、読み取り確認者`coordinator_retention_shrink_alignment`は上記2件の是正後、移行準備の局所実装だけをPassとした。実装・試験・本記録・現在投影の差分を確認し、追加指摘はなかった。確認者自身は試験を再実行せず、実行結果と差分の整合を確認した。

| 対象 | 確認したSHA-256 |
|---|---|
| `project-runtime-durable-foundation.ts` | `1D6E9A2BD1C109BB12AB8760AD8D03A2ACE8973D8161FCAEAA1E69BDED361A2A` |
| 同名の結合試験File | `A6C6312A285725EDFB9935F34AC8D67B039C0C446DD8CD2A0B8EDB7775A98B8F` |

一貫Snapshot、保存確定、新旧移行、Lease／Decision／結果集約、清掃、全回帰とE2Eは未成立であり、この局所Passを流用しない。

## 10. 保存本実装前のArchitecture更新

2026-10-05、Project Runtimeの上位設計と詳細設計、Coordinator、Runtime Dataの正本4文書へ共通4ファイル、終了・再入場、旧形式との移行境界、限定unknown終了、Candidate有限保持を反映した。設計の所有者は各Architecture文書であり、本記録で再定義しない。

読取り確認者`coordinator_retention_shrink_alignment`は固定改訂版の責務、移行影響、文書・参照整合を独立確認し、修正必須指摘なしでPassとした。`git diff --check`、Project Runtime設計対応Checker、Runtime Traceability Checkerも成功した。保存実装、実データ移行、旧記録回収、全回帰、署名とE2EのPassではない。

| Architecture対象 | 確認したSHA-256 |
|---|---|
| `project-runtime/01_Architecture.md` | `29C3D8CA0BCB3A7679AB846440A84AE745D0DEC83867E5CE539F59D0B441402C` |
| `project-runtime/02_Detailed_Design.md` | `1B3BDD22BBFFC1C888C0CD4B2C56A7073FFF9E2C3BF0FDA0A4EF9C3BE9F8E2C3` |
| `coordinator/01_Architecture.md` | `3DFA8F2D514ED08A1B5B0E0989EF44F1A2573B96F74F6AD04874D7BC86C202C7` |
| `runtime-data/01_Architecture.md` | `056A449289FCFDCFF62B1BCE9FA17BFD8DDABBF943D896A0730661094178CD7D` |

各Pathは`06_Architecture/Details/`配下。次は保存詳細設計のOPENを局所境界ごとに具体化し、新Snapshotの保存・排他・再入場を確認する。設計記載だけを切替成立へ読み替えない。

## 11. State／Queue部分codecの局所確認

2026-10-05、[保存詳細設計](../../../../06_Architecture/Details/project-runtime/02_Detailed_Design.md#compact-runtime-storage)の試行契約を実装した。JSON文字列からの閉じた形式検証、期待Binding、Hash、UTF-8上限、既存値制約、重複と孤立Queueの拒否を行う。State／Queueだけの部分codecであり、本番Port、保存先、実データを変更していない。

Formatter→型→Lint→既存契約Checkerの静的Gateが成功した。同じ改訂版で局所6件、その後、対象結合試験ファイル全34件が成功した。確認commandは`node --test --test-concurrency=1 40_Develop/coordinator/tests/integration/project-runtime-durable-foundation.contract.test.ts`。Node.js v24.19.0、全package回帰ではない。

読取り確認者`coordinator_retention_shrink_alignment`は実装・試験・設計の部分codecに限定してPassとした。確認者自身は試験を再実行していない。固定Hashは実装`0E92112211DA4D055692D3B211F9BB994E59BAE3360808B3E0BCBC07798187A0`、試験`26B4EE28D4B936EB27F3ECC010FFADC312A24067B24FEF308290231F8C3ACBB8`、詳細設計`294E2592D415BB5A35503E58EB743B381E6595E3B6320927FB8E41C13F0ACB9A`。

次は実効排他と固定pendingの保存・再入場を具体化する。Lease、Decision、結果受領、履歴、旧Writer停止、物理移行・回収とE2Eの未成立は維持し、部分形式を完全なstate.jsonへ保存しない。

## 12. Repository結合した短期排他の実環境確認

2026-10-05、検証済みRepository Rootのnative realpathから専用Identityを導出し、既存Named Pipe Workerを再利用するProject Runtime用の短期排他を実装した。他のCandidate／Provider／Docker排他の名前空間とWorkerは変更していない。保存File作成と本番Writerへの接続は行っていない。

最初の試験用eval入口は`--input-type`をWorkerへ継承して取得できなかったため、固定TypeScript fixture入口へ是正した。Windows実環境で独立Processの取得、同Root・配下・case差の競合拒否、別Rootの独立性、Owner強制終了後と通常解放後の再取得を確認した。非Windows分岐を実行する試験はあるが、今回のWindows実行ではその分岐は未観測である。

独立レビューで、保持確認Assertion失敗時と競合反例で誤取得した場合の試験側handle解放不足を指摘された。すべてfinallyで解放を試行する形に修正し、読取り確認者`coordinator_retention_shrink_alignment`は最終改訂を限定Passとした。確認者自身は試験を再実行していない。

最終改訂でFormatter→型→Lint→契約Checker成功、Snapshot関連3件成功、その後、対象2試験ファイル全62件成功（失敗・skip 0）。commandは`node --test --test-concurrency=1 40_Develop/coordinator/tests/integration/project-runtime-durable-foundation.contract.test.ts 40_Develop/coordinator/tests/integration/candidate-store-kernel-lock.contract.test.ts`。Node.js v24.19.0。全package回帰ではない。

| 固定対象 | SHA-256 |
|---|---|
| `src/security/candidate-store-kernel-lock.ts` | `31CF9D2026F0A094EDC538868A3629EF0510C9F760C2AF171221251301915686` |
| `src/security/project-runtime-durable-foundation.ts` | `3B6105FE56C74046E55912BF2CA4855E4EBAC43C1B16816939B95044C3B3EF12` |
| `tests/integration/project-runtime-durable-foundation.contract.test.ts` | `064F7FAE608D43EAC5FF61A58AAD1B8F1B3BE5F08C5EDAA1F8B53392FC662BC7` |
| `tests/fixtures/project-runtime-snapshot-lock-owner.ts` | `B9BD9E08716E35D42C1A6FF2AE213F51B8B3C9D86B7EF32A5C4961CA770D17BA` |
| Project Runtime詳細設計 | `A72C9B28D62F308DBE9E80F56DE6F73CDB33728E8A2C051F5509AD57F8078DF4` |

実装・試験Pathは`40_Develop/coordinator/`配下。次は固定pendingの保存・再入場。排他取得だけを、保存確定、旧Writer停止、受領、移行・回収、署名またはE2E成立へ読み替えない。

## 13. 30日保持と履歴保存の局所確認

2026-10-05、人間の採用判断に従い、Project Runtimeの通常履歴を直近30日だけ保持する設計へ更新した。件数・合計Byteによる削除上限は採用していない。[詳細設計](../../../../06_Architecture/Details/project-runtime/02_Detailed_Design.md#compact-runtime-storage)を正本とし、本記録は実装・検証結果を保持する。

`project-runtime-history.ts`は旧Writerへ未接続の保存試行である。全行を逐次検証してから期限外の行を除き、固定名の短命候補から再入場する。取得済み排他のcanonical Root／Hashと保存先を結合し、fsync失敗後の候補も再入場時に改めてfsyncする。状態・Queue・未受領結果、Candidate、Evidenceを削除していない。

| 確認 | 最終改訂の結果 |
|---|---|
| 静的Gate | Formatter→型→Lint→Capability Graph／Runtime Traceability／Project Runtime設計対応が成功。新Moduleをstrict対象へ追加した。 |
| 局所試験 | 対象3ファイル70件成功、fail／cancelled／skipped 0。Node.js v24.19.0、Windows実FilesystemとNamed Pipe。 |
| 履歴の反証 | 30日ちょうどの保持、101件の保持、重複・異内容の衝突、pendingの置換前後再入場、不一致保全、期限外の破損・部分行・時計逆行、Root再解決、fsync／rename失敗、hardlinkとEACCES拒否を確認した。 |
| 独立レビュー | `coordinator_retention_shrink_alignment`が固定5ファイルを読み取り確認し、局所試行に限定してPass。確認者自身は試験を実行していない。 |

実行commandは`node --test --test-concurrency=1 40_Develop/coordinator/tests/integration/project-runtime-history.contract.test.ts 40_Develop/coordinator/tests/integration/project-runtime-durable-foundation.contract.test.ts 40_Develop/coordinator/tests/integration/candidate-store-kernel-lock.contract.test.ts`。

| 固定対象 | SHA-256 |
|---|---|
| `src/security/project-runtime-history.ts` | `6FEF7F26B74412DE8337961A6642625D096E57B68F5E588929920CEBF8EFCDE6` |
| `src/security/project-runtime-durable-foundation.ts` | `83EA0DBFDFB1E4E681DD1F4DC64F60DE6D50191D169547B2342C7039D15FD905` |
| `tests/integration/project-runtime-history.contract.test.ts` | `28AEA995EAF6C4D31AC510A39B5C2EBEC4BEE2ABA53595F75C68EE8E5F6B4513` |
| `tsconfig.strict.json` | `BE41C4F3FD4FB7C3C356CFE282BA31BC9484F7C707315E5DFD55C2E9B033833A` |
| Project Runtime詳細設計 | `E9C2F052CD822CB80AA55A1B32EAD30F9352D413AD98A506D778BE9635F09215` |

電源断耐久性、現在状態からの履歴搬送、受付世代切替、全Writer接続、新旧移行・回収は未成立。②全体完了、全回帰、署名またはE2EのPassではない。次は現在状態の固定pending保存と受付世代の接続を進める。

## 14. 本番接続前の入口・結果記録の照合

2026-10-05、現在の公開Request、Objective Application、State Port、Integration Record Port、Coordinatorの保存AdapterとComposition、MCP搬送を読み取り確認した。`coordinator_retention_shrink_alignment`の着手前照合を統合した。本節は設計候補と判断待ちを記録し、保存切替または新しい公開機能の採用を表さない。

| 対象 | 確認した現在の意味 | 最小接続候補・注意点 |
|---|---|---|
| Request／QueueのIdentity | requestIdは呼出し側指定。queueIdはRepository、Project、Milestone、requestId、Principalから決定論的に生成する。 | 新Requestの発行時に受付世代を結合し、各入口で同じ値を搬送する。enqueue時に現在世代を後付けすると、旧Requestを新Queueとして再実行できるため不可。 |
| 受付の処理順 | 新規Stateの保存がenqueueより先に行われる。 | 旧世代の新規RequestをState保存前に拒否し、enqueueの同じRoot排他下で世代を再検査する。拒否された旧RequestはStateも作らない。 |
| 旧進行中の再入場 | Queue、requestHash、Project、Principal等の結合を既存処理が利用する。 | 元のqueueIdを保持し、現在世代へ付け替えない。同ID異内容・別Principalを拒否する。 |
| integration Record | 作成候補の耐久的な公開。Portはwriteだけで、受領確認のPortではない。 | 保存成功を利用者や上位Consumerの受領へ読み替えない。 |
| adoption Receipt | Repositoryへの実適用結果。適用後の記録保存失敗はeffectIssued=true／effectStateUnknown=trueとなる。 | 保存方式を変えても適用済み事実と未確定公開を保持し、再入場で同じPatchを重複適用しない。 |
| Queue.resultReference | 候補またはReceiptへの参照。 | 参照中・回復待ちの結果を履歴の保持期間だけで削除しない。 |

受付世代の採用判断は維持する。公開入口で新Request発行時の世代を固定し、旧進行中の再入場と終了済み旧Requestの拒否を分ける必要がある。履歴を再受付防止の正本へ戻さない。

2026-10-05、人間は既存の運用を整理したstate.jsonで再現する方針を承認した。新しい結果取得・受領確認・既読管理は追加しない。integration／adoptionの意味、参照と回復、適用済み記録の保全を維持し、保存成功を利用者の受領へ読み替えない。[詳細設計](../../../../06_Architecture/Details/project-runtime/02_Detailed_Design.md#compact-runtime-storage)へ反映する。今回の承認を物理移行成功、旧記録削除済みまたは②完了とは扱わない。

次の接続前に、少なくとも旧Request再送、世代切替との競合、旧進行中のexact再入場、拒否前のState作成なし、採用後の公開失敗と重複適用防止、旧Writer再入場、pending残存とRoot不一致を反証する。固定pendingは変更前・候補の改訂番号とHash、Root結合を持ち、履歴保存と同じ短期排他で順序付ける。保護Decisionは既存の保護境界へ残す。

## 15. 既存の候補公開・適用結果の移行入力

2026-10-05、承認済みの保存統合へ向けて、既存の結果保存Adapterへ読取り専用の全件抽出を追加した。既存Writerとwrite Portは変更せず、新しい受領・既読管理を追加していない。前節以前の「未受領結果」は当時の検討語であり、現在の完成条件には採用しない。現在の意味は[詳細設計](../../../../06_Architecture/Details/project-runtime/02_Detailed_Design.md#compact-runtime-storage)の結果保存・採用後処理である。

| 確認 | 結果・限界 |
|---|---|
| 静的Gate | Formatter→型→Lint→Capability Graph／Runtime Traceability／Project Runtime設計対応が成功した。 |
| 関連回帰 | 結果保存Adapter、履歴、耐久保存基盤、Kernel Lockの4契約78件成功。fail／cancelled／skipped 0、32.98秒。Node.js v24.19.0、Windows。全Package回帰ではない。 |
| 追加反証 | 複数kind・Project、全値と元Byte列Hashの保持、未知key、kind／Project／Identity／Hash差、pending残存、hardlink、EACCES、列挙後ENOENT、親alias、上限超過、親存在確認後の消失、空返却前祖先再確認失敗、不正UTF-8を確認した。 |
| 実記録 | 読取り抽出が成功。20件（integration 15、adoption 5）、導出元20件、migrationCommitted=false。本文を出力せず件数のみ確認した。 |
| 独立レビュー | 確認者coordinator_retention_shrink_alignmentが固定4文書・実装を限定Passとした。確認者自身は試験を再実行していない。 |

独立確認で、親のlstat後の消失を不存在へ畳む点、不正UTF-8の置換復号、詳細設計の旧受領OPEN残存を検出した。一括是正後の静的Gate・78試験・再レビューを上記の根拠とする。先行77件は是正前の結果であり、現在の固定候補の根拠へ流用しない。

| 固定対象 | SHA-256 |
|---|---|
| src/security/project-runtime-integration-record-adapter.ts | 34169F3168811A6A1C4EFF04F31F23F4583C9D6178539F98A282527EB397E6F8 |
| tests/integration/project-runtime-integration-record-adapter.contract.test.ts | E3AD11937AD222515F2B07585A1082AA5AE10C845848AF900910C9CE4C98B480 |
| project-runtime/01_Architecture.md | 0DB54825EFA01CC5D1A42AF8C8024AA6C079E32E0F9D626C55BDDC8FDA389D54 |
| project-runtime/02_Detailed_Design.md | 77130D079D9A72DB641524BF80CE1BA26B1D77992C47BB3329EB8D5716C9041A |

実装・試験Pathは40_Develop/coordinator配下、設計Pathは06_Architecture/Details配下。実行commandは`node --test --test-concurrency=1 40_Develop/coordinator/tests/integration/project-runtime-integration-record-adapter.contract.test.ts 40_Develop/coordinator/tests/integration/project-runtime-history.contract.test.ts 40_Develop/coordinator/tests/integration/project-runtime-durable-foundation.contract.test.ts 40_Develop/coordinator/tests/integration/candidate-store-kernel-lock.contract.test.ts`。

実結果の抽出は各Fileの読取り時点の確認であり、一時点の整合Snapshotではない。旧Writer排他、Lease marker・証拠とDecision参照の全処置、本番Port接続、受付世代、固定pendingによる状態確定、実移行・旧記録回収は残る。②全体完了、全E2E成功またはRelease可能とは表示しない。切替時は旧入力を排他下で再検証する。

## 16. 旧Lease証拠と途中残存の読取り

2026-10-05、既存の取得・解放処理を変更せず、Lease証拠と取得途中の残存を非破壊で収集する入口を追加した。保存統合と長期排他の置換を分離し、短期保存排他を外部待機に保持しない順序を[詳細設計](../../../../06_Architecture/Details/project-runtime/02_Detailed_Design.md#compact-runtime-storage)へ反映した。

| 確認 | 結果・限界 |
|---|---|
| 静的確認 | Formatter、source／testの型、Lint、既存3種の設計対応検査が成功した。 |
| 関連回帰 | 前節と同じ4契約81件成功。fail／cancelled／skipped 0、32.1468秒。全Package回帰ではない。 |
| 追加確認 | 本番取得・解放の二種類のLease、取得中のMarker、解放後の証拠と元bytes Hash、取得証拠欠落、未知File、領域外hardlink拒否、証拠公開前の内部hardlink対と未確定解放の保全を確認した。 |
| 実記録 | 証拠86件、途中残存0件、導出元86件の読取りが成功。migrationCommitted=false。本文は出力していない。 |
| 独立確認 | coordinator_retention_shrink_alignmentが下表の固定3件を読取りレビューし、旧Lease入力の非破壊抽出に限定してPassとした。修正必須指摘なし。確認者による試験再実行はない。 |

| 固定対象 | SHA-256 |
|---|---|
| src/security/project-runtime-durable-foundation.ts | F3D915F113C63988F698D148AF3530A8D5942791355F0326C60DD50F025E601A |
| tests/integration/project-runtime-durable-foundation.contract.test.ts | A1BB6792A28010CA8867554908C511DC27B4A70ABA0D5CFDE017F1EF724AC59D |
| project-runtime/02_Detailed_Design.md | E79CE182B1CF522CFB051896571BCFCA127452075ED8E4558F436D9B4744B5EF |

保存済みLease証拠の相関確認と、途中残存の収集は異なる。途中残存は後続のState／Queue照合までRepository・Project結合未確定であり、新版の有効Leaseとして採用しない。短期更新用の空Lock Directoryも長期Leaseと同一視しない。不正・部分入力は保全して停止する。今回の読取りは現在Ownerの稼働、実資源不存在、旧Writer停止または一貫Snapshotを証明しない。本番保存への接続と旧領域回収は未実施で、②の完了ではない。

## 17. 統合保存入口と中断再入場の局所確認

2026-10-05、全区画を持つSnapshotの保存入口と固定`state.pending.json`からの再入場を追加した。本番Portと旧Writerは切り替えていない。

独立レビューの初回判定は限定Failで、再入場が通常保存の保全検査を迂回する点、保存先再検証前の領域作成、同じLease Owner世代の証拠と途中記録の矛盾を検出した。統合是正方針を確認者へ戻して整合確認を得た後、3件を是正した。再レビューでRoot反例が取得前に発火し得る試験上の不足を検出し、取得後resolver経路に限定する試験へ是正した。確認者coordinator_retention_shrink_alignmentは下表の固定5件を局所保存に限定してPassとした。確認者自身による試験再実行はない。

| 確認 | 現在の結果 |
|---|---|
| 静的Gate | 整形、source／testの型、Lint、既存3種の設計対応検査が成功した。 |
| 関連試験 | 前節と同じ4契約84件成功。fail／cancelled／skipped／todo 0、36.7085166秒。Windows、Node.js v24.19.0。全Package回帰とE2Eではない。 |
| 保存反例 | 受付結合変更、未解決結果・Lease途中記録の除去、世代飛越、Owner Process矛盾を通常保存と正しいbaseHashのpending再入場で拒否し、元bytesを保全した。 |
| 保存範囲 | 取得入口内を除外し、取得後resolver経路のRoot変更を発火フラグ付きで確認した。別Rootに`.crdd`を作成せず、元Rootにもstate／pending／markerを作成しない停止を確認した。回数だけで差替える先行試験を取得後反例の根拠へ流用しない。 |
| 試験準備の是正 | 最初の追加Root試験は不存在のfixture領域を削除しようとして停止した。不要な削除を除いた最終84件を現在の根拠とし、先行83件成功・1件失敗を最終結果へ流用しない。 |

| 固定対象 | SHA-256 |
|---|---|
| src/security/project-runtime-durable-foundation.ts | D45E5CF96750D0CE76CA1BAD8E6FE1C54F36A41536B4DAE7C63F607B25729330 |
| src/security/project-runtime-integration-record-adapter.ts | 78AF9E3195CD2736794EC39C9E8510B0FB08406E760D2B58AC40BA2EDA566C10 |
| src/security/project-runtime-history.ts | 90B207BFAB1257992F9087E8FFE56587594FCFAC05CF73C4B80D6AFE690DA64D |
| tests/integration/project-runtime-durable-foundation.contract.test.ts | 6BED112276F327517041EE0B583F92D04C1F6ED41D4130014CD3F58CC6FFF01A |
| project-runtime/02_Detailed_Design.md | 80966F09BF79902DE97F9A33CED8A48781E1D4C32C6CC25EAC9EC0C1C231E89C |

実装・試験Pathと再実行commandは第15節と同じ。固定対象は試験終了まで変更していない。出力はこの実行の端末結果で確認し、生成Runtime記録をGitへ追加していない。再実行可能な契約試験と対象Hashを保持する。

未解決区画の除去は初段で禁止している。履歴搬送と終了処置、本番保存Port、Request発行時の受付世代、旧Writer停止、保護Decision参照、物理移行・旧領域回収は未完了。今回の局所結果を②全体、全E2EまたはRelease成立へ拡張しない。

## 18. 統合保存の内部読取り

2026-10-05、統合Snapshotの内部読取りを追加した。正常値・真正不存在・未確定保存を分け、読取り入口から領域作成、保存確定、pending回収または旧形式への自動Fallbackを行わない。これは内部保存Portの基礎であり、利用者向けの受領・既読機能ではない。

| 確認 | 結果・限界 |
|---|---|
| 静的Gate | 整形、source／testの型、Lint、既存3種の設計対応検査が成功した。 |
| 関連試験 | 第15節と同じ4契約85件成功。fail／cancelled／skipped／todo 0、41.0142344秒。Windows、Node.js v24.19.0。 |
| 読取り反例 | 真正不存在と保存領域非作成、正常値、binding差、pending存在と元bytes保全、hardlink、破損、親の観測不能、親lstat後の消失を確認した。 |
| 独立レビュー | coordinator_retention_shrink_alignmentが下表の固定3件を内部読取りに限定してPassとした。確認者自身は試験を再実行していない。 |

| 固定対象 | SHA-256 |
|---|---|
| src/security/project-runtime-durable-foundation.ts | DB687E355AC3265A5C7076E6C6109DA4601DEF15542DD8731B939C269E33F653 |
| tests/integration/project-runtime-durable-foundation.contract.test.ts | C4BEA41B847F156F5014579D9B01D6C04212615755365320CC0EB521D3A75698 |
| project-runtime/02_Detailed_Design.md | 2EE4C210FA4323F3CA31DC3EA796DDBCE02F101929F97EE5177A022917D208C0 |

Pathの起点、実行commandおよび結果の保持方法は第17節と同じ。固定対象は試験・レビュー中に変更していない。本番Port切替、旧Writer停止、履歴搬送、受付世代、実移行・削除は依然未実施であり、②全体、全Package回帰、全E2EまたはRelease成立とは扱わない。

## 19. 本番接続前の保存関係の再照合

2026-10-05、旧入力の既存検証付きReaderを使用し、本文を出力せず関係の件数を再照合した。読取りだけで、移行・削除・Provider依頼は行っていない。

| 観測対象 | 件数・現在の意味 |
|---|---|
| 最新State／Queue | 33／33件。各区画のRepository bindingは1種類。 |
| 結果記録 | 20件。 |
| Lease証拠／途中残存 | 86／0件。Lease証拠のbindingは1種類。 |
| 現存Queueに結び付かない証拠 | 10件、5組。全組が同じOwnerのacquired＋releasedであり、Projectは現存する。 |

Queue照合キーはRepository bindingとqueueId、Project照合キーはRepository bindingとprojectId、証拠の組はbinding・Project・Queue・kind・Owner世代である。証拠の検証には`readLegacyProjectRuntimeLeaseInputs`、最新値には`readLegacyProjectRuntimeStateAndQueueInputs`、結果件数には`readLegacyProjectRuntimeResultInputs`を使用した。異なる時点の読取りなので、一時点の整合Snapshotや旧Writer停止は証明しない。

この5組を現行Queueへ仮結合したり、releasedだけでTask成功・実資源不存在と判断したりしない。切替時の排他下で再照合し、現在の参照・未解決義務がないことを確認してから、現在状態ではなく過去記録として処置できるか確認する。現時点の処置は保全であり、削除許可ではない。

本番接続は、同じ排他Owner内の読取り・更新、State／Queue全操作、Leaseの証拠Writerと全Reader、結果Writerを一組のfixture接続で揃える。既存Factoryの一部だけを自動切替しない。受付世代・終了要約搬送を接続し、全旧入力と利用側を照合してから実移行Gateへ進む。

## 20. 同じ排他Owner内の読書きへの責務分離

2026-10-05、公開の読取り・保存入口が短期排他の取得と解放確認を所有し、内部処置へ同じ取得済みOwnerを渡す構造へ分離した。内部処置は再取得・解放せず、Filesystem・復号・検証例外を停止結果へ戻す。本番Factoryと旧Writerは変更していない。

| 確認 | 結果・限界 |
|---|---|
| 静的Gate | 整形、source／testの型、Lint、既存3種の設計対応検査が成功した。 |
| 関連試験 | 第15節と同じ4契約85件成功。fail／cancelled／skipped／todo 0、37.7772159秒。全Package回帰・E2Eではない。 |
| 独立レビュー | coordinator_retention_shrink_alignmentが下表のHash一致を確認し、読書き処置の責務分離に限定してPassとした。修正必須指摘なし。確認者自身による試験再実行はない。 |

| 固定対象 | SHA-256 |
|---|---|
| src/security/project-runtime-durable-foundation.ts | 4B2AEE7DFC3066D4E740A1ED3847CC42AF6EAB96C0A89D20718F6F02AF95E84F |
| tests/integration/project-runtime-durable-foundation.contract.test.ts | C4BEA41B847F156F5014579D9B01D6C04212615755365320CC0EB521D3A75698 |
| project-runtime/02_Detailed_Design.md | B1F70588085D1F25818861A195A48DFEB73BDF1777BCDE703189D6F2468C754E |

操作固有の更新処置を挟む場合も、その例外から外側のOwner解放へ戻す。今回の限定Passを本番Port全体、物理移行、旧記録回収または②完成のPassとして流用しない。

## 21. 統合保存上のProject状態更新

2026-10-05、同じ排他Owner内でProject状態の読取り・期待世代比較・更新・保存を行う明示入口を追加した。既存の本番Factoryと旧Writerは切り替えていない。

| 確認 | 結果・限界 |
|---|---|
| 着手前整合 | 既存State世代契約と照合し、通常JSON・上限・安全な非負整数を取得前に検査すること、不在Projectの追加は期待世代0だけとすること、確定再送を独自の成功へ丸めないことを確認した。 |
| 静的Gate | 整形、source／testの型、Lint、既存3種の設計対応検査が成功した。 |
| 関連試験 | 第15節と同じ4契約85件成功。fail／cancelled／skipped／todo 0、42.8819838秒。既存試験へ反例を追加しており、件数増加を網羅性の根拠にはしない。 |
| 更新と反例 | 非空のQueue・Lease証拠・Lease途中記録・結果を保持した更新、Project追加、確定再送の競合、入力不正、初期Snapshot不存在時の保存領域非作成、pending保全停止を確認した。rename失敗時は元bytesとpendingを保持し、手動回復が必要な結果と解放後の排他再取得を確認した。 |
| 独立レビュー | coordinator_retention_shrink_alignmentが下表のHash一致を確認し、明示的なState更新接続に限定してPassとした。修正必須指摘なし。確認者自身は試験を再実行していない。 |

| 固定対象 | SHA-256 |
|---|---|
| src/security/project-runtime-durable-foundation.ts | 4FCB2689F24B7585071EAD89CD23CC583B1698BBFD3F2301F449143CF6CE6D66 |
| tests/integration/project-runtime-durable-foundation.contract.test.ts | 6869CD4A12D76B8030850D029FFCC54FADF774F98731A6AA84D0079CEEB4A1F2 |
| project-runtime/02_Detailed_Design.md | 49AFC158D295FE59403FBFB043F8EE2152EB73636B6C59FA10D7E7DD7ABA9EC2 |

次の接続対象はQueue全操作、Leaseと結果保存である。Request発行時の受付世代確認は、古い受付を拒否する前にProject状態を作成してしまう現行順序も対象にする。履歴搬送・退役・保護Decision参照・旧Writer停止・実移行と回収が残り、②全体完了ではない。Provider送信、署名、Docker操作、物理移行と旧記録削除は行っていない。

## 22. Queue・判断・結果と通常Leaseの統合接続

2026-10-05、既存Portを明示した統合保存試行へ接続した。本番Factoryと旧Writerは未切替である。

| 対象 | 実装と現在の限界 |
|---|---|
| State／Queue | 8操作を同じOwner内の比較・更新へ接続。優先順位と使用中の割込み禁止、受付世代、opaque Lease照合を維持した。 |
| 判断・結果 | 受入判断の二世代、判断回復の現在世代と全期待値CAS、integration／adoption結果の同内容再送をv2へ接続。保護Authorityは移していない。 |
| 通常Lease | 取得意図、実排他、取得証拠、解放意図、物理不存在、終了証拠を接続。Owner観測・喪失後再入場は未接続。 |
| 独立確認 | 固定6件の限定レビューで必須是正2件。意図保存失敗時の回復参照欠落と、物理取得前のRoot再確認不足を指摘された。是正と反例追加は実施したが、更新版の独立確認は未完了。 |

追加反例は最初の意図保存rename失敗、意図保存後の短期Owner解放観測未確認、物理取得前の実Root差替え、取得証拠の保存失敗、物理解放失敗である。Root差替え先に`.crdd`を作らず、未確定意図と同じ回復参照を保持する。部分成立を②完了へ読み替えない。

## 23. 未搬送終了要約の履歴への接続

2026-10-05、同じ実発行Ownerを借用する履歴保存本体と、`historyPending`からの搬送入口を追加した。着手前の独立照合では、偽造Owner拒否、同内容再送、期限内行の確認と期限超過処置の区別、一般保存・pending再入場での除去検査、固定評価時刻を接続条件とした。

| 確認 | 結果・限界 |
|---|---|
| 静的Gate | 整形、source／testの型、Lint、既存3種の設計対応検査が成功した。 |
| 関連試験 | 第15節と同じ4契約89件成功。fail／cancelled／skipped／todo 0、57.3716458秒。全Package回帰・E2Eではない。 |
| 搬送反例 | 偽造・解放済みOwner、未搬送要約の直接除去、複数要約の途中保存失敗、履歴確定後のSnapshot保存失敗、exact再入場、同ID異内容、30日ちょうどと期限超過を確認した。 |
| 保持範囲 | 履歴保存失敗では現在値を保持。現在値確定失敗では履歴と再送元を保持。Queue、Project、結果、判断、回復義務、候補本体は除去しない。 |
| 独立確認 | 着手前照合は完了。実装更新版の固定レビューは未完了。 |

実行はWindows、Node.js v24.19.0、Repository内の自己所有fixtureで行い、生成Runtime記録をGitへ追加しない。現在の接続を本番切替、実移行・回収、②全体またはRelease完了として扱わない。

## 25. 新版Owner喪失処置の局所実装と確認

2026-10-05、新版v2だけを対象に、Owner観測を短期排他の外へ出し、対象intent・Queue・Rootを再照合してから終了する処置を追加した。旧形式の救済、Provider送信、Docker変更、本番Factory切替、実記録清掃は行っていない。

| 対象 | 結果と限界 |
|---|---|
| 終了の意味 | 取得証拠へ結合した回収は`recovered_after_owner_loss`。取得未確定で現在の物理不存在を確認した場合は`acquisition_unknown_closed`とし、取得成功・Task成功を捏造しない。 |
| 再入場 | 回収意図確定後、物理解放後と終了保存中断後も同じ回復IDを維持する。固定pendingは公開回収入口から自動確定しない。 |
| 採用との分離 | 採用LeaseはOperation Queueを読取り・比較・更新しない。同名`canonical`のQueueが同Project／別Projectにある反例を確認した。結果の採否・適用事実は変更しない。 |
| 保存ガード | 通常保存と正しいbaseを持つpendingでも、回収意図の事前確定を飛ばした終了分類を拒否し、元のbytesを保持する。 |
| 初回・観測不能 | 親Directoryの真正不存在は作成せず確認する。Owner解放未確認、PID／世代差、観測例外、対象変更、非空・由来未確定実体では終了を表示しない。 |
| 静的確認 | Formatter、source／testの型、Lintと既存3種の設計対応検査が成功した。 |
| 局所試験 | 最終版の登録試験1件で16モードと追加の飛越・再入場反例を確認した。pending再入場ではcallback冒頭のカウンタと返却後の0で非実行を確認した。 |
| 関連回帰 | 前段候補は90/90成功。実装の最終是正後の4契約は89/90となり、旧結果fixtureのDirectory改名で`EPERM`が1件発生した。旧結果8試験をコード変更なしで再実行し8/8成功したが、原因確定や全回帰Passとは扱わない。 |
| 局所独立確認 | AdoptionのQueue干渉、回収意図の飛越、公開再入場の回復参照欠落、callback非実行の観測不足を是正し、固定候補の限定レビューPass。②全体の確認ではない。 |

固定対象のSHA-256は、foundation `496E093E07D0AD717F9A9C7A8A98F301920DE7CA2395BC04982A5C64E6035C4D`、試験 `2CF50332107DBDF9A53F9C5A4D575950431E776E4670BCED3AC82B3FB7B12A4A`、詳細設計 `5D0821E457F53A48A7500DE895DC1AEBA8F79D1D966D01A26CF9123ED17F3BCC`である。

物理作成後・実体Identity保存前の`physicalIdentity=null`＋実体存在は、新版自身の到達可能な中断窓として保持する。由来未確定の実体を名前だけで削除せず、後続処置が未成立の間は②全体の回復完成を主張しない。本番全利用側、受付発行、終了記録退役、実切替と清掃、全回帰・②全体の独立確認が残り、コミット・プッシュは未実施である。

## 26. 新版Persistence Factoryの全操作接続

2026-10-05、`createProjectRuntimeSnapshotPersistencePorts`へState／Queueの8操作とLeaseの4操作を接続した。構築時の保存・初期化・旧形式Fallbackはなく、下位の停止理由・exact回復参照・未完了情報を維持する。Operation回復はProject／Queue結合を確認し、Adoption回復はcanonical採用Leaseから回復参照だけを返す。

| 確認 | 結果と限界 |
|---|---|
| 着手前整合確認 | 既存Portへの配線、結果形の投影、発行時世代の固定、本番切替の分離を読み取り専用で確認した。追加仕様・Frameworkは不要と判定した。 |
| 独立レビュー是正 | 全State8操作の試験だけがv1試行と旧Leaseを使っていたため、全12操作の成立は限定Failとなった。当該試験をv2必須区画、新FactoryのState／Lease、旧受付の反例へ切り替え、期待結果と解放処理を維持した。再レビューは限定Pass。 |
| 静的Gate | Formatter、source／testの型、Lint、既存3種の設計対応検査が最終試験改訂で成功した。 |
| 局所確認 | 新版Owner喪失、統合判断Store、全State操作の登録3試験が3/3成功。17.7446582秒、fail／cancelled／skipped／todo 0。Owner喪失の16モードを16登録試験とは数えない。 |
| 関連回帰 | 最終試験改訂の4契約は90/90成功。80.3357451秒、fail／cancelled／skipped／todo 0。前回の旧結果fixture改名`EPERM`は今回再現しなかったが、原因確定とは扱わない。全Package回帰・E2Eではない。 |
| 受付経路の調査 | CLIとMCPは完成Requestを転送しており、現在のRequestには受付世代がない。WorkbenchはObjective発行者ではない。状態作成がenqueueより先にあるため、enqueueの拒否だけでは不足する。 |

実装の固定SHA-256は`77750FDFE4188D5886CD4401FD09A8C30DDE98B2B5CA80797E46B177F1FCA7A5`、試験は`79F797572C3FF3EFCD363FD10522C587120A79CE1DA0071FCCC6217C7529E898`である。Factory接続の設計レビュー対象は`E5E6CDDC161E6D13666C409A12C62A36C8A7EEEAAE55A9BDD7AE4A78B7AD8D43`。その後、受付経路の調査結果を詳細設計へ還元し、`A9CC23DCA0937B9106A2C8ADC5E2CA094BD8BFE13AA28A84652135397145F08C`で限定整合確認Passとなった。

次の本番受付接続は、認証済み状態取得から非Authorityの受付世代を返し、依頼発行側で固定してCLI／MCPへ搬送する。受信時の世代補完は行わない。最初のState作成前と保存Owner内の再照合、新規／未解決／退役済み依頼の区別を設計へ明記したが、公開Request・状態取得Schemaと保存側の実接続は未実装である。

本番保存入口の切替、終了記録退役、由来未確定実体の後続処置、実切替・清掃と②全体の独立確認は残る。旧互換処理、新規受領・既読機能、Provider送信、Docker操作、署名、実記録削除は追加していない。②全体の完了、コミット・プッシュ、E2EまたはRelease成立とは表示しない。

## 27. 受付・本番接続と終了整理の追加確認

2026-10-06、公開Queryから取得した受付世代を新Requestの発行時に固定し、CLI／MCPへ搬送する接続を追加した。受信時の世代補完は行わず、状態作成前と保存Owner内で同じ受付結合を確認する。本番Composition、独立候補採用、状態QueryとDocker側のProject結果照合を新版保存へ接続した。公開初期化は`automation project --initialize --json`で分離し、Queryから初期化しない。

| 確認 | 現在の結果・限界 |
|---|---|
| 静的Gate | Formatter、source／test型、Lint、既存3種の設計対応検査が成功した。 |
| 保存入口の局所試験 | 公開初期化の冪等性、独立採用、終了Queueと旧受付拒否、共有終了証拠の段階整理を確認した。追加是正後の最終反例は再確認中。 |
| Project Runtime package | 追加拒否保存例外の反例を含むUT69件、IT5件が成功した。Coordinator全回帰の代替ではない。 |
| 統合利用側 | 新形式でfull-flow3件、integration5件、Recovery1件が成功した。最終Source改訂後の再確認は別に行う。 |
| 独立確認 | ArchitectureとQualityの読み取り確認で、共有採用証拠の早期除去、新規参照保護、後処理失敗の結果相関、退役IDの名前衝突、既知Effect 0拒否証拠の永久残存を検出した。統合是正方針の確認後、Sourceと反例を修正している。②全体Passは未成立。 |
| 全回帰 | 前段Coordinator全回帰は失敗した。旧形式fixtureの追従不足を局所是正したが、Host境界の初期化失敗も含むため全回帰Passとは表示しない。 |
| 実切替 | Repositoryの旧Runtime記録はまだ削除・初期化していない。認証、署名、候補本体と正式Evidenceは別Ownerとして保全する。 |

追加是正は既存処理の終了・保持条件を補うものであり、一般Recovery Framework、受領・既読機能、Provider送信、Docker再起動を追加しない。履歴は30日保持、未知の過去結果は成功へ書き換えない。最終レビューと実切替が完了するまで、②完了やコミット・プッシュ済みとは表示しない。

## 28. 本番切替前の独立確認と実在庫

2026-10-06、ArchitectureとQualityの独立再レビューはSource／Contractの本番切替準備に限定してPassとなった。foundationの固定Hashは`E40BBA1BB80557FD714814130F1BC26D4C772295536DDDCD6130D564A901930A`。関連8契約130/130、MCP全試験50/50、Project Runtime UT69/69・IT5/5が成功した。物理切替、Coordinator全回帰、署名E2EのPassをこの結果から推定しない。

| 切替前確認 | 観測した事実・処置 |
|---|---|
| exact清掃対象 | `C:\project\CRDD\.crdd\project-runtime`だけ。検証済みGit Root直下で、alias／reparse pointなし。 |
| 旧記録 | 516ファイル。State205、Queue205、結果20、Lease証拠86。相対Pathと本文を結合した在庫SHA-256は`30a8a2a07cee8bbdf87ebdd6a2b25d1e93464b3747a068dac5ebc8eda8e4a272`。 |
| 旧Project | 公開E2E用33件。Milestoneはexecuting23、recovery_required10。Queueはcompleted15、integration_pending4、replan_required4、recovery_required10。過去の不明状態を回復成功へ変更しない。 |
| 現在使用 | QueueのownerGenerationは全33件null。旧記録の38 PIDに対応するNode Processは不存在。再利用PID41740はconhostであり旧Nodeではない。旧work配下は空のadoption／locks Directoryだけ。 |
| Docker | 読取り観測でContainer0。既定外Network `jarvis_default`を含めDocker資源を変更・削除・再起動しない。 |
| 保全 | 候補参照19件の本体は別Ownerの保護Storeにあり、今回触らない。認証、署名、送信同意、候補本体と正式Evidenceは清掃対象外。採用判断のapplication参照は旧33 Stateで0。 |
| 切替の根拠 | 人間が承認した新形態への刷新と旧実行記録の清掃。通常Recovery成功や旧全世代Migrationではない。初期化後は旧Attemptを復元せず、新しい受付世代を取得する。 |

全体Checkerの5件は、追加自己確認欄の固定Checklist不一致、旧アンカー、基準版のReadyを現版候補へ区別していない状態表示だった。両確認者へ是正案を提示し、独自確認とOPENを可視Sectionへ分離、リンク修正、Architecture Rootの現版Candidate表示へ是正した。判定条件を弱めず、再確認は1169 Markdown・18473リンクでerror0／warning0となった。Coordinator全回帰は継続中であり、まだ②全体完了・コミット済みとはしない。

## 29. Repositoryの実切替結果

同日の切替前確認後、exact Rootを再確認し、全対象のreparse point不存在とworkの空状態を確認して、旧`C:\project\CRDD\.crdd\project-runtime`を削除した。削除後の不存在を確認した。新しいProvider依頼、Docker停止・再起動、候補StoreまたはRepository外の変更は行っていない。

公開入口`node template/tools/crdd-coordinator.ts automation project --initialize --json`は`status=completed`、`reason=project_runtime_snapshot_initialized`で成功した。二度目も受付世代`epoch-d8e9c345-f16b-40cf-85b0-c890ae1e6aa3`を維持した。現在の領域には`state.json`と`state.lock`だけがあり、schemaRevision2のprojects／queueEntries／results／leaseIntentsはすべて空である。履歴は終了記録の搬送時に作成するため、初期化だけでは`history.jsonl`を作らない。固定pending、一時作業物と旧世代Directoryは残っていない。

実切替は人間が承認した旧試験記録の刷新であり、旧recovery_requiredを成功へ変換した結果ではない。保全した候補本体と正式Evidenceの清掃は、別Ownerの契約と後続段階に従う。受付搬送、終了整理、本番Port切替とRepositoryの初期化は接続済みだが、全回帰の終了前に②全体Passやコミット済みとはしない。

## 30. 回帰の是正と固定候補の確認境界

2026-10-06、受付世代の公開搬送、終了要約の確定後整理、本番v2 Port接続とRepositoryの切替を実施済みとした。②全体の完了条件は維持し、未署名の成立と署名依存の未成立を分ける。

| 確認 | 結果・処置 |
|---|---|
| Coordinator全Portable | 2276件中2262 Pass、6 Fail、8 skip。全体Passではない。skipは実測成功ではなく、非適用・環境条件の個別判定を別に維持する。 |
| 旧Acceptance fixture | 公開入口を本番v2 fixtureへ接続し、既存Oracleを維持。受入三判断とHash改ざん拒否の2件Pass。 |
| Host／Portableの所有 | 既存4ファイル18件と保存方式2ファイル18件を明示閉集合へ接続。未知試験追加は拒否したまま、計36件をHostで実行し36/36 Pass（89.563秒）。Portableの除外から成功を推定しない。 |
| Shell／Process所有 | 既存の署名Native Adapter2件を実Ownerとして明示登録。Shell搬送禁止を緩めず、対象反例1/1 Pass。 |
| 命名と固定Graph | 局所boolean名だけをshouldInitializeへ変更し、固定argv参照・呼出し形・本体Hashを同改訂へ再結合。要求byte、外部mode、Authority不変。namespace正常・拒否・Graph改変反例3/3 Pass、実行profile2/2 Pass。 |
| 履歴の関係・一覧 | history Source／試験をsymbol manifestとTest Catalogへ登録。Foundation Headerの005を正しいsymbolIdへ接続し、対象外cli-optionsへの誤追加を撤去した。 |
| 静的確認 | Formatter、型、Lint、Runtime capability／traceabilityの3検査はPass。 |
| 独立レビュー | Architecture／Qualityは当時のSource／Contract限定Pass。並び順・命名是正前のsymbol manifest Hashは06E6D044604F4214BB44863A8F716960257CB7D8BF5E44FE7E6E14BE923F4AD6。現候補は次節で区別し、署名全体または全回帰のPassへ拡張しない。 |
| 署名依存3件 | archiveの候補観測1件、production Operation／doctorの署名Native初期化2件は確認待ち。未コミットTreeと旧署名の差を失敗理由から除外して、成功へ読み替えない。新しい固定Commitと正しい署名候補で元の成立Oracleを再実行する。 |

署名検証用の固定候補コミットは②全体完了、Release承認または新しいProvider依頼ではない。必要な署名の秘密入力は人間が外部対話端末で行う。Sourceのモック成功、署名拒否の成功扱い、Timeout延長、Docker再起動またはRecovery機構追加で代替しない。

## 31. 命名是正後の現候補

同日、命名検査で検出した50件を対象Symbolと参照の局所改名で是正した。今回追加34件と基準版からの持越し16件を区別した。公開キー、要求byte、外部mode、Authority、判断条件と反例Oracleは変更していない。Map内の配列名の衝突はgroupRecordsへ修正した。HeaderとQA関係の検査条件も弱めていない。

| 確認 | 現候補の結果・限界 |
|---|---|
| 固定Source | Foundation SHA-256: 287B9BF519F3513DE6E4F40E84F8A42C085CE6C688E80F3808FDF6FB2D2F026E。history: 53768C8F9D454FBAA5E938809744F5CD51F002CF593193A774054C0D04428C33。 |
| 関係 | symbol manifest: ED7FEFB2D54AD4BD91E6A9B464365DD16D01E3E344DE895284D5067A67CCFA0C。Foundationは005／012、cli-optionsは012だけに接続した。 |
| 静的確認 | Formatter、Source／試験の型、Lint、既存3種の設計対応検査がPass。命名とTest Header／QA関係の個別検査も各1/1 Pass。 |
| Windows実測 | 改名後のHost全36件が36/36 Pass。66.406秒。前節の89.563秒は前候補の測定として保持する。 |
| 公開入口 | Objective受付、保存結果Adapter、本番Composition、一連の処理、受入判断の関連37件が37/37 Pass。131.118秒、fail／cancelled／skipped／todo 0。 |
| 独立レビュー | Architecture／Qualityとも現候補のSource／Contract限定Pass。全回帰・署名E2E・②全体のPassではない。 |
| Checker全試験 | 静的確認とRepository検査error0／warning0に続き、377/377 Pass。397.871秒、fail／cancelled／skipped／todo 0。 |
| 残る確認 | 配布候補の試験は候補拒否が複数例へ波及したため、旧候補の結果を成功へ読み替えず、最初の拒否理由を局所確認する。固定Commit由来の差とSource契約の差を分離して再実行する。production Operation／doctorの署名初期化も未完了。 |

受付搬送、終了整理、本番切替の実装と実初期化は完了しているが、②全体のGateは確認中である。現在の確認から新Provider依頼、Docker再起動、③への移行またはReleaseを許可しない。
