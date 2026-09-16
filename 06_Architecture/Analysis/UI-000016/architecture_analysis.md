# UI-000016のArchitecture分析

成果物種別: Architecture分析（UI観点）
分析単位: `UI-000016`
状態: Canonical

## 1. 正式入力

- UI定義: [UI-000016 外部送信の同意・持帰り・採否](../../../04_UI/Definitions/UI-000016/ui_definition.md)

このUI定義だけを正式入力とする。反対観点、上流工程、現行Architectureまたは実装から不足する意味を補わない。

## 2. Architectureへ引き継ぐUI契約

### 利用者成果

外部へ渡す範囲を理解し、戻った候補を採用前に判断できる。

### UX観点の分析結果

| UX分析 | このUIで保持する利用者成果 |
|---|---|
| [UX-000024](../../../04_UI/Analysis/UX-000024/ui_analysis.md) | 外部作用（Effect）の前に送信先・目的・操作・情報分類・許可範囲を理解し、外部情報・反応・依存新版を出典付き候補として扱える |

### IA観点の分析結果

| IA分析 | このUIで保持する情報構造 |
|---|---|
| [IA-000014](../../../04_UI/Analysis/IA-000014/ui_analysis.md) | 必要最小の情報を出所付きで渡し、同じ仕事へ結果と未決事項を戻す。 |
| [IA-000017](../../../04_UI/Analysis/IA-000017/ui_analysis.md) | 外部へ何をなぜ渡すかを判断し、戻った結果を自動採用しない。 |

### 両観点の統合判断

| UX分析 | 利用者が得たい結果 | 対応するIA分析 | UIで成立させる対応 |
|---|---|---|---|
| [UX-000024](../../../04_UI/Analysis/UX-000024/ui_analysis.md) | 不要情報を漏らさず人間判断を保って外部連携できる | [IA-000014](../../../04_UI/Analysis/IA-000014/ui_analysis.md) | 送信先（Destination）、目的（Purpose）、情報分類（Information Classification）、同意（Consent）、送信する最小情報、作業（Task）、持帰り結果（Returned Result）、候補（Candidate）、判断（Decision）を見分ける。状態は「未許可（not_authorized）／許可済み（authorized）／送信済み（sent）／返却済み（returned）／候補（candidate）／採用（adopted）」。採用／却下／保留は既存の判断（Decision）へ返る結果値として認識し、却下／保留をCandidate状態へ追加しない。導線は「送信候補→境界確認→送信する最小情報→送信→出所付き結果→採否」 |
| [UX-000024](../../../04_UI/Analysis/UX-000024/ui_analysis.md) | 不要情報を漏らさず人間判断を保って外部連携できる | [IA-000017](../../../04_UI/Analysis/IA-000017/ui_analysis.md) | 送信先（Destination）、目的（Purpose）、情報分類（Information Classification）、同意（Consent）、送信する最小情報、作業（Task）、持帰り結果（Returned Result）、候補（Candidate）、判断（Decision）を見分ける。状態は「未許可（not_authorized）／許可済み（authorized）／送信済み（sent）／返却済み（returned）／候補（candidate）／採用（adopted）」。採用／却下／保留は既存の判断（Decision）へ返る結果値として認識し、却下／保留をCandidate状態へ追加しない。導線は「送信候補→境界確認→送信する最小情報→送信→出所付き結果→採否」 |

UIはUX側の目的だけでも、IA側の対象一覧だけでも成立しない。各行の利用者成果を、対応する情報・状態・関係・導線で判断可能にした時だけ、このUIの意味が成立する。

### 表示面と情報の優先順位

