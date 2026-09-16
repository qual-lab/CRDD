# Checkerの設計

成果物種別: Architecture詳細設計
詳細設計領域: checker
状態: Canonical

## 基本設計との関係

| Architecture定義 | この領域が具体化する責務 | Relation状態 |
|---|---|---|
| [ARCH-000001](../../Definitions/ARCH-000001/architecture_definition.md) | Generic Checker CoreとCRDD現行Profileを分け、構造・ID・Path・Relationの決定論的検査を具体化する。 | Covered |
| [ARCH-000002](../../Definitions/ARCH-000002/architecture_definition.md) | 契約移行で宣言集合と自動導出集合を比較する機械検査だけを担当する。変更の意味判断は所有しない。 | Partial |

Relation状態は、この領域が担当する責務断面に対する状態である。複数領域で同じARCH-IDを実現する場合、各領域の断面を合成して基本設計全体を閉じる。

## 詳細成果物の適用判断

| 詳細成果物 | 判定 | 理由 | 正本節／成果物 |
|---|---|---|---|
| Component Model | Required | Core、Profile、CLI、package入口の責務を分ける。 | [§2](#2-配布本体と開発用入口) |
| Interface Model | Required | 入力Root、Finding、終了codeと利用側の意味を固定する。 | [§6](#6-結果の意味と利用側) |
| Data Flow | Required | 探索、読取り、検査、集約、結果の流れを示す。 | [§3](#3-検査の順序) |
| State Model | Required | 未開始、検査中、完了、実行不能と資源解放を区別する。 | [§5](#5-資源と終了) |
| Sequence | Required | 構造確認後に意味別Profileを適用する順序が再現性に影響する。 | [§3](#3-検査の順序) |
| Failure／Recovery | Required | FindingとChecker実行不能を分ける。 | [§6](#6-結果の意味と利用側) |
| Deployment | Required | 配布本体とRepository開発入口の同一性を保つ。 | [§2](#2-配布本体と開発用入口) |
| Observability | Required | 検査範囲、未検査範囲、所要時間、Findingを返す。 | [§6](#6-結果の意味と利用側) |
| Security Boundary | Required | 検証済みRootだけを読み、link越境を確認済みにしない。 | [§4](#4-読取り境界) |

`N/A`は未検討を意味しない。対象外にできるArchitecture上の理由を記載する。

## Engineering Concern評価

| Concern | Result | Rationale | Evidence／Related ID |
|---|---|---|---|
| Concurrency | PASS | RunごとにRoot、結果、一時領域を分離し、共有可変状態を持たない。 | [§5](#5-資源と終了) |
| Timing | PASS | 所要時間の合格上限は持たないが、試験runnerのtimeout、取消、子Process完了通知と終了後回収を別に観測する。 | [§5](#5-資源と終了) |
| Resource Lifecycle | PASS | 読取りhandle、子Process、一時領域をRun所有として終了時に回収する。 | [§5](#5-資源と終了) |
| External Boundary | PASS | Filesystem、Version Control Port、package入口の失敗を適合へ丸めない。 | [§4](#4-読取り境界) |
| Failure／Recovery | PASS | Findingと実行不能を区別し、未検査範囲をPassへ含めない。 | [§6](#6-結果の意味と利用側) |
| State／Consistency | PASS | 未開始、検査中、完了、実行不能と資源解放を区別する。 | [§5](#5-資源と終了) |
| Observability | PASS | 検査範囲、未検査範囲、所要時間、Findingを返す。 | [§6](#6-結果の意味と利用側) |
| Security／Trust | PASS | 検証済みRootだけを読み、link越境を確認済みにしない。 | [§4](#4-読取り境界) |

結果語彙は次の意味に限定する。

- `PASS`: 詳細設計上の処置と根拠節が揃った状態。実装済み・試験済みを意味しない。
- `N/A`: Architecture上、そのConcern自体が存在しない状態。未検討や後工程送りを意味しない。
- `OPEN`: 未解決の設計事項が残る状態。
- `FAIL`: 必須設計と矛盾する、または必要な設計が未充足の状態。

## Qualityへの引渡し

| 検証単位 | 対象 | 正常条件 | 反証する失敗 | 観測 | 終了後条件 | 未確認 |
|---|---|---|---|---|---|---|
| Generic Core | 可視Markdown／Path／ID | 同一入力で同一Finding | 非表示構造、link越境、重複ID | Finding codeとpath | handle・一時物0 | 意味妥当性は独立レビュー |
| 配布入口 | package入口とRepository入口 | 同じCore／Profileを実行 | 旧実装、内部Path直参照 | 実行source identity | 同じ終了code | なし |
| 宣言集合と導出集合 | Consumer／派生物／公開・Release経路の構造 | 両集合が完全一致 | 欠落、未知、重複、正規節外、旧Path／API残存 | Finding code、Path、集合差分 | 構造差分0 | 意味妥当性と移行採用は独立レビュー |
| 開発試験runnerのLifecycle | 試験子Process、timeout、取消、fixture | 完了・timeout・取消を区別し、全子Processの終了とfixture残存を確認する | timeoutを正常完了へ丸める、子Processまたはfixtureの残存を見落とす | 終了状態、signal、残存Process、fixture分類 | 全子Process終了、残存物を未確認として報告 | 所要時間そのものは品質合否に使わない |

## 現行実装との照合

現行Sourceと既存試験は本詳細設計の正式入力ではない。本設計候補を固定した後、成立済み能力を失わないよう`Covered`、`Partial`、`Missing`、`Legacy`または`Implementation Detail`へ分類する。

担当責任者: Qual-Lab
最終更新日: 2026-08-31

## 1. 何を解く部品か

Checkerは、CRDD文書の構造、版、識別子、リンク、アンカー、宣言した契約の整合を決定論的に調べる。文書を編集するツールではなく、AIの専門判断やCRDD準拠を認定するツールでもない。検査結果を読んだ人またはAIが、責務を持つ文書を修正する。

利用契約は[振る舞い仕様](../../../05_SPEC/07_Current_Behavior_Reference.md#checker-contract)、操作は[Checkerの手順](../../../19_Workflows/02_Checker.md)、全体の品質状態は[品質の現在状態](../../../07_Quality/01_Quality_Center.md)を参照する。

## 2. 配布本体と開発用入口

| 部品 | 責務 | この分離の理由 |
|---|---|---|
| [配布本体](../../../template/tools/crdd-check.ts) | 検査・報告の単一実装。採用Repositoryにも配布する | 公式Repository専用版と配布版の検査意味を二重管理しない |
| [公式Repository入口](../../../40_Develop/checker/crdd-check.ts) | 配布本体をimportする | 実装工程から発見できる入口を持ち、コピーを作らない |
| [private package](../../../40_Develop/checker/package.json) | 型・命名・静的解析・試験の開発環境 | 開発依存を採用先の必須導入物へ広げない |
| [試験runner](../../../40_Develop/checker/test-runner.ts) | 安全に列挙した試験を子Processで実行する | 通常Checkerの検査と、fixtureを作る開発試験を分ける |

`template/tools`は配布契約として残す。削除した旧ルート`tools`の互換実装ではない。Coordinatorの実行成功やProvider利用許可を、この部品が発行する経路はない。

## 3. 検査の順序

### 内部ブロック

Checker本体は一つの配布Sourceであり、以下のブロックはその内部責務を示す。図に合わせて架空のpackageやフォルダへ分割したものではない。

```text
公式Repository入口 [40_Develop/checker/crdd-check.ts]
  ↓ import（採用先は配布本体から直接開始）
配布本体 [template/tools/crdd-check.ts]
  ├ 引数・モード・Rootの受付
  ↓
  ファイル発見・読取り境界 ─→ Git／Filesystem（読取り）
  ↓
  Markdown・アンカー・参照索引
  ↓
  対象範囲選択＋現行契約プロファイルの照合
  ↓
  全体検査／対象文書検査
  ↓
  指摘・未確認・範囲の集計 → stdout／終了値

開発試験入口 [test-runner.ts]
  → 試験列挙 [test-discovery.ts]
  → tests/（通常Checkerとは別の子Process・fixture lifecycle）
```

| 内部ブロック | Source群・関数群 | 役割 |
|---|---|---|
| 開発用接続部 | `40_Develop/checker/crdd-check.ts` | 配布本体へ接続し、検査実装を複製しない |
| 発見・参照・範囲 | 配布本体の`discoverProjectFiles`、`anchorsFor*`、`resolveLocalTarget`と範囲選択部 | 確認する文書集合と参照先を構成する |
| 規則照合・報告 | 配布本体の`check*`群と末尾の集計・出力部 | 機械的指摘と未確認範囲を返す |
| 開発検証 | `40_Develop/checker/test-*`、`tests/` | 試験発見と契約検証。通常実行の構成部ではない |

専門的な意味監査、外部URLへの照会、自動文書修正は接続していない。次の順序説明と境界表が、その制約を具体化する。

```text
引数を読む（対象Root・出力形式・限定範囲）
  → 公式／採用先のモードとRepository境界を調べる
  → ファイルを発見する（Git、または理由付きFilesystem探索）
  → Markdown・アンカー・参照関係をメモリ上に索引化する
  → 対象集合を決める
  → 現在のCRDD構造を使う場合だけ公式Current Profileを照合する
  → ローカルリンクを検査する
  → 残りの全体検査と対象文書の検査を行う
  → 指摘・範囲・未確認を集計し、stdoutと終了値へ返す
```

実装上の順序は配布本体で照合できる。引数処理、`discoverProjectFiles`、参照解決、範囲選択、報告構築を辿ると、どの集合を実際に確認したか再構成できる。単なるファイル件数では確認範囲を表さない。

### 全体確認と限定確認

`--root`省略時のRootは起動Directoryであり、最寄りGit Rootの自動解決ではない。公式の作業手順ではRootを明示する。

`--scope`では、指定したMarkdown集合に直接の参照先・参照元を一段追加する。依存関係を無限に辿る検査ではない。一方、版・構造・安定ID等の全体検査は残る。このため限定確認は「指定ファイルだけ検査」でも「Repository全体確認」でもない。

| 集合 | 意味 | 報告での区別 |
|---|---|---|
| 発見集合 | Git追跡済み＋非無視の未追跡、またはFilesystem探索で得たもの | 発見方式と失敗理由を保持 |
| 要求した範囲 | 利用者が`--scope`で指定した対象 | `requested_scope` |
| 展開した範囲 | 直接の参照関係を追加した確認対象 | `expanded_scope`、件数と省略表示の有無 |
| 全体検査 | 限定時にも行う構造等の確認 | `global_checks` |
| 除外・未確認 | Git無視、Gitlink境界、確認できない範囲等 | 除外情報と`unchecked`。指摘0へ吸収しない |

## 4. 読取り境界

外部URLへ通信して存在確認しない。ローカルリンクではRoot外への解決、symbolic link／junction等を確認済みにしない。Gitlinkは独立した境界として扱う。Gitが使えない場合のFilesystem探索は、Gitと同一の確認を保証する代替ではなく、失敗理由・除外・未確認付きの経路である。

Checkerは、現在の正本・案内・ひな型・Change・Work Lifecycle Evidenceの通常リンクを現在Pathに対して検査する。本文を変更できない固定履歴では、CRDD Official Current Profileが承認済み移行表から当時の参照基準を解決し、固定本文を通常リンク修正の対象にしない。固定原文Identity、過去Git object、移行表が当時の移行を正しく表すかという真正性は独立監査が扱う。固定履歴の扱いを、現行正本または改変可能なChange／Evidenceのリンク切れを許容する例外に使わない。

| 層 | 対象 | 含めないもの |
|---|---|---|
| Generic Checker Core | Root、発見集合、Path境界、Link、Anchor、ID、宣言された汎用構造 | CRDD公式Repositoryの固有Version、CHG、実装package、過去移行 |
| CRDD Official Current Profile | 現在の公式正本・template・版・状態・現行Directory契約、通常のChange／Evidenceリンク、承認済み移行表による固定履歴参照の機械的解決 | 過去Releaseの意味評価、固定Commit／Blobと移行表の真正性、個別CHGの監査 |

## 5. 資源と終了

| 資源・操作 | 所有と終了 | 保証しないこと |
|---|---|---|
| 文書・参照索引 | Checker Processのメモリ | 索引化しただけで意味品質が成立すること |
| Filesystem読取り | 同期読取り。読取失敗は処理ごとの拒否または例外へ | あらゆる例外で完全なsummaryが返ること |
| Git子Process | 本体の同期呼出し。各呼出しの設定に従う | 全体deadline、全Git呼出し共通timeout、独自のprocess tree回収契約 |
| stdout／stderr | 結果と引数エラーを出力 | 途中中断時に完全なJSONが残ること |
| 試験fixture | private試験だけが一時Rootを作り、通常終了時に清掃する | 通常Checkerの読取り契約との同一視、強制終了後の清掃保証 |

通常Checker本体は文書の生成・修正・削除を行わない。開発試験は別の資源所有者であり、`os.tmpdir()`の解決先を承認済みのRepository-local `.crdd/tests/checker`へ指定して実行する。通常のCheckerに、存在しないAuthority、候補Store、永続Recoveryを追加しない。

### ブロック状態遷移

| 現在状態 | 契機／事前条件 | 処理と観測 | 次状態 | 終了後条件 |
|---|---|---|---|---|
| 未受付 | 正規化済みRootと引数 | Root、mode、範囲を検証 | 発見中／拒否 | 拒否時は子Process・書込み0 |
| 発見中 | Gitまたは理由付きfallbackを開始 | 文書、参照、未確認境界を列挙 | 索引済み／失敗 | Git子Process終了、読取りだけ |
| 索引済み | 対象集合確定 | 構造・参照・契約を照合 | 集計中 | Repository byte不変 |
| 集計中 | 全検査終了 | 指摘・warning・未確認を分けて構成 | 報告済み | stdoutとexitが同じ結果を表す |
| 試験実行中 | 開発runnerが試験を開始 | timeout／取消／終了を観測 | 完了／部分失敗 | 全子Process終了、fixture残存を分類 |

通常検査と開発試験runnerを同じLifecycleへ畳まない。試験runnerのcleanupまたは子Process終了が不明な場合、通常Checkerが読取り専用であることを根拠に成功へ補正しない。

通常検査は現在の正本、参照、ID、構造および禁止された旧Pathを対象とする。過去の大規模移行を全source byteから再演する確認はCheckerの責務にせず、当該移行の独立監査で行う。Checkerの品質試験では、Repository境界、現行Path、ID、参照等の一般化した機械的不変条件だけを小さなfixtureで反証する。

## 6. 結果の意味と利用側

正常に報告を構築した場合、errorがあればexit 1、なければexit 0。warningや未確認があっても0になり得る。引数拒否はstderrとexit 2であり、未捕捉例外・外部からの終了とは分ける。`--help`は現行の引数ではない。

通常テキストは人間向け、`--json`単独は指摘配列、`--json --summary`は範囲・発見方式・未確認・指摘を含む報告である。`--references <file-or-directory>`の対象Pathは必須。相対PathはRoot基準で解決し、絶対PathもRoot内の場合だけ受理する。参照関係表示はsummaryと併用する。CIや監査はexit 0だけで判断せず、必要範囲と未確認も読む。

## 7. 設計から試験への接続

| 確認する不確実性 | 正常・準正常・異常の代表 | 接続先 |
|---|---|---|
| Root・入力の意味 | 明示Root、省略、未知引数、値欠落 | [Checker契約試験](../../../40_Develop/checker/tests/integration/crdd-check.contract.test.ts) |
| 範囲の取り違え | 全体、限定、一段展開、全体検査の残存 | 同契約試験のscope／references項目 |
| 発見と読取り | Git、fallback、読取失敗、link／Gitlink | 同契約試験の発見・境界・fault injection項目 |
| 表示と終了 | テキスト、JSON配列、summary、0／1／2 | 同契約試験の出力・引数項目 |
| 試験そのものの脱落 | nested試験、重複・未知entry、TypeScript所有集合との差 | [試験列挙](../../../40_Develop/checker/test-discovery.ts)、[命名契約](../../../40_Develop/checker/tests/integration/tools-naming.contract.test.ts) |

この表は試験への接続であり、全件の最新実行結果ではない。結果は品質記録へ分離する。意味監査、初見利用者の理解、中断時の実子Process観測は、Checkerの指摘件数から証明しない。

## Checklist

- [x] 関連するARCH-IDと担当する責務断面を明示した
- [x] 9種類の詳細成果物を全数Applicability判定した
- [x] Requiredを実在する節または成果物へ接続した
- [x] N/AにArchitecture上の理由を記録した
- [x] 8種類のEngineering Concernを全数評価した
- [x] PASSを設計済みの意味に限定した
- [x] Component、Interface、Data／StateおよびSequenceを必要な粒度で具体化した
- [x] Failure／Recovery、ObservabilityおよびSecurity Boundaryを具体化した
- [x] Qualityへ対象、正常条件、反証する失敗、観測および終了後条件を渡した
- [x] Human Inputの必要性とOpen／Gapを評価した
- [x] 現行実装との照合をReality Auditとして分離した
- [x] Source構造をCanonical詳細設計へ逆輸入していない
