# UI-000014のArchitecture分析

成果物種別: Architecture分析（UI観点）
分析単位: `UI-000014`
状態: Canonical

## 1. 正式入力

- UI定義: [UI-000014 成立済み能力と利用側の確認](../../../04_UI/Definitions/UI-000014/ui_definition.md)

このUI定義だけを正式入力とする。反対観点、上流工程、現行Architectureまたは実装から不足する意味を補わない。

## 2. Architectureへ引き継ぐUI契約

### 利用者成果

内部変更後も以前の能力がどこで保たれたか確認できる。

### 表示面と情報の優先順位

```text
成立済み能力と利用側の確認
        ↓
利用能力（Capability）／正式契約（Canonical Contract）／利用側（Consumer）／置換先（Replacement）／能力維持の根拠（Preservation Evidence）
        ↓
現在状態・不足・制限
        ↓
変更→能力→全利用側→置換→反証根拠
```

| IA分析 | 独立して見分ける対象 | 利用者にとっての意味 | 識別・関係 |
|---|---|---|---|
| IA-000005 | 利用能力（Capability） | 成立済みの利用者能力 | 名称と基準版の根拠（Baseline Evidence） |
| IA-000005 | 正式契約（Canonical Contract） | 能力の意味契約 | 責任者（Owner）と改訂版（Revision） |
| IA-000005 | 利用側（Consumer） | 契約を利用する入口・派生・配布経路 | 公開入口または責任で識別 |
| IA-000005 | 置換先（Replacement） | 変更後の所有者と実装 | Contractへ結合 |
| IA-000005 | 能力維持の根拠（Preservation Evidence） | 能力保存の反証根拠 | Consumerごとに結合 |

同じ画面や応答へ置く場合も、上表の独立軸を一つの成功・信頼・完了へ畳まない。重要な不足、制限、判断要否は詳細へ隠さない。

### 操作とFeedback

主要な操作・判断: 対応を見る／不足箇所へ進む。

| UX分析 | 利用者が行う判断・行動 | 重要な場面 | 必要なFeedback | 避ける失敗 |
|---|---|---|---|---|
| UX-000007 | 維持・変更・廃止された能力と利用側を確認する | 変更を完了・公開可能と判断する直前 | 旧能力・全利用側・置換根拠を閉じる | 主経路だけ移行し副次利用側を取り残す |

UI部品や通信方式はここで固定しない。各UX行のFeedbackを、IAの状態・導線と対応付けて表示する。

### 状態と表示差

| UX／IAの対応 | 区別する状態 | 状態から進む導線 |
|---|---|---|
| UX-000007／IA-000005 | 維持／変更／廃止／未確認 | 変更→能力→全利用側→置換→反証根拠 |

上表にない処理中、取消、回復その他の状態を一律に追加しない。値なし、未観測、古い値、競合、開示制限または結果不明は、該当するIA定義が要求する場合にだけ別状態として示す。

### 視覚表現とアクセシビリティ

- 「利用能力（Capability）、正式契約（Canonical Contract）、利用側（Consumer）、置換先（Replacement）、能力維持の根拠（Preservation Evidence）」を、色だけでなく表示名、状態語、順序でも見分けられるようにする。
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
| [契約移行と利用側閉包のArchitecture定義](../../Definitions/ARCH-000002/architecture_definition.md) | 変更影響分析とConsumer Closure契約 | UI契約はAuthorityを発行しない。利用者操作: 対応を見る／不足箇所へ進む | UI契約はEffectを定義しない。表示上の状態差: 維持／変更／廃止／未確認。導線: 変更→能力→全利用側→置換→反証根拠 | 利用者成果を壊す表示・操作: UIだけに正本、決定権限、業務ロジックまたは独自状態Storeを作らない。 |

## 4. Architecture処置

| Architecture定義候補 | 処置 | 判断理由 |
|---|---|---|
| [契約移行と利用側閉包](../../Definitions/ARCH-000002/architecture_definition.md) | New | 変更ファイルではなく移動した意味契約から利用側集合を導出し、宣言集合と実ソース集合を比較する。CanonicalなPath・Identity・StateをConsumer側で再解釈させない。 |

## 5. SPEC観点との統合時に確認すること

- 対応候補: SPEC-000019
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
