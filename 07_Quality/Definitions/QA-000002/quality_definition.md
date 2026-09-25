# QA-000002 変更と品質状態の検証定義

成果物種別: Quality定義
Quality ID: `QA-000002`
検証目標: 同じ固定改訂版に対する確認、是正、根拠および現在のGateが矛盾なく統合されること
主な試験段階: Integration／System／User Acceptance
状態: Canonical
維持責任者: Qual-Lab

## 1. 情報源と網羅条件

| Source ID | Obligation Key | 導出元 | 保持する固有条件 | 試験段階 | 対応Local Item |
|---|---|---|---|---|
| [REQ-000026](../../../01_Discovery/Definitions/REQ-000026/requirement.md) | `req-000026.qa-000002` | Requirement Definition（成立条件・失敗・検証意図） | 変更意味から正本、利用側、反証、必要監査を着手前に特定する。複数指摘を編集先と試験へ全数対応し、修正前に方針整合する。修正後に同型問題を反証し、現在必要な人間判断だけを影響付きで提示する。複数利用側と複数監査を持つ変更で、未対応指摘、同型漏れ、合意未試験、人間判断の有無を観測する | IT／ST／UAT | `CQS-IT-004`、`CQS-IT-001`、`CQS-ST-005`、`CQS-UAT-006` |
| [REQ-000030](../../../01_Discovery/Definitions/REQ-000030/requirement.md) | `req-000030.qa-000002` | Requirement Definition（成立条件・失敗・検証意図） | 各試験段階の責務と重複しない完成主張を定義する。外部境界は正常系から取消、清掃、回復まで実環境で観測する。変更意味から成立済み機能と回帰対象を選び、最終E2Eを最初の結合にしない。局所、外部単体、一連の状態変化、隣接1～2 Block、公開入口の順に故障を注入し、発見段階と診断可能性を観測する | IT／ST／UAT | `CQS-IT-002`、`CQS-IT-003`、`CQS-ST-005`、`CQS-UAT-007` |
| [REQ-000033](../../../01_Discovery/Definitions/REQ-000033/requirement.md) | `req-000033.qa-000002` | Requirement Definition（成立条件・失敗・検証意図） | Roadmap、Change、リリース、根拠、品質の責務と正本を一意に説明できる。リリース状態変更がOverview、CHANGELOG、品質、Roadmap等へ同時に伝播する。根拠から対象改訂版、結果、所有CHG／リリースを追跡できる。候補から公開済みへの移行、CHGの完了、根拠追加、品質再評価を行い、すべての表示、リンク、責任者、旧表示の残存を観測する | IT／ST／UAT | `CQS-IT-001`、`CQS-IT-002`、`CQS-ST-005`、`CQS-UAT-006` |
| [UX-000023](../../../02_UX/Definitions/UX-000023/ux_definition.md) | `ux-000023.qa-000002` | UX Definition（利用者成果・重要場面・重要な失敗） | 合意した条件、適用先、反証、未処置および現在必要な人間判断を一つの改訂版で理解して収束できる。重要場面「再レビューへ固定候補を渡す直前」で、避ける失敗を利用者が正常状態や完了として誤認しない。入口、実装または利用主体が変わっても、この利用者成果の意味を維持する。指摘の小出し適用、解消済み判断の再要求および一部是正の完成表示を反証する | IT／ST／UAT | `CQS-IT-004`、`CQS-IT-001`、`CQS-ST-005`、`CQS-UAT-006` |
| [UX-000026](../../../02_UX/Definitions/UX-000026/ux_definition.md) | `ux-000026.qa-000002` | UX Definition（利用者成果・重要場面・重要な失敗） | 各試験層が確認したこと・未確認範囲・時間や費用を理解し、必要な検証と高負荷試験の実行有無を選べる。重要場面「外部境界を結合する各段階」で、避ける失敗を利用者が正常状態や完了として誤認しない。入口、実装または利用主体が変わっても、この利用者成果の意味を維持する。一部Passからの全体品質推定、単発成功だけの一連の状態変化保証および未指示の高負荷実行を反証する | IT／ST／UAT | `CQS-IT-004`、`CQS-IT-002`、`CQS-ST-005`、`CQS-UAT-007` |
| [UX-000029](../../../02_UX/Definitions/UX-000029/ux_definition.md) | `ux-000029.qa-000002` | UX Definition（利用者成果・重要場面・重要な失敗） | 未完了、変更理由、全影響パス、成立根拠および現在品質を役割の違いとともに辿れる。重要場面「変更の影響漏れを確認する場面」で、避ける失敗を利用者が正常状態や完了として誤認しない。入口、実装または利用主体が変わっても、この利用者成果の意味を維持する。責任者の混同、代表パスだけの表示、根拠の遡及上書きおよびGit差分への丸投げを反証する | IT／ST／UAT | `CQS-IT-002`、`CQS-IT-004`、`CQS-ST-005`、`CQS-UAT-006` |
| [IA-000016](../../../03_IA/Definitions/IA-000016/ia_definition.md) | `ia-000016.qa-000002` | IA Definition（情報・関係・状態・見つけ方） | 作業の意図、変更対象、指摘、是正、検証、現在品質を一つの改訂版で辿る。UX-000023: 固定済み（fixed）／レビュー中（under_review）／是正必要（changes_required）／確認済み（verified）／判断必要（decision_required）。UX-000026: 計画済み（planned）／未実行（not_executed）／合格（passed）／失敗（failed）／停止（blocked）／非該当（not_applicable）。UX-000029: 計画済み（planned）／進行中（in_progress）／確認済み（verified）／公開済み（released）と品質状態を別にする | IT／ST／UAT | `CQS-IT-001`、`CQS-IT-002`、`CQS-IT-004`、`CQS-ST-005`、`CQS-UAT-006`、`CQS-UAT-007` |
| [IA-000021](../../../03_IA/Definitions/IA-000021/ia_definition.md) | `ia-000021.qa-000002` | IA Definition（情報・関係・状態・見つけ方） | 過去の仮説・判断・学びと現在有効な意図を区別し、古い前提を現在値として利用せず、いま必要な情報を選ぶ。UX-000025: 現在有効（current）／履歴（historical）／置換済み（superseded）／不明（unknown） | IT／ST／UAT | `CQS-IT-001`、`CQS-IT-002`、`CQS-ST-005`、`CQS-UAT-006` |
| [UI-000015](../../../04_UI/Definitions/UI-000015/ui_definition.md) | `ui-000015.qa-000002` | UI Definition（認識・操作・Feedback・失敗表示） | 同じ改訂版上で指摘、是正、試験、品質状態を辿れる。UX-000023: 監査合意から是正・反証までを一つの改訂版で閉じる: 再レビューへ固定候補を渡す直前: 合意事項と試験を全数対応させる: 一部是正や監査回数を完成と誤認する。UX-000026: 試験層ごとの保証と未確認範囲を理解する: 外部境界を結合する各段階: 開始から清掃まで段階的に反証する: 単発成功や試験件数から一連の状態変化全体を保証する。UX-000029: 作業・変更・根拠・品質を役割別に辿る: 変更の影響漏れを確認する場面: 正本を分け全影響ファイルを列挙する: 同じ説明を複製し代表ファイルだけで済ませる。UX-000023／IA-000016: 固定済み（fixed）／レビュー中（under_review）／是正必要（changes_required）／確認済み（verified）／判断必要（decision_required）: 固定版→監査集合→統合方針→是正→再固定→判断。UX-000026／IA-000016: 計画済み（planned）／未実行（not_executed）／合格（passed）／失敗（failed）／停止（blocked）／非該当（not_applicable）: 変更→不確実性→試験層→実行結果→現在保証。UX-000029／IA-000016: 計画済み（planned）／進行中（in_progress）／確認済み（verified）／公開済み（released）と品質状態を別にする: Roadmap→Change→対象ファイル→Evidence→Quality→Release | IT／ST／UAT | `CQS-IT-001`、`CQS-IT-004`、`CQS-IT-002`、`CQS-ST-005`、`CQS-UAT-006`、`CQS-UAT-007` |
| [SPEC-000020](../../../05_SPEC/Definitions/SPEC-000020/spec_definition.md) | `spec-000020.qa-000002` | SPEC Definition（正常・境界・失敗・観測不能・副作用） | 正常: 未実施・非該当・失敗・Passを区別し、人間判断が残る場合だけ提示する。境界: 未実施／非該当／失敗／Pass、現改訂版／旧改訂版を分け、一部結果を全体Passへ広げない。失敗: 試験件数や一部監査完了から全体Passを推定しない。観測不能: 不明を正常・不存在・完了へ丸めず、実際の副作用「評価記録は更新できるが、Pass表示から統合・Release Effectを自動発行しない」と矛盾する結果を返さない。失敗: 試験件数や一部監査完了から全体Passを推定しない。副作用: 評価記録は更新できるが、Pass表示から統合・Release Effectを自動発行しない。本SPEC固有の回復経路は設けず、失敗理由と安全な戻り先を返す | IT／ST／UAT | `CQS-IT-004`、`CQS-IT-002`、`CQS-ST-005`、`CQS-UAT-006` |
| [ARCH-000003](../../../06_Architecture/Definitions/ARCH-000003/architecture_definition.md) | `arch-000003.qa-000002` | Architecture Definition（責務・境界・状態・故障） | レビュー件数や試験件数を品質へ読み替えず、同じ固定改訂版に対する必須確認がすべて終わった時だけ工程状態を更新する。所有する責務: 同じ改訂版に対する指摘、是正、試験Evidence、未確認範囲、現在Gateの統合。所有しない責務: 各監査の専門判断、リスク受容、Release判断。主な外部境界: CHG、監査結果、試験結果、Quality Center。SPEC-000020: 試験件数や一部監査完了から全体Passを推定しない。Effect: 評価記録は更新できるが、Pass表示から統合・Release Effectを自動発行しない。入力SPECが固有Recoveryを定義しない場合、Architectureから追加しない。結果には最後に確認できた状態、観測時点、不足および次の安全な行動を、入力契約が必要とする範囲で含める | IT／ST／UAT | `CQS-IT-001`、`CQS-IT-004`、`CQS-IT-002`、`CQS-ST-005`、`CQS-UAT-006` |
### Architecture詳細設計入力

