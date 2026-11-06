# Checkerの責務境界整理

## 全体回帰50失敗の限定是正 — 2026-11-06、試験回帰完了

人間が試験側の最小是正を承認した。着手前の独立確認により、製品Source・公開API・探索／安全検査・正式QA義務は変更しないことを固定した。実装変更ではなく試験前提・故障代役・期待する不変条件の是正である。既存の汚れた作業差分は保持し、この段階の製品Source512 Fileの合成SHA-256を`13399b85a0c1c35ae1d85c32c9d32001bdf2faa3166b5247f509f9931d7f54ad`として変更前後を照合する。

| 初回失敗 | 原因 | 是正・維持条件 |
|---|---|---|
| 41 Case | 親Repositoryのignoreに属する新品fixtureを独立Repositoryと扱っていた | 既存initializeGitを該当Case／既存Architecture fixtureへ接続し、Git Rootの実体一致を確認する |
| 2 Case | 非Git・Filesystem探索を意図した条件が実際は親Git配下だった | 初期化した新品Rootで、Gitの非Git応答と実際のPATH分離による未導入を明示的に再現し、既存分類を維持する |
| 4 Case | 故障代役のargv前提が現行VC起動形式と不一致 | Root・実subcommandを照合して注入し、元のoptionsを維持して未対象を実処理へ渡す。注入回数も確認する |
| 1 Case | 実submodule試験のコピーにDomainから必要なPA Sourceがなかった | 新品fixtureだけへ依存Sourceを追加。後段HEAD注入も現在のFilesystem Readerへ追従する |
| 1 Case | 廃止済みorchestrator Packageの固定参照 | 旧項目だけ撤去し、既にある現Coordinatorの検査を維持する |
| 1 Case | Tool／参照Suiteの件数4／3が固定されていた | 非空・一意・代表対象・全対象のCoverage非混入へ変更し、12／10の別固定値へ付け替えない |

通常fixtureを一律変更しない。HEADの配置確認まで失敗させる注入は、元の「配置確認済み・本文未確認」の反証にならないため使わない。WindowsのPath大小文字は実CLI入力で対照する。新しいManager・Registry・Store・製品Hookは追加せず、試験用の変更は既存統合Suite・Semantic Suite・故障注入Helperに限定する。

試験台帳は既存二Suiteの終了後確認事項だけを追従し、Suite ID・件数449・QA／Local Item・段階を維持する。Architecture・Qualityの現在表示を同期し、限定回帰、全体回帰432 Case、静的検査、Catalog、製品Source不変、固定候補の独立レビューと直接文書整合を確認する。規範・公開API・保存形式・リリースを変更しないため準拠・Release監査と実Provider／Docker E2Eは対象外。実AI・Docker・過去保持物・コミット／プッシュは操作しない。最終候補の全体回帰と独立レビューの指摘是正を完了した。正式QA全体・Repository自身の文書検査・Releaseの成立とは区別する。

### 固定候補の検証結果

- 最終全体回帰は23 File・432 Case、431成功・失敗0・取消0・既存skip1、exit0、797397.8165ms。対象外は既存の利用者理解UAT（acceptance/regression-plan-understanding.contract.test.ts）で、今回追加・変更していない。先行候補の431成功・既存skip1は位置是正前の結果として区別する。
- 書式・型検査・警告禁止Lintは成功。Info142件は残るがwarning/errorは0。Catalog449件valid、testExecution not_startedを維持した。
- 製品Source512 Fileの合成SHA-256は変更前後とも上記値で一致し、今回の製品実装・公開API・検査条件の変更は0。
- 独立レビューの必須指摘はPA依存のコピー位置1件。元fixture Repositoryのgit add／commit前へ移し、clone側でPA入口が追跡済みであることを確認した。是正後の限定Case・全体回帰が成功し、再レビューで追加指摘なし。Windows大小文字・exact HEAD本文失敗・注入回数の確認も維持した。
- Repository自身のChecker実行は別軸でexit1、3,760指摘（broken-link 3,748、broken-anchor 5、品質関係・件数7）。検査対象は2,486 File／Markdown1,197 Fileで、上記の試験回帰50失敗には含めない。これらを解消済み・すべて既存と断定せず、Repository自己検査とnpm test全体Gate・全体QAは未成立として保持する。
- 実AI・Docker・過去保持物、正式項目の全数Pass化、コミット・プッシュは行っていない。試験用Rootだけを既存の後処理で回収した。

