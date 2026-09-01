# Checkerの設計

状態: Stable（v0.18.1）
担当責任者: Qual-Lab
最終更新日: 2026-08-31

## 1. 何を解く部品か

Checkerは、CRDD文書の構造、版、識別子、リンク、アンカー、宣言した契約の整合を決定論的に調べる。文書を編集するツールではなく、AIの専門判断やCRDD準拠を認定するツールでもない。検査結果を読んだ人またはAIが、責務を持つ文書を修正する。

利用契約は[振る舞い仕様](../../05_SPEC/01_Behavior_Specification.md#checker-contract)、操作は[Checkerの手順](../../19_Workflows/02_Checker.md)、全体の品質状態は[品質の現在状態](../../07_Quality/01_Quality_Center.md)を参照する。

## 2. 配布本体と開発用入口

| 部品 | 責務 | この分離の理由 |
|---|---|---|
| [配布本体](../../template/tools/crdd-check.ts) | 検査・報告の単一実装。採用Repositoryにも配布する | 公式Repository専用版と配布版の検査意味を二重管理しない |
| [公式Repository入口](../../40_Develop/checker/crdd-check.ts) | 配布本体をimportする | 実装工程から発見できる入口を持ち、コピーを作らない |
| [private package](../../40_Develop/checker/package.json) | 型・命名・静的解析・試験の開発環境 | 開発依存を採用先の必須導入物へ広げない |
| [試験runner](../../40_Develop/checker/test-runner.ts) | 安全に列挙した試験を子Processで実行する | 通常Checkerの検査と、fixtureを作る開発試験を分ける |

`template/tools`は配布契約として残す。削除した旧ルート`tools`の互換実装ではない。Coordinatorの実行成功やProvider利用許可を、この部品が発行する経路はない。

## 3. 検査の順序

```text
引数を読む（対象Root・出力形式・限定範囲）
  → 公式／採用先のモードとRepository境界を調べる
  → ファイルを発見する（Git、または理由付きFilesystem探索）
  → Markdown・アンカー・参照関係をメモリ上に索引化する
  → 対象集合を決める
  → 公式台帳・固定歴史参照の同一性と有効性を専用条件で照合する
  → その結果を用いてローカルリンクを検査する
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

## 4. 読取り境界と歴史参照

外部URLへ通信して存在確認しない。ローカルリンクではRoot外への解決、symbolic link／junction等を確認済みにしない。Gitlinkは独立した境界として扱う。Gitが使えない場合のFilesystem探索は、Gitと同一の確認を保証する代替ではなく、失敗理由・除外・未確認付きの経路である。

公開済みEvidenceの旧Pathは、現在のファイルへ無条件に付け替えない。公式台帳が指定した原文、Git固定内容、Hash、旧アンカー、後継、旧Pathの非active／非indexed等を照合した場合だけ歴史参照として確認する。未知のリンク切れを許す例外ではない。採用Repositoryへ公式履歴台帳を要求しない。

## 5. 資源と終了

| 資源・操作 | 所有と終了 | 保証しないこと |
|---|---|---|
| 文書・参照索引 | Checker Processのメモリ | 索引化しただけで意味品質が成立すること |
| Filesystem読取り | 同期読取り。読取失敗は処理ごとの拒否または例外へ | あらゆる例外で完全なsummaryが返ること |
| Git子Process | 本体の同期呼出し。各呼出しの設定に従う | 全体deadline、全Git呼出し共通timeout、独自のprocess tree回収契約 |
| stdout／stderr | 結果と引数エラーを出力 | 途中中断時に完全なJSONが残ること |
| 試験fixture | private試験だけが一時Rootを作り、通常終了時に清掃する | 通常Checkerの読取り契約との同一視、強制終了後の清掃保証 |

通常Checker本体は文書の生成・修正・削除を行わない。開発試験は別の資源所有者であり、`os.tmpdir()`の解決先を承認済みのRepository-local `.crdd/test-tmp`へ指定して実行する。通常のCheckerに、存在しないAuthority、候補Store、永続Recoveryを追加しない。

## 6. 結果の意味と利用側

正常に報告を構築した場合、errorがあればexit 1、なければexit 0。warningや未確認があっても0になり得る。引数拒否はstderrとexit 2であり、未捕捉例外・外部からの終了とは分ける。`--help`は現行の引数ではない。

通常テキストは人間向け、`--json`単独は指摘配列、`--json --summary`は範囲・発見方式・未確認・指摘を含む報告である。`--references <file-or-directory>`の対象Pathは必須。相対PathはRoot基準で解決し、絶対PathもRoot内の場合だけ受理する。参照関係表示はsummaryと併用する。CIや監査はexit 0だけで判断せず、必要範囲と未確認も読む。

## 7. 設計から試験への接続

| 確認する不確実性 | 正常・準正常・異常の代表 | 接続先 |
|---|---|---|
| Root・入力の意味 | 明示Root、省略、未知引数、値欠落 | [Checker契約試験](../../40_Develop/checker/crdd-check.contract.test.ts) |
| 範囲の取り違え | 全体、限定、一段展開、全体検査の残存 | 同契約試験のscope／references項目 |
| 発見と読取り | Git、fallback、読取失敗、link／Gitlink | 同契約試験の発見・境界・fault injection項目 |
| 固定履歴の偽装 | 正しい台帳、原文変更、旧対象残存、後継欠落 | 同契約試験の歴史参照項目 |
| 表示と終了 | テキスト、JSON配列、summary、0／1／2 | 同契約試験の出力・引数項目 |
| 試験そのものの脱落 | nested試験、重複・未知entry、TypeScript所有集合との差 | [試験列挙](../../40_Develop/checker/test-discovery.ts)、[命名契約](../../40_Develop/checker/tools-naming.contract.test.ts) |

この表は試験への接続であり、全件の最新実行結果ではない。結果は品質記録へ分離する。意味監査、初見利用者の理解、中断時の実子Process観測は、Checkerの指摘件数から証明しない。
