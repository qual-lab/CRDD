# 現行実装との照合

成果物種別: Quality現実照合
状態: In Progress
進捗: Reality Assessment Complete — Remediation Routed; Legacy Migration Required
現在範囲: 全18 Architecture詳細設計領域
維持責任者: Qual-Lab

## 設計集合

| 項目 | 件数 |
|---|---:|
| Local Item数 | 154 |
| 内訳 | 154件をCanonical化済み。実装・Test・Evidenceとの照合は本書の各判定で分ける |

## 1. 目的

[Quality Integration](04_Quality_Integration.md)と各[Quality定義](Definitions/)を基準に、現行Source、Test Catalogおよび実境界Evidenceがどこまで対応するかを照合する。既存実装や試験の存在から検証義務を逆算しない。

```text
[157件のCanonical入力]
          ↓
[Quality Mapping]
          ↓
[検証定義とLocal Item]
──────────────────── ここまでを先に固定
          ↓
[Source／Test／Evidenceとの照合]
          ↓
[Implemented／Executed／Passed／Evidenceあり]
```

## 2. 判定の単位

検証目標全体を一つの`Covered`へ丸めない。各Local Itemについて次を別々に判定する。

| 判定軸 | 意味 |
|---|---|
| Designed | Canonicalな検証項目、正常・境界・失敗、観測、終了後条件が定義済み |
| Implemented | 対応する実装と試験入口を確認済み |
| Executed | 対象改訂版と条件を固定して実行済み |
| Passed | 期待した理由、観測および終了後条件で合格済み |
| Evidence | 結果、対象改訂版、未確認範囲および根拠を追跡可能 |

`Safe Reject`、試験ファイルの存在、以前の版のPass、別のGuardによる偶然の拒否は、目的のLocal Itemの`Passed`を意味しない。

## 3. 照合方法

| 入力 | 照合する内容 | 禁止する推定 |
|---|---|---|
| Source | Owner、境界、Effect、状態、失敗・回復の実装位置 | ファイル名やDirectory名だけで実装済みとする |
| Test Catalog | 対象、段階、実境界、Lifecycle、選択条件 | 登録件数から意味Coverageを推定する |
| Test | 刺激、観測、期待理由、終了後条件 | 最終statusだけで意図したGuardの成立を推定する |
| Evidence | 改訂版、環境、実行結果、未確認、残存Risk | 過去版や別条件の結果を現在へ流用する |

## 4. 現在状態

| 対象 | 状態 | 理由 | 次の処置 |
|---|---|---|---|
| 13検証目標のLocal Item | Quality Design Ready | 157件のMapping、Source ID固有条件および154 Local ItemとのRelationを固定した | Pilotの17意味に接続したLocal Itemから照合する |
| 現行Source／Test | 全Subsystem初回照合済み | 18領域を実装所有、Symbol Relation、Test Catalog、局所試験、工程／統制所有へ分けた。実装を持つ12領域の静的確認は全てPassした | `Partial`のRelation不足と実装欠落を所有変更へ返す |
| 実行結果／Evidence | 全Subsystem局所実行済み | 11 TypeScript packageとPlatform Accessの局所試験を実行した。CoordinatorとCheckerではSandboxまたは命名規則に起因する不一致を分離した | 是正後の局所再実行と独立レビューを対象Commitへ結合する |

以前のArchitecture限定Sliceで示した`Covered 4／Partial 6／Missing 1`は、17 ARCH-IDだけを入力にした暫定対応であり、現在の157件Mappingに対する品質状態ではない。現在判定へ使用しない。

## 5. 旧検証設計から引き継ぐ未照合候補

旧`03_Verification_Design.md`が所有していた具体的なSource、TestおよびRuntime検証は、Quality Definitionの正本として扱わず、Reality Auditの未照合候補へ移す。移行前の内容はCommit `2135799e7691503e1474c8e94cec571093e55a15`の同Pathから再現できるため、本文を複製しない。

| 未照合候補 | 対応を確認するQuality Definition | Reality Auditで確認すること |
|---|---|---|
| 署名配布物、期限、Manifest昇格、Trust | QA-000010 | 現行Source／Test／Evidenceが署名対象、鍵境界、改変拒否、昇格後状態をどこまで証明するか |
| Checker、Windows native部品、Version Control | QA-000001／QA-000006／QA-000013 | 決定論的検査、OS境界、Repository境界、利用側閉包の実対応 |
| Tool結合block、Docker／CLI／Provider境界 | QA-000006／QA-000009 | 直接境界から関連2 blocks、System／E2Eまでの段階到達と全lifecycle |
| Project Runtime、取消、判断返却、回復 | QA-000003 | Taskの受付から終了後状態、exact Recovery、再入場までの実対応 |
| 実行記録の生成・保存・読取り | QA-000004／QA-000012 | 読取り責務と基準版Writer／Store能力を分け、削除・置換前のCapabilityを確認する |
| 推論コンテキストと工程引継ぎ | QA-000013 | 成果物の理解、判断理由、意味伝播および人間確認の現実対応 |

この表は試験設計や合格結果ではない。各候補をLocal Item単位で照合し、未実装、未実行、別版Evidence、意図した理由でのPassを区別する。

## 6. 基準版から引き継ぐ実行知の能力

