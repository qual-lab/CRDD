# UI-000009のArchitecture分析

成果物種別: Architecture分析（UI観点）
分析単位: `UI-000009`
状態: Canonical

## 1. 正式入力

- UI定義: [UI-000009 Meeting・Topic・候補の処置](../../../04_UI/Definitions/UI-000009/ui_definition.md)

このUI定義だけを正式入力とする。反対観点、上流工程、現行Architectureまたは実装から不足する意味を補わない。

## 2. Architectureへ引き継ぐUI契約

### 利用者成果

会議内容から継続論点や候補を見つけ、採否へ進める。

### 表示面と情報の優先順位

```text
Meeting・Topic・候補の処置
        ↓
会議（Meeting）／会議項目（Meeting Item）／候補（Candidate）／論点（Topic）／関係（Relation）／判断（Decision）
        ↓
現在状態・不足・制限
        ↓
Meeting→Item→候補→既存Topic比較→採否→所有正本
```

| IA分析 | 独立して見分ける対象 | 利用者にとっての意味 | 識別・関係 |
|---|---|---|---|
| IA-000010 | 会議（Meeting） | 時間境界を持つ対話 | Meeting ID |
| IA-000010 | 会議項目（Meeting Item） | 会議内の観察・問い・判断候補 | Meeting内Identity |
| IA-000010 | 候補（Candidate） | 正本更新前の提案 | 候補（Candidate） ID |
| IA-000010 | 論点（Topic） | 継続して扱う論点 | Topic ID |
| IA-000010 | 関係（Relation） | 同一・関連・派生等の判断 | 対象Identityと種類 |
| IA-000010 | 判断（Decision） | 採用・却下・保留 | 権限（Authority）と改訂版（Revision） |

同じ画面や応答へ置く場合も、上表の独立軸を一つの成功・信頼・完了へ畳まない。重要な不足、制限、判断要否は詳細へ隠さない。

### 操作とFeedback

主要な操作・判断: 候補化する／比較する／採用・却下する。

| UX分析 | 利用者が行う判断・行動 | 重要な場面 | 必要なFeedback | 避ける失敗 |
|---|---|---|---|---|
| UX-000014 | 会議の内容を候補として整理し正本へつなぐ | 候補を採用または却下する場面 | 候補・判断・反映結果を区別する | 会議記録が自動的に正本へ昇格する |

UI部品や通信方式はここで固定しない。各UX行のFeedbackを、IAの状態・導線と対応付けて表示する。

### 状態と表示差

| UX／IAの対応 | 区別する状態 | 状態から進む導線 |
|---|---|---|
| UX-000014／IA-000010 | 観測済み（observed）／候補（candidate）／採用（adopted）／却下（rejected）。会話と正本を分ける | Meeting→Item→候補→既存Topic比較→採否→所有正本 |

上表にない処理中、取消、回復その他の状態を一律に追加しない。値なし、未観測、古い値、競合、開示制限または結果不明は、該当するIA定義が要求する場合にだけ別状態として示す。

### 視覚表現とアクセシビリティ

- 「会議（Meeting）、会議項目（Meeting Item）、候補（Candidate）、論点（Topic）、関係（Relation）、判断（Decision）」を、色だけでなく表示名、状態語、順序でも見分けられるようにする。
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
| [Meeting候補と正本への引渡しのArchitecture定義](../../Definitions/ARCH-000006/architecture_definition.md) | Project Operation Context | UI契約はAuthorityを発行しない。利用者操作: 候補化する／比較する／採用・却下する | UI契約はEffectを定義しない。表示上の状態差: 観測済み（observed）／候補（candidate）／採用（adopted）／却下（rejected）。会話と正本を分ける。導線: Meeting→Item→候補→既存Topic比較→採否→所有正本 | 利用者成果を壊す表示・操作: UIだけに正本、決定権限、業務ロジックまたは独自状態Storeを作らない。 |

## 4. Architecture処置

| Architecture定義候補 | 処置 | 判断理由 |
|---|---|---|
| [Meeting候補と正本への引渡し](../../Definitions/ARCH-000006/architecture_definition.md) | New | Meeting内の観測、候補、採用、却下を区別し、候補作成と正本更新のAuthorityを分ける。媒体ではなく項目の目的で候補種別を決める。 |

## 5. SPEC観点との統合時に確認すること

- 対応候補: SPEC-000013
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
