# 変更トレース: gitlinkサブモジュール検証

変更トレースID: `CHG-000005`
状態: `Released`
担当責任者: Qual-Lab
最終更新日: 2026-07-31

正本規則: [変更](../../12_Change.md)

## 契機 / 起点

CRDDをサブモジュールとして採用するプロジェクトから、正常なgitlinkをCheckerが未初期化と誤認する報告を受けた。

旧Checkerは、`.gitmodules`の記載と`git -C 00_CRDD rev-parse`の成否を中心に判定していた。親Indexのmode `160000`を直接確認せず、Git metadataへアクセスできない状態を未初期化へ丸めていたため、次の誤判定があり得た。

- 正常なgitlinkでも、権限や実行環境によりHEADを読めないと未初期化になる
- `.gitmodules`の記載だけで通常ディレクトリをサブモジュールとみなす
- Git管理領域だけが残る壊れた状態を初期化済みとみなす
- gitlink OIDとサブモジュールHEADの不一致を見逃す
- `git -C 00_CRDD`が親Gitを探索し、通常ディレクトリを検証済みと誤認する

## 主要な変更意図

サブモジュール宣言、親Indexのgitlink、作業ツリー、Git管理領域、HEAD、Revision一致を別々に確認する。確認不能を未初期化と断定せず、人間と自動化が原因別に対処できる結果を返す。

## 想定する影響

直接変更する成果物:

- [`template/tools/crdd_check.ts`](../../template/tools/crdd_check.ts)
- 当時の`tools/crdd_check.test.ts`。現在の移設先は[`tools/checker/crdd_check.test.ts`](../../tools/checker/crdd_check.test.ts)
- 当時の`tools/crdd_check_fault_injector.ts`。現在の移設先は[`tools/checker/fault-injector.ts`](../../tools/checker/fault-injector.ts)
- [`README.md`](../../README.md)
- [`CHANGELOG.md`](../../CHANGELOG.md)
- 公開版を示す24正本文書のVersion／Last Updatedヘッダー

利用側への条件付き影響:

- 配布Checkerを使用する採用プロジェクトは、更新によりgitlink診断の精度が上がる
- finding codeを完全一致で処理する自動化は、新しい診断コードへの対応を確認する
- JSON利用者は、詳細診断に`baseline_submodule_state`を使用する
- 互換項目`baseline_submodule_initialized`は、`true`を確認済み、`false`をgitlink確認済みかつworktree不在、`null`を非該当または未確認として扱う

工程成果物、データ、利用者操作、セキュリティ、プライバシー、実行時コストへの影響はない。

## 対象外 / 変更してはならないこと

- `00_CRDD`の配置、基準版有効化、人間の決定権限を変更しない
- 基本フォルダ、安定コンテキストID、準拠基準、移行規則を変更しない
- サブモジュール内部を親リポジトリ所有のファイルとして再帰検査しない
- 正当なGit worktreeでGit管理領域が親リポジトリ外にある構成を拒否しない
- 汚れたサブモジュールworktreeの検出は追加しない
- Checkerを準拠条件または監査の代替にしない

## 判断 / 承認の参照

- 人間による判断: v0.11.4でChecker不具合として修正する
- 変更分類: `clarification`
- 移行要否: なし
- 作業ブランチ: `codex/v0.11.4-gitlink-detection`

## 変更内容

親リポジトリとサブモジュールを次の順で確認する。

1. `.gitmodules`に対象パスが正しいsubmodule節として宣言されている
2. 親Indexの対象パスが通常stage 0のmode `160000`である
3. 親Indexからgitlink OIDを取得できる
4. 対象worktreeが存在する
5. 対象自身のGit rootとGit管理領域へアクセスできる
6. 対象自身のHEADを取得できる
7. HEADとgitlink OIDが一致する

Checkerは次の状態を個別に返す。

```text
declared
gitlink_indexed
gitlink_conflicted
gitlink_oid
worktree_present
gitdir_accessible
head_readable
head_oid
head_matches_gitlink
```

診断は次のように分離する。