v0.20.1の実行知はEvent生成、Repository-local Storeへの不変保存、並行Writerの競合処理、Repository Root確認、Project Runtimeからの記録および限定並列実行の評価を成立済み能力として持つ。これらは現在のread-onlyなCanonical実行知へ逆輸入せず、削除または置換判断の前に過去Evidenceと現行実装を照合する。

| 成立済み能力候補 | 現行照合先 | 現在判定 |
|---|---|---|
| 閉じたEvent生成と入力拒否 | execution-intelligenceの生成・検証試験 | 未照合 |
| 不変保存、再送冪等、衝突拒否 | Repository-local Store試験 | 未照合 |
| 並行Writer、Lock、一時file、失敗残存 | Storeの実Process／故障注入試験 | 未照合 |
| 検証済みRepository Rootへの保存 | Version Control境界とStore結合試験 | 未照合 |
| Project Runtimeからの記録と再読取り | Coordinator利用側結合試験 | 未照合 |
| 限定並列Attemptと統合結果の評価 | bounded integration試験 | 未照合 |

基準版の詳細根拠は[CHG-000062の検証結果](../99_Roadmap/Changes/CHG-000062/Evidence/260905_execution-intelligence-verification.md)から辿る。過去の合格をv0.21の合格へ流用せず、Capability、Owner、置換実装、利用側および必要な実境界検証を対応付ける。

## 7. 完了条件

- 全Local Itemが一つ以上のCanonical Source IDまたは横断Architecture成立条件へ接続されている。
- 各Local ItemがTest Catalogまたは人間確認へ接続され、未実装・未実行・未確認を区別できる。
- 自動試験は期待する理由、観測および終了後条件を確認する。
- 実境界を必要とする項目は段階的なITから必要なSTへ接続する。
- PT／LTは人間が対象、環境、上限、費用、中止およびcleanupを明示した場合だけ実行する。
- 現在の品質状態は本書の集計ではなく、Local Itemと最新EvidenceからQuality Centerへ投影する。

## 8. Coordinator／Project Runtime Pilot

照合開始の基準改訂版はCommit `3f2567bd54f00fe638bfc8ff9e7f3695fd8eba66`であり、現在の再照合候補はCommit `1973542`以後のTest Source Contract是正を含む。Canonical入力からSemantic Coverage Bundleを再生成し、Test Fileを一つの代表Local Itemへ縮約した誤りを解消した。FileはCase／Helper Relationの和集合、Caseは対応する1件、Helperは支援する1件以上を保持し、`symbol.json`だけが正方向Relationを所有する。旧Relationをそのまま戻さず、物理試験段階、個別Test責務、実装SymbolおよびLocal Itemが同時に一致するRelationだけを観測済みとした。

| 意味単位 | 実装Relation | Test Relation | 現在判定 |
|---|---|---|---|
| `coordinator.candidate-review-boundary` | observed | observed | `Covered Candidate`: 対応Source、Local ItemおよびRuntime契約試験を局所実行で確認 |
| `coordinator.cleanup-before-result` | observed | observed | `Covered Candidate`: Windows Process取消2条件を通常ユーザー境界で局所実行し、終了後不存在を確認 |
| `coordinator.external-boundary-diagnostics` | observed | observed | `Covered Candidate`: Native Trace契約試験を局所実行で確認 |
| `coordinator.objective-lifecycle` | observed | observed | `Covered Candidate`: Task Runtime契約試験を局所実行で確認 |
| `coordinator.provider-effect-authority` | observed | observed | `Covered Candidate`: Authority契約試験を局所実行で確認 |
| `coordinator.provider-selection-boundary` | observed | observed | `Covered Candidate`: Model Selection契約試験を局所実行で確認 |
| `coordinator.recovery-obligation` | observed | observed | `Covered Candidate`: Runtime契約試験とRecovery Matrix契約試験を局所実行で確認 |
| `coordinator.runtime-trust-consumption` | unobserved | unobserved | `Missing`: Trust候補の検証部品はあるが、Runtime Trust Policy activationとProvider launch結合が`not_implemented` |
| `project-runtime.acceptance-decision-authority` | observed | observed | `Covered Candidate`: 判断ApplicationとState契約試験を局所実行で確認 |
| `project-runtime.durable-before-effect` | observed | observed | `Covered Candidate`: Project RuntimeのEffect前耐久化を`PRL-ST-004`へ接続したSystem Test Relationで確認 |
| `project-runtime.execution-intelligence-read-model` | observed | manual_pending | `Pending`: 読取りPortの実装Relationはあるが、利用者受入を所有する`PPR-UAT-008`は未実施でありUnit TestをUATへ昇格しない |
| `project-runtime.objective-task-lifecycle` | observed | observed | `Covered Candidate`: Objective、State、Integrationの契約試験を局所実行で確認 |
| `project-runtime.project-state-projection` | observed | observed | `Covered Candidate`: State QueryとState契約試験を局所実行で確認 |
| `project-runtime.queue-lease-lifecycle` | observed | observed | `Covered Candidate`: State契約試験を局所実行で確認 |
| `project-runtime.recovery-obligation` | observed | observed | `Covered Candidate`: Project Runtimeの同一Identity再入場を`PRL-ST-004`へ接続したSystem Test Relationで確認 |
| `project-runtime.task-authority-narrowing` | observed | observed | `Covered Candidate`: Objective Intake契約試験を`PRL-IT-005`へ接続し局所実行で確認 |
| `project-runtime.transport-neutral-application-contract` | observed | observed | `Covered Candidate`: Public Contract契約試験を局所実行で確認 |

