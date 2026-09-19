# QA-000008 Runtime Dataと資源Lifecycleの検証定義

成果物種別: Quality定義
Quality ID: `QA-000008`
検証目標: Repository-local `.crdd`とOS管理Runtime Rootにおける用途、Owner、耐久性、保持、清掃および回復を全Lifecycleで確認する
主な試験段階: Unit／Integration／System
状態: Canonical
維持責任者: Qual-Lab

## 1. 情報源と網羅条件

| Source ID | 保持する固有条件 | 試験段階 | 対応Local Item |
|---|---|---|---|
| [REQ-000015](../../../01_Discovery/Definitions/REQ-000015/requirement.md) | リポジトリ内 .crddを検証済みリポジトリの基点フォルダ直下だけに作る。リポジトリ設定、耐久状態、回復情報、再生成可能tmpを区別する。CROS横断情報をリポジトリ内 基点フォルダへ混在させない。subdirectory起動、複数リポジトリ、追跡設定、一時物、回復残存を作り、書込み基点フォルダと分類を観測する | UT／IT／ST | `RDL-01`、`RDL-02`、`RDL-05` |
| [REQ-000022](../../../01_Discovery/Definitions/REQ-000022/requirement.md) | 作成時に責任者、用途、保持、清掃、回復条件を記録する。成功、失敗、取消の全終了経路で残存と削除可否を判定する。参照中、由来不明、観測不能、回復途中を削除せず明示状態で返す。全終了経路、プロセス crash、清掃再入場、参照中、由来不明、期限超過を作り、残存、回復、最終不存在を観測する | IT／ST | `RDL-03`、`RDL-02` |
| [UX-000017](../../../02_UX/Definitions/UX-000017/ux_definition.md) | 保存場所の内部構造を推測せず、保持すべき状態と一時物を区別して安全に作業を継続・終了できる。重要場面「永続化または削除の直前」で、避ける失敗を利用者が正常状態や完了として誤認しない。入口、実装または利用主体が変わっても、この利用者成果の意味を維持する。用途不明の書込み、名前や時間だけの削除および別リポジトリへの波及を反証する | IT／UAT | `RDL-03`、`RDL-04`、`RDL-06` |
| [UX-000022](../../../02_UX/Definitions/UX-000022/ux_definition.md) | 失敗後に残存の由来・影響・再入場先を理解し、必要な回復を行って不存在まで確認できる。重要場面「削除または回復を選ぶ場面」で、避ける失敗を利用者が正常状態や完了として誤認しない。入口、実装または利用主体が変わっても、この利用者成果の意味を維持する。清掃要求だけの完了表示、別処理の巻込みおよび不明状態での削除を反証する | IT／ST／UAT | `RDL-02`、`RDL-03`、`RDL-06` |
| [IA-000012](../../../03_IA/Definitions/IA-000012/ia_definition.md) | 保存場所の内部構造を推測せず、保持すべき状態、一時物、回復義務を安全に扱う。UX-000017: 一時（temporary）／保持必要（durable）／回復必要（recovery_required）／清掃可能（eligible_for_cleanup）／不明（unknown）。UX-000022: 存在（present）／不存在（absent）／不明（unknown）、回復可能（recoverable）／清掃可能（cleanup_eligible） | IT／ST | `RDL-02`、`RDL-03`、`RDL-01` |
| [UI-000003](../../../04_UI/Definitions/UI-000003/ui_definition.md) | 失敗後に同じ作用を重複させず、安全な回復方法を選べる。UX-000004: 再試行・回復・清掃の違いを理解する: 同じ外部作用（Effect）を再発行する直前: 外部作用（Effect）状態・回復対象の識別情報・終了条件を示す: 結果不明の処理を新規実行して外部作用（Effect）の二重実行を起こす。UX-000022: 残存資源の由来・保持・清掃・回復を理解する: 削除または回復を選ぶ場面: 残存・観測不能・不存在を区別する: 名前や経過時間だけで由来不明物を削除する。UX-000004／IA-000003: 失敗後の作用なし／作用済み／不明、回復要／不要: 失敗→作用状態→同じ依頼の結果→回復処置または再試行。UX-000022／IA-000003: 存在（present）／不存在（absent）／不明（unknown）、回復可能（recoverable）／清掃可能（cleanup_eligible）: 停止→残存観測→同一の回復対象識別子→回復処置・清掃→不存在確認→義務解消。UX-000022／IA-000012: 存在（present）／不存在（absent）／不明（unknown）、回復可能（recoverable）／清掃可能（cleanup_eligible）: 停止→残存観測→同一の回復対象識別子→回復・清掃→不存在確認 | IT／ST | `RDL-03`、`RDL-02`、`RDL-04` |
| [UI-000011](../../../04_UI/Definitions/UI-000011/ui_definition.md) | 必要な状態だけを保持し、不要になったデータを安全に清掃できる。UX-000017: 実行時データの所有場所と一連の状態変化を理解する: 永続化または削除の直前: 用途別領域とcleanup条件を明示する: subdirectoryや別基点フォルダへ同名データを作る。UX-000022: 残存資源の由来・保持・清掃・回復を理解する: 削除または回復を選ぶ場面: 残存・観測不能・不存在を区別する: 名前や経過時間だけで由来不明物を削除する。UX-000017／IA-000012: 一時（temporary）／保持必要（durable）／回復必要（recovery_required）／清掃可能（eligible_for_cleanup）／不明（unknown）: 作業→データ用途→保持判断→清掃→不存在確認。UX-000022／IA-000012: 存在（present）／不存在（absent）／不明（unknown）、回復可能（recoverable）／清掃可能（cleanup_eligible）: 停止→残存観測→同一の回復対象識別子→回復・清掃→不存在確認。UX-000022／IA-000003: 存在（present）／不存在（absent）／不明（unknown）、回復可能（recoverable）／清掃可能（cleanup_eligible）: 停止→残存観測→同一の回復対象識別子→回復処置・清掃→不存在確認→義務解消 | IT／ST | `RDL-03`、`RDL-02`、`RDL-01` |
| [SPEC-000005](../../../05_SPEC/Definitions/SPEC-000005/spec_definition.md) | 正常: 処置の発行だけで完了せず、終了後確認によって義務を解消する。境界: 対象Root／隣接Root、由来確定／不明、終了後確認済み／未確認を分ける。失敗: 由来不明、参照中、観測不能は削除せず、義務を保持する。観測不能: 不明を正常・不存在・完了へ丸めず、実際の副作用「対象残存へのFilesystem Effectを発行する。対象外PathとProvider Effectは0」と矛盾する結果を返さない。失敗: 由来不明、参照中、観測不能は削除せず、義務を保持する。副作用: 対象残存へのFilesystem Effectを発行する。対象外PathとProvider Effectは0。応答喪失またはEffect不明では同じ識別情報で再確認し、終了後確認まで回復義務を保持する | IT／ST | `RDL-03`、`RDL-02`、`RDL-04` |
| [SPEC-000016](../../../05_SPEC/Definitions/SPEC-000016/spec_definition.md) | 正常: Repository-localとOS管理領域を混同せず、終了時に残存義務を確認できる。境界: Repository-local／OS管理Root、耐久／一時、参照中／清掃可能を分ける。失敗: 用途不明の直下書込み、時間だけの削除、別Repositoryへの波及を拒否する。観測不能: 不明を正常・不存在・完了へ丸めず、実際の副作用「許可領域への作成・publish・清掃Effectを発行し、終了後状態を再観測する」と矛盾する結果を返さない。失敗: 用途不明の直下書込み、時間だけの削除、別Repositoryへの波及を拒否する。副作用: 許可領域への作成・publish・清掃Effectを発行し、終了後状態を再観測する。応答喪失またはEffect不明では同じ識別情報で再確認し、終了後確認まで回復義務を保持する | IT／ST | `RDL-03`、`RDL-01`、`RDL-02` |
| [ARCH-000011](../../../06_Architecture/Definitions/ARCH-000011/architecture_definition.md) | temporary／durable／recovery_required／cleanup／unknownを用途別に分ける。Repository-local情報を自Repoに集約し、横断CROS状態はOS管理Rootへ分離する。所有する責務: Repository-local .crddとOS管理Runtime Rootの用途、Owner、耐久性、保持、清掃。所有しない責務: 各Toolの業務データ意味、任意Pathへの書込み、由来不明残存の削除。主な外部境界: Filesystem、Repository Root、OS-managed Runtime Root。SPEC-000016: 用途不明の直下書込み、時間だけの削除、別Repositoryへの波及を拒否する。Effect: 許可領域への作成・publish・清掃Effectを発行し、終了後状態を再観測する。入力SPECが固有Recoveryを定義しない場合、Architectureから追加しない。結果には最後に確認できた状態、観測時点、不足および次の安全な行動を、入力契約が必要とする範囲で含める | IT | `RDL-01`、`RDL-03`、`RDL-04` |
### Architecture詳細設計入力

