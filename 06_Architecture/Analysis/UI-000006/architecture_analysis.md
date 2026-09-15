# UI-000006のArchitecture分析

成果物種別: Architecture分析（UI観点）
分析単位: `UI-000006`
状態: Canonical

## 1. 正式入力

- UI定義: [UI-000006 Repository内作業と対象選択](../../../04_UI/Definitions/UI-000006/ui_definition.md)

このUI定義だけを正式入力とする。反対観点、上流工程、現行Architectureまたは実装から不足する意味を補わない。

## 2. Architectureへ引き継ぐUI契約

### 利用者成果

普段のRepository作業を保ちながら、対象の取り違えを防げる。

### 表示面と情報の優先順位

```text
Repository内作業と対象選択
        ↓
プロジェクト（Project）／リポジトリ（Repository）／結合情報（Binding）／プロジェクト項目／読取り投影（Projection）／対象範囲（Coverage）／手元の情報（Local Context）／手元の作業（Local Work）／リポジトリ横断情報源（Cross-repository Source）／履歴管理能力（Version Control Capability）
        ↓
現在状態・不足・制限
        ↓
Project→Repository→Binding→検証済みRoot／Repository→手元の正本→作業、必要時だけCROS
```

| IA分析 | 独立して見分ける対象 | 利用者にとっての意味 | 識別・関係 |
|---|---|---|---|
| IA-000006 | プロジェクト（Project） | 論理的な案件・活動 | プロジェクト識別子（Project ID） |
| IA-000006 | リポジトリ（Repository） | Projectの一部を所有する正本境界 | リポジトリ識別子（Repository ID） |
| IA-000006 | 結合情報（Binding） | Repositoryと検証済みRootの結合 | 結合識別子（Binding ID） |
| IA-000006 | プロジェクト項目 | リポジトリが正本として所有する文書その他の項目 | リポジトリと項目固有の識別情報で結ぶ |
| IA-000006 | 読取り投影（Projection） | 正本から導出した読取りView | 情報源（Source）＋改訂版（Revision）＋観測時点（Observed At） |
| IA-000006 | 対象範囲（Coverage） | 投影が扱えた範囲 | 情報源（Source）集合と状態 |
| IA-000007 | 手元の情報（Local Context） | 現在Repositoryが所有する正本 | 検証済みリポジトリの基点フォルダ（Repository Root） |
| IA-000007 | 手元の作業（Local Work） | 手元で開始・完了できる仕事 | 対象Repositoryへ結合 |
| IA-000007 | リポジトリ横断情報源（Cross-repository Source） | CROSから得る追加情報 | 情報源（Source）とAccess State |
| IA-000007 | 履歴管理能力（Version Control Capability） | 履歴を扱う差替可能な能力 | 接続口（Port）／利用能力（Capability）で識別 |

同じ画面や応答へ置く場合も、上表の独立軸を一つの成功・信頼・完了へ畳まない。重要な不足、制限、判断要否は詳細へ隠さない。

### 操作とFeedback

主要な操作・判断: 対象を選ぶ／Rootを確認する／正本を開く。

| UX分析 | 利用者が行う判断・行動 | 重要な場面 | 必要なFeedback | 避ける失敗 |
|---|---|---|---|---|
| UX-000010 | 現在リポジトリだけで日常作業を完結する | 横断利用へ切り替える判断 | 手元を既定にし横断を任意に保つ | CROS未設定で手元作業まで止まる |
| UX-000011 | プロジェクト・リポジトリ・基点フォルダを区別して対象を確認する | 外部作用（Effect）対象を確定する直前 | 各識別情報と物理基点フォルダの結合を明示する | 同名や近いパスを同じ対象と誤認する |

UI部品や通信方式はここで固定しない。各UX行のFeedbackを、IAの状態・導線と対応付けて表示する。

### 状態と表示差

| UX／IAの対応 | 区別する状態 | 状態から進む導線 |
|---|---|---|
| UX-000011／IA-000006 | 確認済み（verified）／未確認（unverified）／曖昧（ambiguous）／利用不能（unavailable） | Project→Repository→Binding→検証済みRoot |
| UX-000010／IA-000007 | 手元で利用可能（local available）／横断情報源を利用不能（cross-source unavailable）でも継続可能 | Repository→手元の正本→作業、必要時だけCROS |

上表にない処理中、取消、回復その他の状態を一律に追加しない。値なし、未観測、古い値、競合、開示制限または結果不明は、該当するIA定義が要求する場合にだけ別状態として示す。

### 視覚表現とアクセシビリティ

- 「プロジェクト（Project）、リポジトリ（Repository）、結合情報（Binding）、プロジェクト項目、読取り投影（Projection）、対象範囲（Coverage）、手元の情報（Local Context）、手元の作業（Local Work）、リポジトリ横断情報源（Cross-repository Source）、履歴管理能力（Version Control Capability）」を、色だけでなく表示名、状態語、順序でも見分けられるようにする。
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
| [Repository境界とBindingのArchitecture定義](../../Definitions/ARCH-000009/architecture_definition.md) | Version Control PortとRepository Binding Resolver | UI契約はAuthorityを発行しない。利用者操作: 対象を選ぶ／Rootを確認する／正本を開く | UI契約はEffectを定義しない。表示上の状態差: 確認済み（verified）／未確認（unverified）／曖昧（ambiguous）／利用不能（unavailable）。導線: Project→Repository→Binding→検証済みRoot | 利用者成果を壊す表示・操作: UIだけに正本、決定権限、業務ロジックまたは独自状態Storeを作らない。 |

## 4. Architecture処置

| Architecture定義候補 | 処置 | 判断理由 |
|---|---|---|
| [Repository境界とBinding](../../Definitions/ARCH-000009/architecture_definition.md) | New | verified／unverified／ambiguous／unavailableを分け、local／cross-sourceの対象範囲を明示する。GitはAdapterの一実装であり、未Commitを理由に通常利用を拒否しない。 |

## 5. SPEC観点との統合時に確認すること

- 対応候補: SPEC-000010
- この分析にある状態、操作、Feedback、Authority、Effectの適用／非適用、失敗を、対応SPECの契機と結果へ一つずつ照合する。
- 差分がある場合はArchitectureで推測せず、UI／SPEC対応レビューへ戻す。