## 採用した範囲 — 2026-11-06

基準HEADは`096aa7591707d0c6e11806be65151cb9fb73a70e`。利用者の判断により、CRDD Checkerは成果物・ID・参照・台帳・関係の整合を所有し、Source内部のコーディング規約を推定する機能を持たない。

| 対象 | 確認するOwner |
|---|---|
| 成果物の実在、所有範囲、ID、参照、QA／Local Item、試験段階、verifies | CRDD Checker |
| 構文、型、書式、標準的な未使用検出 | 各言語の既存ツール |
| 命名の意味、責務、コメントの十分性、過剰設計、安全保証 | AIレビューを含む独立レビュー |

Checkerの自己API・逆依存禁止・既存13ツールの公開接続試験は、宣言済み製品契約の統合試験として維持する。すべての言語へTypeScript形式を要求する汎用規約検査ではない。新しい言語Adapter、レビューEngine、ManagerやStoreは追加しない。

## 実装と受理条件の変更

- 横断試験からAST、識別子推定、命名・Header・固定tag・型配置の全件走査を撤去した。
- Checker本番経路のSource本文読取りによるskip検出と、Domainの専用Parser・公開Export・専用Suiteを撤去した。PPR-UT-017の関係整合義務は維持する。
- skipを含むSourceも構造が正しければ登録できるようになる。これは受理条件の変更である。登録成功を実行済み・合格・検証Evidenceとしない。実行結果は既存Runnerで確認する。
- 検証専用ツールの登録PathからTS／Rust拡張子限定を撤去した。Python等の登録受理は、その言語の実行対応を意味しない。安全な相対Path、実在する通常File、Owner、ID、関係の検査は維持する。
- 実台帳照合で見つかった三Suiteの余分なQA接続と、Coordinator／WorkbenchのVC旧Symbol参照を現行Ownerへ是正した。承認済みRFD-UT-030は正本の検証項目表へ配置した。

過去に観測した命名・コメント4,328件は、旧検査による診断件数である。今回の撤去を4,328件のSource是正完了とは扱わない。先行して実施したSource説明・private型名の整理は維持するが、全Sourceの規約適合は未評価である。

## 検証と限界

- Checker関連26件、Domain公開境界・台帳・実Repository接続15件が成功した。
- Checker本番の構造観測がSource本文を読まないことを実経路で確認した。未知ID、不正Path、Owner外、verifies不整合の拒否も維持した。
- Catalogは449件でvalid、testExecutionはnot_started。Parser専用一Suiteの撤去による減少であり、他の試験義務を削除したものではない。
- 全体回帰の試行は失敗した。CLI表示／診断契約、semantic集計などに失敗が観測され、固定候補による原因切分けは未完了。全体Pass、すべて既存失敗、正式QA完了とは主張しない。
- 実AI、Docker、過去保持物の操作は行わない。新しい試験領域だけを既存試験の範囲で扱う。

文書はCoding Standards、Checker／Domain Architecture、QA-000001／004を追従する。規範の受理範囲と製品接続を独立レビューし、準拠認定・Release監査は実施しない。コミット・プッシュはこの作業では行わない。

独立レビューでは機能上の必須指摘なし。Quality Centerの旧現在表示と、Manifest収集HelperのHeader分類という旧説明二点を是正した。再現した全体回帰の四失敗は、存在しないorchestrator参照、REQ試験領域のFile発見0、英語Remediation行・Coverage行の集計0であり、今回差分との因果と基準版比較は未完了のため既存失敗とは断定しない。