`observed`はRelationの存在だけを示す。Source責務、反例、終了後条件、試験実行およびEvidenceが揃う前に`Covered`へ昇格しない。

### 8.1 初回判定とRelation是正

初回判定は`Covered 1／Partial 15／Missing 1`だった。途中のRelation是正では16件を観測済みとしたが、その後のTest Source全数移行でFile、Case、Helperを一つの代表Local Itemへ縮約し、成立済みRelationを失った。さらに旧Relationには物理Test段階とLocal Item段階の不一致が含まれていたため、旧集合をそのまま復元せず、197 Test Fileと2,125 Test Caseを責務別に再照合した。

現在は17意味中15件が実装と自動Testの両Relationを持つ。`coordinator.runtime-trust-consumption`は実装自体がない`Missing`である。`project-runtime.execution-intelligence-read-model`は実装Relationを持つが、手動UATである`PPR-UAT-008`が未実施の`manual_pending`である。Unit Testまたは名前の近いTestをUAT成立へ昇格しない。

`coordinator.runtime-trust-consumption`だけは単なるRelation漏れではない。Trust候補のLoader、VerifierおよびPackage Trust Coreは存在するが、現行Source自身がRuntime Trust Policy activationとProvider launch integrationを`not_implemented`として公開している。したがって、署名検証部品の存在や署名済みE2E成功から、このMeaningの成立を推定しない。

### 8.2 局所実行結果

| 対象 | 結果 | 判定 |
|---|---:|---|
| Test Source Contract | 16／16 Pass | 197 File、2,125 Case、Helper、Manifest Relation和集合、Local Item実在および試験段階一致を確認 |
| Symbol Graph Contract | 11／11 Pass | Test Relation、未知Symbol、未知Local Item、Catalog owner／pathをFail Closedで確認 |
| Semantic Coverage Pilot | 17意味を全数生成。実装観測16、自動Test観測15、手動確認待ち1 | Runtime Trustの実装・Test不足と手動UAT待ちを空Relationのまま保持し、旧Relationや近似Testで補完していない |
| Repository Checker | 1,622 files、962 Markdown、16,201 links、0 error、0 warning | 現行構造とRelation更新後のRepository検査は成立 |

Sandbox内ではProcess列挙が`Access denied`となり、取消試験も子Process終了を猶予内に観測できなかった。同じ2条件を通常ユーザー境界で再実行すると2／2 Passしたため、製品回帰ではなく実行環境の不一致として分類する。Process／OS境界の成立は、必要な権限を持つ本番同等境界で確認し、Sandbox内の失敗も消さずに実行条件とともに残す。

## 9. 全Subsystemの現在分類

初回分類の対象改訂版はCommit `54f248ff93ebbefdb82a76363d5bb33bd84d228e`であり、当時値はGit履歴から再現する。本節の表は現在候補の分類であり、初回Snapshotへ現在値を上書きした履歴記録ではない。`Quality Integration`の詳細設計領域とLocal Itemを期待集合とし、`symbol.json`、Test Catalog、Sourceおよび局所試験を現実集合として照合する。未Commit候補の値は現在の暫定値であり、Commit後にその改訂版を現在照合の基準として固定する。`symbol.json`がないことだけで実装欠落とせず、工程・統制として人間確認を所有する領域と、実Runtimeを宣言しながら実装を持たない領域を分ける。