| 詳細設計領域 | 受け取る成立条件 |
|---|---|
| [platform-access](../../../06_Architecture/Details/platform-access/01_Architecture.md) | OS資源、Process Effect、観測、cleanup、回復 |
| [runtime-data](../../../06_Architecture/Details/runtime-data/01_Architecture.md) | Repository-local／OS管理Root、用途、保持、清掃、回復 |

## 2. Lifecycle

```text
[検証済みRoot]
      ↓
[用途とAreaを選択]
      ↓
[書込み／公開]
      ↓
[保持・期限・参照を判定]
      ↓
[対象限定cleanupまたはRecovery]
      ↓
[不存在を再観測]
```

## 3. 試験段階と外部境界の適用

| 試験段階 | 適用 | 確認する範囲 | 外部境界の到達範囲 | 判断理由 |
| --- | --- | --- | --- | --- |
| UT | Required | Path分類、保持・清掃・回復判定 | N/A | Filesystem Effect前に分類規則を反証するため |
| IT | Required | Repository Root、Runtime Root、Filesystem、Recovery Storeの境界 | Related 2 Blocks | 作成から清掃・回復までを局所化するため |
| ST | Required | Tool実行から終了後の全Path不存在／保持まで | System/E2E | tmp作成成功だけでLifecycle完成にしないため |
| UAT | Conditional | 運用者が残存物と回復義務を判断する場面 | User Acceptance | 手動判断が必要な残存状態を対象にする場合に必要 |

