# 故障／回復／耐障害モデル

Workspace方式の失敗・取消・親喪失・Merge途中失敗・採用後保存失敗は[状態と終了条件](Details/orchestrator/03_Workspace.md#5-状態競合終了条件)へ接続する。実行資源cleanupと継続Workspace破棄は別であり、取消で既存dirty・他Task成果を削除／resetしない。Git部分成立・元失敗・同対象参照を保持し、観測不能を不存在や再実行許可にしない。以下の旧方式の成功は新方式へ継承しない。

Status: Candidate (v0.22 responsibility reorganization)
Owner: Qual-Lab
Last Updated: 2026-10-11

旧固定版の履歴: 固定8管理分担、登録解除・通常鍵3分岐の前回限定レビューは履歴として保持する。今回は承認済み初回Host設定をARCH-000013とAccess Management詳細から横断モデル・Workbench／MCP詳細へ候補伝播する。今回の固定12文書は契約・品質の限定独立再レビュー済み・全重大度の残指摘0で、前回Passを流用していない。Quality・Source・具体API／物理保存・本番接続は未完了。Architecture Ready・QA Handoff・実装／実E2E成立は主張しない。

現在の最小提示方式では、発行／記録不明の元Identity再観測と、確定後の提示・初回接続未確認からの別明示交換を保持する。初回の確認保存・読戻し・清掃／Lock終了不明は完了と通常Authorityを阻止し、具体処置は詳細設計へ戻す。今回故障境界差分は限定再レビュー済み（最小鍵提示方式の伝播差分、全重大度0）。

## 1. この成果物が所有すること

故障を一つの`failed`へ畳まず、故障領域、影響、Authority、残存Resource、回復入口および終了後条件を横断して示す。各理由値と実装方式は個別ARCH定義と後段実装が所有する。

## 2. 故障と回復の全体図

```text
要求
 │
 ├─ 入力／Binding不正 ───────────────> Effect 0で拒否
 │
 ├─ 判断不足 ───────────────────────> 同じTaskで判断待ち
 │                                      │
 │                                      └─ 入力返却／取消
 │
 ├─ 外部境界の開始前失敗 ───────────> Authority非発行・Effect 0
 │
 ├─ Effect発行後の結果不明 ─────────> exact Recovery義務を保存
 │                                      │
 │                                      └─ 再観測 → 再入場 → settlement
 │
 ├─ 部分結果／欠測 ─────────────────> partial／unknownのまま投影
 │
 ├─ 外部結果の相関不能 ─────────────> 候補隔離・採用不可
 │
 └─ cleanup未確認 ──────────────────> 完了表示せず回復待ち
```

## 3. Failure Matrix

| 故障領域 | 対象Component | 守る対象 | 即時処置 | 回復／終了条件 |
|---|---|---|---|---|
| 入力・構成 | Transport、Capability Resolver | 意味契約、選択理由 | Provider Effect前に拒否 | 修正済み入力で新規受付 |
| Repository境界 | Binding Resolver | exact Root、Identity、書込み範囲 | Effect 0 | Root再検証 |
| 判断不足 | Orchestrator | 同じTaskとHuman Authority | 判断待ち | exact Taskへの入力または取消 |
| 受入判断 | Acceptance Decision Port | Objective／Milestone IdentityとHuman Authority | 推定書込みをEffect 0で拒否 | 同じ対象への明示判断または判断待ち維持 |
| 実行開始前 | Execution Port／Platform Port | Capability非発行 | 失敗理由を返す | 条件変更後に再評価 |
| 実行Effect後 | Execution Port | 重複Effect防止 | Recovery義務を耐久化 | 同じIdentityで観測・settlement |
| 取消 | Orchestrator／Execution Port | 終了とResource回収 | 要求受付と完了を分離 | Process終了、handle／Resource 0 |
| Data永続化 | Runtime Data Contract | intent、receipt、evidence | 上書きせず残存を分類 | immutable publishまたはexact cleanup |
| 投影・観測 | Projection／Diagnosis | 欠測、時点、根拠 | unknownを保持 | Source再取得または不足表示 |
| 外部送信 | External Information Boundary | Consent Scope、Secret | Effect 0 | 新しい有効同意 |
| 結果帰還 | Result Receiver | Request相関、未信頼性 | 隔離 | exact相関後も人間採否 |
| Trust／権利 | Trust Evaluator／収載判断 | Publisher、用途、決定権限 | 未承認 | 必要な根拠と人間判断 |
| 契約移行 | Consumer Closure | 全Consumer、派生物、Release経路 | 旧処理を削除しない | 集合一致と全Consumer反証 |
| 検査・品質 | Checker／Quality Center | 同じ改訂版、未確認範囲 | 全体Passを表示しない | 必須確認の完了または明示保留 |
| 接続・管理認可 | Access Management | 固定管理分担と内容認可の分離、現行Role、失効、三可視境界、公開範囲と実アクセス | 必要状態不明や不認可は非開示拒否 | 現在Authorityと現在状態で再評価。Domainへ未許可集合を渡さない |
| 通常管理の処置前 | Access Management | 操作別対象、変更前の現在管理認可、必要状態 | 不明・不認可・認可破損は新Effect 0。manager正常管理にadministrator存在を要求しない | 現在状態を再評価。交換専用Recoveryを追加せず、拒否を自身利用拒否へ広げない |
| 通常管理の更新後 | Access Management | 更新確定と結果受領、次要求認可の別事実 | 不明を成功化せず現在状態を確認して再処置。更新受理を内容取得としない | 現行Role・Exposure・実アクセスで次要求を評価。登録からの公開、解除からの削除を推定しない |
| 鍵交換の処置前 | Access Management | 既存対象・必要なadministrator・認可健全性、現在Authority | 対象不明・必要管理者不存在・安全な観測不能・認可破損は新Effect 0 | 修正済みの条件を再評価。Role初期化・認可破損修復・特別User／Bootstrapをしない |
| 新規発行の処置前 | Access Management | Workbenchの現行固定administrator、既存対象userId、必要状態・認可健全性 | administrator不成立・対象／必要状態不明・認可破損は発行Effect 0で停止 | 現在条件を再評価。旧失効0、交換Recoveryを生成しない |
| 独立失効の処置前 | Access Management | Workbenchの現行固定administrator、exact資格IdentityとuserIdへの結合、必要状態・認可健全性 | administrator不成立・対象／必要状態不明・結合不一致・認可破損は失効Effect 0で停止 | 対象外資格の失効0。条件を再評価し、交換Recoveryを生成しない |
| 新規発行または結果記録の不明 | Access Management | Credential IDとは別の非秘密な元発行Identity、既存userId、既知事実 | 元処理を現在再観測し、新交換を開始しない。確定済み事実を不明へ戻さない | 旧失効0、交換Recoveryを生成せず交換用未解決集合へ入れない。Secret保存／再表示なし |
| 発行・結果記録確定後の提示・引渡し（初回は同鍵接続確認）未確認 | Access Management／入口結果搬送 | 確定済み発行・記録、未確認の受け渡し、元発行Identity | 「発行済み・受け渡し未確認」と表示。秘密再表示・保存・自動再発行なし | 現在administratorが既存交換を明示選択する場合だけ別Operation／Recoveryで開始。現在administrator非接続時は既存Host交換2操作だけ |
| 別交換後の遅延旧応答 | Access Management／入口結果搬送 | 旧発行事実と新交換の失効確定範囲 | 失効済み鍵を利用可能と表示しない | 新交換成功は旧Secret受領、rollback、開始済み取消の証明ではない |
| 鍵交換の失効後・発行未確定 | Access Management | 既知失効、未確定発行、旧失効前からの同じRecovery、保持情報 | 未確定段階と確定済み段階を部分結果として非秘密耐久記録へ保持 | 同じRecovery IDで現在状態と入口ごとの現在Authorityを再観測。旧鍵有効・rollback・完了を推定しない |
| 鍵交換の結果記録不明 | Access Management | 確定済み失効・発行、元発行Identity、元exact Recovery | 先行の確定事実と未確認の記録を別に保持し、新交換を開始しない | 元exact Recoveryで現在再観測。Secret再表示・完了推定なし。発行・記録確定後の配送未確認は上記の別操作分岐へ |
| 独立失効 | Access Management | exact対象資格IdentityとuserIdへの結合、確定／不明の失効結果 | 確定した失効資格の後続要求を拒否。不明は既知状態と確認先を返す | 他資格への範囲拡大0、新発行・Secret・交換再入場0。開始済みTaskの取消完了を推定しない |

登録解除では同じ受理済み操作・採用改訂で登録と対応Exposureを除去し、両読戻し確認時だけ完了とする。片側残存・観測不能を完了にせず、対象外登録・Exposureと本体を保持する。両除去完了でも開始済み操作の終了不明は別に保持し、新しい取消処置を追加しない。

### 初回Host設定の失敗分岐

| 事実 | 処置 | 禁止する推定・Effect |
|---|---|---|
| 未試行・双方未初期化確認済み | Host明示開始で正規の初回へ進む | 全ての未試行を観測不能として拒否しない |
| 既存管理状態／通常鍵喪失 | 初期化を拒否し、鍵喪失は既存Host交換へ案内 | 二重UUID、再初期化、Role修復、内容権限の自動付与 |
| 元試行の鍵発行または結果記録が不明 | 確認済み元試行だけを再観測 | 自動再発行、別交換、秘密再表示、unknown→成功 |
| 発行・結果記録とも確定し、Host提示またはexact同鍵限定接続確認だけ不明 | 旧事実を保持。作成済みadministratorへの既存Host指定ユーザー交換を別明示操作として案内 | 元試行を交換Recoveryに変換、提示だけから限定接続成功を推定、交換を自動実行 |
| Root・記録・排他等の観測不能／破損 | 新作成を停止。確定した元試行がなければ推測しない | File一件の不存在から未初期化確定、無関係Root、進行記録消去 |

詳細な[初回State／Sequence](Details/access-management/01_Architecture.md#41-初回host設定のstateとsequence)へ戻す。この失敗処置から一般Recoveryや第三の鍵回復を作らない。新規UUID／鍵Effectの停止と、Root準備に既に発生したFilesystem Effectを分け、後者をEffect 0へ書き換えない。

## 4. 回復の不変条件

- Recovery Identityは、残存可能性が最初に生じた結果から耐久記録、再入場、終了まで変えない。
- Retryは新しい仕事を暗黙生成せず、同じEffectの重複発行を防ぐ。
- `unknown`は`false`、不存在またはcleanup済みへ変換しない。
- 保存済みintent、receiptまたはpointerだけから現在Authorityを再生成しない。
- 取消要求、Process終了、Resource回収、公開結果の確定を別の観測として扱う。
- 部分故障で無関係なComponentを全停止にせず、利用可能範囲と未確認範囲を返す。
- Project状態の観測、Task完了またはObjective受入から次段階の受入Authorityを生成しない。推定入力は記録を変更せず、判断待ちと根拠を保持する。
- 鍵交換は指定ユーザー交換／全員交換と通常／Host入口を別軸にする。全4組を事前表示し、Hostまたは全員交換の3組だけ明示確認する。通常入口は同一Process Workbenchの現行administrator、Host入口は信頼したログイン済みローカル操作者の対話CLIで再入場する。通常Host回復は交換2操作だけで、追加認証・専用資格・承認コード・OS管理者昇格なし。既存Root／Path検証は維持する。
- 各交換Recoveryは旧失効前にexact IDへ結合し、Process喪失・部分結果・耐久記録・再入場まで同じ相関を維持する。元発行／記録不明の再観測と、発行・記録確定後に現在管理者が選ぶ別交換を分け、後者の別Operation／Recoveryで旧相関を上書きしない。新規発行・独立失効へ交換Recoveryを付けない。
- 発行、結果記録、提示結果、観測外の本人引渡しを別の事実とし、後続失敗だけで確定済み発行結果を不明へ戻さない。未確認の記録・提示結果（本人受領は観測外）を成功扱いしない。
- MCPはSecret有無を問わず鍵操作の一覧・Schema・登録・dispatchを持たない。固定管理認可は現行RoleとARCH-000013の9 Role分担行から判定し、Role内容設定から派生させない。manager／administratorはユーザー登録・表示名変更、developer／managerのRole変更・内容設定、Repository登録・登録解除・Exposureを管理する。administratorの付与・解除・降格・詳細権限と鍵操作はadministrator専用。managerはadministratorの表示名だけ変更可。通常管理の失敗に鍵交換の保持保証やRecoveryを転用しない。
- 失効後に新発行や搬送が失敗しても、userId・表示名・Role・詳細権限・Repository登録・Product Dataを変更しない。生Secretを耐久記録・ログ・Evidenceへ保存せず、再入場で再表示しない。
- 資格の失効・交換からTask取消完了、過去Effect 0、認可設定の修復やAuthority復元を主張しない。単体資格不要の契約は変えない。初回Host設定は承認済みの別開始契約として扱い、通常Host回復へ混ぜない。

## 5. 段階的な故障確認

### 故障・終了処置のOwner

| Owner | 保持する事実・処置 | 代替してはならないこと |
|---|---|---|
| Orchestrator | Task／Attemptの停止、判断待ち、候補採否、上位再入場 | 下位の成功・取消受付だけをTask完了や資源回収成立へ変換しない。 |
| Coordinator | 最初の失敗境界、実行・資源の現在観測、取消・回収、限定した終了処置 | cleanupの結果で最初の失敗理由を上書きしない。上位の判断を生成しない。 |
| AI Adapter | Provider別の入力・起動・出力・認証の結果分類 | Provider終了をDocker資源不存在と同一視しない。回復Authorityを発行しない。 |
| Platform Access | OS固有のProcess／handle／Filesystemの実観測と限定処置 | 観測不能を不存在へ変換しない。業務状態・再実行を所有しない。 |
| Access Management | 認可、新規発行・独立失効・鍵交換の操作別部分結果。鍵交換に限る同じRecoveryへの再入場 | 認可破損修復、Role再設定、Task取消、Domain情報集約、Transport終了を引き取らない。現在認可なしに保存記録をAuthorityへ昇格しない。 |

最初の失敗（Primary Failure）、cleanup／回復の結果、最終公開状態は別々に保持する。要求未発行、作成拒否、応答未観測、結果確定失敗を区別し、後続の清掃失敗で原因境界を失わない。診断にProvider本文・秘密値・未許可Pathを複製しない。

### 使い捨てDocker Runtimeと限定unknown終了

Docker Runtimeは使い捨てを基本とし、旧Containerの復元や過去のunknownを成功へ書き換えることを目指さない。回復は現在の実資源を安全に終了・確認し、旧Owner・旧作業領域の再利用を防いだ後、上位が必要条件を再評価して新しいAttemptを開始できる状態へ戻す。回復処置自体は新しいProvider依頼を発行しない。

作成結果unknownの終了は、今回採用した限定Classに限る。Provider本体の開始前、外部送信なし、共有書込みEffectなし、旧OwnerのEffect不能、遅延Createの無害化、現在の対象実資源不存在を確認できる条件を詳細設計で結合する。一つでも不明なら終了済みへ畳まず停止する。他の失敗Classや任意の残骸へ一般化しない。終了後も過去の作成結果unknownは履歴の事実として保持するが、現在状態へ永久蓄積しない。

通常の自動終了処置は利用者へRecovery内部情報の判断を求めない。自動処置不能の場合だけ、再認証や必要性を確認したDocker再起動など具体的な操作を提示する。Windows再起動を通常の終了証明にせず、追加の回復Frameworkも作らない。現在の状態、通常履歴、正式Evidenceと候補本体は保存Owner・保持条件を分ける。

```text
Component内部の異常
        ↓
隣接境界での拒否・搬送・終了
        ↓
一つ先の状態Owner／Resource Ownerまで
        ↓
公開入口からの部分故障表示
        ↓
必要な場合だけSystem全体のST／E2E
```

同じResource、Identity、Authorityまたはtransactionが開始からsettlementまで続く場合は同じ結合単位にする。別Owner、別Failure Isolation、別Retryまたは別永続化境界を持つ場合は分け、隣接境界で結合する。

## 6. Qualityへの引渡し

初回のHost提示、exact同鍵限定接続、確認保存、読戻し、短命材料清掃・Lock終了を個別に故障させ、未確認・失敗・観測不能でcompleted表示と通常Authorityが0となることを反証する。清掃は有効資格の削除ではない。通常提示から対象本人受領を推定せず、初回確認に通常認証を先行許可しない。具体接続・Binding・未解決処置はAM詳細のOPENとして閉じる。

- 登録解除の片側除去・両読戻し欠測・対象外変更、完了からの開始済み取消推定を反証する。
- 元発行／記録不明からの新交換、通常発行への交換Recovery付与、確定発行の不明化、別交換と旧相関の混同、秘密再表示・自動再発行、失効鍵の遅延利用表示、現在認可なしの通常交換を反証する。

- 正常系だけでなく、開始前、Effect後、取消中、回復中、cleanup不明の各状態を試験する。
- rejectされた事実だけでなく、期待したphase／reason、Capability非発行、Effect 0、残存Resourceを確認する。
- ProjectionからAcceptance Decision Portへ到達できないこと、SPEC-000002の明示判断だけが限定記録されること、および判断記録からTask作成・Provider Effectが発生しないことを確認する。
- 実Docker、外部CLI、Filesystem等の実境界では、起動だけでなく停止、故障、回復、再開、清掃までLifecycle全体を確認する。
- 長時間・高費用の負荷試験は人間の明示指示なしに実行せず、未実施を通常のArchitecture Ready阻害にしない。
- 新規発行の未確定と確定後の記録・提示結果／初回限定接続確認失敗を分け、旧失効0・交換Recoveryなし、独立失効のexact対象・範囲拡大0・新発行／Secret／交換再入場0を個別に反証する。
- 新規発行・独立失効の処置前にadministrator不成立・対象／必要状態不明・認可破損を与え、それぞれ発行0・失効0を観測する。独立失効は資格IdentityとuserId結合の不一致・対象外資格の失効0も反証する。処置開始後の結果不明を、この処置前Effect 0へ読み替えない。
- 鍵交換の処置前拒否と失効後失敗を別検証にし、固定administratorのWorkbench／信頼したHost入口、4組表示・3組確認、対象保持、旧失効前からの同じRecovery、秘密非再表示と段階別不明を観測する。入口分担は採用済みであり、具体的な保存確定方式・回復API・入力／表示／提示方式・初回限定接続確認方式はDetails照合待ちである。
- MCPの鍵操作4面不存在、Hostの通常発行／独立失効拒否と追加認証なし、現在参照許可と鍵操作権限の区別を反証する。

## Checklist

- [x] 最初の失敗、cleanup結果、最終状態を別の事実として扱った。
- [x] 上位Task状態と下位実行・資源のOwnerを分離した。
- [x] 限定unknown終了を汎用Recoveryへ一般化していない。
- [x] 回復からのProvider再依頼と過去unknownの成功化を禁止した。
- [ ] OPEN: 限定終了の全条件・本番観測・反例の詳細対応は段階3、設計の独立確認は段階4、実装・実境界は段階5〜7で確認する。