| 詳細設計領域 | 受け取る成立条件 |
|---|---|
| [quality-change-control](../../../06_Architecture/Details/quality-change-control/01_Architecture.md) | 固定改訂版、指摘、是正、Evidence、現在Gateの閉包 |
| [verification-runner](../../../06_Architecture/Details/verification-runner/01_Architecture.md) | Catalog closure、段階実行、資源集約試験のAuthorityおよび未実行理由の保持 |

## 2. 成立の流れ

```text
[対象と必須確認を固定]
          ↓
[すべての結果を同じ改訂版に結合]
          ↓
[是正または人間判断]
          ↓
[新しい改訂版を再確認]
          ↓
[現在の品質状態を投影]
```

## 3. 試験段階と外部境界の適用

| 試験段階 | 適用 | 確認する範囲 | 外部境界の到達範囲 | 判断理由 |
| --- | --- | --- | --- | --- |
| UT | Conditional | 状態集約とFreshness判定の純粋規則 | N/A | 独立した判定責務がある場合に確認する |
| IT | Required | Change、監査結果、Evidence、Quality Center間の関係、Test CatalogからOwner Runnerへの解決および段階実行の結果集約 | Related 2 Blocks | 隣接境界に加え、段階実行から結果集約までの二境界を確認するため |
| ST | Required | Release候補全体のGate統合 | System/E2E | 複数工程の結果を一つの完成表示へ誤って畳まないことを確認するため |
| UAT | Required | 人間が残存Riskと現在Gateを判断する場面 | User Acceptance | 人間が未確認範囲と残存Riskを理解して判断できることを確認するため |

