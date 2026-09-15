# Runtime Dataと資源Lifecycleの検証定義

成果物種別: Quality定義
検証目標: Repository-local `.crdd`とOS管理Runtime Rootにおける用途、Owner、耐久性、保持、清掃および回復を全Lifecycleで確認する
主な試験段階: Integration／System
状態: Canonical
維持責任者: Qual-Lab

## 1. 情報源と網羅条件

| Source ID | 保持する固有条件 | 対応Local Item |
|---|---|---|
| [REQ-000015](../../../01_Discovery/Definitions/REQ-000015/requirement.md) | リポジトリ内 .crddを検証済みリポジトリの基点フォルダ直下だけに作る。リポジトリ設定、耐久状態、回復情報、再生成可能tmpを区別する。CROS横断情報をリポジトリ内 基点フォルダへ混在させない。subdirectory起動、複数リポジトリ、追跡設定、一時物、回復残存を作り、書込み基点フォルダと分類を観測する | `RDL-01`、`RDL-02` |
| [REQ-000022](../../../01_Discovery/Definitions/REQ-000022/requirement.md) | 作成時に責任者、用途、保持、清掃、回復条件を記録する。成功、失敗、取消の全終了経路で残存と削除可否を判定する。参照中、由来不明、観測不能、回復途中を削除せず明示状態で返す。全終了経路、プロセス crash、清掃再入場、参照中、由来不明、期限超過を作り、残存、回復、最終不存在を観測する | `RDL-03`、`RDL-02` |
| [UX-000017](../../../02_UX/Definitions/UX-000017/ux_definition.md) | 保存場所の内部構造を推測せず、保持すべき状態と一時物を区別して安全に作業を継続・終了できる。重要場面「永続化または削除の直前」で、避ける失敗を利用者が正常状態や完了として誤認しない。入口、実装または利用主体が変わっても、この利用者成果の意味を維持する。用途不明の書込み、名前や時間だけの削除および別リポジトリへの波及を反証する | `RDL-03`、`RDL-04` |
| [UX-000022](../../../02_UX/Definitions/UX-000022/ux_definition.md) | 失敗後に残存の由来・影響・再入場先を理解し、必要な回復を行って不存在まで確認できる。重要場面「削除または回復を選ぶ場面」で、避ける失敗を利用者が正常状態や完了として誤認しない。入口、実装または利用主体が変わっても、この利用者成果の意味を維持する。清掃要求だけの完了表示、別処理の巻込みおよび不明状態での削除を反証する | `RDL-02`、`RDL-03` |
| [IA-000012](../../../03_IA/Definitions/IA-000012/ia_definition.md) | 保存場所の内部構造を推測せず、保持すべき状態、一時物、回復義務を安全に扱う。UX-000017: 一時（temporary）／保持必要（durable）／回復必要（recovery_required）／清掃可能（eligible_for_cleanup）／不明（unknown）。UX-000022: 存在（present）／不存在（absent）／不明（unknown）、回復可能（recoverable）／清掃可能（cleanup_eligible） | `RDL-02`、`RDL-03`、`RDL-01` |
| [UI-000003](../../../04_UI/Definitions/UI-000003/ui_definition.md) | 失敗後に同じ作用を重複させず、安全な回復方法を選べる。UX-000004: 再試行・回復・清掃の違いを理解する: 同じ外部作用（Effect）を再発行する直前: 外部作用（Effect）状態・回復対象の識別情報・終了条件を示す: 結果不明の処理を新規実行して外部作用（Effect）の二重実行を起こす。UX-000022: 残存資源の由来・保持・清掃・回復を理解する: 削除または回復を選ぶ場面: 残存・観測不能・不存在を区別する: 名前や経過時間だけで由来不明物を削除する。UX-000004／IA-000003: 失敗後の作用なし／作用済み／不明、回復要／不要: 失敗→作用状態→同じ依頼の結果→回復処置または再試行。UX-000022／IA-000003: 存在（present）／不存在（absent）／不明（unknown）、回復可能（recoverable）／清掃可能（cleanup_eligible）: 停止→残存観測→同一の回復対象識別子→回復処置・清掃→不存在確認→義務解消。UX-000022／IA-000012: 存在（present）／不存在（absent）／不明（unknown）、回復可能（recoverable）／清掃可能（cleanup_eligible）: 停止→残存観測→同一の回復対象識別子→回復・清掃→不存在確認 | `RDL-03`、`RDL-02`、`RDL-04` |
| [UI-000011](../../../04_UI/Definitions/UI-000011/ui_definition.md) | 必要な状態だけを保持し、不要になったデータを安全に清掃できる。UX-000017: 実行時データの所有場所と一連の状態変化を理解する: 永続化または削除の直前: 用途別領域とcleanup条件を明示する: subdirectoryや別基点フォルダへ同名データを作る。UX-000022: 残存資源の由来・保持・清掃・回復を理解する: 削除または回復を選ぶ場面: 残存・観測不能・不存在を区別する: 名前や経過時間だけで由来不明物を削除する。UX-000017／IA-000012: 一時（temporary）／保持必要（durable）／回復必要（recovery_required）／清掃可能（eligible_for_cleanup）／不明（unknown）: 作業→データ用途→保持判断→清掃→不存在確認。UX-000022／IA-000012: 存在（present）／不存在（absent）／不明（unknown）、回復可能（recoverable）／清掃可能（cleanup_eligible）: 停止→残存観測→同一の回復対象識別子→回復・清掃→不存在確認。UX-000022／IA-000003: 存在（present）／不存在（absent）／不明（unknown）、回復可能（recoverable）／清掃可能（cleanup_eligible）: 停止→残存観測→同一の回復対象識別子→回復処置・清掃→不存在確認→義務解消 | `RDL-03`、`RDL-02`、`RDL-01` |
| [SPEC-000005](../../../05_SPEC/Definitions/SPEC-000005/spec_definition.md) | 正常: 処置の発行だけで完了せず、終了後確認によって義務を解消する。境界: 対象Root／隣接Root、由来確定／不明、終了後確認済み／未確認を分ける。失敗: 由来不明、参照中、観測不能は削除せず、義務を保持する。観測不能: 不明を正常・不存在・完了へ丸めず、実際の副作用「対象残存へのFilesystem Effectを発行する。対象外PathとProvider Effectは0」と矛盾する結果を返さない。失敗: 由来不明、参照中、観測不能は削除せず、義務を保持する。副作用: 対象残存へのFilesystem Effectを発行する。対象外PathとProvider Effectは0。応答喪失またはEffect不明では同じ識別情報で再確認し、終了後確認まで回復義務を保持する | `RDL-03`、`RDL-02`、`RDL-04` |
| [SPEC-000016](../../../05_SPEC/Definitions/SPEC-000016/spec_definition.md) | 正常: Repository-localとOS管理領域を混同せず、終了時に残存義務を確認できる。境界: Repository-local／OS管理Root、耐久／一時、参照中／清掃可能を分ける。失敗: 用途不明の直下書込み、時間だけの削除、別Repositoryへの波及を拒否する。観測不能: 不明を正常・不存在・完了へ丸めず、実際の副作用「許可領域への作成・publish・清掃Effectを発行し、終了後状態を再観測する」と矛盾する結果を返さない。失敗: 用途不明の直下書込み、時間だけの削除、別Repositoryへの波及を拒否する。副作用: 許可領域への作成・publish・清掃Effectを発行し、終了後状態を再観測する。応答喪失またはEffect不明では同じ識別情報で再確認し、終了後確認まで回復義務を保持する | `RDL-03`、`RDL-01`、`RDL-02` |
| [ARCH-000011](../../../06_Architecture/Definitions/ARCH-000011/architecture_definition.md) | temporary／durable／recovery_required／cleanup／unknownを用途別に分ける。Repository-local情報を自Repoに集約し、横断CROS状態はOS管理Rootへ分離する。所有する責務: Repository-local .crddとOS管理Runtime Rootの用途、Owner、耐久性、保持、清掃。所有しない責務: 各Toolの業務データ意味、任意Pathへの書込み、由来不明残存の削除。主な外部境界: Filesystem、Repository Root、OS-managed Runtime Root。SPEC-000016: 用途不明の直下書込み、時間だけの削除、別Repositoryへの波及を拒否する。Effect: 許可領域への作成・publish・清掃Effectを発行し、終了後状態を再観測する。入力SPECが固有Recoveryを定義しない場合、Architectureから追加しない。結果には最後に確認できた状態、観測時点、不足および次の安全な行動を、入力契約が必要とする範囲で含める | `RDL-01`、`RDL-03`、`RDL-04` |
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

