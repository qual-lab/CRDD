# 機械検査と文書検査のArchitecture定義

成果物種別: Architecture定義
Architecture ID: `ARCH-000001`
状態: Canonical
維持責任者: Qual-Lab

## 1. 責務と境界

機械で確定できる不備だけをCheckerが返し、解釈を要する内容は対象と改訂版を保ったまま意味レビューへ渡す。文書の読みやすさや図の意味を、見出しの存在だけから合格としない。

| 区分 | 内容 |
|---|---|
| 状態Owner | Checker CoreとCRDD現行Profile |
| 所有する責務 | 決定論的なRepository検査、文書構造検査、意味レビューへの案内 |
| 所有しない責務 | 意味の採否、独立レビュー、工程移行・Release判断 |
| 主な外部境界 | Repository正本、Checker利用者、独立レビュー |

## 2. UI観点の入力

| UI分析 | 守る利用者向けの約束 |
|---|---|
| [UI-000001](../../Analysis/UI-000001/architecture_analysis.md) | 事前検査と意味レビューへの案内 |
| [UI-000018](../../Analysis/UI-000018/architecture_analysis.md) | 文書の物語・構造・図のNavigation |

## 3. SPEC観点の入力

| SPEC分析 | 守る振る舞い契約 |
|---|---|
| [SPEC-000001](../../Analysis/SPEC-000001/architecture_analysis.md) | 事前検査を実行し意味レビューへ案内する |
| [SPEC-000023](../../Analysis/SPEC-000023/architecture_analysis.md) | 文書の物語・構造・図と工程引継ぎを検査する |

## 4. 両観点の統合判断

入力ごとの状態Owner、Authority、Effect、失敗およびlifecycleを次表で分ける。同じ責務に統合しても、読取り、分類、書込み、外部Effectまたは再接続を相互流用しない。

| 入力 | 観点 | State Owner | Authority | Effect／非該当 | Failure Boundary | Lifecycle |
|---|---|---|---|---|---|---|
| UI-000001 | UI | Checker CoreとCRDD現行Profile | UI契約はAuthorityを発行しない。利用者操作: 検査を実行する／指摘箇所へ進む | UI契約はEffectを定義しない。表示上の状態差: 検査前／不備あり／機械確認済み。意味判断は別状態。導線: 対象→指摘→場所→所有成果物 | 利用者成果を壊す表示・操作: UIだけに正本、決定権限、業務ロジックまたは独自状態Storeを作らない。 | 利用者が確認・操作する → 機械的な不備と意味判断を分け、直すべき場所へ進める。 → 結果と次の行動を認識する |
| UI-000018 | UI | Checker CoreとCRDD現行Profile | UI契約はAuthorityを発行しない。利用者操作: 概要を読む／図から詳細へ進む／正本を開く | UI契約はEffectを定義しない。表示上の状態差: 下書き（draft）／レビュー済み（reviewed）／現在有効（current）／履歴（historical）を必要時に区別。導線: 問題と目的→判断→構造化詳細→根拠→次工程 | 利用者成果を壊す表示・操作: UIだけに正本、決定権限、業務ロジックまたは独自状態Storeを作らない。 | 利用者が確認・操作する → 課題から結論までを理解し、図と正本から次工程の意図を辿れる。 → 結果と次の行動を認識する |
| SPEC-000001 | SPEC | Checker CoreとCRDD現行Profile | 検査の実行者。指摘の意味判断や修正採用のAuthorityは発行しない | Repository内容を変更しない読取り検査。 | 入力不備、対象不明、検査不能を成功へ畳まず、変更を発生させない。 | [未検査] --検査--> [指摘なし／指摘あり／検査不能] |
| SPEC-000023 | SPEC | Checker CoreとCRDD現行Profile | 工程成果物の作成者と確認者。Checker結果は意味採用Authorityを持たない | 読取り検査だけを行い、文書内容や工程状態を自動変更しない。 | Checklistの並びを章構成へ強制せず、必要図の無言欠落を許さない。 | [工程成果物] -> [物語／構造／図／凡例／関係を検査] -> [成立／不足／作成不能理由] |

## 5. 構造と依存方向

```text
[Checker CoreとCRDD現行Profile]
├─ [SPEC-000001: 事前検査を実行し意味レビューへ案内する]
   [未検査] --検査--> [指摘なし／指摘あり／検査不能]
└─ [SPEC-000023: 文書の物語・構造・図と工程引継ぎを検査する]
   [工程成果物] -> [物語／構造／図／凡例／関係を検査] -> [成立／不足／作成不能理由]
```

各SPEC branchはSibling blockであり、前のblockのAuthorityやEffectを暗黙に継承しない。UI契約はこれらの状態を利用者へ表すが、AuthorityやEffectを発行しない。

## 6. データ・状態・Interface

