# Product Documentation Guide

Version: v0.1.0
Status: Stable
Owner: Shared
Last Updated: 2026-07-15
Related:
- [00_10_Context_Repository_Standard.md](00_10_Context_Repository_Standard.md)
- [00_15_Document_Standard.md](00_15_Document_Standard.md)
- [00_35_Architecture_and_Integration_Guide.md](00_35_Architecture_and_Integration_Guide.md)

---

> このドキュメントはPractice Guide（推奨知見）である。ここで示すファイル構成・テンプレートは出発点であり、CRDDの必須要件ではない（§7 Architecture Starter Templateの実装規約文書のみ、必須として扱う）。

---

# 1. Purpose

本ドキュメントは、新しいプロダクトが `02_UX`・`03_IA`・`04_Spec`・`05_UI`・`06_Architecture`・`07_Workflows`・`90_Release` を作成する際の、責務境界と最小構成テンプレートを定義する。

`00_10_Context_Repository_Standard.md`はフォルダの責務を1行で定義しているが、実際に何のファイルをどんな順で作ればよいかまでは定義していない。本ドキュメントはその実務的なギャップを埋める。

---

# 2. Basic Principle

```text
UXはWhyを守る。
IAは対象概念と画面責務を守る。
Specは機能の振る舞いと受け入れ条件を守る。
UIは表示・操作・文言を守る。
Architectureは実現構造と非機能を守る。
Workflowsは人間とAIの進め方を守る。
```

そのため、以下のテンプレートは「必ずこの通りに作る」型ではなく、「どの情報をどこに置くべきか迷わないための出発点」として扱う。プロダクトの性質に応じて増減してよい。

## Layer Boundary

| Layer | Owns | Does Not Own |
|---|---|---|
| `02_UX` | Why、Who、When、体験原則、価値判断 | 画面別の細かい表示仕様、DB/API詳細 |
| `03_IA` | Object Model、画面責務、ナビゲーション、情報の流れ | 個別機能の例外処理、見た目の詳細 |
| `04_Spec` | 機能の振る舞い、状態、入力、出力、例外、受け入れ条件 | 具体的なUIレイアウト、実装方式 |
| `05_UI` | 画面表示、操作、文言、空状態、エラー表示、画面別仕様 | DB/API/AI Providerの実装詳細 |
| `06_Architecture` | DB、API、IPC、Pipeline、AI、Security、非機能 | ユーザー価値判断、画面文言の正本 |
| `07_Workflows` | 開発・検証・Release手順、レビュー手順 | プロダクト仕様そのもの |

---

# 3. UX Starter Template

`02_UX`は、以下の構成を出発点とすることを推奨する。

| ファイル | 役割 | 主な内容 |
|---|---|---|
| `02_00_INDEX.md` | 起点 | UXフォルダの目的、読む順番 |
| `02_01_Foundation.md` | Why | Vision / Mission / 解決する課題 / 意思決定ループ |
| `02_02_Persona.md` | Who | Persona / JTBD（Job to be Done）/ Hidden Pain |
| `02_03_User_Journey.md` | When | 利用シーン・利用頻度・体験の時間軸 |
| `02_04_Experience_Principles.md` | What | UX判断原則、体験の一貫性を保つための基準 |

## Why This Set

```text
Why  → 誰に向けて、何のために作るのかがないと、以降の判断がぶれる
Who  → 誰の課題を解くのかを明確にしないと、機能の優先順位が決まらない
When → いつ使われるかによって、体験の設計（通知、頻度、負荷）が変わる
What → 個別画面の判断がぶれたときに立ち返る基準が要る
```

Service Blueprint（ユーザー行動とプロダクト処理の対応表）のような詳細ドキュメントは、プロダクトの複雑さに応じて追加する。

---

# 4. IA Starter Template

`03_IA`は、IA自体がドメイン（プロダクトが扱う対象領域）に強く依存するため、完全な汎用化は難しい。以下は最小骨格である。

| ファイル | 役割 | 主な内容 |
|---|---|---|
| `03_00_INDEX.md` | 起点 | IAフォルダの目的、読む順番、不変条件 |
| `03_01_Foundation.md` | 用語・原則 | ドメイン用語の定義、IA全体の設計原則 |
| `03_02_Object_Model.md` | 対象領域の構造 | プロダクトが扱う中心的な概念とその関係 |
| `03_03_Screen_Responsibility.md` | 画面構造 | 画面の一覧と、各画面が何に責任を持つか |
| `03_04_Navigation_Model.md` | 動線 | 画面間の遷移、情報の流れ |