| 詳細設計領域 | 実装Owner | 局所確認 | 初回判定 | 主な不足／次の処置 |
|---|---|---|---|---|
| artifact-signing | `40_Develop/artifact-signing` | 5／5 Pass | Partial | `AIT-IT-007`、`AIT-IT-009`と実試験のRelationを確認して接続する |
| checker | `40_Develop/checker` | Repository検査0 error／0 warning、初回350／351 Pass、命名是正後の対象試験1／1 Pass | Partial | 11期待Local Itemのうち6件を接続。`AUH-ST-006`、`RCM-IT-003`、`RCM-IT-004`、`RCM-IT-007`、`RCM-IT-010`は独立再構築、Consumer Closure、Runner lifecycle、Tool Registryの追加確認が必要 |
| contract-migration | checker／version-control等へ分散 | 専用Runnerなし | Gap | 独立packageを要求せず、Consumer Closureと縦断移行の実Owner／Test／Evidenceを明示する |
| coordinator | `40_Develop/coordinator` | 静的確認Pass、通常ユーザー境界のPilot取消2／2 Pass | Partial／Missing | `ERB-ST-011`は実Dockerと別Session／Runtimeを使う署名E2Eが未実行。`coordinator.runtime-trust-consumption`は実装欠落 |
| crdd-domain-library | `40_Develop/crdd-domain-library` | 20／20 Pass | Partial | 8期待Local Itemのうち3件を接続。署名配布、文書理解、移行閉包は利用側を含む追加確認が必要 |
| cros | `40_Develop/cros` | 静的確認Pass、IT／ST 13／13 Pass | Partial | 認証、Workspace非開示、local同等性、AI入口、Context Package、Handoff、Tool Registry、TS API／CLI／MCP／Workbenchの実Adapter、共有Application Contractおよび結果帰還を接続した。Hybrid／ManualとShared Host実配置は未成立 |
| execution-intelligence | `40_Develop/execution-intelligence` | 43／43 Pass | Partial | 10期待Local Itemのうち7件を接続。利用者判断2件とClock／現行性の結合確認が残る |
| mcp | `40_Develop/mcp` | 32／32 Pass | Partial | 6期待Local Itemのうち4件を接続。Candidate Storeと四入口のEffect同等性が残る |
| official-asset-governance | `40_Develop/official-asset-governance` | 静的確認Pass、6／6 Pass | Partial | 判断完全性、Revision競合および収載Relationの4 Local Itemを接続した。公開・撤回のSystem境界と人間受入4件は未観測を維持する |
| platform-access | `40_Develop/platform-access` | Rust 29 Pass、8 Explicit Ignore | Partial | Process／Docker境界試験は存在するが、`PRL-ST-003`、`ERB-IT-002`のRelationを確認して接続する。Ignore 8件は明示実環境試験として別扱い |
| project-operation | `40_Develop/project-operation` | 静的確認Pass、投影／候補採否IT 5／5 Pass | Partial | 部分状態投影、restricted非開示、Authority不足、採用／拒否／保留、Revision競合、Owner Effect前後の耐久再入場を接続した。ST／UATと横断利用側は未成立 |
| project-runtime | `40_Develop/project-runtime` | 60／60 Pass | Partial | 14期待Local Itemのうち9件を接続。Transport同等性、取消、判断待ち再開、受入Scenario／UATが残る |
| quality-change-control | 保守／監査工程 | 専用Runnerなし | Process-owned Partial | 独立Runtimeは要求しない。監査集合統合、是正再入場と3 Local Itemを実レビュー／監査Evidenceへ接続する |
| runtime-data | `40_Develop/runtime-data` | 35／35 Pass | Partial | 6期待Local Itemのうち4件を接続。Project View分類とCredential→Session Grantを伴うCROS Root利用は別Ownerの成立が必要 |
| runtime-trust | なし | 未実行 | Missing | Trust候補の部品はCoordinator側にあるが、Policy activationとProvider launch結合を持つOwnerがない |
| semantic-coverage | `40_Develop/semantic-coverage` | 14／14 Pass | Covered Candidate | 期待Local Itemを全て接続。Pilot名称と全Subsystem対応は別の移行処置 |
| verification-runner | `40_Develop/verification-runner` | 35／35 Pass | Covered Candidate | 期待Local Itemを全て接続。PT／LTは計画のみで、明示Authorityなしに実行していない |
| version-control | `40_Develop/version-control` | 41／41 Pass | Partial | 固定Snapshotと局所Consumer Closureは接続済み。`RCM-ST-012`が要求する公開・署名・Release・Recoveryを同一Snapshotで通すSystem Closureは全回帰と署名E2Eで未確認 |

`Process-owned Partial`は実装packageがないという理由での失敗ではない。各Local Itemに必要な判断、レビュー、公開記録または監査Evidenceが追跡できない状態である。`Missing`は現在宣言したRuntime能力に対する実装Ownerを確認できない状態である。

## 10. 局所実行の総括

| 対象 | 結果 | 扱い |
|---|---:|---|
| 実装を持つ12領域のformat／type／lintまたはRust build | 全てPass | 静的成立を確認 |
| 9 TypeScript library／runtime package | 283／283 Pass | artifact-signing、domain library、execution intelligence、MCP、project runtime、runtime data、semantic coverage、verification runner、version control |
| Platform Access | 29 Pass、8 Explicit Ignore | 8件はinstalled Docker等の明示実環境観測であり、未実行をPassへ畳まない |
| Checker Repository検査 | 959 Markdown、15,892 links、0 error、0 warning | 現行Repository構造は成立 |
| Checker全試験 | 初回350／351 Pass、対象試験の是正後再実行1／1 Pass | Coordinatorの命名規則違反11件を検出し、意味を変えない名称是正後に同じ検査がPassした |
| Coordinator静的確認 | Pass | 旧2 Registryの現行契約検査もPass |
| Coordinator Windows Process Gate | Sandbox内0／8 Pass | Process権限とDocker pipeアクセス制約。既知の通常ユーザー境界再確認と分離する |
| Coordinator restricted-process | 1995 Pass、1 Fail、5 Explicit Skip（全2001件） | 失敗1件は`os.tmpdir()`を未検証Source checkoutとして起動する試験で、Workspace外を許可しないSandboxが先に`coordinator_task_start_failed_closed`へ閉じた。期待した`coordinator_task_release_verification_required`まで到達しておらず、製品の意味不一致ではなく実行環境差として分離する |

## 11. 旧Runtime Traceability JSONの移行判定

対象は次の2ファイルである。

- `07_Quality/Registry/coordinator-runtime-traceability.json`
- `07_Quality/Registry/project-runtime-design-traceability.json`

