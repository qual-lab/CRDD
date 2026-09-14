# UI-000006 Repository内作業と対象選択

成果物種別: UI定義
UI ID: `UI-000006`
状態: Canonical
維持責任者: Qual-Lab

## 利用者成果

普段のRepository作業を保ちながら、対象の取り違えを防げる。

## UX観点の入力

| UX分析 | このUIで保持する利用者成果 |
|---|---|
| [UX-000010](../../Analysis/UX-000010/ui_analysis.md) | 横断機能、Commit済み状態または特定の履歴実装を前提にせず、現在リポジトリで日常作業を開始・継続できる |
| [UX-000011](../../Analysis/UX-000011/ui_analysis.md) | 論理プロジェクトを一つに見ながら、参照・実行・回復の対象リポジトリと基点フォルダを取り違えずに選べる |

## IA観点の入力

| IA分析 | このUIで保持する情報構造 |
|---|---|
| [IA-000006](../../Analysis/IA-000006/ui_analysis.md) | 論理Projectを一つに見ながら、情報源、物理Root、不完全性を取り違えず現在地を判断する。 |
| [IA-000007](../../Analysis/IA-000007/ui_analysis.md) | 一つのRepositoryで日常作業を完了し、必要な時だけ横断情報へ進む。 |

## 両観点の統合判断

| UX分析 | 利用者が得たい結果 | 対応するIA分析 | UIで成立させる対応 |
|---|---|---|---|
| [UX-000010](../../Analysis/UX-000010/ui_analysis.md) | 横断機能、Commit済み状態または特定の履歴実装を前提にせず、現在リポジトリで日常作業を開始・継続できる | [IA-000007](../../Analysis/IA-000007/ui_analysis.md) | Repository-local 情報源（Source）、日常作業、横断情報源、履歴管理能力を見分ける。状態は「手元で利用可能（local available）／横断情報源を利用不能（cross-source unavailable）でも継続可能」。導線は「Repository→手元の正本→作業、必要時だけCROS」 |
| [UX-000011](../../Analysis/UX-000011/ui_analysis.md) | 論理プロジェクトを一つに見ながら、参照・実行・回復の対象リポジトリと基点フォルダを取り違えずに選べる | [IA-000006](../../Analysis/IA-000006/ui_analysis.md) | プロジェクト（Project）、リポジトリ（Repository）、リポジトリの基点フォルダ（Repository Root）、結合情報（Binding）を見分ける。状態は「確認済み（verified）／未確認（unverified）／曖昧（ambiguous）／利用不能（unavailable）」。導線は「Project→Repository→Binding→検証済みRoot」 |

UIはUX側の目的だけでも、IA側の対象一覧だけでも成立しない。各行の利用者成果を、対応する情報・状態・関係・導線で判断可能にした時だけ、このUIの意味が成立する。

## 表示面と情報の優先順位

```text
Repository内作業と対象選択
        ↓
プロジェクト（Project）／リポジトリ（Repository）／結合情報（Binding）／プロジェクト項目／読取り投影（Projection）／対象範囲（Coverage）／手元の情報（Local Context）／手元の作業（Local Work）／リポジトリ横断情報源（Cross-repository Source）／履歴管理能力（Version Control Capability）
        ↓
現在状態・不足・制限
        ↓
Project→Repository→Binding→検証済みRoot／Repository→手元の正本→作業、必要時だけCROS
```

| IA分析 | 独立して見分ける対象 | 利用者にとっての意味 | 識別・関係 |
|---|---|---|---|
| IA-000006 | プロジェクト（Project） | 論理的な案件・活動 | プロジェクト識別子（Project ID） |
| IA-000006 | リポジトリ（Repository） | Projectの一部を所有する正本境界 | リポジトリ識別子（Repository ID） |
| IA-000006 | 結合情報（Binding） | Repositoryと検証済みRootの結合 | 結合識別子（Binding ID） |
| IA-000006 | プロジェクト項目 | リポジトリが正本として所有する文書その他の項目 | リポジトリと項目固有の識別情報で結ぶ |
| IA-000006 | 読取り投影（Projection） | 正本から導出した読取りView | 情報源（Source）＋改訂版（Revision）＋観測時点（Observed At） |
| IA-000006 | 対象範囲（Coverage） | 投影が扱えた範囲 | 情報源（Source）集合と状態 |
| IA-000007 | 手元の情報（Local Context） | 現在Repositoryが所有する正本 | 検証済みリポジトリの基点フォルダ（Repository Root） |
| IA-000007 | 手元の作業（Local Work） | 手元で開始・完了できる仕事 | 対象Repositoryへ結合 |
| IA-000007 | リポジトリ横断情報源（Cross-repository Source） | CROSから得る追加情報 | 情報源（Source）とAccess State |
| IA-000007 | 履歴管理能力（Version Control Capability） | 履歴を扱う差替可能な能力 | 接続口（Port）／利用能力（Capability）で識別 |