| 状態 | 診断 |
|---|---|
| 宣言あり・通常gitlinkなし | `baseline-gitlink-missing` |
| 通常gitlinkあり・宣言なし | `baseline-submodule-declaration-missing` |
| 通常gitlinkあり・worktreeなし | `baseline-submodule-not-initialized` |
| Index競合、Index／Git管理領域／HEADの確認不能 | `baseline-submodule-unverified` |
| HEADとgitlink OIDが不一致 | `baseline-submodule-revision-mismatch` |
| すべて成立 | 検証済み |

一般のgitlinkまたはIndex取得不能時の宣言済みsubmoduleは未確認境界として扱う。親リポジトリの破損リンクと断定せず、初期化後にそのsubmodule rootから直接確認する。

## 変更影響の伝播確認

- 規範変更: なし。Checkerは任意の決定論的確認であり、CRDD規則を変更しない
- 維持する基準: 基準版採用、基本フォルダ、安定コンテキストID、準拠、監査のツール非依存
- 正本文書: 意味変更はなく、公開版ヘッダーだけをv0.11.4へ揃える
- 文書監査: 版、リンク、変更トレース、用語、公開差分を確認するため適用
- 不足／影響監査: 採用先、一般gitlink、fallback、JSON利用者への影響を確認するため適用
- 準拠監査: 準拠基準を変更しないことの限定確認として適用
- 工程移行レビュー: プロダクト工程の移行ではないため非適用
- 品質保証成果物レビュー: プロダクトの検証義務・品質状態を変更しないため非適用

## 実装の参照

- 判定実装: [`template/tools/crdd_check.ts`](../../template/tools/crdd_check.ts)
- 回帰試験（当時）: `tools/crdd_check.test.ts`。現在の移設先は[`tools/checker/crdd_check.test.ts`](../../tools/checker/crdd_check.test.ts)
- 異常注入（当時）: `tools/crdd_check_fault_injector.ts`。現在の移設先は[`tools/checker/fault-injector.ts`](../../tools/checker/fault-injector.ts)

## 検証

- 回帰試験: 100件すべて合格
- Checker本体: 行・分岐ともに100%
- CRDD全体確認: Error 0／Warning 0
- 実環境確認: `qual-suite`の親gitlink OIDと`00_CRDD` HEADが一致し、正常なサブモジュールとして判定
- 独立コードレビュー: 初回指摘と再確認指摘を是正し、最終固定版で`Pass`
- 文書監査: 初回指摘を是正し、最終固定版で`Pass`
- 不足／影響監査・準拠影響確認: 初回指摘と再確認指摘を是正し、最終固定版で`Pass`

回帰対象:

- 正常な実サブモジュール
- 宣言のみ、gitlinkのみ、worktreeなし、通常ディレクトリ
- 引用符付き`.gitmodules` pathとsubmodule節外のpath
- `.gitmodules`のコメント、引用値の連結、不正な設定出力
- `.gitmodules`の読取不能
- Windowsの大文字・小文字が異なる同一パス
- 親Index mode確認不能、gitlink競合
- Git root／Git管理領域／HEAD確認不能
- HEADとgitlink OIDの不一致
- Gitを利用できないfallback
- 一般gitlink配下へのリンク、範囲指定、参照マップ

## 実際の影響 / 逸脱

- 規範、成果物構造、ID、準拠表明、プロダクト実装への影響はない
- CheckerのJSON状態と診断コードを直接読む自動化だけ、条件付きで対応確認が必要
- 想定範囲からの逸脱はない

## 正本コンテキストの更新

- Checker実装と試験をv0.11.4へ更新
- READMEの公開版表示をv0.11.4へ更新
- CHANGELOGへv0.11.3からの純粋差分と採用影響を追加
- 24正本文書の公開版ヘッダーをv0.11.4へ更新し、規範本文は変更しない

## 既知制限 / 残存リスク

- Git metadataを読めない環境では推測せず`unverified`とする
- サブモジュール内部の文書、実装、意味、準拠は、そのsubmodule rootで別途確認する
- HEADとgitlink OIDの一致は確認するが、未コミット変更の有無は確認しない

## リリース

- 対象バージョン: `v0.11.4`
- 収録リリース: `v0.11.4`
- 処置: `Released`
- 統合: [PR #4](https://github.com/qual-lab/CRDD/pull/4)
- 公開識別子: `v0.11.4`タグ

## 後続対応 / ロードマップ

- 現時点で別のロードマップ項目はない
- 独立レビュー、監査、mainへの統合、リリース処置を完了した