移行判定の結果は、**Retained — Migration Required**である。現形式を全Subsystemへ増殖させず、現時点では削除もしない。両ファイルは現在もCoordinatorの静的検査、契約試験、Architecture参照およびSemantic Coverage移行棚卸しの入力である。一方、現在の正本責務では複数Ownerの情報を一つに重複保持しており、恒久的な手編集正本にはしない。

### 11.1 Propertyの新Owner

| 旧Property | 現在のOwner | Coordinator | Project Runtime | 移行判定 |
|---|---|---:|---:|---|
| Resource／State／Transition／Invariant等の設計意味 | Architecture Details | 10 Resource、32 State、31 Transition、5分類、12 Invariant | 9 Interface、10 Record、14 Resource、4 Lock、7 Authority、9 Effect、7 State Machine、54 Action Binding、32 Invariant、16 Failure Injection | Project Runtimeは構造化済み。Coordinatorは一部が文章から決定論的に再生成できず、Details補強が必要 |
| Effect観測範囲 | Architecture Detailsの状態遷移契約 | `transition_delta` | 非該当 | Coordinatorの遷移観測規則としてDetailsへ明示してから生成する |
| Implementation Binding | `40_Develop/*/symbol.json` | 旧JSONでは独立集合なし | 9件 | Symbol側へ移行し、旧JSONへ二重記録しない |
| Verification Binding | Quality Definition＋Test Symbol | 25件 | 23件 | Local ItemとTest Symbolへ移行する |
| Binding別Boundary Map | 生成Global Graph | 25件 | 非該当 | Canonical入力から生成する |
| Schema／Revision／参照先 | 生成契約のHeader | あり | あり | 生成物のIdentityとしてのみ保持する |

Propertyの全数はCoordinator 11件、Project Runtime 16件である。Semantic CoverageのMigration Inventoryは、上表の配列とObjectだけでなく、`schema`、`schemaRevision`、参照先および`effectObservationScope`を含むルートProperty全件にOwnerを必須化する。未分類Propertyが追加された場合はMigration Inventoryを発行しない。

### 11.2 現在のConsumer

| Consumer | 現在の用途 | 新Ownerへの移行先 | 現在判定 |
|---|---|---|---|
| Coordinatorの2つの静的検査Script | 集合、参照、反例、Fail Closed条件の検査 | Architecture Detailsから生成する投影とGlobal Symbol Graph | 未移行 |
| Coordinatorの2つの契約試験と試験支援 | 旧JSONの構造および失敗反例の検証 | 新生成投影の同等契約試験 | 未移行 |
| Checkerの現行ProfileとFixture | 3 Registryの必須配置 | Canonical入力と生成投影の完全性検査 | 未移行 |
| Architectureの現行参照 | 設計と実装／試験の対応導線 | Architecture Details、Quality Definition、Global Symbol Graph | 未移行 |
| Semantic Coverage Migration Inventory | 旧PropertyのOwnerと欠落を観測 | Migration完了後に削除する期限付きConsumer | 移行中のため維持 |
| Test Catalog | 現行契約試験のInventory | 新契約試験のPathとIdentity | 試験移行後に再生成 |

CHGや過去EvidenceのPath参照は当時の履歴であり、現行Consumer移行の対象にしない。削除後もGit履歴とEvidenceから当時の投影を再現できる。

### 11.3 廃止Gate

次の全条件が揃うまで旧2 JSONを削除しない。

1. 全PropertyがArchitecture Details、Semantic IR、`symbol.json`、Quality Definition／Test Symbol、Evidenceまたは生成Global Graphのいずれかへ一意に移る。
2. 旧JSONにしか存在しないCanonicalな設計意味が0件になる。
3. Coordinatorの2 checker script、契約試験、Architecture参照およびTest Catalogの全Consumerが新入口へ移る。
4. 旧JSONと新しい生成投影について、集合、RelationおよびFail Closed条件の同等性を決定論的に確認する。
5. 削除後にCoordinator／Project Runtimeの成立済みCapabilityと過去Evidenceを逆引きできる。

Project RuntimeはArchitecture Detailsの構造化が進んでいるため、生成器とConsumer移行後に先行廃止できる可能性が高い。Coordinatorは固有MeaningをDetailsへ戻すまで削除不可である。他Subsystemには旧JSONの複製を作らず、必要な機械投影を各Architecture Detailsから生成する。

## 12. Relation是正結果

現在の完了判定は、13件のQuality Definitionが所有する154個の一意なLocal Itemを母集団とする。Test Sourceの`symbol.json`が所有する正方向Relationと再照合した結果、119件を観測済み、35件を未観測と判定した。残る35件はAutomated 2件、Hybrid 14件、Manual 19件である。

| Quality領域 | 未観測数 | 実行形態の内訳 |
|---|---:|---|
| AIT | 1 | Manual 1 |
| AUH | 4 | Hybrid 3、Manual 1 |
| CPR | 4 | Hybrid 3、Manual 1 |
| CQS | 3 | Hybrid 1、Manual 2 |
| ERB | 3 | Automated 1、Hybrid 1、Manual 1 |
| ERP | 1 | Manual 1 |
| EST | 4 | Manual 4 |
| OAG | 4 | Hybrid 4 |
| PPR | 5 | Hybrid 1、Manual 4 |
| PRL | 2 | Hybrid 1、Manual 1 |
| RCM | 2 | Automated 1、Manual 1 |
| RDL | 1 | Manual 1 |
| RFD | 1 | Manual 1 |