## Why This Set

```text
Object Model         → 何を中心概念として設計するかが決まらないと、画面が増えるたびに構造が崩れる
Screen Responsibility → 画面同士の責務が重複すると、同じ情報がバラバラな場所に表示される
Navigation Model      → 動線が整理されていないと、ユーザーが迷子になる
```

ドメインが複雑な場合（例: 複数のサブドメインを持つプロダクト）は、`03_02`以降を複数ファイルに分割してよい。

## Facet-based Filtering over Tree Navigation

`03_04_Navigation_Model.md`で、大量の対象（一覧から選んで判断・処理する画面）の絞り込み方を設計する場合、単一の階層（ツリー）に押し込めるのではなく、独立して組み合わせ可能な属性（ファセット）で絞り込めるようにすることを優先する。

### Rule

```text
対象を分類する軸が複数ある場合、1つのツリー階層に強制せず、軸ごとに独立したファセットとして
設計する
ファセットは自由に組み合わせられるようにする（例: 属性Aで絞り込みながら属性Bでも絞り込む）
検索は特別な別機能として扱わず、ファセットの一種として同じ絞り込み体系に含める
```

ツリー階層は「この対象は1つの分類にしか属さない」という前提を持つため、複数の観点で同じ対象を見たい一覧・トリアージ画面には向かないことが多い。

### Bad

```text
一覧画面の絞り込みを、フォルダのような単一階層のツリーとして設計する。ある対象を
別の観点でも探したくなったとき、同じ対象を複数のフォルダへ複製するか、ツリー構造
そのものを作り直す必要が生じる。
```

### Good

```text
一覧画面の絞り込みを、独立したファセット（種類・状態・担当・期間等）の組み合わせとして
設計する。検索キーワードも1つのファセットとして扱い、他のファセットと自由に併用できる
ようにする。
```

---

# 5. Spec Starter Template

`04_Spec`は、UX/IAで決めた意図を、実装と検証に渡せる機能仕様へ変換する場所である。

| ファイル | 役割 | 主な内容 |
|---|---|---|
| `04_00_INDEX.md` | 起点 | Specフォルダの目的、読む順番、対象範囲 |
| `04_01_Feature_List.md` | 機能一覧 | 機能ID、名称、対象画面、状態、関連Decision |
| `04_XX_<Feature>.md` | 機能仕様 | 振る舞い、状態、入力、出力、例外、受け入れ条件 |
| `04_9X_Acceptance_Criteria.md` | 検証観点 | 横断的な受け入れ条件、テストID、Evidenceリンク |

## Feature Spec Template

```text
# <Feature Name>

Version:
Status:
Owner:
Last Updated:
Related:
- 02_UX/...
- 03_IA/...
- 05_UI/...
- 06_Architecture/...
- 95_Decisions/...

## Purpose

## Scope

## Non-goals

## Behavior

## State

## Input

## Output

## Empty / Error / Offline

## Acceptance Criteria

## Test / Evidence

## Open Questions
```

## Why This Set

```text
Behavior            → 何が起きるべきかを実装前に固定する
State               → UI・DB・Scheduler・AI処理の不一致を防ぐ
Input / Output      → UIとBackend、AI処理の契約を明確にする
Acceptance Criteria → 実装完了の判定を人間の感覚だけにしない
Test / Evidence     → 仕様と検証結果を接続する
```

---

# 6. UI Starter Template

`05_UI`は、以下の構成を出発点とすることを推奨する。

| ファイル | 役割 | 主な内容 |
|---|---|---|
| `05_00_INDEX.md` | 起点 | UIフォルダの目的、読む順番 |
| `05_01_Principles.md` | 判断原則 | UI設計における一貫した判断基準（例: AIが提案し人間が決める、等） |
| `05_02_Design_Guidelines.md` | デザインシステム | 配色・タイポグラフィ・コンポーネントの参照先、または規約 |
| `05_XX_<Screen>.md` | 画面仕様 | 画面ごとの表示・操作・状態（1画面1ファイルを基本とする） |
| `05_9X_Wording.md` | 文言 | UI文言の統一ルール・用語 |

## Why This Set

```text
Principles         → 個別画面の判断のたびに一から議論しないための共通基準
Design Guidelines   → 画面ごとにデザインがばらつくのを防ぐ
画面仕様（1画面1ファイル） → 00_15の「1文書1テーマ」原則に従い、画面ごとに独立して読める形にする
Wording             → 表記ゆれ（同じ概念に異なる言葉を使うこと）を防ぐ
```