共通するIdentityとDataの関係はこの責務が管理する。ただし、状態Owner、AuthorityおよびEffectは入力単位で次のように分け、責務全体へ一律に拡張しない。

| 入力 | State Owner | Authority | Effect／非該当 |
|---|---|---|---|
| UI-000001 | Checker CoreとCRDD現行Profile | UI契約はAuthorityを発行しない。利用者操作: 検査を実行する／指摘箇所へ進む | UI契約はEffectを定義しない。表示上の状態差: 検査前／不備あり／機械確認済み。意味判断は別状態。導線: 対象→指摘→場所→所有成果物 |
| UI-000018 | Checker CoreとCRDD現行Profile | UI契約はAuthorityを発行しない。利用者操作: 概要を読む／図から詳細へ進む／正本を開く | UI契約はEffectを定義しない。表示上の状態差: 下書き（draft）／レビュー済み（reviewed）／現在有効（current）／履歴（historical）を必要時に区別。導線: 問題と目的→判断→構造化詳細→根拠→次工程 |
| SPEC-000001 | Checker CoreとCRDD現行Profile | 検査の実行者。指摘の意味判断や修正採用のAuthorityは発行しない | Repository内容を変更しない読取り検査。 |
| SPEC-000023 | Checker CoreとCRDD現行Profile | 工程成果物の作成者と確認者。Checker結果は意味採用Authorityを持たない | 読取り検査だけを行い、文書内容や工程状態を自動変更しない。 |

公開Interfaceは入力IDと対応する契約を保持し、別入力のAuthority、Effectまたはlifecycleを暗黙に継承しない。

## 7. 失敗・回復・観測

- SPEC-000001: 入力不備、対象不明、検査不能を成功へ畳まず、変更を発生させない。Effect: Repository内容を変更しない読取り検査。
- SPEC-000023: Checklistの並びを章構成へ強制せず、必要図の無言欠落を許さない。Effect: 読取り検査だけを行い、文書内容や工程状態を自動変更しない。

- 入力SPECが固有Recoveryを定義しない場合、Architectureから追加しない。
- 結果には最後に確認できた状態、観測時点、不足および次の安全な行動を、入力契約が必要とする範囲で含める。

## 8. 品質・保護・運用

| 入力 | 保護する失敗境界 | 検証可能性 |
|---|---|---|
| UI-000001 | 利用者成果を壊す表示・操作: UIだけに正本、決定権限、業務ロジックまたは独自状態Storeを作らない。 | 利用者が状態差と次の行動を認識でき、UIからAuthorityやEffectが発行されないこと |
| UI-000018 | 利用者成果を壊す表示・操作: UIだけに正本、決定権限、業務ロジックまたは独自状態Storeを作らない。 | 利用者が状態差と次の行動を認識でき、UIからAuthorityやEffectが発行されないこと |
| SPEC-000001 | 入力不備、対象不明、検査不能を成功へ畳まず、変更を発生させない。 | 固有のAuthority、Effect、失敗理由および終了状態を理由別に反証できること |
| SPEC-000023 | Checklistの並びを章構成へ強制せず、必要図の無言欠落を許さない。 | 固有のAuthority、Effect、失敗理由および終了状態を理由別に反証できること |

共通品質を理由に、入力固有の失敗、非該当Effectまたは終了条件を一つの成功状態へまとめない。

## 9. 互換性・移行・成立済み能力

| 基準版Capability | 旧Owner／現行照合先 | 新Owner | 保持状態 | Evidence | Gap／移行 |
|---|---|---|---|---|---|
| v0.20.1のCheckerと文書検査 | Checker／CRDD現行Profile（06_Architecture/checker） | Checker CoreとCRDD現行Profile | 保持・再編 | [checker:integration:crdd-check](../../../07_Quality/Registry/test-catalog.json) | 新工程の構造契約をProfileへ追加 |

現行設計はこの比較だけに使い、UI／SPECにない望ましい意味を補わない。新規責務は基準版能力や実装Evidenceが存在するように表示しない。

## 10. 実装と検証への引き渡し

- 実装は「決定論的なRepository検査、文書構造検査、意味レビューへの案内」を所有するCoreと、外部境界を扱うPort／Adapterを分ける。
- 入力固定→検査→構造化結果→必要時に意味レビューへ案内を段階的な結合試験で確認する。
- 読取不能、対象不明、Profile不一致、形式適合だけの完成表示を理由別に反証する。
- 取消・Recovery・外部送信は非該当。子Processを使う検査だけはProcess終了確認を別途必要とする。

## 11. 情報源と現行照合

正式入力は第2・3節のArchitecture分析だけである。次は成立済み能力とGapを照合するためにだけ参照する。

- [現行照合先](../../Details/checker/01_Architecture.md)
- [現行照合先](../../99_Coding_Standards.md)