この35件は「新しい自動Testが35本必要」という意味ではない。Automated 2件は、局所fixtureでは代替できない全Consumer同一Snapshotの回帰と、実Dockerを使う別Session回復の署名E2Eで処置する。Hybridは自動観測と独立した人間・実境界評価の両方、Manualは参加者の判断Evidenceを必要とする。自動部分だけを全体成立へ畳まず、名前や同じQuality領域だけを根拠にTest Symbolへ接続しない。

今回の局所Closureでは、`AIT-ST-010`を実署名済み固定Snapshotの昇格・不一致拒否・候補破棄へ、`CQS-ST-013`を公開Verification入口のPT／LT Authority Gateへ、`RDL-ST-002`を公開Runtime Data APIの清掃・回復保護・最終不存在へ接続した。さらに`ERB-IT-012`は、既存のDocker Desktop修復統合試験がexact Repair Identity、旧Effect非再発行、fresh観測および同一義務の継続をすでに確認していたため、試験を複製せず正方向Relationを補った。`CQS-ST-012`は公開Verification CLIでStatic、UT、IT、ST、UATの固定計画を実行し、UATを自動Passへ畳まず人間入力待ち、全体`blocked`、Exit 2として返すSystem Testへ接続した。`ERB-ST-015`は同じ公開入口で下位Gate成立時だけ次の境界へ進み、人間入力待ちの上位境界を開始しない独立Test Caseへ接続した。`RFD-IT-005`はdirtyな実Repositoryと同じPortを実装する差替Adapterで同じLocal Change Set操作を行い、Commit SHAおよびGit具象をCoreの成立条件へしない専用ITへ接続した。`ERB-IT-008`はPlatform AccessのHome分類結果をTask RuntimeのProcess Gateへ結合し、missing、regular file、link／reparse、異なるIdentity、権限不足および観測不能が初回観測・再観測のどちらで発生してもProvider Process Effect 0で停止する専用ITへ接続した。公式素材の判断完全性、Revision競合および収載Relationは、追加した専用Packageの`OAG-IT-005`、`OAG-IT-006`、`OAG-IT-007`、`OAG-UT-008`へ接続した。Project Operationは専用Packageを追加し、`PPR-IT-002`の部分状態投影とrestricted非開示、`CPR-IT-004`のAuthority／Relation不足拒否、`CPR-IT-006`の明示採用・非採用・Revision競合およびOwner Effect前後の耐久再入場を独立したTest Caseへ接続した。CROSはlocal同等性、AI入口、Handoff、Tool Registry、Session Grant、非開示、実Repositoryを使うFederation／Context Package、TS API／CLI／MCP／Workbenchの実Adapter、共有Application Contractおよび相関付き結果帰還へ接続した。`RCM-ST-012`の既存Testは手作りのObservation集合を判定する局所試験であり、公開・署名・Release・Recoveryの実Consumerを同一Snapshotで実行していないため、Relationを外して全回帰／署名E2E待ちへ戻した。`ERB-ST-011`の既存Testも自己申告fixtureであり、実Docker・Host資源と別Session／Runtimeを観測していないため、Relationを外して署名E2E待ちへ戻した。再計画中のHuman Decision試験は`PRL-IT-005`を補強するが、Objective／Milestone Acceptance Decisionを求める`PRL-IT-008`とは意味が異なるため、同項目は未観測を維持する。skipされた`CQS-UAT-007`は実行Evidenceに数えずManual待ちへ戻した。PT／LT実処理、全回帰および署名E2Eは実行していない。

### 12.1 初回Snapshotの扱い

初回の`Subsystem × Local Item`一覧は、現在の正方向Relationを作るための一時Inventoryだった。Gitの対象改訂版から再現でき、現在Coverageの正本でもないため、可変な件数表を本文へ永続化しない。現在の領域別RelationはArchitecture Details、Quality Integrationおよび各`symbol.json`から生成し、一意なLocal Itemの現在値は本節の119／154だけを使用する。

未接続は既存Testへ名前だけで割り当てない。Test FileはCase／Helper Relationの和集合、Test Caseは対応する一つのLocal Item、Helper／Fixtureは支援する一つ以上のLocal Itemを持つ。`symbol.json`だけが正方向Relationを所有し、逆方向Coverageは生成する。人間UAT、工程Evidence、未実装Capabilityおよび段階不足を自動Test Relationへ偽装しない。

## 13. 未観測35件の処置

| 実行形態 | 件数 | 現在の処置 |
|---|---:|---|
| Automated | 2 | `RCM-ST-012`は全Consumer同一Snapshotの回帰、`ERB-ST-011`は実Docker・別Session回復の署名E2Eで処置する。局所fixtureへ縮退させない |
| Hybrid | 14 | 自動部分と人間判断部分を分離し、自動部分だけのPassを全体成立へ畳まない |
| Manual | 19 | 自動Test Symbolを捏造せず、参加条件、入力、判断、未判断範囲およびEvidenceを固定して実施する |