## 3. 検証項目

| Local ID | 分類 | 事前状態／入力 | 操作／刺激 | 観測と期待結果 | 終了後条件 | 実行形態 |
| --- | --- | --- | --- | --- | --- | --- |
| `RDL-01` | 正常 | 検証済みRepository Root、Repository-local耐久データ・tmp、OS管理横断Session | 各用途のデータを作成する | 用途に合う唯一のAreaとOwnerへ配置 | Root直下や別Repositoryに余分な物なし | Automated |
| `RDL-02` | 準正常 | 完了・取消・期限到達した対象、再生成可能tmp、引用・Recovery参照 | 保持要否を再観測し対象だけcleanupする | 引用とRecovery義務を再観測し、対象だけcleanup | 対象不存在と別所有物の非削除を確認 | Automated |
| `RDL-03` | 異常 | 由来不明、参照中、link・reparse、観測不能、競合Writerの各残存物 | 各残存物へcleanupを要求する | 経過時間や名前だけで削除せず、同じIdentityの回復義務を保持 | 別候補／別Repository Effect 0 | Automated |
| `RDL-04` | 異常 | tmp内だけにある再開State、用途未登録Top-level作成要求 | tmpからの再開と未登録Pathへの書込みを要求する | 利用／作成を拒否し、正式Areaへの移行を案内 | 不正Pathへ新規Effect 0 | Automated |

## 4. 評価とEvidence

Filesystem APIの成功または削除要求を終了根拠にしない。Passには、対象RootとIdentityの再観測、公開後byte、参照の不在、対象の不存在および別所有物の非削除が必要である。