### 状態区分の適用

| 状態区分 | 適用 | 対応Local Item | 判断理由 |
|---|---|---|---|
| 正常 | Required | RDL-01 | 正規配置と保持を確認する |
| 準正常／境界 | Required | RDL-02、RDL-05 | 回復中と一時物境界を区別する |
| 異常 | Required | RDL-03 | 範囲外削除や誤清掃を拒否する |
| 判定不能 | Required | RDL-04 | 由来や参照状態不明の残存を削除しない |

## 4. 検証項目

| Local ID | 分類 | 試験段階 | 試験種別 | 対象／境界 | 外部境界の段階 | 事前状態／入力 | 操作／刺激 | 観測 | Oracle | Evidence | 終了後条件 | 実行形態 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `RDL-01` | 正常 | IT | Filesystem／Placement | Repository Root・Runtime Root→Filesystem Writer | Adjacent 1 Block | 検証済みRepository Root、Repository-local耐久データ・tmp、OS管理横断Session | 各用途のデータを作成する | RDL-01として、「各用途のデータを作成する」前後のRepository Root・Runtime Root→Filesystem Writerについて、Identity、phase／state遷移、結果field、Effect発行回数、資源残存数および失敗理由を記録する | 用途に合う唯一のAreaとOwnerへ配置 | RDL-01、固定した改訂版・環境・入力Identity、phase／state遷移、結果field、Effect／資源件数、Oracle判定「用途に合う唯一のAreaとOwnerへ配置」および終了後条件「Root直下や別Repositoryに余分な物なし」を保存する。Secret、鍵bytes、passphrase、生Provider出力および絶対Pathは保存しない | Root直下や別Repositoryに余分な物なし | Automated |
| `RDL-02` | 準正常 | ST | Lifecycle／Cleanup | Tool→保持判定→Filesystem cleanup→不存在観測 | System/E2E | 完了・取消・期限到達した対象、再生成可能tmp、引用・Recovery参照 | 保持要否を再観測し対象だけcleanupする | RDL-02として、「保持要否を再観測し対象だけcleanupする」前後のTool→保持判定→Filesystem cleanup→不存在観測について、Identity、phase／state遷移、結果field、Effect発行回数、資源残存数および失敗理由を記録する | 引用とRecovery義務を再観測し、対象だけcleanup | RDL-02、固定した改訂版・環境・入力Identity、phase／state遷移、結果field、Effect／資源件数、Oracle判定「引用とRecovery義務を再観測し、対象だけcleanup」および終了後条件「対象不存在と別所有物の非削除を確認」を保存する。Secret、鍵bytes、passphrase、生Provider出力および絶対Pathは保存しない | 対象不存在と別所有物の非削除を確認 | Automated |
| `RDL-03` | 異常 | IT | Safety／Recovery | Cleanup Planner→Filesystem Observer→Recovery Store | Related 2 Blocks | 由来不明、参照中、link・reparse、観測不能、競合Writerの各残存物 | 各残存物へcleanupを要求する | RDL-03として、「各残存物へcleanupを要求する」前後のCleanup Planner→Filesystem Observer→Recovery Storeについて、Identity、phase／state遷移、結果field、Effect発行回数、資源残存数および失敗理由を記録する | 経過時間や名前だけで削除せず、同じIdentityの回復義務を保持 | RDL-03、固定した改訂版・環境・入力Identity、phase／state遷移、結果field、Effect／資源件数、Oracle判定「経過時間や名前だけで削除せず、同じIdentityの回復義務を保持」および終了後条件「別候補／別Repository Effect 0」を保存する。Secret、鍵bytes、passphrase、生Provider出力および絶対Pathは保存しない | 別候補／別Repository Effect 0 | Automated |
| `RDL-04` | 異常 | IT | Contract／Path Policy | Runtime Data API→Path Policy→Filesystem | Adjacent 1 Block | tmp内だけにある再開State、用途未登録Top-level作成要求 | tmpからの再開と未登録Pathへの書込みを要求する | RDL-04として、「tmpからの再開と未登録Pathへの書込みを要求する」前後のRuntime Data API→Path Policy→Filesystemについて、Identity、phase／state遷移、結果field、Effect発行回数、資源残存数および失敗理由を記録する | 利用／作成を拒否し、正式Areaへの移行を案内 | RDL-04、固定した改訂版・環境・入力Identity、phase／state遷移、結果field、Effect／資源件数、Oracle判定「利用／作成を拒否し、正式Areaへの移行を案内」および終了後条件「不正Pathへ新規Effect 0」を保存する。Secret、鍵bytes、passphrase、生Provider出力および絶対Pathは保存しない | 不正Pathへ新規Effect 0 | Automated |
| `RDL-05` | 境界 | UT | Classification／Retention | Path分類、保持、清掃、回復判定規則 | N/A | durable、temporary、recovery_required、cleanup、unknownの各用途・状態 | 配置先、保持要否、清掃可否を判定する | RDL-05として、「配置先、保持要否、清掃可否を判定する」前後のPath分類、保持、清掃、回復判定規則について、入力差分、判定結果、欠落・重複・不一致および理由codeを記録する | unknownをcleanup可能へ畳まず、用途ごとの唯一の処置を返す | RDL-05、固定入力「durable、temporary、recovery_required、cleanup、unknownの各用途・状態」、観測した差分と理由code、Oracle判定「unknownをcleanup可能へ畳まず、用途ごとの唯一の処置を返す」および終了後条件「Filesystem Effect 0」を保存する | Filesystem Effect 0 | Automated |
| `RDL-06` | 利用者判断 | UAT | Acceptance／Retention | 実行時データ・残存資源・回復義務→利用者判断 | User Acceptance | durable、temporary、recovery_required、cleanup_eligible、unknownを含む状態表示 | 利用者が保持、回復、清掃または保留を選ぶ | 表示された用途、由来、参照状態、不完全性および利用者判断を記録する | 内部配置を推測せず必要な状態を保持し、由来不明や観測不能を削除せず安全に終了できる | RDL-06の状態表示、利用者判断、清掃・回復結果および不存在確認 | 判断前にFilesystem Effect 0 | Manual |