全回帰は、Automated／Hybridの実装・試験Gapを閉じ、Manual項目の実施条件と現在Releaseへの影響を固定した後に実行する。Phase 8完了前に各件の具体的Owner、処置、再評価契機および現在Releaseへの影響を固定する。Reality Auditは未実装Capabilityや未実行の手動評価を自分で補完せず、対応するQuality Mappingから再評価する。

### 13.1 Hybrid項目の実施条件

Hybrid項目は、機械化可能な前提確認と、独立した意味評価・人間判断・実境界観測の両方を必要とする。次表の前提確認が存在しても、Local Item自体を合格とは扱わない。実行時は固定した対象改訂版と[検証結果の記録形式](../template/07_Quality/99_Verification_Result_Format.md)を使い、直接証明するChangeまたはReleaseの`Evidence/`へ結果を保存する。

実行前に、各項目について次を具体値へ解決する。未解決のまま実行した結果はEvidenceとして採用しない。

| 固定項目 | 必須内容 |
|---|---|
| 対象改訂版 | Commitだけを前提にせず、対象File集合と内容Hash、または同等の固定Snapshot Identityを記録する |
| 入力 | 入力成果物、Fixture、権限、状態および反例のIdentityとHashを記録する |
| 実行入口 | 実際に使う公開入口、Command、Review Protocolまたは操作手順を一意にする |
| 環境 | OS、Runtime、利用する外部境界、利用不能な境界および観測限界を記録する |
| Evidence | 実行前にCHGまたはRelease配下の保存先とRecord Identityを割り当てる |
| 終了判定 | Pass／Fail／OPEN、終了後Effect、残存資源、未判断範囲および戻り条件を記録する |

| Local Item | 実施責任 | 固定する自動前提／入力 | 残る実施 | 再評価契機／現在Releaseへの影響 |
|---|---|---|---|---|
| `AUH-ST-004` | 独立読者／工程レビュー担当 | Checkerの文書構造確認と、固定した自己完結成果物・参照退避反例 | 参照先を使わず物語と固有条件を再構築する | 独立レビュー時。未成立なら成果物構造を再開し、Quality Readyを停止する |
| `AUH-ST-005` | 下流工程を担当する独立確認者 | 固定した上流成果物、ID、制約、未確認事項、基本図 | 上流だけから下流成果物を再構築し、意味差を記録する | 工程Closureレビュー時。欠落は上流Gapとして戻し、Quality Readyを停止する |
| `AUH-ST-006` | 入口実装を行っていない独立実行者 | `RFD-IT-011`の入口別規則・正本・Authority・差分理由 | 結果だけから共通意図、入口固有制約、選択理由、次工程を再構築する | AI入口の独立レビュー時。推測補完または入口差の説明不能ではQuality Readyを停止する |
| `CPR-ST-005` | Project Operation担当と決定権限者 | `CPR-IT-004`／`CPR-IT-006`、固定Meeting候補集合 | 採用・不採用・保留を含む候補を人間判断へ通し、採用分だけ一度反映する | Candidate Promotion確認時。重複反映または未判断反映ではQuality Readyを停止する |
| `CPR-UAT-002` | 採用の決定権限者 | Candidate Authority／Relation／Revisionの自動確認結果 | 対象Ownerと採用範囲を確認して採用判断する | Promotion UAT時。判断EvidenceなしではQuality Readyを停止する |
| `CPR-UAT-003` | 採用の決定権限者 | 非採用・保留候補と再評価条件 | 却下または保留を選び、正本Effect 0を確認する | Promotion UAT時。理由または再評価条件の欠落ではQuality Readyを停止する |
| `CQS-IT-001` | 変更担当から分離した独立レビュー担当 | 固定改訂版、必須監査集合、各確認結果、残存Risk | 結果を現在Gateへ統合し、判断先と未確認範囲を独立確認する | 独立レビュー集合の統合時。不整合では回帰・署名E2Eへ進まない |
| `ERB-ST-009` | Docker Runtime運用担当 | `ERB-IT-012`／`ERB-ST-011`、署名済みCoordinator、exact Repair ID | 既知2領域の退避、Docker再起動、Engine readiness、再入場を実境界で観測する | 署名E2EのDocker修復時。Engine readyと終了後条件未確認ではQuality Readyを停止する |
| `OAG-ST-003` | 公式素材管理者と配布経路担当 | `OAG-IT-005`／`OAG-IT-006`／`OAG-IT-007`／`OAG-UT-008` | 用途拡張・対象外版・許可撤回で再配布を拒否し、影響範囲を特定する | 公式素材Governance確認時。新規配布Effectまたは影響先不明ではQuality Readyを停止する |
| `OAG-UAT-001` | 公式収載の決定権限者 | 完全な素材Identity、出所、権利、用途、版、判断Authority | 許可範囲を確認して収載を判断する | 公式素材UAT時。判断EvidenceなしではQuality Readyを停止する |
| `OAG-UAT-002` | 公式収載の決定権限者 | 権利未確認・第三者模倣疑義の固定候補 | 権利を推定せず隔離を判断する | 公式素材UAT時。公式収載Effect 0を確認できなければQuality Readyを停止する |
| `OAG-UAT-004` | 公式収載の決定権限者 | 権利者・許可文言・判断者・対象版の不足候補 | 不足を明示して判断権限者へ戻す | 公式素材UAT時。候補変更・削除または不足の隠蔽ではQuality Readyを停止する |
| `PPR-ST-005` | Project Projection担当とSecurity確認者 | `PPR-IT-002`、Grant内外Sourceを含む固定Projection入力 | 制限付き利用者の実Viewで値とSource存在の非開示を確認する | Project View実境界確認時。restricted Sourceの存在開示ではQuality Readyを停止する |
| `PRL-UAT-002` | Project Runtime利用者と判断権限者 | 判断待ち状態、同一Task／Request Identity、再開Authority | 自動継続せず判断を返し、同じTaskを一度だけ再開する | Project Runtime UAT時。別Task結合または重複settleではQuality Readyを停止する |

