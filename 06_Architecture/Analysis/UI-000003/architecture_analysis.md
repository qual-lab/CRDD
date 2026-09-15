# UI-000003のArchitecture分析

成果物種別: Architecture分析（UI観点）
分析単位: `UI-000003`
状態: Canonical

## 1. 正式入力

- UI定義: [UI-000003 失敗後の再試行・回復・清掃](../../../04_UI/Definitions/UI-000003/ui_definition.md)

このUI定義だけを正式入力とする。反対観点、上流工程、現行Architectureまたは実装から不足する意味を補わない。

## 2. Architectureへ引き継ぐUI契約

### 利用者成果

失敗後に同じ作用を重複させず、安全な回復方法を選べる。

### 表示面と情報の優先順位

```text
失敗後の再試行・回復・清掃
        ↓
依頼（Request）／試行（Attempt）／外部作用（Effect）／結果（Result）／回復義務（Recovery Obligation）／回復処置（Recovery Action）／終了確認（Settlement Observation）／次の行動（Next Action）／実行データの基点（Runtime Root）／実行データ（Data Item）／永続性（Durability）／保持条件（Retention）／清掃根拠（Cleanup Evidence）
        ↓
現在状態・不足・制限
        ↓
失敗→作用状態→同じ依頼の結果→回復処置または再試行／停止→残存観測→同一の回復対象識別子→回復処置・清掃→不存在確認→義務解消／停止→残存観測→同一の回復対象識別子→回復・清掃→不存在確認
```

| IA分析 | 独立して見分ける対象 | 利用者にとっての意味 | 識別・関係 |
|---|---|---|---|
| IA-000003 | 依頼（Request） | 利用者の同一依頼 | 依頼識別子（Request Identity） |
| IA-000003 | 試行（Attempt） | 依頼を実行した個別試行 | 依頼（Request）に属する試行識別子（Attempt ID） |
| IA-000003 | 外部作用（Effect） | 外部へ生じ得る変更 | 試行（Attempt）と作用識別子（Effect Identity） |
| IA-000003 | 結果（Result） | 試行または依頼の結果 | 依頼（Request）／試行（Attempt）へ結合 |
| IA-000003 | 回復義務（Recovery Obligation） | 残存を処置し、終了後を確認するまで残る義務 | 同一の回復対象識別子（Recovery Identity） |
| IA-000003 | 回復処置（Recovery Action） | 回復義務を解消するために実行する行動 | 回復義務と処置の試行へ結合 |
| IA-000003 | 終了確認（Settlement Observation） | 回復後に残存や作用が解消したことの確認 | 回復義務と観測時点へ結合 |
| IA-000003 | 次の行動（Next Action） | 現在許される行動 | 状態と権限（Authority）から導く |
| IA-000012 | 実行データの基点（Runtime Root） | 実行時データの管理基点 | 検証済みRoot |
| IA-000012 | 実行データ（Data Item） | 用途を持つ実行時情報 | 責任者（Owner）＋目的（Purpose）＋識別子（Identity） |
| IA-000012 | 永続性（Durability） | 再起動後も必要か | 一時（temporary）／保持必要（durable） |
| IA-000012 | 保持条件（Retention） | 保持する条件と上限 | 実行データ（Data Item）へ結合 |
| IA-000012 | 回復義務（Recovery Obligation） | 回復に必要な耐久情報 | 同一の識別子（Identity） |
| IA-000012 | 清掃根拠（Cleanup Evidence） | 終了後の不存在根拠 | 対象と観測へ結合 |

同じ画面や応答へ置く場合も、上表の独立軸を一つの成功・信頼・完了へ畳まない。重要な不足、制限、判断要否は詳細へ隠さない。

### 操作とFeedback

主要な操作・判断: 再試行する／回復する／清掃する。

| UX分析 | 利用者が行う判断・行動 | 重要な場面 | 必要なFeedback | 避ける失敗 |
|---|---|---|---|---|
| UX-000004 | 再試行・回復・清掃の違いを理解する | 同じ外部作用（Effect）を再発行する直前 | 外部作用（Effect）状態・回復対象の識別情報・終了条件を示す | 結果不明の処理を新規実行して外部作用（Effect）の二重実行を起こす |
| UX-000022 | 残存資源の由来・保持・清掃・回復を理解する | 削除または回復を選ぶ場面 | 残存・観測不能・不存在を区別する | 名前や経過時間だけで由来不明物を削除する |

