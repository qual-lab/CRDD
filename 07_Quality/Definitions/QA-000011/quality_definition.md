# QA-000011 公式素材の権利と用途の検証定義

成果物種別: Quality定義
Quality ID: `QA-000011`
検証目標: 公式Repositoryへ収載する素材の出所、権利確認、許可用途、対象版および決定権限を追跡できること
主な試験段階: Unit／Integration／User Acceptance
状態: Canonical
維持責任者: Qual-Lab

## 1. 情報源と網羅条件

| Source ID | Obligation Key | 導出元 | 保持する固有条件 | 試験段階 | 対応Local Item |
|---|---|---|---|---|
| [REQ-000035](../../../01_Discovery/Definitions/REQ-000035/requirement.md) | `req-000035.qa-000011` | Requirement Definition（成立条件・失敗・検証意図） | 素材の識別用途と、署名・準拠・品質保証を明確に分ける。収載、公開、再配布の権利確認と判断主体を追跡できる。原本と利用向け派生物の責任者、生成関係を確認できる。公式／非公式表示、権利記録欠落、派生物追加、保証表現を確認し、識別と誤認防止を観測する | ST／UAT | `OAG-UAT-001`、`OAG-ST-003` |
| [UX-000030](../../../02_UX/Definitions/UX-000030/ux_definition.md) | `ux-000030.qa-000011` | UX Definition（利用者成果・重要場面・重要な失敗） | 公式素材の出所・原本・派生物・利用条件を確認し、許可された用途で安心して収載・再利用できる。重要場面「公式用途へ採用する直前」で、避ける失敗を利用者が正常状態や完了として誤認しない。入口、実装または利用主体が変わっても、この利用者成果の意味を維持する。見た目からの信頼保証推定、権利不明素材の収載および用途外再配布を反証する | UAT | `OAG-UAT-001`、`OAG-UAT-004` |
| [IA-000019](../../../03_IA/Definitions/IA-000019/ia_definition.md) | `ia-000019.qa-000011` | IA Definition（情報・関係・状態・見つけ方） | 公式素材を、見た目ではなく由来・権利・許可用途を確認して利用する。UX-000030: 候補（candidate）／採用済み（approved）／開示制限（restricted）／取下げ済み（withdrawn） | ST／UAT | `OAG-UAT-001`、`OAG-ST-003` |
| [UI-000019](../../../04_UI/Definitions/UI-000019/ui_definition.md) | `ui-000019.qa-000011` | UI Definition（認識・操作・Feedback・失敗表示） | 素材の由来と許可された用途を確認して安心して使える。UX-000030: 視覚素材の出所・権利・用途を確認する: 公式用途へ採用する直前: 由来・権利・用途を追跡する: 見た目だけで権利や信頼保証を推定する。UX-000030／IA-000019: 候補（candidate）／採用済み（approved）／開示制限（restricted）／取下げ済み（withdrawn）: 素材→由来→権利→用途→収載・派生 | UAT | `OAG-UAT-001`、`OAG-UAT-002` |
| [SPEC-000024](../../../05_SPEC/Definitions/SPEC-000024/spec_definition.md) | `spec-000024.qa-000011` | SPEC Definition（正常・境界・失敗・観測不能・副作用） | 正常: 確認済み・未確認・利用不可を区別し、許可範囲へ戻れる。境界: 由来・権利・用途が確認済み／未確認／利用不可を分け、許可用途を拡張しない。失敗: 生成手段だけで権利を推定せず、用途外利用を許可しない。観測不能: 不明を正常・不存在・完了へ丸めず、実際の副作用「由来・権利・許可用途・判断者を同じ素材へ記録する。実際の収載・配布は別の変更・Release Authorityを必要とする」と矛盾する結果を返さない。失敗: 生成手段だけで権利を推定せず、用途外利用を許可しない。副作用: 由来・権利・許可用途・判断者を同じ素材へ記録する。実際の収載・配布は別の変更・Release Authorityを必要とする。本SPEC固有の回復経路は設けず、失敗理由と安全な戻り先を返す | UAT | `OAG-UAT-001`、`OAG-UAT-002`、`OAG-UAT-004` |
| [ARCH-000017](../../../06_Architecture/Definitions/ARCH-000017/architecture_definition.md) | `arch-000017.qa-000011` | Architecture Definition（責務・境界・状態・故障） | candidate／approved／restricted／withdrawnを区別し、生成手段や見た目だけから公開・再配布権を推定しない。所有する責務: 素材の出所、権利確認、許可用途、対象版、決定権限者の記録。所有しない責務: 法的判断の自動化、確認だけからの収載・再配布、用途外利用。主な外部境界: 素材提供者、決定権限者、公式Repository、公開成果物。SPEC-000024: 生成手段だけで権利を推定せず、用途外利用を許可しない。Effect: 由来・権利・許可用途・判断者を同じ素材へ記録する。実際の収載・配布は別の変更・Release Authorityを必要とする。入力SPECが固有Recoveryを定義しない場合、Architectureから追加しない。結果には最後に確認できた状態、観測時点、不足および次の安全な行動を、入力契約が必要とする範囲で含める | IT／ST／UAT | `OAG-UAT-001`、`OAG-UAT-002`、`OAG-ST-003`、`OAG-IT-005` |
### Architecture詳細設計入力