同じ画面や応答へ置く場合も、上表の独立軸を一つの成功・信頼・完了へ畳まない。重要な不足、制限、判断要否は詳細へ隠さない。

## 操作とFeedback

主要な操作・判断: 対象を選ぶ／Rootを確認する／正本を開く。

| UX分析 | 利用者が行う判断・行動 | 重要な場面 | 必要なFeedback | 避ける失敗 |
|---|---|---|---|---|
| UX-000010 | 現在リポジトリだけで日常作業を完結する | 横断利用へ切り替える判断 | 手元を既定にし横断を任意に保つ | CROS未設定で手元作業まで止まる |
| UX-000011 | プロジェクト・リポジトリ・基点フォルダを区別して対象を確認する | 外部作用（Effect）対象を確定する直前 | 各識別情報と物理基点フォルダの結合を明示する | 同名や近いパスを同じ対象と誤認する |

UI部品や通信方式はここで固定しない。各UX行のFeedbackを、IAの状態・導線と対応付けて表示する。

## 状態と表示差

| UX／IAの対応 | 区別する状態 | 状態から進む導線 |
|---|---|---|
| UX-000011／IA-000006 | 確認済み（verified）／未確認（unverified）／曖昧（ambiguous）／利用不能（unavailable） | Project→Repository→Binding→検証済みRoot |
| UX-000010／IA-000007 | 手元で利用可能（local available）／横断情報源を利用不能（cross-source unavailable）でも継続可能 | Repository→手元の正本→作業、必要時だけCROS |

上表にない処理中、取消、回復その他の状態を一律に追加しない。値なし、未観測、古い値、競合、開示制限または結果不明は、該当するIA定義が要求する場合にだけ別状態として示す。

## 視覚表現とアクセシビリティ

- 「プロジェクト（Project）、リポジトリ（Repository）、結合情報（Binding）、プロジェクト項目、読取り投影（Projection）、対象範囲（Coverage）、手元の情報（Local Context）、手元の作業（Local Work）、リポジトリ横断情報源（Cross-repository Source）、履歴管理能力（Version Control Capability）」を、色だけでなく表示名、状態語、順序でも見分けられるようにする。
- 結論、重大な不足、主要操作、根拠、詳細の順を視覚順と読上げ順で一致させる。
- CLI、MCP、Workbenchで同じ意味の状態と次の導線を対応付ける。
- キーボード操作と文字表示だけでも、上表の判断・根拠・戻り先へ到達できるようにする。

## 制約

- UIだけに正本、決定権限、業務ロジックまたは独自状態Storeを作らない。
- 表示の都合でUX成果、IAの独立軸、状態、根拠、対象範囲または開示境界を弱めない。
- 視覚詳細はPrototypeで評価し、未評価の候補を完成表示しない。

## UI／SPEC対応レビューへ渡す項目

両観点の統合内容は前節の正本を参照し、ここへ全文を再掲しない。次表は、SPECが同じUX／IAを別々に分析した後で確定すべき未決事項だけを渡す。

| UX | IA | UIで観測可能にすべき操作・Feedback | SPEC側で未確定の振る舞い |
|---|---|---|---|
| UX-000010 | IA-000007 | 現在リポジトリだけで日常作業を完結する。手元を既定にし横断を任意に保つ | IA-000007 が示す状態・関係を入力条件、成功・停止条件へ接続し、「CROS未設定で手元作業まで止まる」を防ぐ観測可能な結果を確定する |
| UX-000011 | IA-000006 | プロジェクト・リポジトリ・基点フォルダを区別して対象を確認する。各識別情報と物理基点フォルダの結合を明示する | IA-000006 が示す状態・関係を入力条件、成功・停止条件へ接続し、「同名や近いパスを同じ対象と誤認する」を防ぐ観測可能な結果を確定する |

SPECはこの表の結論を転記せず、UX観点とIA観点を別々に分析する。UIの操作に対応する発火条件・結果がない、またはSPECの結果を利用者が認識できない場合は対応レビューを通過しない。

## 情報源

- [UX-000010のUI分析](../../Analysis/UX-000010/ui_analysis.md)
- [UX-000011のUI分析](../../Analysis/UX-000011/ui_analysis.md)
- [IA-000006のUI分析](../../Analysis/IA-000006/ui_analysis.md)
- [IA-000007のUI分析](../../Analysis/IA-000007/ui_analysis.md)
