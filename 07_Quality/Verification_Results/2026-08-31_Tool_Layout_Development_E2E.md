# 工程別配置後の開発E2E結果

実行日: 2026-08-31
対象: Coordinatorの工程別配置移行後の開発試験
判定: 対象239件合格。移行全体・正式配布の完了判定ではない。

## 対象の識別

基準コミットは`d108d5c702dcddbf8e5a29a0ac9da83de5a6a1a9`。その上にある未コミットの配置移行差分を対象とした。基準コミットだけを実行対象とみなさない。

実行中に変更していない`40_Develop/coordinator/`の319ファイルを実行後に識別した。`node_modules`、`target`、`.crdd`を除外し、通常ファイルだけを対象とする。リポジトリ相対Pathを`/`区切りで辞書順に並べ、各ファイルについて`Path + NUL + ファイル内容のSHA-256小文字hex + LF`をUTF-8で連結した集合ハッシュは次のとおり。

`cebaffe809d89f556659df3b8a7160898d2dd1212a5ec7c027e59ba3625a7300`

依存物は対象packageの固定lockfileを使用し、新しいダウンロードは行っていない。ハッシュは試験対象の再識別用であり、署名や実行権限ではない。

## 実行条件と結果

| 項目 | 観測値 |
|---|---|
| OS・実行環境 | Windows、Node.js 24.19.0 |
| 起動Directory | リポジトリの`40_Develop/coordinator/` |
| 一時保存 | 実行Processの`TEMP`と`TMP`をリポジトリ直下`.crdd/test-tmp`へ設定 |
| 実行対象 | packageの`development-e2e:verify`に列挙した9試験ファイルを`node --test`へ渡した |
| 合格／失敗／取消／skip | 239／0／0／0 |
| 終了コード | 0 |
| 試験runnerの経過時間 | 22,157.7013 ms |
| ローカルログ | `.crdd/test-tmp/layout-development-e2e.tap`（Git非追跡） |
| ログSHA-256 | `9d17b9f6d9de9103cc5dba927bce1582d8d89646499d3d327df169335936ac99` |

再実行時は同じ対象内容と固定依存を確認し、上記の一時保存条件・起動Directoryで`npm run development-e2e:verify`を実行する。生成ログの保持はローカル運用に従い、この記録からログの永続存在を保証しない。

## 確認できたことと限界

- 新配置の実行計画、Provider adapter、Task、各署名検証runnerの契約試験を起動できた。
- [実子Process結合試験](../../40_Develop/coordinator/tests/coordinator-task-process.integration.test.ts)では、実子Processと所有FilesystemをTaskへ接続し、正常・非0終了・取消・close観測不明・Host cleanup拒否を確認した。
- 認証、Provider、Docker等の試験用adapterを実物の証明には扱わない。公式秘密鍵の入力、正式署名、実Providerへの送信、Docker修復は行っていない。
- Checkerの追加中の歴史参照検証、移行全体のリンク確認、独立完成監査、正式配布E2Eはこの試験の対象外。全試験件数だけから設計上の網羅を推定しない。

検証義務との対応は[検証設計](../03_Verification_Design.md)、現在の処置は[品質の現在状態](../01_Quality_Center.md)、移行は[CHG-000017](../../90_Release/Changes/CHG-000017_Tools_Coding_Standards.md#9-内部ツールの工程別配置への移行)で追跡する。
