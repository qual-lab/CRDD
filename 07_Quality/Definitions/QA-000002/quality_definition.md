# QA-000002 変更と品質状態の検証定義

成果物種別: Quality定義
Quality ID: `QA-000002`
検証目標: 同じ固定改訂版に対する確認、是正、根拠および現在のGateが矛盾なく統合されること
主な試験段階: Integration／System／User Acceptance
状態: Canonical
維持責任者: Qual-Lab

## 1. 情報源と網羅条件

| Source ID | 保持する固有条件 | 試験段階 | 対応Local Item |
|---|---|---|---|
| [REQ-000026](../../../01_Discovery/Definitions/REQ-000026/requirement.md) | 変更意味から正本、利用側、反証、必要監査を着手前に特定する。複数指摘を編集先と試験へ全数対応し、修正前に方針整合する。修正後に同型問題を反証し、現在必要な人間判断だけを影響付きで提示する。複数利用側と複数監査を持つ変更で、未対応指摘、同型漏れ、合意未試験、人間判断の有無を観測する | IT／ST／UAT | `CQS-04`、`CQS-01`、`CQS-05`、`CQS-06` |
| [REQ-000030](../../../01_Discovery/Definitions/REQ-000030/requirement.md) | 各試験段階の責務と重複しない完成主張を定義する。外部境界は正常系から取消、清掃、回復まで実環境で観測する。変更意味から成立済み機能と回帰対象を選び、最終E2Eを最初の結合にしない。局所、外部単体、一連の状態変化、隣接1～2 Block、公開入口の順に故障を注入し、発見段階と診断可能性を観測する | IT／ST／UAT | `CQS-02`、`CQS-03`、`CQS-05`、`CQS-07` |
| [REQ-000033](../../../01_Discovery/Definitions/REQ-000033/requirement.md) | Roadmap、Change、リリース、根拠、品質の責務と正本を一意に説明できる。リリース状態変更がOverview、CHANGELOG、品質、Roadmap等へ同時に伝播する。根拠から対象改訂版、結果、所有CHG／リリースを追跡できる。候補から公開済みへの移行、CHGの完了、根拠追加、品質再評価を行い、すべての表示、リンク、責任者、旧表示の残存を観測する | IT／ST／UAT | `CQS-01`、`CQS-02`、`CQS-05`、`CQS-06` |
| [UX-000023](../../../02_UX/Definitions/UX-000023/ux_definition.md) | 合意した条件、適用先、反証、未処置および現在必要な人間判断を一つの改訂版で理解して収束できる。重要場面「再レビューへ固定候補を渡す直前」で、避ける失敗を利用者が正常状態や完了として誤認しない。入口、実装または利用主体が変わっても、この利用者成果の意味を維持する。指摘の小出し適用、解消済み判断の再要求および一部是正の完成表示を反証する | IT／ST／UAT | `CQS-04`、`CQS-01`、`CQS-05`、`CQS-06` |
| [UX-000026](../../../02_UX/Definitions/UX-000026/ux_definition.md) | 各試験層が確認したこと・未確認範囲・時間や費用を理解し、必要な検証と高負荷試験の実行有無を選べる。重要場面「外部境界を結合する各段階」で、避ける失敗を利用者が正常状態や完了として誤認しない。入口、実装または利用主体が変わっても、この利用者成果の意味を維持する。一部Passからの全体品質推定、単発成功だけの一連の状態変化保証および未指示の高負荷実行を反証する | IT／ST／UAT | `CQS-04`、`CQS-02`、`CQS-05`、`CQS-07` |
| [UX-000029](../../../02_UX/Definitions/UX-000029/ux_definition.md) | 未完了、変更理由、全影響パス、成立根拠および現在品質を役割の違いとともに辿れる。重要場面「変更の影響漏れを確認する場面」で、避ける失敗を利用者が正常状態や完了として誤認しない。入口、実装または利用主体が変わっても、この利用者成果の意味を維持する。責任者の混同、代表パスだけの表示、根拠の遡及上書きおよびGit差分への丸投げを反証する | IT／ST／UAT | `CQS-02`、`CQS-04`、`CQS-05`、`CQS-06` |
| [IA-000016](../../../03_IA/Definitions/IA-000016/ia_definition.md) | 作業の意図、変更対象、指摘、是正、検証、現在品質を一つの改訂版で辿る。UX-000023: 固定済み（fixed）／レビュー中（under_review）／是正必要（changes_required）／確認済み（verified）／判断必要（decision_required）。UX-000026: 計画済み（planned）／未実行（not_executed）／合格（passed）／失敗（failed）／停止（blocked）／非該当（not_applicable）。UX-000029: 計画済み（planned）／進行中（in_progress）／確認済み（verified）／公開済み（released）と品質状態を別にする | IT／ST／UAT | `CQS-01`、`CQS-02`、`CQS-04`、`CQS-05`、`CQS-06`、`CQS-07` |
| [IA-000021](../../../03_IA/Definitions/IA-000021/ia_definition.md) | 過去の仮説・判断・学びと現在有効な意図を区別し、古い前提を現在値として利用せず、いま必要な情報を選ぶ。UX-000025: 現在有効（current）／履歴（historical）／置換済み（superseded）／不明（unknown） | IT／ST／UAT | `CQS-01`、`CQS-02`、`CQS-05`、`CQS-06` |
| [UI-000015](../../../04_UI/Definitions/UI-000015/ui_definition.md) | 同じ改訂版上で指摘、是正、試験、品質状態を辿れる。UX-000023: 監査合意から是正・反証までを一つの改訂版で閉じる: 再レビューへ固定候補を渡す直前: 合意事項と試験を全数対応させる: 一部是正や監査回数を完成と誤認する。UX-000026: 試験層ごとの保証と未確認範囲を理解する: 外部境界を結合する各段階: 開始から清掃まで段階的に反証する: 単発成功や試験件数から一連の状態変化全体を保証する。UX-000029: 作業・変更・根拠・品質を役割別に辿る: 変更の影響漏れを確認する場面: 正本を分け全影響ファイルを列挙する: 同じ説明を複製し代表ファイルだけで済ませる。UX-000023／IA-000016: 固定済み（fixed）／レビュー中（under_review）／是正必要（changes_required）／確認済み（verified）／判断必要（decision_required）: 固定版→監査集合→統合方針→是正→再固定→判断。UX-000026／IA-000016: 計画済み（planned）／未実行（not_executed）／合格（passed）／失敗（failed）／停止（blocked）／非該当（not_applicable）: 変更→不確実性→試験層→実行結果→現在保証。UX-000029／IA-000016: 計画済み（planned）／進行中（in_progress）／確認済み（verified）／公開済み（released）と品質状態を別にする: Roadmap→Change→対象ファイル→Evidence→Quality→Release | IT／ST／UAT | `CQS-01`、`CQS-04`、`CQS-02`、`CQS-05`、`CQS-06`、`CQS-07` |
| [SPEC-000020](../../../05_SPEC/Definitions/SPEC-000020/spec_definition.md) | 正常: 未実施・非該当・失敗・Passを区別し、人間判断が残る場合だけ提示する。境界: 未実施／非該当／失敗／Pass、現改訂版／旧改訂版を分け、一部結果を全体Passへ広げない。失敗: 試験件数や一部監査完了から全体Passを推定しない。観測不能: 不明を正常・不存在・完了へ丸めず、実際の副作用「評価記録は更新できるが、Pass表示から統合・Release Effectを自動発行しない」と矛盾する結果を返さない。失敗: 試験件数や一部監査完了から全体Passを推定しない。副作用: 評価記録は更新できるが、Pass表示から統合・Release Effectを自動発行しない。本SPEC固有の回復経路は設けず、失敗理由と安全な戻り先を返す | IT／ST／UAT | `CQS-04`、`CQS-02`、`CQS-05`、`CQS-06` |
| [ARCH-000003](../../../06_Architecture/Definitions/ARCH-000003/architecture_definition.md) | レビュー件数や試験件数を品質へ読み替えず、同じ固定改訂版に対する必須確認がすべて終わった時だけ工程状態を更新する。所有する責務: 同じ改訂版に対する指摘、是正、試験Evidence、未確認範囲、現在Gateの統合。所有しない責務: 各監査の専門判断、リスク受容、Release判断。主な外部境界: CHG、監査結果、試験結果、Quality Center。SPEC-000020: 試験件数や一部監査完了から全体Passを推定しない。Effect: 評価記録は更新できるが、Pass表示から統合・Release Effectを自動発行しない。入力SPECが固有Recoveryを定義しない場合、Architectureから追加しない。結果には最後に確認できた状態、観測時点、不足および次の安全な行動を、入力契約が必要とする範囲で含める | IT／ST／UAT | `CQS-01`、`CQS-04`、`CQS-02`、`CQS-05`、`CQS-06` |
### Architecture詳細設計入力