| 詳細設計領域 | 受け取る成立条件 |
|---|---|
| [official-asset-governance](../../../06_Architecture/Details/official-asset-governance/01_Architecture.md) | 出所、権利、用途、収載・再配布Authority |

## 2. 試験段階と外部境界の適用

| 試験段階 | 適用 | 確認する範囲 | 外部境界の到達範囲 | 判断理由 |
| --- | --- | --- | --- | --- |
| UT | Required | 同一素材Revisionへの競合判断を上書きしない純粋な比較規則 | N/A | 人間判断の前提となるRevision競合を局所規則として反証するため |
| IT | Required | 素材Identity、出所、許可、対象版、収載先および同時判断の関係 | Direct Boundary | Repository成果物間の関係と、同一改訂版へ競合する判断を保存する直接境界を確認するため |
| ST | Conditional | 収載から公開・再配布までの運用経路 | System/E2E | 実際の公開経路を対象にする場合に必要 |
| UAT | Required | 決定権限者による許可範囲と収載判断 | User Acceptance | 権利と公開判断を自動判定へ置換しないため |

### 条件区分の適用

| 条件区分 | 適用 | 対応Local Item | 判断理由 |
|---|---|---|---|
| 正常 | Required | OAG-UAT-001、OAG-IT-005 | 通常の成立経路を独立して確認する。 |
| 境界 | Required | OAG-IT-006、OAG-IT-007、OAG-UT-008 | 値、Authority、情報、責務または利用者判断の境界を確認する。 |
| 準正常 | Required | OAG-UAT-004 | 継続可能な分岐、保留、観測不能または診断状態を成功へ畳まない。 |
| 異常 | Required | OAG-UAT-002、OAG-ST-003 | 不正入力、故障または拒否経路を通常成功へ畳まない。 |
| 回復 | N/A | - | 失敗後の再入場または回復義務を持たない。 |

## 3. 検証項目

