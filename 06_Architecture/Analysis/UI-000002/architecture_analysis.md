# UI-000002のArchitecture分析

成果物種別: Architecture分析（UI観点）
分析単位: `UI-000002`
状態: Canonical

## 1. 正式入力

- UI定義: [UI-000002 委任・実行状態・判断](../../../04_UI/Definitions/UI-000002/ui_definition.md)

このUI定義だけを正式入力とする。反対観点、上流工程、現行Architectureまたは実装から不足する意味を補わない。

## 2. Architectureへ引き継ぐUI契約

### 利用者成果

任せた範囲と進行状態を理解し、必要な時だけ判断する。

### 表示面と情報の優先順位

```text
委任・実行状態・判断
        ↓
プロジェクト（Project）／節目（Milestone）／目的（Objective）／作業（Task）／決定権限／受入条件／依頼（Request）／試行（Attempt）／外部作用（Effect）／結果（Result）／回復義務（Recovery Obligation）／回復処置（Recovery Action）／終了確認（Settlement Observation）／次の行動（Next Action）
        ↓
現在状態・不足・制限
        ↓
目的→範囲と担い手→許可→実行／Task→現在状態→判断要否→待機・入力・取消・回復
```

| IA分析 | 独立して見分ける対象 | 利用者にとっての意味 | 識別・関係 |
|---|---|---|---|
| IA-000002 | プロジェクト（Project） | 継続する活動の境界 | プロジェクト識別子（Project ID） |
| IA-000002 | 節目（Milestone） | 人が委ね受入を判断する到達点 | Projectに属する安定ID |
| IA-000002 | 目的（Objective） | Milestoneを成立させる目的 | Milestoneに属する安定ID |
| IA-000002 | 作業（Task） | 実行可能な仕事単位 | Objectiveと作業識別子（Task Identity） |
| IA-000002 | 決定権限 | 誰が何を決められるか | 対象・主体・時点へ結合 |
| IA-000002 | 受入条件 | 上位成果を受け入れる条件 | Milestone／Objectiveへ結合 |
| IA-000003 | 依頼（Request） | 利用者の同一依頼 | 依頼識別子（Request Identity） |
| IA-000003 | 試行（Attempt） | 依頼を実行した個別試行 | 依頼（Request）に属する試行識別子（Attempt ID） |
| IA-000003 | 外部作用（Effect） | 外部へ生じ得る変更 | 試行（Attempt）と作用識別子（Effect Identity） |
| IA-000003 | 結果（Result） | 試行または依頼の結果 | 依頼（Request）／試行（Attempt）へ結合 |
| IA-000003 | 回復義務（Recovery Obligation） | 残存を処置し、終了後を確認するまで残る義務 | 同一の回復対象識別子（Recovery Identity） |
| IA-000003 | 回復処置（Recovery Action） | 回復義務を解消するために実行する行動 | 回復義務と処置の試行へ結合 |
| IA-000003 | 終了確認（Settlement Observation） | 回復後に残存や作用が解消したことの確認 | 回復義務と観測時点へ結合 |
| IA-000003 | 次の行動（Next Action） | 現在許される行動 | 状態と権限（Authority）から導く |

同じ画面や応答へ置く場合も、上表の独立軸を一つの成功・信頼・完了へ畳まない。重要な不足、制限、判断要否は詳細へ隠さない。

### 操作とFeedback

主要な操作・判断: 委任する／取消す／判断を返す。

| UX分析 | 利用者が行う判断・行動 | 重要な場面 | 必要なFeedback | 避ける失敗 |
|---|---|---|---|---|
| UX-000002 | 複数AIへ任せる範囲と権限を理解する | 外部作用（Effect）の前の委任境界 | 委任状態・停止理由・回復先を行動可能に示す | 暗黙の範囲拡張や回復不能 |
| UX-000003 | 現在の実行状態と必要な判断を確認する | 応答がなく待機か停止かを判断する場面 | 観測時点・停止理由・必要な判断を行動可能に示す | 古い観測や一律表示を進捗・完了と誤認する |