### 条件区分の適用

| 条件区分 | 適用 | 対応Local Item | 判断理由 |
|---|---|---|---|
| 正常 | Required | CQS-IT-001 | 通常の成立経路を独立して確認する。 |
| 境界 | Required | CQS-ST-005、CQS-UAT-006、CQS-UAT-007、CQS-IT-008、CQS-ST-008、CQS-UT-010、CQS-IT-011、CQS-IT-013、CQS-ST-013 | 値、Authority、情報、責務または利用者判断の境界を確認する。 |
| 準正常 | N/A | - | 継続可能な分岐または保留状態を持たない。 |
| 異常 | Required | CQS-IT-002、CQS-IT-003、CQS-IT-004、CQS-IT-012、CQS-ST-012 | 不正入力、故障または拒否経路を通常成功へ畳まない。 |
| 回復 | Required | CQS-IT-009、CQS-ST-009 | 失敗・取消後に同じIdentityと義務で安全に再入場できることを確認する。 |

## 4. 検証項目

| Local ID | 条件区分 | 試験段階 | 試験種別 | 対象／境界 | 外部境界の段階 | 事前状態／入力 | 操作／刺激 | 観測 | Oracle | Evidence | 終了後条件 | 実行形態 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `CQS-IT-001` | 正常 | IT | Traceability／Review | Change・監査・Evidence・Quality Center。外部実行境界なし | N/A | 同一改訂版、固定済み必須確認集合、各確認結果と残存Risk | 全結果を現在Gateへ統合し、独立レビューで判断先を確認する | CQS-IT-001として、「全結果を現在Gateへ統合し、独立レビューで判断先を確認する」前後のChange・監査・Evidence・Quality Center。外部実行境界なしについて、入力差分、判定結果、欠落・重複・不一致および理由codeを記録する | 結果、未確認、残存Risk、判断先が現在Gateと一致 | CQS-IT-001、固定入力「同一改訂版、固定済み必須確認集合、各確認結果と残存Risk」、観測した差分と理由code、Oracle判定「結果、未確認、残存Risk、判断先が現在Gateと一致」および終了後条件「未解消状態と残存Effect／資源を評価へ引き渡す」を保存する | 未解消状態と残存Effect／資源を評価へ引き渡す | Hybrid |
| `CQS-IT-002` | 異常 | IT | Freshness／Regression | 現在状態Projector。外部実行境界なし | N/A | 現行改訂版の未完了結果と、別改訂版のPass結果 | 古いPassを現行結果へ混入して評価する | CQS-IT-002として、「古いPassを現行結果へ混入して評価する」前後の現在状態Projector。外部実行境界なしについて、入力差分、判定結果、欠落・重複・不一致および理由codeを記録する | 古い根拠をFreshとせず、要再確認とする | CQS-IT-002、固定入力「現行改訂版の未完了結果と、別改訂版のPass結果」、観測した差分と理由code、Oracle判定「古い根拠をFreshとせず、要再確認とする」および終了後条件「未解消状態と残存Effect／資源を評価へ引き渡す」を保存する | 未解消状態と残存Effect／資源を評価へ引き渡す | Automated |
| `CQS-IT-003` | 異常 | IT | Closure／Audit | 監査集合とGate集約。外部実行境界なし | N/A | 開始済み必須監査集合と、一部だけ完了した結果 | 必須監査集合を縮小して完了判定を要求する | CQS-IT-003として、「必須監査集合を縮小して完了判定を要求する」前後の監査集合とGate集約。外部実行境界なしについて、入力差分、判定結果、欠落・重複・不一致および理由codeを記録する | 完了とせず、元の母集団と未完了項目を保持 | CQS-IT-003、固定入力「開始済み必須監査集合と、一部だけ完了した結果」、観測した差分と理由code、Oracle判定「完了とせず、元の母集団と未完了項目を保持」および終了後条件「未解消状態と残存Effect／資源を評価へ引き渡す」を保存する | 未解消状態と残存Effect／資源を評価へ引き渡す | Automated |
| `CQS-IT-004` | 異常 | IT | Revision／Regression | 改訂版別結果とGate集約。外部実行境界なし | N/A | 一部項目だけのPass、または是正前改訂版の結果 | 全体Passまたは是正後Passとして評価を要求する | CQS-IT-004として、「全体Passまたは是正後Passとして評価を要求する」前後の改訂版別結果とGate集約。外部実行境界なしについて、入力差分、判定結果、欠落・重複・不一致および理由codeを記録する | 全体Passを生成せず、新しい改訂版の確認を要求 | CQS-IT-004、固定入力「一部項目だけのPass、または是正前改訂版の結果」、観測した差分と理由code、Oracle判定「全体Passを生成せず、新しい改訂版の確認を要求」および終了後条件「未解消状態と残存Effect／資源を評価へ引き渡す」を保存する | 未解消状態と残存Effect／資源を評価へ引き渡す | Automated |
| `CQS-ST-005` | 境界 | ST | Gate／System | 全工程結果→現在品質→Release候補表示 | System/E2E | Pass、未実施、非該当、失敗、停止、旧改訂版の結果を含む候補 | 候補全体の現在Gateを生成する | CQS-ST-005として、「候補全体の現在Gateを生成する」前後の全工程結果→現在品質→Release候補表示について、Identity、phase／state遷移、結果field、Effect発行回数、資源残存数および失敗理由を記録する | 必須確認が揃わない限り全体Passとせず、未完了と根拠を示す | CQS-ST-005、固定した改訂版・環境・入力Identity、phase／state遷移、結果field、Effect／資源件数、Oracle判定「必須確認が揃わない限り全体Passとせず、未完了と根拠を示す」および終了後条件「Release Effect 0」を保存する。Secret、鍵bytes、passphrase、生Provider出力および絶対Pathは保存しない | Release Effect 0 | Automated |
| `CQS-UAT-006` | 境界 | UAT | Acceptance／Decision | 現在Gate→人間判断 | User Acceptance | 残存Risk、未確認範囲、旧根拠を含む現在品質表示 | 人間が受容・是正・保留を判断する | CQS-UAT-006として、利用者の選択、判断理由、参照した根拠、理解できなかった項目および未判断範囲を記録する | 判断に必要な不足と影響を理解でき、解消済み事項を再要求しない | CQS-UAT-006、固定した参加条件と入力、利用者の選択・理由・参照根拠、未判断範囲、Oracle判定「判断に必要な不足と影響を理解でき、解消済み事項を再要求しない」および終了後条件「人間判断なしの統合・Release Effect 0」を保存する | 人間判断なしの統合・Release Effect 0 | Manual |
| `CQS-UAT-007` | 境界 | UAT | Acceptance／Test Planning | 試験段階・費用・時間・未確認範囲→利用者判断 | User Acceptance | UT／IT／ST／UATの保証範囲、未確認範囲、実行時間・費用、PT／LT候補と上限 | 利用者が追加検証とPT／LTを実行するか判断する | CQS-UAT-007として、利用者の選択、判断理由、参照した根拠、理解できなかった項目および未判断範囲を記録する | 一部Passを全体保証へ広げず、PT／LTは対象・上限・中止条件・清掃を明示した場合だけ選べる | CQS-UAT-007、固定した参加条件と入力、利用者の選択・理由・参照根拠、未判断範囲、Oracle判定「一部Passを全体保証へ広げず、PT／LTは対象・上限・中止条件・清掃を明示した場合だけ選べる」および終了後条件「未承認のPT／LT・外部Effect 0」を保存する | 未承認のPT／LT・外部Effect 0 | Manual |