| 詳細設計領域 | 受け取る成立条件 |
|---|---|
| [quality-change-control](../../../06_Architecture/Details/quality-change-control/01_Architecture.md) | 固定改訂版、指摘、是正、Evidence、現在Gateの閉包 |

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
| IT | Required | Change、監査結果、Evidence、Quality Center間の関係 | N/A | Repository内成果物の意味統合であり外部実行境界を持たないため |
| ST | Required | Release候補全体のGate統合 | System/E2E | 複数工程の結果を一つの完成表示へ誤って畳まないことを確認するため |
| UAT | Required | 人間が残存Riskと現在Gateを判断する場面 | User Acceptance | 人間が未確認範囲と残存Riskを理解して判断できることを確認するため |

## 4. 検証項目

| Local ID | 分類 | 試験段階 | 試験種別 | 対象／境界 | 外部境界の段階 | 事前状態／入力 | 操作／刺激 | 観測と期待結果 | 終了後条件 | 実行形態 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `CQS-01` | 正常 | IT | Traceability／Review | Change・監査・Evidence・Quality Center。外部実行境界なし | N/A | 同一改訂版、固定済み必須確認集合、各確認結果と残存Risk | 全結果を現在Gateへ統合し、独立レビューで判断先を確認する | 結果、未確認、残存Risk、判断先が現在Gateと一致 | 未解消状態と残存Effect／資源を評価へ引き渡す | Hybrid |
| `CQS-02` | 異常 | IT | Freshness／Regression | 現在状態Projector。外部実行境界なし | N/A | 現行改訂版の未完了結果と、別改訂版のPass結果 | 古いPassを現行結果へ混入して評価する | 古い根拠をFreshとせず、要再確認とする | 未解消状態と残存Effect／資源を評価へ引き渡す | Automated |
| `CQS-03` | 異常 | IT | Closure／Audit | 監査集合とGate集約。外部実行境界なし | N/A | 開始済み必須監査集合と、一部だけ完了した結果 | 必須監査集合を縮小して完了判定を要求する | 完了とせず、元の母集団と未完了項目を保持 | 未解消状態と残存Effect／資源を評価へ引き渡す | Automated |
| `CQS-04` | 異常 | IT | Revision／Regression | 改訂版別結果とGate集約。外部実行境界なし | N/A | 一部項目だけのPass、または是正前改訂版の結果 | 全体Passまたは是正後Passとして評価を要求する | 全体Passを生成せず、新しい改訂版の確認を要求 | 未解消状態と残存Effect／資源を評価へ引き渡す | Automated |
| `CQS-05` | 組合せ | ST | Gate／System | 全工程結果→現在品質→Release候補表示 | System/E2E | Pass、未実施、非該当、失敗、停止、旧改訂版の結果を含む候補 | 候補全体の現在Gateを生成する | 必須確認が揃わない限り全体Passとせず、未完了と根拠を示す | Release Effect 0 | Automated |
| `CQS-06` | 利用者判断 | UAT | Acceptance／Decision | 現在Gate→人間判断 | User Acceptance | 残存Risk、未確認範囲、旧根拠を含む現在品質表示 | 人間が受容・是正・保留を判断する | 判断に必要な不足と影響を理解でき、解消済み事項を再要求しない | 人間判断なしの統合・Release Effect 0 | Manual |
| `CQS-07` | 利用者判断 | UAT | Acceptance／Test Planning | 試験段階・費用・時間・未確認範囲→利用者判断 | User Acceptance | UT／IT／ST／UATの保証範囲、未確認範囲、実行時間・費用、PT／LT候補と上限 | 利用者が追加検証とPT／LTを実行するか判断する | 一部Passを全体保証へ広げず、PT／LTは対象・上限・中止条件・清掃を明示した場合だけ選べる | 未承認のPT／LT・外部Effect 0 | Manual |

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
