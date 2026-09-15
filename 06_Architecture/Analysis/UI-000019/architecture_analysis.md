# UI-000019のArchitecture分析

成果物種別: Architecture分析（UI観点）
分析単位: `UI-000019`
状態: Canonical

## 1. 正式入力

- UI定義: [UI-000019 公式素材の由来・権利・用途確認](../../../04_UI/Definitions/UI-000019/ui_definition.md)

このUI定義だけを正式入力とする。反対観点、上流工程、現行Architectureまたは実装から不足する意味を補わない。

## 2. Architectureへ引き継ぐUI契約

### 利用者成果

素材の由来と許可された用途を確認して安心して使える。

### 表示面と情報の優先順位

```text
公式素材の由来・権利・用途確認
        ↓
素材（Asset）／由来（Provenance）／権利確認（Rights Statement）／許可用途（Allowed Use）／派生物（Derivative）
        ↓
現在状態・不足・制限
        ↓
素材→由来→権利→用途→収載・派生
```

| IA分析 | 独立して見分ける対象 | 利用者にとっての意味 | 識別・関係 |
|---|---|---|---|
| IA-000019 | 素材（Asset） | 利用候補の視覚・文章素材 | 素材識別子（Asset Identity） |
| IA-000019 | 由来（Provenance） | 生成・取得・編集の由来 | 情報源（Source）と履歴 |
| IA-000019 | 権利確認（Rights Statement） | 収載・公開・再配布の権利根拠 | 権限（Authority）と記録 |
| IA-000019 | 許可用途（Allowed Use） | 許可された用途 | 素材（Asset）＋Scope |
| IA-000019 | 派生物（Derivative） | 原本から作成した派生物 | 元素材との関係（Parent Asset Relation） |

同じ画面や応答へ置く場合も、上表の独立軸を一つの成功・信頼・完了へ畳まない。重要な不足、制限、判断要否は詳細へ隠さない。

### 操作とFeedback

主要な操作・判断: 素材を見る／根拠を確認する／利用する。

| UX分析 | 利用者が行う判断・行動 | 重要な場面 | 必要なFeedback | 避ける失敗 |
|---|---|---|---|---|
| UX-000030 | 視覚素材の出所・権利・用途を確認する | 公式用途へ採用する直前 | 由来・権利・用途を追跡する | 見た目だけで権利や信頼保証を推定する |

UI部品や通信方式はここで固定しない。各UX行のFeedbackを、IAの状態・導線と対応付けて表示する。

### 状態と表示差

| UX／IAの対応 | 区別する状態 | 状態から進む導線 |
|---|---|---|
| UX-000030／IA-000019 | 候補（candidate）／採用済み（approved）／開示制限（restricted）／取下げ済み（withdrawn） | 素材→由来→権利→用途→収載・派生 |

上表にない処理中、取消、回復その他の状態を一律に追加しない。値なし、未観測、古い値、競合、開示制限または結果不明は、該当するIA定義が要求する場合にだけ別状態として示す。

### 視覚表現とアクセシビリティ

- 「素材（Asset）、由来（Provenance）、権利確認（Rights Statement）、許可用途（Allowed Use）、派生物（Derivative）」を、色だけでなく表示名、状態語、順序でも見分けられるようにする。
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
| [公式素材の権利・用途確認のArchitecture定義](../../Definitions/ARCH-000017/architecture_definition.md) | 公式Repositoryの素材収載判断 | UI契約はAuthorityを発行しない。利用者操作: 素材を見る／根拠を確認する／利用する | UI契約はEffectを定義しない。表示上の状態差: 候補（candidate）／採用済み（approved）／開示制限（restricted）／取下げ済み（withdrawn）。導線: 素材→由来→権利→用途→収載・派生 | 利用者成果を壊す表示・操作: UIだけに正本、決定権限、業務ロジックまたは独自状態Storeを作らない。 |

## 4. Architecture処置

| Architecture定義候補 | 処置 | 判断理由 |
|---|---|---|
| [公式素材の権利・用途確認](../../Definitions/ARCH-000017/architecture_definition.md) | New | candidate／approved／restricted／withdrawnを区別し、生成手段や見た目だけから公開・再配布権を推定しない。 |

## 5. SPEC観点との統合時に確認すること

- 対応候補: SPEC-000024
- この分析にある状態、操作、Feedback、Authority、Effectの適用／非適用、失敗を、対応SPECの契機と結果へ一つずつ照合する。
- 差分がある場合はArchitectureで推測せず、UI／SPEC対応レビューへ戻す。
