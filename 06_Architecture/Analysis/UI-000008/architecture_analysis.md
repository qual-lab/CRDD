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

### UX観点の分析結果

| UX分析 | このUIで保持する利用者成果 |
|---|---|
| [UX-000013](../../../04_UI/Analysis/UX-000013/ui_analysis.md) | 接続元や接続資格情報が変わっても、現在許可された作業領域だけを利用し、利用不能理由と管理能力を内容閲覧から区別できる |

### IA観点の分析結果

| IA分析 | このUIで保持する情報構造 |
|---|---|
| [IA-000009](../../../04_UI/Analysis/IA-000009/ui_analysis.md) | 現在の接続で許可された作業領域とRepositoryだけを利用し、管理能力と内容閲覧を混同しない。 |

### 両観点の統合判断

| UX分析 | 利用者が得たい結果 | 対応するIA分析 | UIで成立させる対応 |
|---|---|---|---|
| [UX-000013](../../../04_UI/Analysis/UX-000013/ui_analysis.md) | 場所が変わっても開示範囲を理解して安全に使える | [IA-000009](../../../04_UI/Analysis/IA-000009/ui_analysis.md) | 接続資格、接続中の作業単位（Session）、利用可能領域（Workspace Grant）、公開関係（Exposure）、リポジトリの利用可否、管理能力（System Capability）を見分ける。状態は「利用可能（available）／接続資格が必要（credential_required）／開示制限（restricted）／利用不能（unavailable）／不明（unknown）」。導線は「接続→接続単位→許可された作業領域→公開されたリポジトリ→情報源」 |

UIはUX側の目的だけでも、IA側の対象一覧だけでも成立しない。各行の利用者成果を、対応する情報・状態・関係・導線で判断可能にした時だけ、このUIの意味が成立する。

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

### UI／SPEC対応レビューへ渡す項目

両観点の統合内容は前節の正本を参照し、ここへ全文を再掲しない。次表は、SPECが同じUX／IAを別々に分析した後で確定すべき未決事項だけを渡す。

| UX | IA | UIで観測可能にすべき操作・Feedback | SPEC側で未確定の振る舞い |
|---|---|---|---|
| UX-000013 | IA-000009 | 許可された作業領域だけへ接続する。現在の利用許可範囲（Grant）だけを開示し不足を補完しない | IA-000009 が示す状態・関係を入力条件、成功・停止条件へ接続し、「利用不能なリポジトリの存在や内容を推測表示する」を防ぐ観測可能な結果を確定する |

SPECはこの表の結論を転記せず、UX観点とIA観点を別々に分析する。UIの操作に対応する発火条件・結果がない、またはSPECの結果を利用者が認識できない場合は対応レビューを通過しない。

### 対応するSPEC

- pairs_with: [SPEC-000012](../../../05_SPEC/Definitions/SPEC-000012/spec_definition.md)

UIは認識・操作・Feedbackを所有し、SPECの条件・状態・結果をこの節で再定義しない。

### 未確認事項・人間判断・戻り条件

正式入力に残る未確認事項を、解消済みとみなさず次のとおり継承する。

#### UX-000013から継承する確認事項

正式入力: [UX-000013](../../../02_UX/Definitions/UX-000013/ux_definition.md)

未確認事項は、統合元の要求ごとに次を保持する。

- REQ-000011: プロジェクト運営者／PMが「許可された作業領域だけへ接続する」を行う際の判断基準、許容負担、利用環境および失敗後の選択
- 現在判定: 後続の実利用確認が必要。現在のUX定義をCanonical化する判断を止める事項ではない。
- 確認事項: REQ-000011: プロジェクト運営者／PMが「許可された作業領域だけへ接続する」を行う際の判断基準、許容負担、利用環境および失敗後の選択
- 判断者: プロジェクト運営者／PMを代表する利用者とQual-Lab。
- 未確認時の影響: 利用者成果、重要場面、失敗および品質期待を仮説として保持し、定量条件や実現方式を確定しない。
- Discoveryへ戻す条件: 想定した利用者、問題、望ましい変化または制約が誤っていると判明した場合。
- UX分析へ戻す条件: 利用場面、目的、得られる結果、重要場面、失敗または品質期待の統合判断が変わる場合。

再評価契機: 対象利用者による実利用確認、前提変更、または後続工程でこの未確認事項が成立条件へ影響すると判明した時。

#### IA-000009から継承する確認事項

正式入力: [IA-000009](../../../03_IA/Definitions/IA-000009/ia_definition.md)

| 入力UX | UXから継承する確認事項 | 判断者 | 現在判定 | 未確認時の影響 |
|---|---|---|---|---|
| UX-000013 | REQ-000011: プロジェクト運営者／PMが「許可された作業領域だけへ接続する」を行う際の判断基準、許容負担、利用環境および失敗後の選択 | プロジェクト運営者／PMを代表する利用者とQual-Lab。 | 後続の実利用確認が必要。現在のUX定義をCanonical化する判断を止める事項ではない。 | 利用者成果、重要場面、失敗および品質期待を仮説として保持し、定量条件や実現方式を確定しない。 |

