# UI-000012のArchitecture分析

成果物種別: Architecture分析（UI観点）
分析単位: `UI-000012`
状態: Canonical

## 1. 正式入力

- UI定義: [UI-000012 Agent間の情報引継ぎと再接続](../../../04_UI/Definitions/UI-000012/ui_definition.md)

このUI定義だけを正式入力とする。反対観点、上流工程、現行Architectureまたは実装から不足する意味を補わない。

## 2. Architectureへ引き継ぐUI契約

### 利用者成果

必要な情報を限定して渡し、切断後も同じ仕事へ戻れる。

### 表示面と情報の優先順位

```text
Agent間の情報引継ぎと再接続
        ↓
仕事用情報一式（Context Package）／情報源参照（Source Reference）／選択理由（Selection Reason）／作業（Task）／引き渡し（Handoff）／結果（Result）／判断（Decision）／依頼（Request）／試行（Attempt）／外部作用（Effect）／回復義務（Recovery Obligation）／回復処置（Recovery Action）／終了確認（Settlement Observation）／次の行動（Next Action）
        ↓
現在状態・不足・制限
        ↓
情報源→選択→仕事用情報一式（Context Package）→Task→結果（Result）→元の仕事／再接続→同じ依頼（Request）→現在権限→状態・結果→回復義務
```

| IA分析 | 独立して見分ける対象 | 利用者にとっての意味 | 識別・関係 |
|---|---|---|---|
| IA-000014 | 仕事用情報一式（Context Package） | 選択した仕事用情報一式 | 情報一式の識別子（Package ID） |
| IA-000014 | 情報源参照（Source Reference） | 出所と改訂版（Revision） | 情報源の識別子（Source Identity）＋改訂版（Revision） |
| IA-000014 | 選択理由（Selection Reason） | 含めた理由 | Package Itemへ結合 |
| IA-000014 | 作業（Task） | 受け渡し先の仕事 | 作業識別子（Task Identity） |
| IA-000014 | 引き渡し（Handoff） | 役割間の移送 | 情報源（Source）／Target Role |
| IA-000014 | 結果（Result） | Taskから戻る成果と状態 | Taskへ結合 |
| IA-000014 | 判断（Decision） | 結果とともに元の仕事へ戻す判断・未解決事項 | 責任者（Owner）と決定権限（Decision Authority）へ結ぶ |
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

主要な操作・判断: 引き継ぐ／再接続する／結果を戻す。

| UX分析 | 利用者が行う判断・行動 | 重要な場面 | 必要なFeedback | 避ける失敗 |
|---|---|---|---|---|
| UX-000019 | 必要な情報だけを出所付きで渡す | 外部境界へ情報を出す直前 | 情報源・改訂版・選択理由を保持する | 全量投入・秘密情報混入・古い仮説の現在値化 |
| UX-000021 | 切断後に同じ依頼へ戻る | 再実行するか判断する直前 | 同一識別情報の照会を再実行より先に示す | Timeoutを未実行とみなし新規外部作用（Effect）を起こす |

UI部品や通信方式はここで固定しない。各UX行のFeedbackを、IAの状態・導線と対応付けて表示する。

### 状態と表示差

| UX／IAの対応 | 区別する状態 | 状態から進む導線 |
|---|---|---|
| UX-000019／IA-000014 | 準備済み（prepared）／送信済み（sent）／受領済み（received）／返却済み（returned）／停止（blocked） | 情報源→選択→仕事用情報一式（Context Package）→Task→結果（Result）→元の仕事 |
| UX-000021／IA-000014 | 進行中（active）／切断（disconnected）／結果取得可能（result_available）／回復必要（recovery_required）／確定済み（settled） | 再接続→同じ依頼（Request）→現在権限→状態・結果→回復義務 |
| UX-000021／IA-000003 | 進行中（active）／切断（disconnected）／結果取得可能（result_available）／回復必要（recovery_required）／確定済み（settled） | 再接続→同じ依頼（Request）→現在権限→状態・結果→回復義務 |

上表にない処理中、取消、回復その他の状態を一律に追加しない。値なし、未観測、古い値、競合、開示制限または結果不明は、該当するIA定義が要求する場合にだけ別状態として示す。

### 視覚表現とアクセシビリティ

- 「仕事用情報一式（Context Package）、情報源参照（Source Reference）、選択理由（Selection Reason）、作業（Task）、引き渡し（Handoff）、結果（Result）、判断（Decision）、依頼（Request）、試行（Attempt）、外部作用（Effect）、回復義務（Recovery Obligation）、回復処置（Recovery Action）、終了確認（Settlement Observation）、次の行動（Next Action）」を、色だけでなく表示名、状態語、順序でも見分けられるようにする。
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
| [Project実行のArchitecture定義](../../Definitions/ARCH-000004/architecture_definition.md) | Project Runtime | UI契約はAuthorityを発行しない。利用者操作: 引き継ぐ／再接続する／結果を戻す | UI契約はEffectを定義しない。表示上の状態差: 準備済み（prepared）／送信済み（sent）／受領済み（received）／返却済み（returned）／停止（blocked）。導線: 情報源→選択→仕事用情報一式（Context Package）→Task→結果（Result）→元の仕事 | 利用者成果を壊す表示・操作: UIだけに正本、決定権限、業務ロジックまたは独自状態Storeを作らない。 |

## 4. Architecture処置

| Architecture定義候補 | 処置 | 判断理由 |
|---|---|---|
| [Project実行](../../Definitions/ARCH-000004/architecture_definition.md) | Same | 委任、状態照会、再試行／回復選別、清掃、引継ぎを同じRequest／Task／Recovery Identityへ結ぶ。ただし受付、実行、Recovery、清掃は独立した状態機械と終了条件を持つ。 |

## 5. SPEC観点との統合時に確認すること

- 対応候補: SPEC-000002、SPEC-000003、SPEC-000004、SPEC-000005、SPEC-000017
- この分析にある状態、操作、Feedback、Authority、Effectの適用／非適用、失敗を、対応SPECの契機と結果へ一つずつ照合する。
- 差分がある場合はArchitectureで推測せず、UI／SPEC対応レビューへ戻す。
