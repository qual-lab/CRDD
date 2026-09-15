# UI-000010のArchitecture分析

成果物種別: Architecture分析（UI観点）
分析単位: `UI-000010`
状態: Canonical

## 1. 正式入力

- UI定義: [UI-000010 Tool・AIモデル構成の選択](../../../04_UI/Definitions/UI-000010/ui_definition.md)

このUI定義だけを正式入力とする。反対観点、上流工程、現行Architectureまたは実装から不足する意味を補わない。

## 2. Architectureへ引き継ぐUI契約

### 利用者成果

仕事に合うToolとAIモデルを根拠付きで選び、安全に変更できる。

### 表示面と情報の優先順位

```text
Tool・AIモデル構成の選択
        ↓
利用能力（Capability）／利用可否（Availability）／実行権限（Authority）／配布物（Distribution）／配布目録（Manifest）／実行環境との結合（Runtime Binding）／AIモデル（Model）／構成（Configuration）／作業上の役割（Task Role）／選択結果（Selection）／再選定条件（Fallback Condition）
        ↓
現在状態・不足・制限
        ↓
仕事→必要能力→登録Tool→配布根拠→起動／設定→検証→利用可能候補→選択→理由・再選定条件
```

| IA分析 | 独立して見分ける対象 | 利用者にとっての意味 | 識別・関係 |
|---|---|---|---|
| IA-000011 | 利用能力（Capability） | Toolが提供する仕事上の能力 | 利用能力（Capability） ID |
| IA-000011 | 利用可否（Availability） | 現在利用可能か | 利用能力（Capability）＋環境 |
| IA-000011 | 実行権限（Authority） | 実行時に許される作用 | 主体・対象・時点 |
| IA-000011 | 配布物（Distribution） | 配布単位 | 配布内容の基点（Content Root） |
| IA-000011 | 配布目録（Manifest） | 配布内容と根拠 | 配布目録のハッシュ（Manifest Hash） |
| IA-000011 | 実行環境との結合（Runtime Binding） | 配布と実行環境の結合 | 結合識別子（Binding Identity） |
| IA-000013 | AIモデル（Model） | 利用候補のAIモデル | Provider＋Model ID |
| IA-000013 | 構成（Configuration） | 許可候補と制約 | 構成の改訂版（Config Revision） |
| IA-000013 | 作業上の役割（Task Role） | 実行・確認等の必要役割 | Taskへ結合 |
| IA-000013 | 利用可否（Availability） | 現在利用可能か | Model＋Environment |
| IA-000013 | 選択結果（Selection） | 今回の実効選択 | Task＋Model |
| IA-000013 | 再選定条件（Fallback Condition） | 再選定する条件 | 選択結果（Selection）へ結合 |

同じ画面や応答へ置く場合も、上表の独立軸を一つの成功・信頼・完了へ畳まない。重要な不足、制限、判断要否は詳細へ隠さない。

### 操作とFeedback

主要な操作・判断: 選ぶ／構成を検証する／更新する。

| UX分析 | 利用者が行う判断・行動 | 重要な場面 | 必要なFeedback | 避ける失敗 |
|---|---|---|---|---|
| UX-000016 | 固定Commitに対応するツール／実行基盤と利用可能性を知る | 発見したツール／実行基盤を起動する直前 | Commit・配布集合・Manifest・実行基盤の対応を検証する | 版不一致・欠落実行基盤・改ざんManifestを対応版と誤認する |
| UX-000018 | AIモデル選択を検証可能な構成として更新する | AI提供元で実行する前のモデル確定 | 構成変更を検証し実効選択を観測可能にする | 未知または非対応のモデルを実行可能と表示する |

UI部品や通信方式はここで固定しない。各UX行のFeedbackを、IAの状態・導線と対応付けて表示する。

### 状態と表示差

| UX／IAの対応 | 区別する状態 | 状態から進む導線 |
|---|---|---|
| UX-000016／IA-000011 | 利用可能（available）／利用不能（unavailable）／未確認（unverified）／停止（blocked） | 仕事→必要能力→登録Tool→配布根拠→起動 |
| UX-000018／IA-000013 | 有効（valid）／無効（invalid）／利用可能（available）／利用不能（unavailable）／選択済み（selected） | 設定→検証→利用可能候補→選択→理由・再選定条件 |

上表にない処理中、取消、回復その他の状態を一律に追加しない。値なし、未観測、古い値、競合、開示制限または結果不明は、該当するIA定義が要求する場合にだけ別状態として示す。

### 視覚表現とアクセシビリティ

- 「利用能力（Capability）、利用可否（Availability）、実行権限（Authority）、配布物（Distribution）、配布目録（Manifest）、実行環境との結合（Runtime Binding）、AIモデル（Model）、構成（Configuration）、作業上の役割（Task Role）、選択結果（Selection）、再選定条件（Fallback Condition）」を、色だけでなく表示名、状態語、順序でも見分けられるようにする。
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
| [Tool CapabilityとAIモデル構成のArchitecture定義](../../Definitions/ARCH-000010/architecture_definition.md) | Capability RegistryとModel Configuration Resolver | UI契約はAuthorityを発行しない。利用者操作: 選ぶ／構成を検証する／更新する | UI契約はEffectを定義しない。表示上の状態差: 利用可能（available）／利用不能（unavailable）／未確認（unverified）／停止（blocked）。導線: 仕事→必要能力→登録Tool→配布根拠→起動 | 利用者成果を壊す表示・操作: UIだけに正本、決定権限、業務ロジックまたは独自状態Storeを作らない。 |

## 4. Architecture処置

| Architecture定義候補 | 処置 | 判断理由 |
|---|---|---|
| [Tool CapabilityとAIモデル構成](../../Definitions/ARCH-000010/architecture_definition.md) | New | Toolのavailable／unavailable／unverified／blockedと、モデル構成のvalid／invalid／selectedを分ける。コード埋込みのモデル一覧ではなく検証済み外部構成から選ぶ。 |

## 5. SPEC観点との統合時に確認すること

- 対応候補: SPEC-000014、SPEC-000015
- この分析にある状態、操作、Feedback、Authority、Effectの適用／非適用、失敗を、対応SPECの契機と結果へ一つずつ照合する。
- 差分がある場合はArchitectureで推測せず、UI／SPEC対応レビューへ戻す。