IA固有の追加人間判断はない。これは入力UXの未確認事項が解消済みという意味ではない。正式入力にないObject、情報境界、所有責任または状態を追加する必要が生じた場合は人間の決定権限者へ戻す。UI／SPEC分析またはQuality Analysis / IAで対象・同一性・関係・状態・可視性・時間的な意味の不足または競合が判明した場合はIAを再開する。

再評価契機: 対象利用者による実利用確認、前提変更、または後続工程でこの未確認事項が成立条件へ影響すると判明した時。

#### UI固有の追加判断

現時点で追加の判断事項はない。これは上記の継承事項が解消済みという意味ではない。正式入力の意味、対応関係または成立条件に不足・競合が見つかった場合は、その意味を所有するUX／IAへ戻す。

### 検証意図

正常、境界、失敗、判断不能および対応関係を、具体的な試験手順を先取りせず観測可能な意味で確認する。

### 補足定義

なし。

## 3. Architecture観点の分析

| 責務候補 | 状態Owner | 決定権限 | Effect／非該当 | 主な失敗境界 |
|---|---|---|---|---|
| [Workspace利用範囲とRepository FederationのArchitecture定義](../../Definitions/ARCH-000013/architecture_definition.md) | CROS Session／Workspace Resolver | UI契約はAuthorityを発行しない。利用者操作: 接続する／Workspaceを選ぶ／再認証する。 | UI契約はEffectを定義しない。状態・導線: 利用可能（available）／接続資格が必要（credential_required）／開示制限（restricted）／利用不能（unavailable）／不明（unknown） / 接続→接続単位→許可された作業領域→公開されたリポジトリ→情報源 /  | - UIだけに正本、決定権限、業務ロジックまたは独自状態Storeを作らない。 - 表示の都合でUX成果、IAの独立軸、状態、根拠、対象範囲または開示境界を弱めない。 - 視覚詳細はPrototypeで評価し、未評価の候補を完成表示しない。 |

### 観点別評価

| 観点 | 判定 | 根拠・引渡し |
|---|---|---|
| Responsibility | 評価済み | [Workspace利用範囲とRepository FederationのArchitecture定義](../../Definitions/ARCH-000013/architecture_definition.md)へ入力Contractを意味変更せず渡す |
| Boundary／Component／Interface | 評価済み | 状態OwnerはCROS Session／Workspace Resolver。公開境界は入力定義のAuthority・Effect・制約を越えない |
| Data／State Ownership | 評価済み | CROS Session／Workspace ResolverをOwner候補とし、UI表示またはSPEC結果と内部状態を同一視しない |
| Failure／Recovery | 評価済み | - UIだけに正本、決定権限、業務ロジックまたは独自状態Storeを作らない。 - 表示の都合でUX成果、IAの独立軸、状態、根拠、対象範囲または開示境界を弱めない。 - 視覚詳細はPrototypeで評価し、未評価の候補を完成表示しない。 |
| Security／Trust | 評価済み | 入力定義のAuthority、開示、Effect 0および非推定条件を保持する |
| Quality Constraint | 評価済み | 未観測・不明・制限・失敗を成功または不存在へ丸めない |
| Human Input | 継承あり | REQ-000011: プロジェクト運営者／PMが「許可された作業領域だけへ接続する」を行う際の判断基準、許容負担、利用環境および失敗後の選択 |
| Open／Gap | 上流確認を継承 | 現在判定: 後続の実利用確認が必要。現在のUX定義をCanonical化する判断を止める事項ではない。。Architecture固有の追加Gapはない |
| Verification Intent | 評価済み | 正常、境界、失敗、判断不能および対応関係を、具体的な試験手順を先取りせず観測可能な意味で確認する。 |

Human Inputの判断者は「プロジェクト運営者／PMを代表する利用者とQual-Lab。」。再評価契機は「対象利用者による実利用確認、前提変更、または後続工程でこの未確認事項が成立条件へ影響すると判明した時。」。Architectureはこれらを解消済みとせず、入力の意味が変わる場合はOwner工程へ戻す。

## 4. Architecture処置

| Architecture定義候補 | 処置 | 判断理由 |
|---|---|---|
| [Workspace利用範囲とRepository Federation](../../Definitions/ARCH-000013/architecture_definition.md) | New | credential_required／restricted／unavailable／unknownを区別し、Credential→Session→Workspace Grant→Exposure→Repositoryの順で利用範囲を決める。 |

## 5. SPEC観点との統合時に確認すること

- 対応候補: SPEC-000012
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