---

# 7. Architecture Starter Template

`06_Architecture`は、他フォルダの出発点構成（推奨）とは異なり、以下を**必ず作成する**。

| ファイル | 役割 | 主な内容 |
|---|---|---|
| `06_00_INDEX.md` | 起点 | Architectureフォルダの目的、読む順番 |
| `06_XX_<Domain>.md` | 技術設計 | DB・API・IPC・Pipeline・AI・Security等の構造設計（プロダクトに応じて分割） |
| 実装規約文書（ファイル名・番号は任意） | 実装規約 | プラットフォーム・言語・フレームワークに応じた命名規則、レイヤー境界、実装ルール、テストの選び方等の具体ルール |

## Why This Set

```text
技術設計（06_XX） → 何を作るか、どう構成されるかを決める。無いとAIが構造をその場判断し、揺れる
実装規約         → どう書くか、何を避けるかを決める。無いとAIが実装するたびに命名・境界・
                   テスト方針がばらつき、00_CRDDの「AIに破壊させない」原則
                   （00_01_CRDD_Principles.md 8節）が実装レベルで崩れる
```

UX/IA/Spec/UIの出発点構成は「迷わないための推奨」だが、実装規約はAIが安全に実装し続けるための前提条件であるため、他と異なり必須とする。

## 実装規約文書に含めるべき観点

実装規約文書の具体的な章立てはプロダクト・技術スタックに応じて決めてよいが、以下の観点は最低限含める。含める/含めないの判断自体がプロダクト固有の技術判断であるため、内容そのものは`06_Architecture`側が正本を持ち、00_CRDDは観点の一覧のみを規定する。

```text
責務境界（レイヤー・モジュール間の役割分担）
命名規則
外部境界の実装ルール（API / IPC / Provider呼び出し等、該当するもの）
データアクセス・永続化ルール
エラーハンドリング・ログ方針（機密情報の扱いを含む）
セキュリティ実装ルール
テスト方針（テストの種類の使い分け、変更リスクに応じた最低限の確認基準）
リファクタリングの基準（やってよい／避けるべき変更の線引き）
文書更新ルール（どの変更でどの正本文書を更新するか）
実装完了前のレビューチェックリスト
```

## Rule

```text
06_Architecture配下には、技術設計文書とは別に、実装規約文書を必ず1つ以上作成する
実装規約文書のファイル名・番号は自由とするが、上記観点の欠落は許容しない
実装規約文書がまだ無い場合、実装を開始する前にAIが草案を提案し、人間が承認する
実装規約文書は00_14_AI_Change_Controlの06_Architecture向けEdit Level（Level 2）に従う
```

## Bad

```text
06_Architectureに技術設計文書（DB・API・IPC構成）はあるが、命名規則やテストの
選び方は各エンジニア・各AIセッションの感覚に任されている。実装のたびに
スタイルがばらつき、レビューのたびに同じ指摘を繰り返す。
```

## Good

```text
06_Architecture配下に実装規約文書があり、命名規則・レイヤー境界・テスト方針・
避けるべきパターンが明文化されている。AIはその文書に従って実装し、人間は
実装規約に沿っているかどうかでレビューできる。
```

---

# 8. Spec vs UI vs Architecture vs Workflows vs Release の切り分け

`04_Spec`・`05_UI`・`06_Architecture`・`07_Workflows`・`90_Release`は、内容が混同されやすい。以下の基準で切り分ける。

```text
04_Spec         = 機能が「どう振る舞うか」（仕様・状態・受け入れ条件）
05_UI           = ユーザーに「どう見え、どう操作されるか」（表示・操作・文言）
06_Architecture = システムが「どう構成されているか」（構造・技術設計）
07_Workflows    = 人間とAIが「どう作業を進めるか」（手順・運用ルール）
90_Release      = 「いつ・何を出荷したか」の記録・判断根拠
```

## 判定基準

| 内容の例 | 属する場所 |
|---|---|
| 機能の入力、出力、状態、例外、受け入れ条件 | `04_Spec` |
| 画面表示、操作、文言、空状態、エラー表示 | `05_UI` |
| データ構造、API設計、IPC、AI Provider、コンポーネント構成 | `06_Architecture` |
| 開発環境のセットアップ手順 | `07_Workflows` |
| コードレビューの手順・基準 | `07_Workflows` |
| リリース作業の手順（ビルド、パッケージング） | `07_Workflows`（手順）+ `90_Release`（記録） |
| チームの開発方針（使用言語、対象OS等の合意事項） | `07_Workflows` |
| バージョンごとのリリースノート・既知の制限 | `90_Release` |