UI部品や通信方式はここで固定しない。各UX行のFeedbackを、IAの状態・導線と対応付けて表示する。

### 状態と表示差

| UX／IAの対応 | 区別する状態 | 状態から進む導線 |
|---|---|---|
| UX-000002／IA-000002 | 準備中／許可待ち／実行中／停止。権限発行前後を分ける | 目的→範囲と担い手→許可→実行 |
| UX-000003／IA-000002 | 開始可能（ready）／実行中（running）／入力・判断待ち（waiting）／停止（blocked）／完了（completed）／失敗（failed） | Task→現在状態→判断要否→待機・入力・取消・回復 |
| UX-000003／IA-000003 | 開始可能（ready）／実行中（running）／入力・判断待ち（waiting）／停止（blocked）／完了（completed）／失敗（failed） | Task→現在状態→判断要否→待機・入力・取消・回復 |

上表にない処理中、取消、回復その他の状態を一律に追加しない。値なし、未観測、古い値、競合、開示制限または結果不明は、該当するIA定義が要求する場合にだけ別状態として示す。

### 視覚表現とアクセシビリティ

- 「プロジェクト（Project）、節目（Milestone）、目的（Objective）、作業（Task）、決定権限、受入条件、依頼（Request）、試行（Attempt）、外部作用（Effect）、結果（Result）、回復義務（Recovery Obligation）、回復処置（Recovery Action）、終了確認（Settlement Observation）、次の行動（Next Action）」を、色だけでなく表示名、状態語、順序でも見分けられるようにする。
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
| [Project実行のArchitecture定義](../../Definitions/ARCH-000004/architecture_definition.md) | Project Runtime | UI契約はAuthorityを発行しない。利用者操作: 委任する／取消す／判断を返す | UI契約はEffectを定義しない。表示上の状態差: 準備中／許可待ち／実行中／停止。権限発行前後を分ける。導線: 目的→範囲と担い手→許可→実行 | 利用者成果を壊す表示・操作: UIだけに正本、決定権限、業務ロジックまたは独自状態Storeを作らない。 |

## 4. Architecture処置

| Architecture定義候補 | 処置 | 判断理由 |
|---|---|---|
| [Project実行](../../Definitions/ARCH-000004/architecture_definition.md) | New | 委任、状態照会、再試行／回復選別、清掃、引継ぎを同じRequest／Task／Recovery Identityへ結ぶ。ただし受付、実行、Recovery、清掃は独立した状態機械と終了条件を持つ。 |

## 5. SPEC観点との統合時に確認すること

- 対応候補: SPEC-000002、SPEC-000003、SPEC-000028、SPEC-000029
- この分析にある状態、操作、Feedback、Authority、Effectの適用／非適用、失敗を、対応SPECの契機と結果へ一つずつ照合する。
- 差分がある場合はArchitectureで推測せず、UI／SPEC対応レビューへ戻す。

## Checklist

- [x] 自分自身のUI定義だけを正式入力として処置した
- [x] 利用者が得る結果、認識、操作、Feedbackおよび状態差を保持した
- [x] Architectureが担う責務と担わない責務を評価した
- [x] Boundary、主要ComponentおよびInterfaceの必要性を評価した
- [x] Data／State Ownershipを評価した
- [x] Authority、Effectおよび開示境界を評価した
- [x] Failure BoundaryとRecovery責任を評価した
- [x] Security／TrustとQuality Constraintを評価した
- [x] Human Inputの必要性を評価した
- [x] Open／GapとOwner工程へ戻す条件を明示した
- [x] Verification Intentを評価した
- [x] 現行Sourceや実装構造から意味を逆輸入していない
- [x] SPEC観点との統合時に確認する事項を明示した
