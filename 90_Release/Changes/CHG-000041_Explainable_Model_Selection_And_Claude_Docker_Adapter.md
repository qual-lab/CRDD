# 変更トレース: 説明可能なモデル選定とClaude Docker Adapter候補

- 変更ID: `CHG-000041`
- 状態: `Implementation in Progress`
- 決定権限者: Qual-Lab
- 判断日: 2026-08-24
- 対象: Coordinator Runtime 1.0の用途別モデル選定、Provider Home mount source binding、固定Docker command plan
- 対象version: v0.18.0 Candidate
- 変更分類: `breaking`（private Provider Home契約revision 4から5、Provider Home observation wire revision 1から2、Claude Execution Plan revision 7から8。Model Selection Runtime revision 1とClaude Docker Runtime Adapter revision 1を追加）
- 移行要否: `migration_required: true`（Repository内producer／consumerを同時更新し、旧wire、Provider fallbackまたは黙示的モデル選定へのaliasを設けない。発行済みproduction Selection Grant、active mountおよび実Provider Operationは0）
- 関連正本: [`19_Maintenance.md`](../../19_Maintenance.md#33-internal-typescript-runtime)、[`CHG-000038`](CHG-000038_Claude_Subscription_OAuth_Vertical_Slice.md)、[`CHG-000039`](CHG-000039_Runtime_Owned_Provider_Home_Observation.md)、[`CHG-000040`](CHG-000040_Runtime_Owned_Provider_Home_Mount_Grant.md)

## 結論

CoordinatorはProvider Effect前に、Operationの役割、作業分類、計画状態、難易度、判断影響、リスク、局所復旧可能性、未決方針および複数コンテキスト整合の要否からモデル候補と推論レベルを説明可能に選ぶ。具体化済みで低難度・低リスク・限定影響かつLocal Candidateだけを作る実装は`low`、通常のCoordinator、レビュー、診断または方針整合は役割名だけで高コスト化せず`medium`、`high`は高難度、重大影響、高リスク、または未解決方針と複数コンテキスト整合が重なる場合だけ候補にする。`xhigh`／`max`、高速モード、Provider側fallbackおよび実行中の黙示切替は自動選択しない。

Codexは`sol`、Claude Codeは`opus`を既定family候補とする。`CHG-000047`でCodexを`gpt-5.6-sol`、Claudeを固定CLIが受理する`opus` aliasへ解決するRuntime-owned Profileを接続した。Fableは人間が示した将来のClaude代替候補として保持するが、利用可能性、費用特性および適用条件を検証済みProvider Profileへ固定するまで自動選定へ入れない。選定候補はAuthorityではなく、検証済みProfileとRuntime所有Selection Grantへの入力である。

選定結果はProvider Effect前に、Provider、役割、family、推論レベル、通常速度、選定理由code、高コスト選択の有無および再選定条件をCoordinatorのOperation contextへ表示する。内部の非公開推論全文は記録せず、人間と独立Reviewerが検証できる判断要約を保持する。理由欠落、閉集合外の分類、Profile不一致またはSelection Grant未接続では実行しない。

同時に、Provider Home Mount Grantのmount authorizationをactive mount leaseへ遷移させ、Windows Known Folder由来の専用Home sourceをraw Path非公開のHashでnative observerへ結合する。Claude Docker Adapter候補は同じRuntime-owned Operation世代のmanagement／mount Capability、active mount lease、説明可能なモデル選定候補、固定Claude image、固定Proxy image、最小環境およびOperation専用Network topologyから、30秒・一回限りのopaque prepared planを作る。現在はprocess controller、Selection Grant、Provider Authority、実Docker Effectおよび実Requestを発行しない。

## 着手前整合と代表例

- 変更経路: Security／Authority／Runtime共有契約とprivate wireを変更する非自明な実装変更。Provider Home、Mount Grant、Claude Execution Plan、Docker、Provider lifecycle、QAおよび後続Codex adapter利用側を再開する。
- 着手前整合結果: `着手可`。Provider任せのfallbackとCoordinatorの実行前選定を分離し、モデル／推論の選定をOperation roleごとの短命Authorityへ結合する。高コスト選定は役割名ではなく強い事実根拠を必須にする。
- 発火例: 変更箇所、手順、完了条件が確定し、低難度・低リスク・限定影響のLocal Candidate実装をClaude Executorへ渡すと、`opus` family／`low`／`normal`候補と理由`complete_bounded_local_plan`を表示する。検証済みProfileとSelection Grant接続後だけexact modelを実commandへ固定できる。
- 非発火例: 「レビューだから」「思考作業だから」という役割名だけでは上位modelまたは`high`を選ばない。偽造object、余分field、Profile不一致、旧wire、caller supplied Path、`--fallback-model`または高速モードはProvider Effectを発火しない。
- 境界例: 通常のCoordinator方針整合は`medium`、高難度または重大影響のArchitecture／Security reviewは`high`候補とする。未決方針だけでは`medium`、未決方針と複数コンテキスト衝突が重なる場合は`high`候補とする。
- 判定情報不足例: 難易度、判断影響、リスク、plan state、mount source、Operation世代、Selection Profile、時計またはcleanup結果を確認できない場合は固定blockedへ閉じ、推測選定、fallbackまたは実行を行わない。

## 実装とSecurity invariant

- Model Selection Runtime候補は入力keyと値を閉集合化し、モデルfamilyと`low|medium|high`を決定論的に導出する。exact model IDは返さず、Selection Capability、Provider Effectまたは一般Runtime Authorityを発行しない。
- 選定noticeは構造化した確認事実とreason codeからRuntimeが構成し、Provider出力または自由記述の自己申告を選定根拠へ昇格させない。
- `high`と上位model選択許可は同じ高コストGateへ結合し、高難度、重大影響、高リスクまたは複合衝突のいずれかを必須にする。通常のCoordinator、Reviewerまたは壁打ちという用途だけではGateを満たさない。
- Claude commandは検証済みProfile IDとMount GrantのProfile IDを一致させ、`--model`と`--effort`を明示する。`--fallback-model`を付けず、速度は`normal`だけを候補にする。
- Provider Home requestは76 byteのwire revision 2とし、Provider、Runtime nonceおよびTypeScript／nativeが独立導出したmount source Hashだけを含む。raw Pathはwire、公開結果、Grantおよび選定noticeへ含めない。
- mount authorizationは`active_mount` aliasへ一回だけ遷移し、trusted Docker adapterだけがsource Pathを内部borrowできる。active中の通常revokeはunmount要求として拒否し、complete確認後だけrevoke可能にする。
- Docker planは`--pull=never`、固定digest、read-only root、全Capability削除、`no-new-privileges`、PID上限、UID／GID 65534、Provider HomeとOperation tmpの`rprivate` mount、親環境非継承、API key環境禁止を固定する。
- Provider containerはOperation専用internal Networkだけ、Proxy containerはinternalと専用Egress Networkだけへ接続する。Docker socket、Host Network、repository mount、shell、PATH探索、Provider直接Egressおよび別Engine fallbackを候補に含めない。
- prepared planは最大30秒・一回限りで、期限切れまたは取消時はactive mount leaseを完了する。Path、Proxy credentialおよびraw command planは公開結果へ出さない。現在のprocess controller未接続ではDocker／Filesystem／Network／process／Provider Request Effectをすべて`false`に保つ。

## 探索・比較と収束

比較した案は、model／effort完全固定、Provider側fallback、Coordinatorの自由記述選定、役割名だけの静的mapping、および閉じた事実分類からのCoordinator選定である。完全固定は用途差を扱えず、Provider fallbackはAuthority、費用および説明責任をProviderへ移し、自由記述は再現性を失う。役割名だけのmappingはレビューやCoordinatorを常に高コスト化する。閉じた事実分類、検証済みProfile、短命Selection Grant、事前noticeおよび再選定時の新Grantという分離だけが、適応性、費用抑制、監査可能性およびfail closedを同時に保持する。

Provider Home sourceは親環境を全面継承する案、caller Pathをnative wireへ渡す案、raw PathをGrantへ保存する案、およびKnown Folder由来PathをTypeScript／nativeで独立結合する案を比較した。最後の案はtrusted local OS userというv1 TCBの範囲で、Docker mountに必要なPathをtrusted adapterだけへ限定しつつ、公開Authority面からPathを除外できる。

## 現在の検証結果と残件

- 基準Node.js v24.19.0でstrict source／test typecheck、Biome lint／formatおよびCoordinator全contract test 470／470を確認した。Repository全体checkerは605 files、374 Markdown、2,128 local links、583 anchorsを確認し、Error 0／Warning 0だった。
- Rust 1.94.1 fixed toolchainで`fmt --check`、全target／featureのClippy warning拒否および全testを確認した。結果はunit 8 pass／1 ignored、Worker unit 12 pass、CLI 1 pass、native bootstrap core 6 passである。ignored 1件はCurrentUser Registryを一時変更・復元する明示Effect試験で、この非Effect変更では実行していない。
- 選定規則は具体化済み局所実装`low`、通常Coordinator方針整合`medium`、限定診断`medium`、高難度・重大影響・高リスクSecurity review`high`、不正shapeのfail closedを確認した。
- Docker Adapterは選定notice、Profile一致、固定command topology、`--fallback-model`不存在、API key環境不存在、公開Path／Proxy secret／command非開示、一回消費、取消、期限切れcleanupおよびproduction偽造Capability拒否を確認した。
- 新Model Selection sourceの直接coverageはline 92.42%、branch 86.36%、function 100%、Claude Docker Adapter sourceはline 94.77%、branch 80.90%、function 96.67%、更新後Mount Grant Runtime sourceはline 94.02%、branch 91.06%、function 93.62%である。未到達は依存例外、乱数／mount文字列不正、clock異常、内部不変条件破壊、productionの未接続Effectおよびcleanup再試行防御であり、test-only Authority破壊口をproduction moduleへ追加して100%を装わない。Process ControllerとSelection Grant接続時に該当分岐を再評価する。
- 残件は、Runtime-owned task classificationとSelection Grant発行・consume・supersede、Provider Authority起動直前結合、Proxy process、Docker process controller、timeout／cancel／tree cleanup／Recovery、実Claude structured result、Codex Reviewer、逆方向broker、全体試験、独立レビュー／監査およびPRである。

現在、人間による追加判断は必要ない。保護対象の採用、統合、Releaseまたはリスク受容は行わない。

### 2026-08-24 — 既定Trust LevelをT1〜T2へ固定

Qual-Labの人間の決定権限者は、今回および将来の既定Trust ProfileをT1相当のRuntime Authority／Context／Egress制御と、T2相当の署名済みRelease／Artifact／Provider Identityまでとし、T3相当のOS保護済みbootstrap／managed install rootおよびT4相当のTPM／hardware-backed Identityを成熟度の必須段階または既定Roadmapにしない方針を承認した。T3／T4は、具体的Threat、ComplianceまたはManaged fleet要件と、導入・更新・失効・端末交換・障害回復の責任および費用を人間が別変更で承認した場合だけ再評価する。既存pure候補の存在から実用要件、Authority、Capability、EffectまたはRuntime完成blockerを推定せず、4経路Coordinatorの完成を優先する。