仕様的な「振る舞い」、UI的な「見え方」、技術的な「構造」、手順的な「How」は混ざりやすい。
`04_Spec` は「何が起きるべきか」を扱い、`05_UI` は「どう見えるか」、`06_Architecture` は「どう実現するか」、`07_Workflows` は「どう作業するか」を扱う。

## Bad

```text
06_Architectureの文書内に、「画面文言」「開発環境のセットアップ手順」「インストーラーのビルド手順」が、
システム構造の説明と混在している。
```

## Good

```text
06_Architectureはシステム構造のみを扱い、画面文言は05_UIへ、セットアップ手順・開発方針・ビルド手順は
07_Workflowsへ切り出す。06_Architecture側からは関連文書へリンクする。
```

---

# 9. Workflows Starter Template

`07_Workflows`は、以下の構成を出発点とすることを推奨する。

| ファイル | 役割 |
|---|---|
| `07_00_INDEX.md` | 起点、読む順番 |
| `07_01_Dev_Setup.md` | 開発環境のセットアップ手順 |
| `07_02_Review_Process.md` | コードレビュー・ドキュメントレビューの手順 |
| `07_03_Release_Process.md` | リリース作業の手順（ビルド・パッケージング・配布） |
| `07_04_Development_Policy.md` | チームの開発方針（使用技術、対象環境等の合意事項） |

すべてを最初から作る必要はない。必要になったものから追加してよい。

---

# 10. Release Starter Template

`90_Release`は、以下を出発点とすることを推奨する。

| 項目 | 役割 |
|---|---|
| リリースノートの型 | バージョン・日付・概要・主な機能・追加内容・既知の制限を固定フォーマットで残す |
| Release Readiness Checklist | リリース前に確認すべき項目のチェックリスト（下記参照） |
| Release Evidence Record | チェックリスト実行結果の記録（下記参照） |

具体的なテンプレート例は、プロダクトの`90_Release/90_00_INDEX.md`側で定義する。

## Release Readiness Checklist（推奨カテゴリ）

出荷・タグ付け前に確認するチェックリストは、以下のカテゴリを横断することを推奨する。プロダクトごとに項目は具体化してよいが、カテゴリ自体は省略しない。

```text
ソース状態（想定していないブランチ差分・未コミット変更が無いか）
自動テスト（対象範囲のテストが全件Passしているか）
手動Smoke Test（自動化できない経路を人が実際に動かして確認したか）
配布物（ビルド・パッケージング・署名・配布経路が正しいか）
法務・Governance（ライセンス・利用規約・既知の制限の開示が最新か）
```

## Release Evidence Record（推奨項目）

チェックリストを実行した結果は、記録として残す。最低限、以下を含める。

```text
何を検証したか
検証方法（自動テストか、手動確認か）
結果（合格・不合格・一部保留）
既知の制限のレビュー結果（新たに追加すべき制限が無いか）
最終判断者・承認日
```

Release Evidence Recordは`90_Release`側の実績記録であり、`95_Decisions`のDecision Logとは役割が異なる。Decision Logは「なぜその判断をしたか」を残し、Release Evidence Recordは「何を検証し、結果はどうだったか」を残す。両者は関連文書としてリンクしてよい。

---

# 11. What This Template Does Not Cover

このテンプレートは出発点であり、以下は含まない。

```text
プロダクト固有の機能一覧
個別機能の詳細仕様そのもの
実装方法（コンポーネント技術選定等、06_Architectureの領域）
```

---

# 12. Minimum Rule

最低限、以下を守る。

```text
02_UX / 03_IA / 04_Spec / 05_UIそれぞれにINDEXを置く
UXはWho/Why/When/Whatを明確にする
IAは中心概念（Object Model）を最初に定義する
大量対象の絞り込みはツリーでなくファセットで設計する
Specは機能ごとに振る舞い・状態・受け入れ条件を書く
UIは画面ごとに1ファイルとする
06_Architectureには実装規約文書を必ず1つ以上作成する
リリース前はRelease Readiness Checklistを実行し、結果をRelease Evidence Recordとして残す
Architecture（構造）とWorkflows（手順）を混在させない
```

---

# 13. Final Principle

テンプレートは、思考の代わりではない。

何もない状態から「何を書けばいいか」で迷う時間を減らし、プロダクト固有の思考（Why、価値、優先順位）に人間の時間を使えるようにするための出発点である。
