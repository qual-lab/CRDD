# QA-000011 公式素材の権利と用途の検証定義

成果物種別: Quality定義
Quality ID: `QA-000011`
検証目標: 公式Repositoryへ収載する素材の出所、権利確認、許可用途、対象版および決定権限を追跡できること
主な試験段階: Integration／User Acceptance
状態: Canonical
維持責任者: Qual-Lab

## 現在の適用範囲

専用画面・判断Engine・API・Store・Revision競合管理は製品要求・開発残件から外す。専用方式の検証項目と本文は現行集合から撤去し、当時の結果はGit履歴と既存変更記録で追跡する。撤去をPassへ数えない。出所・権利・用途・版・判断者は既存素材文書に記録し、人間が収載・公開を判断する。

## 1. 情報源と網羅条件

| Source ID | Obligation Key | 導出元 | 保持する固有条件 | 試験段階 | 対応Local Item |
|---|---|---|---|---|
| [REQ-000035](../../../01_Discovery/Definitions/REQ-000035/requirement.md) | `req-000035.qa-000011` | Requirement Definition（成立条件・失敗・検証意図） | 素材の識別用途と、署名・準拠・品質保証を明確に分ける。収載、公開、再配布の権利確認と判断主体を追跡できる。原本と利用向け派生物の責任者、生成関係を確認できる。公式／非公式表示、権利記録欠落、派生物追加、保証表現を確認し、識別と誤認防止を観測する | IT／ST／UAT | `OAG-UAT-001`、`OAG-UAT-002`、`OAG-ST-003`、`OAG-UAT-004`、`OAG-IT-005` |
| [UX-000030](../../../02_UX/Definitions/UX-000030/ux_definition.md) | `ux-000030.qa-000011` | UX Definition（利用者成果・重要場面・重要な失敗） | 公式素材の出所・原本・派生物・利用条件を確認し、許可された用途で安心して収載・再利用できる。重要場面「公式用途へ採用する直前」で、避ける失敗を利用者が正常状態や完了として誤認しない。入口、実装または利用主体が変わっても、この利用者成果の意味を維持する。見た目からの信頼保証推定、権利不明素材の収載および用途外再配布を反証する | IT／ST／UAT | `OAG-UAT-001`、`OAG-UAT-002`、`OAG-ST-003`、`OAG-UAT-004`、`OAG-IT-005` |
| [IA-000019](../../../03_IA/Definitions/IA-000019/ia_definition.md) | `ia-000019.qa-000011` | IA Definition（情報・関係・状態・見つけ方） | 公式素材を、見た目ではなく由来・権利・許可用途を確認して利用する。UX-000030: 候補（candidate）／採用済み（approved）／開示制限（restricted）／取下げ済み（withdrawn） | IT／ST／UAT | `OAG-UAT-001`、`OAG-UAT-002`、`OAG-ST-003`、`OAG-UAT-004`、`OAG-IT-005` |
| [UI-000019](../../../04_UI/Definitions/UI-000019/ui_definition.md) | `ui-000019.qa-000011` | UI Definition（認識・操作・Feedback・失敗表示） | 素材の由来と許可された用途を確認して安心して使える。UX-000030: 視覚素材の出所・権利・用途を確認する: 公式用途へ採用する直前: 由来・権利・用途を追跡する: 見た目だけで権利や信頼保証を推定する。UX-000030／IA-000019: 候補（candidate）／採用済み（approved）／開示制限（restricted）／取下げ済み（withdrawn）: 素材→由来→権利→用途→収載・派生 | IT／ST／UAT | `OAG-UAT-001`、`OAG-UAT-002`、`OAG-ST-003`、`OAG-UAT-004`、`OAG-IT-005` |
| [SPEC-000024](../../../05_SPEC/Definitions/SPEC-000024/spec_definition.md) | `spec-000024.qa-000011` | SPEC Definition（正常・境界・失敗・観測不能・副作用） | 正常: 確認済み・未確認・利用不可を区別し、許可範囲へ戻れる。境界: 由来・権利・用途が確認済み／未確認／利用不可を分け、許可用途を拡張しない。失敗: 生成手段だけで権利を推定せず、用途外利用を許可しない。観測不能: 不明を正常・不存在・完了へ丸めず、実際の副作用「人間が既存の素材文書を更新する。製品による自動保存・収載・配布は行わず、実際の収載・配布は別の変更・Release Authorityを必要とする」と矛盾する結果を返さない。失敗: 生成手段だけで権利を推定せず、用途外利用を許可しない。副作用: 人間が既存の素材文書を更新する。製品による自動保存・収載・配布は行わず、実際の収載・配布は別の変更・Release Authorityを必要とする。本SPEC固有の回復経路は設けず、失敗理由と安全な戻り先を返す | IT／ST／UAT | `OAG-UAT-001`、`OAG-UAT-002`、`OAG-ST-003`、`OAG-UAT-004`、`OAG-IT-005` |
| [ARCH-000017](../../../06_Architecture/Definitions/ARCH-000017/architecture_definition.md) | `arch-000017.qa-000011` | Architecture Definition（責務・境界・状態・故障） | candidate／approved／restricted／withdrawnを区別し、生成手段や見た目だけから公開・再配布権を推定しない。所有する責務: 素材の出所、権利確認、許可用途、対象版、決定権限者の記録。所有しない責務: 法的判断の自動化、確認だけからの収載・再配布、用途外利用。主な外部境界: 素材提供者、決定権限者、公式Repository、公開成果物。SPEC-000024: 生成手段だけで権利を推定せず、用途外利用を許可しない。Effect: 人間が既存の素材文書を更新する。製品による自動保存・収載・配布は行わず、実際の収載・配布は別の変更・Release Authorityを必要とする。入力SPECが固有Recoveryを定義しない場合、Architectureから追加しない。結果には最後に確認できた状態、観測時点、不足および次の安全な行動を、入力契約が必要とする範囲で含める | IT／ST／UAT | `OAG-UAT-001`、`OAG-UAT-002`、`OAG-ST-003`、`OAG-UAT-004`、`OAG-IT-005` |
### Architecture詳細設計入力