```text
外部送信の同意・持帰り・採否
        ↓
仕事用情報一式（Context Package）／情報源参照（Source Reference）／選択理由（Selection Reason）／作業（Task）／引き渡し（Handoff）／結果（Result）／判断（Decision）／送信先（Destination）／目的（Purpose）／情報分類（Information Classification）／同意（Consent）／送信情報（Outbound Package）／持帰り候補（Returned Candidate）
        ↓
現在状態・不足・制限
        ↓
送信候補→境界確認→送信する最小情報→送信→出所付き結果→採否
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
| IA-000017 | 送信先（Destination） | 情報の送信先 | 提供先の識別子（Provider／Service Identity） |
| IA-000017 | 目的（Purpose） | 許可する操作目的 | 目的識別子（Purpose Identity） |
| IA-000017 | 情報分類（Information Classification） | 送る情報の分類 | Policyに基づく値 |
| IA-000017 | 同意（Consent） | 主体が許可した範囲 | 送信先（Destination）＋目的（Purpose）＋Scope＋Time |
| IA-000017 | 送信情報（Outbound Package） | 実際に送る最小情報 | 情報源参照（Source Reference）集合 |
| IA-000017 | 持帰り候補（Returned Candidate） | 出所付きの戻り結果 | Task＋送信先（Destination） |

同じ画面や応答へ置く場合も、上表の独立軸を一つの成功・信頼・完了へ畳まない。重要な不足、制限、判断要否は詳細へ隠さない。

### 操作とFeedback

主要な操作・判断: 同意する／送信を止める／候補を採用・却下・保留する。

| UX分析 | 利用者が行う判断・行動 | 重要な場面 | 必要なFeedback | 避ける失敗 |
|---|---|---|---|---|
| UX-000024 | 送信範囲と内部へ戻す際の昇格条件を理解する | 外部作用（Effect）の前、要求受理後にEffect成立を観測できない時、Effect成立後に結果搬送が失敗した時、結果昇格時 | 同意、要求受理、Effect不明、Effect成立、Effect成立・結果不明、結果観測、投影、採用、却下および保留を分離する。Effect不明では成立を推測せず同じ送信依頼を再観測し、Effect成立・結果不明では成立済みEffectを保持して結果搬送または再観測へ戻す。どちらも同じEffectを自動再送しない。却下・保留では所有正本を変更せず、同じ候補と出所へ戻る | 接続済みを包括許可とする、Effect不明またはEffect成立・結果不明を未送信と誤認して二重送信する、外部反応や依存新版を要求・因果・方針へ自動昇格する |

UI部品や通信方式はここで固定しない。各UX行のFeedbackを、IAの状態・導線と対応付けて表示する。

### 状態と表示差

| UX／IAの対応 | 区別する状態 | 状態から進む導線 |
|---|---|---|
| UX-000024／IA-000014 | 未許可（not_authorized）／許可済み（authorized）／要求済み（requested）／受理済み（accepted）／Effect不明（effect_unknown）／Effect成立（effect_established）／Effect成立・結果不明（effect_established_result_unknown）／送信済み（sent）／返却済み（returned）／候補（candidate）／採用（adopted） | 送信候補→境界確認→最小情報→要求→受理→Effect不明なら成立を推測せず同じ依頼を再観測／Effect成立なら結果観測／Effect成立・結果不明なら成立済みEffectを保持して結果搬送または再観測→出所付き結果→採否。採用は候補が所有正本へ反映された状態、却下・保留は同じ候補と出所へ結合した判断（Decision）の結果値として示し、Candidate状態へ追加しない。自動再送は行わない |
| UX-000024／IA-000017 | 未許可（not_authorized）／許可済み（authorized）／要求済み（requested）／受理済み（accepted）／Effect不明（effect_unknown）／Effect成立（effect_established）／Effect成立・結果不明（effect_established_result_unknown）／送信済み（sent）／返却済み（returned）／候補（candidate）／採用（adopted） | 送信候補→境界確認→最小情報→要求→受理→Effect不明なら成立を推測せず同じ依頼を再観測／Effect成立なら結果観測／Effect成立・結果不明なら成立済みEffectを保持して結果搬送または再観測→出所付き結果→採否。採用は候補が所有正本へ反映された状態、却下・保留は同じ候補と出所へ結合した判断（Decision）の結果値として示し、Candidate状態へ追加しない。自動再送は行わない |

上表にない処理中、取消、回復その他の状態を一律に追加しない。値なし、未観測、古い値、競合、開示制限または結果不明は、該当するIA定義が要求する場合にだけ別状態として示す。

### 視覚表現とアクセシビリティ

- 「仕事用情報一式（Context Package）、情報源参照（Source Reference）、選択理由（Selection Reason）、作業（Task）、引き渡し（Handoff）、結果（Result）、判断（Decision）、送信先（Destination）、目的（Purpose）、情報分類（Information Classification）、同意（Consent）、送信情報（Outbound Package）、持帰り候補（Returned Candidate）」を、色だけでなく表示名、状態語、順序でも見分けられるようにする。
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
| UX-000024 | IA-000014 | 同意、要求、受理、Effect不明、Effect成立、Effect成立・結果不明、結果観測、投影を状態・観測Feedbackとして分離する。採用は所有正本への反映結果、却下・保留は同じ候補へ結合した判断（Decision）の結果値として示す | IA-000014が示す状態・関係を入力条件、成功・停止条件へ接続する。要求受理後のEffect不明では成立を推測せず同じ依頼を再観測し、Effect成立・結果不明では成立済みEffectを保持して結果搬送または再観測へ戻り、どちらも自動再送しない。却下・保留では所有正本を変更しない結果を確定する |
| UX-000024 | IA-000017 | 同意、要求、受理、Effect不明、Effect成立、Effect成立・結果不明、結果観測、投影を状態・観測Feedbackとして分離する。採用は所有正本への反映結果、却下・保留は同じ候補へ結合した判断（Decision）の結果値として示す | IA-000017が示す状態・関係を入力条件、成功・停止条件へ接続する。接続済みを包括許可にせず、二つの不明状態を未送信へ畳まず、外部反応を要求・因果・方針へ自動昇格しない。却下・保留では所有正本を変更しない結果を確定する |

SPECはこの表の結論を転記せず、UX観点とIA観点を別々に分析する。UIの操作に対応する発火条件・結果がない、またはSPECの結果を利用者が認識できない場合は対応レビューを通過しない。

### 対応するSPEC

- pairs_with: [SPEC-000021](../../../05_SPEC/Definitions/SPEC-000021/spec_definition.md)、[SPEC-000026](../../../05_SPEC/Definitions/SPEC-000026/spec_definition.md)、[SPEC-000027](../../../05_SPEC/Definitions/SPEC-000027/spec_definition.md)

UIは認識・操作・Feedbackを所有し、SPECの条件・状態・結果をこの節で再定義しない。

### 未確認事項・人間判断・戻り条件

正式入力に残る未確認事項を、解消済みとみなさず次のとおり継承する。

#### UX-000024から継承する確認事項

正式入力: [UX-000024](../../../02_UX/Definitions/UX-000024/ux_definition.md)

未確認事項は、統合元の要求ごとに次を保持する。

- REQ-000027: 外部へ渡す情報の所有者が「送信範囲を理解し帰還結果を候補として扱う」を行う際の判断基準、許容負担、利用環境および失敗後の選択
- 現在判定: 後続の実利用確認が必要。現在のUX定義をCanonical化する判断を止める事項ではない。
- 確認事項: REQ-000027: 外部へ渡す情報の所有者が「送信範囲を理解し帰還結果を候補として扱う」を行う際の判断基準、許容負担、利用環境および失敗後の選択
- 判断者: 外部へ渡す情報の所有者を代表する利用者とQual-Lab。
- 未確認時の影響: 利用者成果、重要場面、失敗および品質期待を仮説として保持し、定量条件や実現方式を確定しない。
- Discoveryへ戻す条件: 想定した利用者、問題、望ましい変化または制約が誤っていると判明した場合。
- UX分析へ戻す条件: 利用場面、目的、得られる結果、重要場面、失敗または品質期待の統合判断が変わる場合。

再評価契機: 対象利用者による実利用確認、前提変更、または後続工程でこの未確認事項が成立条件へ影響すると判明した時。

#### IA-000014から継承する確認事項

正式入力: [IA-000014](../../../03_IA/Definitions/IA-000014/ia_definition.md)

| 入力UX | UXから継承する確認事項 | 判断者 | 現在判定 | 未確認時の影響 |
|---|---|---|---|---|
| UX-000019 | REQ-000017: 外部へ渡す情報の所有者が「必要な情報だけを出所付きで渡す」を行う際の判断基準、許容負担、利用環境および失敗後の選択／REQ-000024: プロジェクト運営者／PMが「境界を越えた結果を同じタスクへ受け取る」を行う際の判断基準、許容負担、利用環境および失敗後の選択／REQ-000027: 外部へ渡す情報の所有者が「送信範囲を理解し帰還結果を候補として扱う」を行う際の判断基準、許容負担、利用環境および失敗後の選択 | 外部へ渡す情報の所有者を代表する利用者とQual-Lab。 | 後続の実利用確認が必要。現在のUX定義をCanonical化する判断を止める事項ではない。 | 利用者成果、重要場面、失敗および品質期待を仮説として保持し、定量条件や実現方式を確定しない。 |
| UX-000021 | REQ-000021: プロジェクト運営者／PMが「切断後に同じ依頼へ戻る」を行う際の判断基準、許容負担、利用環境および失敗後の選択／REQ-000024: プロジェクト運営者／PMが「境界を越えた結果を同じタスクへ受け取る」を行う際の判断基準、許容負担、利用環境および失敗後の選択 | プロジェクト運営者／PMを代表する利用者とQual-Lab。 | 後続の実利用確認が必要。現在のUX定義をCanonical化する判断を止める事項ではない。 | 利用者成果、重要場面、失敗および品質期待を仮説として保持し、定量条件や実現方式を確定しない。 |
| UX-000024 | REQ-000027: 外部へ渡す情報の所有者が「送信範囲を理解し帰還結果を候補として扱う」を行う際の判断基準、許容負担、利用環境および失敗後の選択 | 外部へ渡す情報の所有者を代表する利用者とQual-Lab。 | 後続の実利用確認が必要。現在のUX定義をCanonical化する判断を止める事項ではない。 | 利用者成果、重要場面、失敗および品質期待を仮説として保持し、定量条件や実現方式を確定しない。 |

IA固有の追加人間判断はない。これは入力UXの未確認事項が解消済みという意味ではない。正式入力にないObject、情報境界、所有責任または状態を追加する必要が生じた場合は人間の決定権限者へ戻す。UI／SPEC分析またはQuality Analysis / IAで対象・同一性・関係・状態・可視性・時間的な意味の不足または競合が判明した場合はIAを再開する。

再評価契機: 対象利用者による実利用確認、前提変更、または後続工程でこの未確認事項が成立条件へ影響すると判明した時。

#### IA-000017から継承する確認事項

正式入力: [IA-000017](../../../03_IA/Definitions/IA-000017/ia_definition.md)

| 入力UX | UXから継承する確認事項 | 判断者 | 現在判定 | 未確認時の影響 |
|---|---|---|---|---|
| UX-000024 | REQ-000027: 外部へ渡す情報の所有者が「送信範囲を理解し帰還結果を候補として扱う」を行う際の判断基準、許容負担、利用環境および失敗後の選択 | 外部へ渡す情報の所有者を代表する利用者とQual-Lab。 | 後続の実利用確認が必要。現在のUX定義をCanonical化する判断を止める事項ではない。 | 利用者成果、重要場面、失敗および品質期待を仮説として保持し、定量条件や実現方式を確定しない。 |

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
| [外部送信・結果帰還・候補採用のArchitecture定義](../../Definitions/ARCH-000015/architecture_definition.md) | External Information Boundary | UI契約はAuthorityを発行しない。利用者操作: 同意する／送信を止める／候補を採用・却下・保留する。 | UI契約はEffectを定義しない。状態・導線: 未許可（not_authorized）／許可済み（authorized）／要求済み（requested）／受理済み（accepted）／Effect不明（effect_unknown）／Effect成立（effect_established）／Effect成立・結果不明（effect_established_result_unknown）／送信済み（sent）／返却済み（returned）／候補（candidate）／採用（adopted） / 送信候補→境界確認→最小情報→要求→受理→Effect不明なら成立を推測せず同じ依頼を再観測／Effect成立なら結果観測／Effect成立・結果不明なら成立済みEffectを保持して結果搬送または再観測→出所付き結果→採否。採用は候補が所有正本へ反映された状態、却下・保留は同じ候補と出所へ結合した判断（Decision）の結果値として示し、Candidate状態へ追加しない。自動再送は行わない / ；未許可（not_authorized）／許可済み（authorized）／要求済み（requested）／受理済み（accepted）／Effect不明（effect_unknown）／Effect成立（effect_established）／Effect成立・結果不明（effect_established_result_unknown）／送信済み（sent）／返却済み（returned）／候補（candidate）／採用（adopted） / 送信候補→境界確認→最小情報→要求→受理→Effect不明なら成立を推測せず同じ依頼を再観測／Effect成立なら結果観測／Effect成立・結果不明なら成立済みEffectを保持して結果搬送または再観測→出所付き結果→採否。採用は候補が所有正本へ反映された状態、却下・保留は同じ候補と出所へ結合した判断（Decision）の結果値として示し、Candidate状態へ追加しない。自動再送は行わない /  | - UIだけに正本、決定権限、業務ロジックまたは独自状態Storeを作らない。 - 表示の都合でUX成果、IAの独立軸、状態、根拠、対象範囲または開示境界を弱めない。 - 視覚詳細はPrototypeで評価し、未評価の候補を完成表示しない。 |

### 観点別評価

| 観点 | 判定 | 根拠・引渡し |
|---|---|---|
| Responsibility | 評価済み | [外部送信・結果帰還・候補採用のArchitecture定義](../../Definitions/ARCH-000015/architecture_definition.md)へ入力Contractを意味変更せず渡す |
| Boundary／Component／Interface | 評価済み | 状態OwnerはExternal Information Boundary。公開境界は入力定義のAuthority・Effect・制約を越えない |
| Data／State Ownership | 評価済み | External Information BoundaryをOwner候補とし、UI表示またはSPEC結果と内部状態を同一視しない |
| Failure／Recovery | 評価済み | - UIだけに正本、決定権限、業務ロジックまたは独自状態Storeを作らない。 - 表示の都合でUX成果、IAの独立軸、状態、根拠、対象範囲または開示境界を弱めない。 - 視覚詳細はPrototypeで評価し、未評価の候補を完成表示しない。 |
| Security／Trust | 評価済み | 入力定義のAuthority、開示、Effect 0および非推定条件を保持する |
| Quality Constraint | 評価済み | 未観測・不明・制限・失敗を成功または不存在へ丸めない |
| Human Input | 継承あり | REQ-000027: 外部へ渡す情報の所有者が「送信範囲を理解し帰還結果を候補として扱う」を行う際の判断基準、許容負担、利用環境および失敗後の選択 |
| Open／Gap | 上流確認を継承 | 現在判定: 後続の実利用確認が必要。現在のUX定義をCanonical化する判断を止める事項ではない。。Architecture固有の追加Gapはない |
| Verification Intent | 評価済み | 正常、境界、失敗、判断不能および対応関係を、具体的な試験手順を先取りせず観測可能な意味で確認する。 |

Human Inputの判断者は「外部へ渡す情報の所有者を代表する利用者とQual-Lab。」。再評価契機は「対象利用者による実利用確認、前提変更、または後続工程でこの未確認事項が成立条件へ影響すると判明した時。」。Architectureはこれらを解消済みとせず、入力の意味が変わる場合はOwner工程へ戻す。

## 4. Architecture処置

| Architecture定義候補 | 処置 | 判断理由 |
|---|---|---|
| [外部送信・結果帰還・候補採用](../../Definitions/ARCH-000015/architecture_definition.md) | New | not_authorized→authorized→sent→returned→candidate→adoptedを別AuthorityとEffectにし、送信、受領、採用を相互流用しない。 |

## 5. SPEC観点との統合時に確認すること

- 対応候補: SPEC-000021、SPEC-000026、SPEC-000027
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
