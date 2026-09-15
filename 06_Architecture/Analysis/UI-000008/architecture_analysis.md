# UI-000008のArchitecture分析

成果物種別: Architecture分析（UI観点）
分析単位: `UI-000008`
状態: Canonical

## 1. 正式入力

- UI定義: [UI-000008 Workspace接続と利用可能範囲](../../../04_UI/Definitions/UI-000008/ui_definition.md)

このUI定義だけを正式入力とする。反対観点、上流工程、現行Architectureまたは実装から不足する意味を補わない。

## 2. Architectureへ引き継ぐUI契約

### 利用者成果

接続資格で許可されたWorkspaceだけを利用できる。

### 表示面と情報の優先順位

```text
Workspace接続と利用可能範囲
        ↓
接続資格（Connection Credential）／接続中の作業単位（Session）／利用可能領域（Workspace Grant）／作業領域（Workspace）／公開関係（Exposure）／管理能力（System Capability）
        ↓
現在状態・不足・制限
        ↓
接続→接続単位→許可された作業領域→公開されたリポジトリ→情報源
```

| IA分析 | 独立して見分ける対象 | 利用者にとっての意味 | 識別・関係 |
|---|---|---|---|
| IA-000009 | 接続資格（Connection Credential） | 接続を認証する資格 | 接続資格識別子（Credential ID） |
| IA-000009 | 接続中の作業単位（Session） | 一回の接続文脈 | 接続単位識別子（Session ID） |
| IA-000009 | 利用可能領域（Workspace Grant） | 接続中の作業単位（Session）が利用できる作業領域集合 | 接続資格（Credential）から発行 |
| IA-000009 | 作業領域（Workspace） | Repository公開のまとまり | 作業領域識別子（Workspace ID） |
| IA-000009 | 公開関係（Exposure） | RepositoryをWorkspaceへ公開する関係 | Workspace＋Repository |
| IA-000009 | 管理能力（System Capability） | サーバー（Server）の管理能力 | 接続中の作業単位（Session）へ別途結合 |

同じ画面や応答へ置く場合も、上表の独立軸を一つの成功・信頼・完了へ畳まない。重要な不足、制限、判断要否は詳細へ隠さない。

### 操作とFeedback

主要な操作・判断: 接続する／Workspaceを選ぶ／再認証する。

| UX分析 | 利用者が行う判断・行動 | 重要な場面 | 必要なFeedback | 避ける失敗 |
|---|---|---|---|---|
| UX-000013 | 許可された作業領域だけへ接続する | 利用可能情報を表示する時 | 現在の利用許可範囲（Grant）だけを開示し不足を補完しない | 利用不能なリポジトリの存在や内容を推測表示する |

UI部品や通信方式はここで固定しない。各UX行のFeedbackを、IAの状態・導線と対応付けて表示する。

### 状態と表示差

| UX／IAの対応 | 区別する状態 | 状態から進む導線 |
|---|---|---|
| UX-000013／IA-000009 | 利用可能（available）／接続資格が必要（credential_required）／開示制限（restricted）／利用不能（unavailable）／不明（unknown） | 接続→接続単位→許可された作業領域→公開されたリポジトリ→情報源 |

上表にない処理中、取消、回復その他の状態を一律に追加しない。値なし、未観測、古い値、競合、開示制限または結果不明は、該当するIA定義が要求する場合にだけ別状態として示す。

### 視覚表現とアクセシビリティ

- 「接続資格（Connection Credential）、接続中の作業単位（Session）、利用可能領域（Workspace Grant）、作業領域（Workspace）、公開関係（Exposure）、管理能力（System Capability）」を、色だけでなく表示名、状態語、順序でも見分けられるようにする。
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
| [Workspace利用範囲とRepository FederationのArchitecture定義](../../Definitions/workspace-access-federation/architecture_definition.md) | CROS Session／Workspace Resolver | UI契約はAuthorityを発行しない。利用者操作: 接続する／Workspaceを選ぶ／再認証する | UI契約はEffectを定義しない。表示上の状態差: 利用可能（available）／接続資格が必要（credential_required）／開示制限（restricted）／利用不能（unavailable）／不明（unknown）。導線: 接続→接続単位→許可された作業領域→公開されたリポジトリ→情報源 | 利用者成果を壊す表示・操作: UIだけに正本、決定権限、業務ロジックまたは独自状態Storeを作らない。 |

## 4. Architecture処置

| Architecture定義候補 | 処置 | 判断理由 |
|---|---|---|
| [Workspace利用範囲とRepository Federation](../../Definitions/workspace-access-federation/architecture_definition.md) | New | credential_required／restricted／unavailable／unknownを区別し、Credential→Session→Workspace Grant→Exposure→Repositoryの順で利用範囲を決める。 |

## 5. SPEC観点との統合時に確認すること

- 対応候補: SPEC-000012
- この分析にある状態、操作、Feedback、Authority、Effectの適用／非適用、失敗を、対応SPECの契機と結果へ一つずつ照合する。
- 差分がある場合はArchitectureで推測せず、UI／SPEC対応レビューへ戻す。