| 詳細設計領域 | 受け取る成立条件 |
|---|---|
| [workbench-server](../../../06_Architecture/Details/workbench-server/01_Architecture.md) | 左上Application Brandでの承認済みCRDD公式ロゴ利用 |


退役領域の旧検証単位と保持義務は[統合表の処置](../../04_Quality_Integration.md#31-退役した設計単位の処置)に残す。現行詳細のCoverageへ混ぜず、上位の未接続を免除しない。

## 2. 試験段階と外部境界の適用

| 試験段階 | 適用 | 確認する範囲 | 外部境界の到達範囲 | 判断理由 |
| --- | --- | --- | --- | --- |
| UT | N/A | 専用Revision比較・判断Engineは要求しない | N/A | 素材文書と人間の収載判断へ限定する |
| IT | Required | 素材文書と実際の収載物の対応 | N/A | 記録と利用先を照合する。専用Store保存は要求しない |
| ST | Conditional | 収載から公開・再配布までの運用経路 | System/E2E | 実際の公開経路を対象にする場合に必要 |
| UAT | Required | 決定権限者による許可範囲と収載判断 | User Acceptance | 権利と公開判断を自動判定へ置換しないため |

### 条件区分の適用

| 条件区分 | 適用 | 対応Local Item | 判断理由 |
|---|---|---|---|
| 正常 | Required | OAG-UAT-001 | 通常の成立経路を独立して確認する。 |
| 境界 | Required | OAG-IT-005 | 値、Authority、情報、責務または利用者判断の境界を確認する。 |
| 準正常 | Required | OAG-UAT-004 | 継続可能な分岐、保留、観測不能または診断状態を成功へ畳まない。 |
| 異常 | Required | OAG-UAT-002、OAG-ST-003 | 不正入力、故障または拒否経路を通常成功へ畳まない。 |
| 回復 | N/A | - | 失敗後の再入場または回復義務を持たない。 |

## 3. 検証項目

| Local ID | 条件区分 | 試験段階 | 試験種別 | 対象／境界 | 外部境界の段階 | 事前状態／入力 | 操作／刺激 | 観測 | Oracle | Evidence | 終了後条件 | 実行形態 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| `OAG-UAT-001` | 正常 | UAT | Rights／Human Review | 素材文書→人間の収載判断 | User Acceptance | 出所・権利根拠・用途・版・判断者が記載された素材文書 | 決定権限者が根拠を確認する | 文書の参照先、判断理由、許可範囲 | 許可範囲と対象版を確認して人間が判断する。専用画面・Storeは要求しない | 固定した対象・入力、観測結果と未確認範囲を記録する。秘密値や不要な絶対Pathは保存しない | 未判断と採用済みを文書で区別する | Manual |
| `OAG-UAT-002` | 異常 | UAT | Rights／Unknown | 根拠不足→人間の収載判断 | User Acceptance | 権利未確認・模倣疑義のある素材文書 | 不足したまま収載しようとする反例を確認する | 不足、判断者への差戻し、収載見送り | 生成手段だけで権利を推定せず人間が収載を止める | 固定した対象・入力、観測結果と未確認範囲を記録する。秘密値や不要な絶対Pathは保存しない | 無許可収載・公開0。既存素材や保持物は削除しない | Manual |
| `OAG-ST-003` | 異常 | ST | Publication／Human Review | 素材文書→収載・公開の人間判断 | System/E2E | 用途外・版外・許可撤回の素材と利用先 | 実際の素材変更・公開時に影響先を確認する | 文書、利用先、許可範囲、見送り判断 | 自動拒否Engineではなく人間が対象外の収載・公開を止める | 固定した対象・入力、観測結果と未確認範囲を記録する。秘密値や不要な絶対Pathは保存しない | 未確認の公開0。実公開操作は別許可 | Manual |
| `OAG-UAT-004` | 準正常 | UAT | Rights／Missing | 素材文書の不足→判断者 | User Acceptance | 権利者・許可文言・判断者・対象版の不足 | 不足と確認先を記録する | 未確認の項目と確認先 | 不明を許可済みにせず人間へ戻す | 固定した対象・入力、観測結果と未確認範囲を記録する。秘密値や不要な絶対Pathは保存しない | 不足を隠さず、素材の自動変更・削除0 | Manual |
| `OAG-IT-005` | 境界 | IT | Document Traceability | 素材文書→実際の収載物 | N/A | 素材、由来・権利根拠・用途・版・判断者の文書と利用先 | 文書と収載物を読取り照合する | 素材参照、原本・派生関係、許可根拠、利用先 | 収載物から文書の根拠・許可範囲へ戻れる。権利の有効性を機械判定しない | 固定した対象・入力、観測結果と未確認範囲を記録する。秘密値や不要な絶対Pathは保存しない | 公開・再配布・Store更新0 | Manual |

## 4. 評価とEvidence

素材文書と利用先を照合し、用途外・対象版外・撤回後の利用は人間が収載・公開前に止める。専用Engineの自動拒否は要求しない。権利自体の有効性と法的判断は決定権限者の確認を必要とし、機械Passで代替しない。Evidenceは素材Identity、許可文言の確認先、判断者、用途、対象版、収載状態を保持する。

## 追加試験種別の適用

| 種別 | 適用 | 確認する範囲 | 実行許可 | 未実行時の扱い |
|---|---|---|---|---|
| RT | Required | 変更した意味と利用側から、再実行する既存Local Itemを選ぶ | Changeの通常検証範囲 | 未選択の範囲を明示し、選択した回帰の結果で評価する |
| PT | N/A | 現在のQuality Contractに性能成立条件がないため非該当 | N/A | 未実行をPassへ読み替えず、明示的なRelease条件でない限り通常監査を停止しない |
| LT | N/A | 現在のQuality Contractに長時間成立条件がないため非該当 | N/A | 未実行をPassへ読み替えず、明示的なRelease条件でない限り通常監査を停止しない |

## UI／SPEC Detailからの観測条件

Source Definition由来の検証義務を維持し、Detailは具体的な観測境界として同じ検証目標へ統合する。

| Detail Source | Source Definition | 追加する観測条件 | 処置 |
|---|---|---|---|
| [SCR-000019／PRT-000019](../../../04_UI/Details/Areas/project-context/SCR-000019/screen.md) | UI-000019 | 情報、操作、Feedback、状態、失敗、Unknownおよび回復をScreen／Part境界で観測する | Mapped |
| [BHV-000024](../../../05_SPEC/Details/BHV-000024/behavior.md) | SPEC-000024 | Trigger、Authority、Validation、State、Effect、Result、FailureおよびRecoveryをBehavior境界で観測する | Mapped |

担当Interaction Relation: `PRT-000019.spec-000024`

全数Coverageと試験段階の扱いは[UI／SPEC DetailのQuality分析](../../Analysis/Detail/quality_analysis.md)を中央統合投影とし、本定義は上記Relationの検証責務を局所所有する。

## Checklist

- [x] Quality ID、検証目標およびSource固有条件を自己完結して示した
- [x] 各Local ItemをRequired Verification Obligationの局所参照と導出元へ接続した
- [x] UT／IT／ST／UATの適用または理由付きN/Aを記録した
- [x] 外部境界の直接、隣接1 block、関連2 blocks、System／E2Eおよび利用者受入を適用判定した
- [x] 正常、境界、準正常、異常および回復をLocal Itemで処置した
- [x] 各Local Itemで観測とOracleを分けた
- [x] 各Local ItemのEvidence要件を示した
- [x] 事前条件、刺激、終了後条件、cleanupおよびRecoveryを必要な範囲で示した
- [x] RT／PT／LTの適用または理由付きN/Aを記録し、PT／LTは人間の明示指定なしに実行しない
- [x] 自動化、手動確認および人間判断の境界を示した
- [x] 現行Source、TestおよびEvidenceとの照合をReality Auditへ分離した
