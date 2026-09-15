# UI-000018のArchitecture分析

成果物種別: Architecture分析（UI観点）
分析単位: `UI-000018`
状態: Canonical

## 1. 正式入力

- UI定義: [UI-000018 文書の物語・構造・図のNavigation](../../../04_UI/Definitions/UI-000018/ui_definition.md)

このUI定義だけを正式入力とする。反対観点、上流工程、現行Architectureまたは実装から不足する意味を補わない。

## 2. Architectureへ引き継ぐUI契約

### 利用者成果

課題から結論までを理解し、図と正本から次工程の意図を辿れる。

### 表示面と情報の優先順位

```text
文書の物語・構造・図のNavigation
        ↓
物語（Narrative）／構造化した詳細（Structured Detail）／図（Diagram）／図の要素（Diagram Element）／判断（Decision）／引継ぎ義務（Handoff Obligation）
        ↓
現在状態・不足・制限
        ↓
問題と目的→判断→構造化詳細→根拠→次工程／上流意図→工程図→要素の意味→下流義務
```

| IA分析 | 独立して見分ける対象 | 利用者にとっての意味 | 識別・関係 |
|---|---|---|---|
| IA-000018 | 物語（Narrative） | 問題・目的・判断へ至る物語 | 成果物内の意味順序 |
| IA-000018 | 構造化した詳細（Structured Detail） | 条件・関係・状態の構造表現 | 物語（Narrative）へ結合 |
| IA-000018 | 図（Diagram） | 工程の関係・流れを示す投影 | 図（Diagram） Type＋Scope |
| IA-000018 | 図の要素（Diagram Element） | 図中の対象・関係 | 凡例に従う文書内識別子（Local Identity） |
| IA-000018 | 判断（Decision） | 採用した判断と理由 | 決定権限（Decision Authority）＋改訂版（Revision） |
| IA-000018 | 引継ぎ義務（Handoff Obligation） | 次工程が失ってはならない意味 | 情報源（Source） Contextへ結合 |

同じ画面や応答へ置く場合も、上表の独立軸を一つの成功・信頼・完了へ畳まない。重要な不足、制限、判断要否は詳細へ隠さない。

### 操作とFeedback

主要な操作・判断: 概要を読む／図から詳細へ進む／正本を開く。

| UX分析 | 利用者が行う判断・行動 | 重要な場面 | 必要なFeedback | 避ける失敗 |
|---|---|---|---|---|
| UX-000027 | 課題と判断の物語から構造化詳細へ進む | 判断理由と条件を結び付ける場面 | 物語と構造化した情報を両立する | 確認項目順と専門語だけで文書を埋める |
| UX-000028 | 工程固有の図から状態・関係・未接続を理解する | 下流義務へ変換する場面 | 図の意味・凡例・正本関係を固定する | 必要な図を黙って省略しAIごとに記法が変わる |

UI部品や通信方式はここで固定しない。各UX行のFeedbackを、IAの状態・導線と対応付けて表示する。

### 状態と表示差

| UX／IAの対応 | 区別する状態 | 状態から進む導線 |
|---|---|---|
| UX-000027／IA-000018 | 下書き（draft）／レビュー済み（reviewed）／現在有効（current）／履歴（historical）を必要時に区別 | 問題と目的→判断→構造化詳細→根拠→次工程 |
| UX-000028／IA-000018 | 作成済み（created）／参照（referenced）／理由付き非該当（not_applicable with reason） | 上流意図→工程図→要素の意味→下流義務 |

上表にない処理中、取消、回復その他の状態を一律に追加しない。値なし、未観測、古い値、競合、開示制限または結果不明は、該当するIA定義が要求する場合にだけ別状態として示す。

### 視覚表現とアクセシビリティ

- 「物語（Narrative）、構造化した詳細（Structured Detail）、図（Diagram）、図の要素（Diagram Element）、判断（Decision）、引継ぎ義務（Handoff Obligation）」を、色だけでなく表示名、状態語、順序でも見分けられるようにする。
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
| [機械検査と文書検査のArchitecture定義](../../Definitions/checker-and-document-validation/architecture_definition.md) | Checker CoreとCRDD現行Profile | UI契約はAuthorityを発行しない。利用者操作: 概要を読む／図から詳細へ進む／正本を開く | UI契約はEffectを定義しない。表示上の状態差: 下書き（draft）／レビュー済み（reviewed）／現在有効（current）／履歴（historical）を必要時に区別。導線: 問題と目的→判断→構造化詳細→根拠→次工程 | 利用者成果を壊す表示・操作: UIだけに正本、決定権限、業務ロジックまたは独自状態Storeを作らない。 |

## 4. Architecture処置

| Architecture定義候補 | 処置 | 判断理由 |
|---|---|---|
| [機械検査と文書検査](../../Definitions/checker-and-document-validation/architecture_definition.md) | Same | 機械で確定できる不備だけをCheckerが返し、解釈を要する内容は対象と改訂版を保ったまま意味レビューへ渡す。文書の読みやすさや図の意味を、見出しの存在だけから合格としない。 |

## 5. SPEC観点との統合時に確認すること

- 対応候補: SPEC-000001、SPEC-000023
- この分析にある状態、操作、Feedback、Authority、Effectの適用／非適用、失敗を、対応SPECの契機と結果へ一つずつ照合する。
- 差分がある場合はArchitectureで推測せず、UI／SPEC対応レビューへ戻す。