UI部品や通信方式はここで固定しない。各UX行のFeedbackを、IAの状態・導線と対応付けて表示する。

### 状態と表示差

| UX／IAの対応 | 区別する状態 | 状態から進む導線 |
|---|---|---|
| UX-000004／IA-000003 | 失敗後の作用なし／作用済み／不明、回復要／不要 | 失敗→作用状態→同じ依頼の結果→回復処置または再試行 |
| UX-000022／IA-000003 | 存在（present）／不存在（absent）／不明（unknown）、回復可能（recoverable）／清掃可能（cleanup_eligible） | 停止→残存観測→同一の回復対象識別子→回復処置・清掃→不存在確認→義務解消 |
| UX-000022／IA-000012 | 存在（present）／不存在（absent）／不明（unknown）、回復可能（recoverable）／清掃可能（cleanup_eligible） | 停止→残存観測→同一の回復対象識別子→回復・清掃→不存在確認 |

上表にない処理中、取消、回復その他の状態を一律に追加しない。値なし、未観測、古い値、競合、開示制限または結果不明は、該当するIA定義が要求する場合にだけ別状態として示す。

### 視覚表現とアクセシビリティ

- 「依頼（Request）、試行（Attempt）、外部作用（Effect）、結果（Result）、回復義務（Recovery Obligation）、回復処置（Recovery Action）、終了確認（Settlement Observation）、次の行動（Next Action）、実行データの基点（Runtime Root）、実行データ（Data Item）、永続性（Durability）、保持条件（Retention）、清掃根拠（Cleanup Evidence）」を、色だけでなく表示名、状態語、順序でも見分けられるようにする。
- 結論、重大な不足、主要操作、根拠、詳細の順を視覚順と読上げ順で一致させる。
- CLI、MCP、Workbenchで同じ意味の状態と次の導線を対応付ける。
- キーボード操作と文字表示だけでも、上表の判断・根拠・戻り先へ到達できるようにする。

### 制約

- UIだけに正本、決定権限、業務ロジックまたは独自状態Storeを作らない。
- 表示の都合でUX成果、IAの独立軸、状態、根拠、対象範囲または開示境界を弱めない。
- 視覚詳細はPrototypeで評価し、未評価の候補を完成表示しない。

## 3. Architecture観点の分析

| 責務候補 | 状態Owner | 決定権限 | Effect／非該当 | 主な失敗境界 |
|---|---|---|---|---|
| [Project実行のArchitecture定義](../../Definitions/project-execution/architecture_definition.md) | Project Runtime | UI契約はAuthorityを発行しない。利用者操作: 再試行する／回復する／清掃する | UI契約はEffectを定義しない。表示上の状態差: 失敗後の作用なし／作用済み／不明、回復要／不要。導線: 失敗→作用状態→同じ依頼の結果→回復処置または再試行 | 利用者成果を壊す表示・操作: UIだけに正本、決定権限、業務ロジックまたは独自状態Storeを作らない。 |

## 4. Architecture処置

| Architecture定義候補 | 処置 | 判断理由 |
|---|---|---|
| [Project実行](../../Definitions/project-execution/architecture_definition.md) | Same | 委任、状態照会、再試行／回復選別、清掃、引継ぎを同じRequest／Task／Recovery Identityへ結ぶ。ただし受付、実行、Recovery、清掃は独立した状態機械と終了条件を持つ。 |

## 5. SPEC観点との統合時に確認すること

- 対応候補: SPEC-000002、SPEC-000003、SPEC-000004、SPEC-000005、SPEC-000017
- この分析にある状態、操作、Feedback、Authority、Effectの適用／非適用、失敗を、対応SPECの契機と結果へ一つずつ照合する。
- 差分がある場合はArchitectureで推測せず、UI／SPEC対応レビューへ戻す。