| `CQS-IT-008` | 境界 | IT | Audit Set／Revision Closure | Change→必須監査集合→Quality Center→Release Gate | Related 2 Blocks | 同一改訂版の全必須監査結果と、一部欠落・別改訂版・途中縮小反例 | Gateへ監査集合を統合する | 監査集合、対象改訂版、各結果、欠落とGate判定を記録する | 全必須結果が同じ改訂版に属する場合だけGateが成立する | 改訂版、監査集合、各結果、判定 | 未処置必須監査0、別改訂版混入0 | Automated |
| `CQS-ST-008` | 境界 | ST | Audit Set／Release Gate Closure | Change全体→全必須監査→Quality Center→Release Gate | System/E2E | 完了・未完了・別改訂版を含む全監査集合とRelease候補 | 同じ固定改訂版の監査集合をRelease Gateへ統合する | 全監査Identity、改訂版、現在状態、未確認範囲とGate表示を記録する | 必須監査の欠落・途中縮小・別改訂版混入が一つでもあればRelease可能と表示しない | 固定改訂版、監査集合、Gate表示と反証結果 | 未処置必須監査0、別改訂版混入0、Release Effect 0 | Automated |
| `CQS-IT-009` | 回復 | IT | Remediation Re-entry | 指摘→是正→新改訂版→再レビュー | Adjacent 1 Block | 旧Pass、是正差分、新改訂版、必要監査集合 | 新改訂版を固定し必要監査を再実行する | 旧結果、新結果、改訂版、再実行集合を記録する | 旧結果を流用せず新改訂版の結果だけで解消判定する | 改訂版、再実行集合、結果、判定 | 旧結果による現行Pass 0 | Automated |
| `CQS-ST-009` | 回復 | ST | Remediation Re-entry Lifecycle | 指摘→是正→新固定改訂版→必須監査再実行→現在Gate | System/E2E | 旧Pass、是正前後の改訂版、必要監査集合および再実行結果 | 是正後の新固定改訂版だけで監査集合と現在Gateを再構築する | 旧結果の隔離、新結果、未完了監査、現在GateとRelease Effectを記録する | 旧Passを流用せず、新固定改訂版の全必須監査が完了するまでRelease可能と表示しない | 旧・新改訂版、全監査結果、現在Gateと反証結果 | 旧結果による現行Pass 0、未完了時Release Effect 0 | Automated |
| `CQS-UT-010` | 境界 | UT | Catalog Closure | Test CatalogとOwner／Path／Level | N/A | 宣言済み試験、実在試験、Owner、Path、Levelと欠落反例 | Catalogと実在集合を比較する | 宣言集合、実在集合、Owner、Level、差分を記録する | 未登録、重複、Owner／Path／Level不一致が0である | Catalog、実在集合、差分、判定 | Source／Catalog変更0 | Automated |
| `CQS-IT-011` | 境界 | IT | Runner Catalog Boundary | Test Catalog→Owner Runner | Adjacent 1 Block | Catalog項目、Portable／Host Windows分類、対応Owner Runner、未知分類・未知Owner反例 | Catalog項目を実行環境ProfileとOwner Runnerへ一意に解決する | 解決Profile、Owner、実行対象、拒否理由を記録する | Portable入口がHost Effectを開始せず、全Host項目が明示的なHost入口だけへ一意に解決される | Catalog項目、Profile、Owner、解決結果、判定 | 未分類・未解決項目0、Portable入口のHost Effect 0 | Automated |
| `CQS-IT-012` | 異常 | IT | Stage Execution | Verification Runner→段階実行→結果集約 | Related 2 Blocks | 宣言順、先行失敗、部分成功、後続禁止を含む固定計画 | 計画を段階実行し全結果を集約する | 開始・終了順、各結果、未開始段階、全体判定を記録する | 先行失敗後に禁止された後続を開始せず部分成功を全体Passへ畳まない | 計画、実行順、全結果、判定 | 未許可後続Effect 0 | Automated |
| `CQS-ST-012` | 異常 | ST | Stage Execution Closure | 公開Verification入口→全段階Runner→統合結果 | System/E2E | Static、UT、IT、ST、UATを含む固定計画と先行失敗反例 | 公開入口から段階計画を実行し、未開始を含む全結果を取得する | 各Runnerの開始・終了、未開始理由、統合状態、公開結果と残存資源を記録する | 先行失敗後の禁止段階を開始せず、公開結果が部分成功を全体Passへ畳まない | 固定計画、全段階結果、公開結果と反証結果 | 未許可後続Effect 0、子Process・一時資源0 | Automated |
| `CQS-IT-013` | 境界 | IT | Resource-intensive Gate | 検証要求→人間許可→Runner | Direct Boundary | PT／LT候補、目的、環境、時間、回数、費用、停止・清掃条件 | 許可の有無と範囲をGateで判定する | 許可主体、範囲、上限、拒否理由、Process開始有無を記録する | 明示許可と全上限が揃う場合だけ対象Processを開始する | 許可入力、範囲、Process Effect、判定 | 未許可Process Effect 0 | Automated |
| `CQS-ST-013` | 境界 | ST | Resource-intensive Gate Closure | 公開Verification入口→人間許可Gate→PT／LT Runner | System/E2E | 未許可、項目不足、範囲超過を含む固定要求。実PT／LTは実行しない | 公開入口からGate判定までを実行し、Runner Effectの有無を確認する | 許可入力、拒否理由、選択段階、Process Effectと公開結果を記録する | 未許可または必須上限不足ではPT／LT Runnerを開始せず、通常回帰をPT／LT実施済みと表示しない | 固定要求、Gate判定、Process Effectと反証結果 | 未承認PT／LT Process Effect 0 | Automated |

## 5. 評価・根拠・終了後条件

- Pass: 固定した母集団の全結果が同じ改訂版へ結合し、必要な人間判断が残っていない。
- Blocked: 必須結果、改訂版、根拠の適用可否または判断権限が不明。
- Evidence: 固定対象、必須確認集合、結果、是正後の新しい改訂版、未確認、現在Gateを分けて保持。
- 終了後: 過去Evidenceは書き換えず、現在状態は適用可能な結果から導出する。

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
| [SCR-000015／PRT-000015](../../../04_UI/Details/Areas/governance/SCR-000015/screen.md) | UI-000015 | 情報、操作、Feedback、状態、失敗、Unknownおよび回復をScreen／Part境界で観測する | Mapped |
| [BHV-000020](../../../05_SPEC/Details/BHV-000020/behavior.md) | SPEC-000020 | Trigger、Authority、Validation、State、Effect、Result、FailureおよびRecoveryをBehavior境界で観測する | Mapped |

担当Interaction Relation: `PRT-000015.spec-000020`

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