## 5. 評価とEvidence

Filesystem APIの成功または削除要求を終了根拠にしない。Passには、対象RootとIdentityの再観測、公開後byte、参照の不在、対象の不存在および別所有物の非削除が必要である。

## 追加試験種別の適用

| 種別 | 適用 | 確認する範囲 | 実行許可 | 未実行時の扱い |
|---|---|---|---|---|
| RT | Required | 変更した意味と利用側から、再実行する既存Local Itemを選ぶ | Changeの通常検証範囲 | 未選択の範囲を明示し、選択した回帰の結果で評価する |
| PT | Conditional | 対象、負荷上限、費用／Credit上限、中止条件および清掃条件を事前に固定した場合だけ設計する | Human Explicit Authorization | 未実行をPassへ読み替えず、明示的なRelease条件でない限り通常監査を停止しない |
| LT | Conditional | 対象、継続時間、資源／費用上限、中止条件および清掃条件を事前に固定した場合だけ設計する | Human Explicit Authorization | 未実行をPassへ読み替えず、明示的なRelease条件でない限り通常監査を停止しない |


## Checklist

- [x] Quality ID、検証目標およびSource固有条件を自己完結して示した
- [x] UT／IT／ST／UATの適用または理由付きN/Aを記録した
- [x] 外部境界の直接、隣接1 block、関連2 blocks、System／E2Eおよび利用者受入を適用判定した
- [x] 正常、境界、失敗および観測不能をLocal Itemで処置した
- [x] 各Local Itemで観測とOracleを分けた
- [x] 各Local ItemのEvidence要件を示した
- [x] 事前条件、刺激、終了後条件、cleanupおよびRecoveryを必要な範囲で示した
- [x] RT／PT／LTの適用または理由付きN/Aを記録し、PT／LTは人間の明示指定なしに実行しない
- [x] 自動化、手動確認および人間判断の境界を示した
- [x] 現行Source、TestおよびEvidenceとの照合をReality Auditへ分離した