| Local ID | 条件区分 | 試験段階 | 試験種別 | 対象／境界 | 外部境界の段階 | 事前状態／入力 | 操作／刺激 | 観測 | Oracle | Evidence | 終了後条件 | 実行形態 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `OAG-UAT-001` | 正常 | UAT | Governance／Acceptance | 素材候補→決定権限者→公式収載 | User Acceptance | 素材Identity、出所、権利確認、許可用途、対象版、収載判断Authority | 決定権限者が許可範囲を確認し収載を判断する | OAG-UAT-001として、利用者の選択、判断理由、参照した根拠、理解できなかった項目および未判断範囲を記録する | 同じ素材Identityに結合し、許可された用途と版だけに収載 | OAG-UAT-001、固定した参加条件と入力、利用者の選択・理由・参照根拠、未判断範囲、Oracle判定「同じ素材Identityに結合し、許可された用途と版だけに収載」および終了後条件「候補と収載済みの状態を区別」を保存する | 候補と収載済みの状態を区別 | Hybrid |
| `OAG-UAT-002` | 異常 | UAT | Governance／Rights | 不完全な素材候補→決定権限者 | User Acceptance | 生成手段だけが既知、権利未確認、第三者模倣疑義の各素材候補 | 各候補の公式収載を要求する | OAG-UAT-002として、利用者の選択、判断理由、参照した根拠、理解できなかった項目および未判断範囲を記録する | 生成手段から権利を推定せず、候補を隔離 | OAG-UAT-002、固定した参加条件と入力、利用者の選択・理由・参照根拠、未判断範囲、Oracle判定「生成手段から権利を推定せず、候補を隔離」および終了後条件「公式収載Effect 0」を保存する | 公式収載Effect 0 | Hybrid |
| `OAG-ST-003` | 異常 | ST | Distribution／Revocation | 収載済み素材→公開・再配布経路 | System/E2E | 収載済み素材と、用途拡張・対象外Version・許可撤回の各状態 | 各状態で素材の再利用・再配布を要求する | OAG-ST-003として、「各状態で素材の再利用・再配布を要求する」前後の収載済み素材→公開・再配布経路について、Identity、phase／state遷移、結果field、Effect発行回数、資源残存数および失敗理由を記録する | 再利用を拒否し、影響する収載先と公開物を特定 | OAG-ST-003、固定した改訂版・環境・入力Identity、phase／state遷移、結果field、Effect／資源件数、Oracle判定「再利用を拒否し、影響する収載先と公開物を特定」および終了後条件「新規配布Effect 0」を保存する。Secret、鍵bytes、passphrase、生Provider出力および絶対Pathは保存しない | 新規配布Effect 0 | Hybrid |
| `OAG-UAT-004` | 準正常 | UAT | Governance／Unknown | 不完全な素材候補→決定権限者 | User Acceptance | 権利者、許可文言、判断者または対象版が不明な素材候補 | 不足状態のまま収載判断を要求する | OAG-UAT-004として、利用者の選択、判断理由、参照した根拠、理解できなかった項目および未判断範囲を記録する | 不足を明示し、判断権限者へ戻す | OAG-UAT-004、固定した参加条件と入力、利用者の選択・理由・参照根拠、未判断範囲、Oracle判定「不足を明示し、判断権限者へ戻す」および終了後条件「候補を変更／削除しない」を保存する | 候補を変更／削除しない | Hybrid |
| `OAG-IT-005` | 正常 | IT | Traceability／Contract | 素材記録→公式収載先 | N/A | 同じ素材Identityに結合した出所、権利確認、許可用途、対象版、判断記録 | 収載候補と公式収載物の関係を照合する | OAG-IT-005として、「収載候補と公式収載物の関係を照合する」前後の素材記録→公式収載先について、入力差分、判定結果、欠落・重複・不一致および理由codeを記録する | 収載物から許可根拠と対象版へ一意に戻れる | OAG-IT-005、固定入力「同じ素材Identityに結合した出所、権利確認、許可用途、対象版、判断記録」、観測した差分と理由code、Oracle判定「収載物から許可根拠と対象版へ一意に戻れる」および終了後条件「外部公開・再配布Effect 0」を保存する | 外部公開・再配布Effect 0 | Automated |
| `OAG-IT-006` | 境界 | IT | Governance／Concurrency | 同一改訂版の素材候補→判断記録→公式収載 | Direct Boundary | 同じ素材Identity・同じ対象Revisionへ異なる収載判断を同時に保存する二要求 | 二判断を同時に確定しようとする | expected Revision、各要求が観測したcurrent Revision、勝者Revision、敗者理由、共有された最終状態、要求別の判断保存・公開Effect回数を記録する | 一方だけをCanonical判断として確定し、競合する判断を上書きせず再評価要求として返す | OAG-IT-006、expected／current／winner Revision、敗者理由、共有最終状態、要求別Effect回数およびOracle判定を保存する。Secret、絶対Pathは保存しない | 同一Revisionに矛盾する採用状態を残さず、公開Effect 0 | Automated |
| `OAG-IT-007` | 境界 | IT | Asset Decision Boundary | Decision Record→Official Asset Store | Direct Boundary | 判断者、用途、対象Revisionの完全・欠落・不一致入力 | 判断記録を公式収載境界へ適用する | 判断主体、用途、Revision、Store Effect、拒否理由を記録する | 全条件が揃う判断だけが一回収載される | 入力、判断記録、Effect、判定 | 不完全判断の収載Effect 0 | Automated |
| `OAG-UT-008` | 境界 | UT | Revision Conflict | Asset DecisionのRevision比較規則 | N/A | 一致、古いRevision、同時判断、silent overwrite反例 | expected Revisionで判断適用可否を評価する | expected／actual Revision、競合、判定を記録する | 一致するRevisionへ一判断だけを許可し競合を上書きしない | 入力Revision、比較結果、判定 | Store Effect 0 | Automated |

## 4. 評価とEvidence

機械検査は入力漏れ、用途外、対象版不一致および撤回後の利用を反証する。権利自体の有効性と法的判断は決定権限者の確認を必要とし、機械Passで代替しない。Evidenceは素材Identity、許可文言の確認先、判断者、用途、対象版、収載状態を保持する。

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