### 13.2 Manual項目の実施条件

Manual項目は、人間の理解・選択・判断そのものがOracleの一部である。自動試験へ置き換えず、参加条件、提示入力、選択、理由、参照根拠、理解不能項目、未判断範囲および終了後Effectを記録する。全項目は現在のv0.21.0 Quality Readyを止める。実施不能の場合はPassへ畳まず、理由、影響、判断先および再評価契機をEvidenceへ`OPEN`として残す。

人間対象の確認では、対象改訂版・入力・実行入口・Evidenceに加え、参加者の適格条件、選定方法、募集経路、想定する偏り、対象外、一般化限界、同意・拒否、途中終了および継続／終了条件を実施前に固定する。対象者や判断権限者を未確定のまま実施した記録は、Local Itemの成立Evidenceへ使わない。

| Local Item | 実施責任 | 主な提示内容 | 再評価契機 |
|---|---|---|---|
| `AIT-UAT-006` | Trust Policy利用者 | 公式・組織・Fork・未署名Local開発物の根拠 | Trust判断UAT |
| `AUH-UAT-001` | 対象工程を知らない代表読者 | 補足説明なしの固定成果物 | 人間可読性UAT |
| `CPR-UAT-007` | Project Operation利用者 | Topic／Meeting／Communication候補、根拠、競合・不明 | Candidate Promotion UAT |
| `CQS-UAT-006` | Release／品質判断権限者 | 残存Risk、未確認範囲、旧根拠を分けた現在品質表示 | 最終品質判断 |
| `CQS-UAT-007` | Release／品質判断権限者 | 設計済み・実装済み・実行済み・合格・Evidence収集済みを分けたQuality Center | 最終品質状態の理解確認 |
| `ERB-UAT-007` | 外部Runtime利用者 | 正常・部分故障・利用不能・未知構成の診断結果 | 外部Runtime UAT |
| `ERP-UAT-007` | 実行記録の利用者 | 実行基盤差、欠測、観測不能、観測時点の異なる記録 | 実行記録UAT |
| `EST-UAT-006` | 外部送信を判断する利用者 | 送信先、目的、情報分類、同意範囲、部分結果 | 外部送信UAT |
| `EST-UAT-007` | 複数入口を使う利用者 | CLI・MCP stdio・MCP HTTP・Workbenchの同一依頼 | 入口同等性UAT |
| `EST-UAT-008` | Context送信を判断する利用者 | 情報源、改訂版、利用範囲、欠測・競合、帰還結果 | Context Scope UAT |
| `EST-UAT-009` | 切断後に再開する利用者 | 要求前切断、受理後切断、応答喪失、回復必要の各状態 | Reconnect UAT |
| `PPR-UAT-007` | Project状況を判断する利用者 | complete・partial・restricted・stale・conflicting・unknown | Project View UAT |
| `PPR-UAT-008` | 実行知を判断する利用者 | 観測済み・未観測・不明・評価候補 | Execution Intelligence UAT |
| `PPR-UAT-009` | 現行情報と履歴を選ぶ利用者 | current・historical・superseded・unknown | History UAT |
| `PPR-UAT-015` | Project運営者 | 不完全性を含むProject Projection | Project Projection UAT |
| `PRL-UAT-010` | Objective／Milestone判断権限者 | Task完了・Objective差戻し・判断待ち・受入済み | Project Lifecycle UAT |
| `RCM-UAT-006` | 標準Tool利用者 | fresh clone・submodule・版不一致・Runtime欠落・Manifest改ざん | Tool Discovery UAT |
| `RDL-UAT-006` | Runtime Data運用者 | durable・temporary・recovery_required・cleanup_eligible・unknown | Runtime Data UAT |
| `RFD-UAT-007` | Project／Repository利用者 | 単一／複数Repository、利用可能・非開示・判定不能 | Repository Scope UAT |

## Checklist

- [x] Canonical Quality設計の固定後にだけReality Auditを開始した
- [x] 基準版Capabilityと過去Evidenceを比較入力として特定した
- [x] 現行Source、TestおよびRegistryをCanonical設計の正解として扱っていない
- [x] 必要な検証をCovered、Partial、Missing、LegacyまたはGapへ分類した
- [x] 未Commit状態とVersion Control Adapterの交換可能性を検証対象へ含めた
- [x] 照合対象のRevision、実行条件および観測限界を固定した
- [x] 不足Test、未実行項目およびEvidence Gapを追跡した
- [x] PT／LTの適用と実行Authorityを評価し、明示指定がない場合は実行していない
