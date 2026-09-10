# 変更トレース: 試験体系と自動回帰

変更ID: `CHG-000061`
状態: `In Progress`
担当責任者: Qual-Lab
対象版: `v0.20.0`
変更分類: `normative`
最終更新日: 2026-09-09

## 1. 結論と現在状態

CRDDの既存品質保証は、検証義務、検証項目、正常・準正常・異常、公開入口、実環境および終了後観測を既に扱う。一方、単体試験、結合試験、総合試験、受入試験、性能試験および長時間試験の責務が明示的に分かれておらず、試験種類、E2Eおよび回帰実行との関係も実装者の解釈に依存していた。

本変更は、試験レベルと試験種類を分離し、設計・変更した意味から必要な試験を選択して自動回帰できる体系へ更新する。既存試験を名称だけで再分類せず、対象境界、利用側、実行環境および観測可能な保証から分類する。

## 2. 人間が決定した範囲

- 回帰試験は独立した試験レベルではなく、単体・結合・総合等の既存試験を変更影響に応じて選択・再実行する方式とする。
- 既存の`unit`、`contract`、`integration`、`boundary`、`golden`、`current`は試験種類として維持し、試験レベルと混同しない。
- CRDD所有Toolの実行可能な試験は、試験レベルごとのDirectoryへ配置する。回帰専用Directoryは作らない。
- 性能試験および長時間試験は、コードまたは試験設計を用意できるが、人間が対象、上限、費用・Credit、時間、停止条件を明示的に指示しない限り実行しない。
- 性能試験または長時間試験が存在すること、および実行可能であることだけを、監査・統合・通常Releaseの必須条件にしない。現在の必須非機能要求または受入条件が実測を要求する場合だけ、未実行を未確認として扱う。
- 機械検証可能な回帰は自動実行を基本とし、人間確認を重ねない。受入試験は利用者または業務上の判断が結果を左右する場合だけ発火する。

## 3. 試験レベル

| 試験レベル | 主対象 | 実行境界 | 主な目的 |
|---|---|---|---|
| 単体試験（UT） | 単一module、純粋な計算、局所状態変換 | 原則として同一Process内。実OS資源や外部Serviceを所有しない | 原因層の局所契約と分岐を速く反証する |
| 結合試験（IT） | Component、Adapter、Store、Filesystem、Process等の接続 | 二つ以上の実Componentまたは実境界 | 層間搬送、資源所有、失敗伝播および終了後条件を確認する |
| 総合試験（ST） | 利用者が選べる公開入口から主要な利用者成果まで | 本番同等の構成または差を明示した固定開発構成 | System全体の意味、Journey、公開結果および終了後状態を確認する |
| 受入試験（UAT） | 利用者・業務上の受入条件 | 実利用者、決定権限者または代表利用環境 | 機械判定だけでは決められない利用可能性・価値・業務適合を判断する |
| 性能試験（PT） | 応答時間、処理量、同時実行、資源上限等 | 定義した負荷・環境・測定条件 | 現在の非機能要求に対する性能を測る |
| 長時間試験（LT） | 長時間安定性、蓄積、枯渇、劣化、回収 | 定義した継続時間、反復、資源・費用上限 | 短時間試験では見えない時間依存のRiskを測る |

E2Eは独立した試験レベルではない。公開入口から利用者成果までを端から端まで確認する試験形態であり、通常は総合試験として分類する。限定したComponent間だけを端から端まで通す場合は結合試験となり得るため、`E2E`という表示だけから総合試験成立を推定しない。

## 4. コード配置

CRDD所有Toolは、存在する実行可能試験だけを次のDirectoryへ配置する。該当試験がない空Directoryは作らない。

```text
tests/
├ unit/
├ integration/
├ system/
├ acceptance/
├ performance/
├ longevity/
├ fixtures/
└ support/
```

試験レベルはDirectory、試験種類は`<subject>.<kind>.test.ts`等の既存filenameで表す。Fixtureと共通支援コードは試験レベルではなく、実行対象として自動発見しない。Rust等、言語・Frameworkの標準配置を維持する必要がある場合も、同じ論理レベルを機械可読な試験カタログで示し、言語標準を壊すDirectory移動を目的にしない。

## 5. 自動回帰の設計方針

自動回帰は、変更fileだけでなく、変更した契約、状態、資源、Authority、Identity、Effect、Recovery、永続化、公開投影および利用者経路から影響を導出する。

```text
変更差分
  ↓
変更した意味と利用側
  ↓
試験カタログ
  ↓
必要なUT／IT／STを選択
  ↓
実行集合と未実行理由を固定
  ↓
実行結果・終了後観測
```

試験カタログは、少なくとも実行対象、試験レベル、試験種類、検証義務または設計要素、必要環境、発火条件、正常・準正常・異常の対象、外部Effect、人間入力および終了後観測への参照を持つ。実在試験集合と登録集合を独立に取得して欠落・余剰を検査し、同じ手書き一覧を期待値と実績へ流用しない。

カタログは閉じたSchemaとして扱い、欠落した安全field、未知field、不正Pathまたは未知の列挙値を既定値へ畳まない。登録試験そのものだけが変わった場合を除き、production code、support、fixtureまたは設定の変更では対象ToolのUT・IT・ST全体を安全側の閉包として選ぶ。共有設定または所有者不明の実行可能変更では全Toolを選び、filename tokenを意味依存の代替にしない。Gitの変更集合はCommit差分だけでなく、staged、unstaged、untrackedおよびrenameの両Pathを含める。

自動回帰runnerは、静的検査、単体試験、結合試験、総合試験の順に実行し、前段が失敗した後段を開始しない。Windows実Process Gateは結合試験の専用実環境確認として総合試験より前に置く。試験失敗、前提不成立、環境不足および未実行を区別する。外部Provider、公式署名、秘密入力、人間判断、長時間または大きなCredit消費を自動的に発火しない。

## 6. PT／LTの実行AuthorityとGate

性能試験または長時間試験を実行するには、人間が少なくとも次を明示する。

- 対象と目的
- 実行環境
- 最大時間または反復数
- 最大費用・Credit・Provider呼出し
- 生成・保持するデータとcleanup
- 中止条件

許可がない場合、runnerは`not_authorized`または同等の非実行結果を返し、試験Process、Provider Effect、課金または長時間待機を開始しない。

現在のrunnerは上限を実行時に強制する制御をまだ持たないため、許可情報が完全でもPT／LTを計画表示に留め、試験Processを開始しない。通常試験と同時に選ばれた場合も全体を計画表示で停止する。上限強制、有限終了およびcleanupの設計・実装・検証を別変更で成立させるまで実行可能とは表示しない。

PT／LTの未実行が監査またはReleaseを停止するのは、現在の要求、品質戦略、受入条件または人間が固定したRelease Gateが、その実測を必須としている場合だけである。それ以外では理由付き非該当または任意の未実行として扱い、全体`Pass`へ実施済みと偽装せず、通常の必須検証を停止しない。

## 7. 実装計画

1. 品質保証正本へ試験レベル、試験種類、E2E、回帰実行およびPT／LT Authorityを追加する。
2. 検証設計Templateへ試験レベル、回帰発火条件および任意試験のGateを追加する。
3. CRDD内部Toolのコーディング規約へDirectory配置を追加する。
4. CheckerとCoordinatorの既存試験を全数棚卸しし、移行表を作る。
5. 既存試験をレベル別Directoryへ移し、import、設定、package script、文書参照および署名対象を同じ変更で更新する。
6. 試験カタログ、登録漏れ検査および変更影響型の回帰runnerを最小実装する。
7. 旧runnerと新runnerの実行集合、正常・準正常・異常、公開入口および終了後条件を照合する。
8. Checker／Coordinatorで自己適用し、固定候補へ独立レビューと必要な監査を行う。

### 7.1 現在の自己適用結果

- Checker、CoordinatorおよびPlatform Accessの実在試験を試験カタログへ全件登録し、未登録、重複、消失およびDirectoryと主試験レベルの不一致を機械検出する。
- Checkerの288件とCoordinatorの制限Process用1683件は、移行後のDirectoryおよび更新した参照で全件成功した。
- Windowsで実子孫Processの終了を確認する7件は、制限ProcessではOSから終了要求を拒否されるため、通常の失敗へ混ぜず、`restricted_process`と`windows_process_control`の二つの実行Profileへ分離した。試験カタログは対象3ファイルを両Profileへ結合し、回帰runnerは専用Authorityなしでは試験Process開始前に停止する。Authorityを明示して必要な実行環境から起動した7件は全件成功した。
- 回帰runner自身の契約試験は、Windows実Process Profileの計画表示、AuthorityなしのEffect 0、および専用Profile実行後の通常終了を確認した。これにより、実装不具合と実行環境不足を同じ失敗として反復しない。
- 過去の中断で残ったRepository-local試験Directory 275件は、対応する試験子Processが現存しないことと、全対象が検証済みの`.crdd/test-tmp`配下であることを確認して削除した。終了後資源の残存を回帰結果へ含め、同種の蓄積を成功扱いしない。
- 性能試験および長時間試験は実行していない。現在の必須非機能要求または受入条件に含まれないため、通常回帰の未達とは扱わない。
- Provider境界の状態・分岐Matrixを全件実装した後の限定実測で、CodexとClaudeの両経路がProvider開始前に`coordinator_task_provider_model_selection_invalid`で停止した。選定Grantの有効期間30秒に対し、`STATE-TASK-AUTHORIZED`の実前処理はCodex約40.9秒、Claude約44.4秒であり、固定Fakeが即時完了する既存結合試験では時間関係を再現していなかった。件数網羅だけでは時間依存の成立条件を保証しないため、Provider HomeとMount照合後に旧Selectionを失効し、同じ意味のSelectionをEffect直前に再発行する構造へ変更した。再発行失敗、意味差および旧Grant失効失敗をProvider Effect 0で反証し、準備失敗を安全な固定理由で識別する。期限延長による吸収は行わない。
- 同じ限定実測では、2TaskのAuthority操作と進捗参照が完全Identity観測を合計66回発火し、Source、Native成果物およびRepositoryの再検証だけで累計約273秒を要した。進捗参照とread-only集計を生存確認へ分離した最初の是正後も、実Codex経路のProvider／Docker資源が全て回収された後に、親Runtimeだけが約20分間CPUを使用し続けた。Native Adapterの前後およびcleanup補助観測が、同じlifecycle内で配布全体の完全Hashを繰り返していたためである。
- 完全Identity観測を単なる関数呼出し単位ではなく、Admission、Task／Operation結合、Native lifecycle初回進入、Provider Effect直前・終了後、cleanup lifecycle初回進入という意味境界へ固定した。同じ境界内の補助観測は固定Identityを再利用し、Native実行物は各Adapterが従来どおりProcess前後に個別照合する。Source、Native配布またはRepositoryがNative補助処理中に変化した場合は、次のProvider Effect境界で拒否し、Provider実行中に変化した場合は終了後の完全観測で成功公開を拒否する。単体・結合試験265件で、正常系、取消・期限切れ、実行物前後差、Source／Native／Repository差および終了後不一致を確認した。

### 7.2 独立レビューで検出した共通原因と是正

初回固定候補の独立レビューは、変更選定のfilename依存、安全field欠落時の既定値化、PT／LT上限の非強制、段階実行の未接続、およびGit未コミット差分の欠落を検出した。これらを個別例外ではなく、回帰runnerが「何を検査対象とし、どの順で、どのAuthorityと終了条件で起動できるか」という一つの信頼境界の不成立として扱った。

是正では、試験カタログrevision 3の閉Schema、所有Tool単位の保守的閉包、静的→UT→IT→STの停止順、Commit・index・worktree・未追跡を含むGit観測、およびPT／LTの全面的な計画専用境界を同時に固定した。各合意事項を正常・準正常・異常の契約試験へ全数対応させた。Focused test 28件、Checker 288件、Coordinator制限Process用1683件、Windows実Process Gate 7件、Platform AccessのRust unit 19件・実子確認1件・CLI結合1件、型・Lint・Format、およびRepository Checker（Markdown 415件、local link 2907件、error 0、warning 0）が成功した。

独立再レビューで残った指摘に対しては、文書の配置に依存しないChecker選択、段階計画から実行処理への実配線と失敗時の後続停止、Windows実Process試験3ファイルと実行Profileの完全一致、明示変更PathのRepository相対境界、および公開field名の正規表記を一括して閉じた。再レビューで、表示用計画と実行順序を別々に生成できる余地が残っていることを確認したため、Windows実Process確認を含む純粋な段階計画を唯一の実行入力へ変更した。同じ計画を依存注入した実行処理へ渡し、`static → unit → integration → windows_process_control → system`の表示と実行の一致、Windows実Process確認が不要な場合の非出現、および各段階の失敗後に後続を起動しないことを反証した。集中契約試験25件、命名契約7件、Checker全292件、型・Lint・Format、およびRepository Checker（Markdown 415件、local link 2907件、error 0、warning 0）が成功した。固定コミット`ae8efe1`の独立最終レビューは、Critical、Major、ModerateおよびMinorがすべて0で、新規指摘なしの`Pass`となった。

### 7.3 合成E2Eの確認範囲と再試行

v0.20.0の正式4経路E2Eでは、Docker回復義務を解消した後も、限定Candidateの独立確認がRepository全体の保守・公開Gateを受入条件へ追加し、一回の是正後も同じ不承認を返した。Runnerは同じ固定入力を最大3回反復したため、結果を変えないProvider利用と約15分の待機が発生した。

v0.19.0との比較では、Docker Desktopを起動するNative処理および一般Taskの実行・確認Coreに、この現象を直接生む置換は確認されなかった。Docker Desktopの起動失敗は、短命な親Processから開始した手順とProcess lifetimeの不整合であり、通常User Sessionに存続する親Processからのv0.19.0相当の起動でEngine成立を確認した。Task側では、合成Candidateの役割が確認者へ十分に伝わらず、Candidate整合性不成立と確認者不承認が同じ理由へ畳まれ、変化しない意味判断まで安全再試行対象に含まれていた。

是正は次の一単位として行う。

| 契約 | 是正 |
|---|---|
| 確認範囲 | 合成CandidateはCommit／Release候補ではなく、指定した受入条件だけを評価することをTask Packetへ明示する |
| 条件の証明主体 | Reviewerへ渡す受入条件はReadable Candidateから観測できる意味に限定し、Base byte、変更Path閉包、改行、byte長およびHashはSigned Runnerの独立検証へ割り当てる |
| 原因分類 | Candidateの固定Identity／内容不一致と、確認者による意味的不承認を別の結果理由にする |
| 再試行 | 一回の是正後も続く確認者不承認を自動再試行対象から外す |
| 保持する保証 | 独立確認、受入条件の実質的反証、Candidate範囲検証、cleanupおよびRecoveryのFail Closedは弱めない |

この是正は、確認を通すためにFindingを無視する変更ではない。試験Candidateが所有しないRelease条件を追加しないこと、各条件を実際に証明できる観測者へ割り当てること、および再実行により変化し得ない入力を反復しないことを固定し、独立確認の判断と機械的なCandidate破損を利用側が区別できるようにする。v0.19.0から存在した固定Taskには、Reviewerから観測できないBase履歴と編集方法が受入条件へ混在していた。全受入条件の評価を明示したことでこの潜在不整合が顕在化したため、Reviewerは現在のCandidateから確認できる表示内容だけを評価し、履歴・Path・byteの保証は既存Runnerの反証へ保持する。

### 7.4 Reviewerの実読取り能力

受入条件をCandidateから観測可能な形へ整理した後も、Codex Reviewerは対象内容を確認できず不承認を返した。限定診断では、Reviewerが`Get-Content`、`type`、`ReadAllText`および`rg`による読取りを試みたが、全て実行Policyで拒否された。Workspaceはread-onlyで接続されていたものの、Providerが内容を読む手段はShell Processだけであり、`approval_policy=never`とProcess非許可により実読取り能力が成立していなかった。

| 成立条件 | 構造是正 |
|---|---|
| 読取り範囲 | `readPaths`からRuntimeが候補内容を列挙する |
| 候補同一性 | Patch Hashと内容Manifest Hashへ内容投影を結合する |
| 情報境界 | UTF-8、1 MiB、256ファイル、認識済みSecret検査をProvider開始前に強制する |
| Reviewer権限 | Codex ReviewerのShell／Filesystem Toolを無効化し、内容投影だけで確認する |
| 差替え防止 | 投影生成時にCandidate Inventoryを再計算し、不一致ではEffect 0で停止する |
| 回帰 | Repository Workspace、Task Packet、Codex実行計画およびCoordinator利用側の契約試験を接続する |

これはReviewerの判定を緩める変更ではない。明示した受入条件を確認するための入力をRuntimeが保証し、任意Process実行やProvider Home読取りを追加せず、観測不能をFindingまたは推測へ畳まないためのCapability是正である。

4経路E2Eでは、Codex Reviewerを使う最初の経路が初めて完了した。一方、Claude Reviewerを使う次の経路は不承認となった。Task Packetに、旧来の`/work`確認指示と新しい内容投影限定指示が同居していたため、Providerによって優先する指示が分かれ得る状態だった。Reviewerの入力正本を内容投影だけへ一意化し、Filesystemは入力でないこと、および投影Recordの`content`だけが完全な候補本文で他fieldはMetadataであることを明示する。異なるProviderが同じ意味契約を受け取る場合、後段の禁止で旧指示を打ち消さず、入力所有者・観測手段・評価対象を一つの矛盾しない指示へ置換する。

指示を一意化した固定候補でも、Filesystem Toolを無効化済みのCodex Reviewerは完了し、旧来の`Read`／`Glob`／`Grep` Capabilityが残るClaude Reviewerだけが不承認となった。設計上の入力正本と実行時Capabilityを一致させるため、Claude ReviewerのBuilt-in Toolも空集合へ変更する。read-only mountの存在を読取りCapability成立とみなさず、全Provider ReviewerがRuntime所有の不変内容投影だけを評価する。Provider間で同じRole契約を持つ場合は、PromptだけでなくTool、FilesystemおよびProcess Capabilityの実効集合も同値にする。

Toolを空集合へ揃えた固定候補でも、同じClaude Reviewer不承認が再現した。この結果により、旧Tool残存だけを原因とする仮説は反証された。Review入力を再点検すると、投影を「非信頼Candidate data」と表現しながら、その投影だけでCandidate内容を評価させており、指示としての非信頼性とReview Evidenceとしての正当性が区別されていなかった。投影EnvelopeとCandidate bindingはRuntime-authenticated Evidence、埋め込み内容は指示・Authorityとしてのみ非信頼、候補内容を評価するdataとしてはexact、という責務を一意化する。安全境界の表現が、必要な証明能力そのものを否定しないことをCross-provider実E2Eで確認する。

4経路試験自体は汎用Review品質の評価ではなく、固定Candidateの搬送、Role分離、結果契約およびcleanupを確認するSystem Testである。そのため固定受入条件は、Runtime-authenticated投影内の対象Path、`present`状態およびexact contentから合否を決める決定表として記述し、Reviewerが試験目的外のRepository Evidenceを追加要求しないようにする。独立Reviewの厳格さを弱めるのではなく、System TestのOracleとReviewerが所有する意味判断を混同しない。

決定表を明示した固定候補でも、Claude Reviewerを使うReverse経路だけが不承認となった。受入条件は現在の投影だけで判定できる一方、Objectiveには「既存の`BASE`を置換した」という履歴上の編集方法が残り、Reviewerへ渡していないBase Evidenceを暗黙に要求していた。System TestのObjectiveも現在の完成状態へ統一し、Base byteと置換過程の確認はSigned Runnerだけが所有する。受入条件だけでなくObjective、説明および検証結果を含むTask Packet全体で、各主張の証明主体を一致させる。

### 7.5 実Reviewer境界の段階的結合

Objectiveを現在状態へ揃えた後もReverse経路の不承認が続いたため、文言調整を中止した。既存の試験体系には、内容投影とResult Parserの単体試験、固定FakeによるCoordinator結合試験、実Providerを使う4経路E2Eはあったが、次の二ブロック境界を直接確認する結合試験がなかった。

```text
候補結合済み内容投影
  ↓
実Codex／Claude Reviewer
  ↓
構造化判定
  ↓
必要な一回是正
  ↓
Provider終了／候補処置
```

この欠落により、投影内容が正しいままReviewerが不承認にしたのか、投影・搬送・是正のどこかが不成立なのかを最終E2E結果から切り分けられなかった。是正として、Provider実行とReviewer判定を別の結合ブロックに分け、署名済み固定候補からCodex ReviewerとClaude Reviewerを各一回だけ通す明示実行の結合試験を追加した。通常回帰では外部Providerを起動せず、明示実行だけが既存Subscriptionを使用する。

失敗結果には生のProvider出力やFinding本文を保存しない。Runtimeが検証した判定、Finding件数、severity／path／category／criterion、本文Hash、候補投影Hash、対象fileのbyte長／Hash、是正有無および終了後資源だけを保存する。これにより、安全境界を維持したまま、最終4経路E2Eの前に境界不成立を局所化する。

### 7.6 Provider実行境界の全数化

実Reviewer境界を追加した後、Reverse経路ではCodex Executorが完了結果を返しても候補内容が変化せず、一回是正後も同じ不承認となった。`workspace-write`の指定だけでは、現在のCodex CLIが無人実行時に書込み要求を承認する経路の成立を証明していなかった。一方、CLI helpに専用optionが存在することだけでも原因を確定できないため、推測修正ではなくProviderごとの最小実境界と全Lifecycle Matrixへ戻す。

| 確認群 | 全数対象 |
|---|---|
| Role計画 | Codex／Claude × Executor／ReviewerのTool、Approval、Workspace権限、stdin |
| 正常縦断 | 両ProviderをExecutorとReviewerの双方で一回ずつ使用し、実変更、申告、候補捕捉、投影、判定、処置、資源不存在を確認 |
| 異常Lifecycle | 同期／非同期起動失敗、非ゼロ終了、timeout、取消、不正結果、申告差、投影失敗、cleanup不明、一回是正 |
| 閉包 | 宣言caseを実在試験へ全数対応し、未対応、重複、消失を機械検出 |

異常Lifecycleは実Providerの応答揺れへ依存させず、同じDocker・子Process・候補経路へ決定論的に注入する。正常縦断だけを明示した実Provider結合として実行し、Subscription消費と外部送信範囲を限定する。CLI option、正常終了codeまたはProvider申告からCapability成立を断定せず、実Workspaceのbyte変化と終了後条件を観測する。

固定開発候補の初回実測では、Claude ExecutorからCodex Reviewerへの経路は成立した一方、Codex Executorだけが`provider_process_exit_nonzero`となった。ネットワークとProvider Homeを遮断した固定Codex 0.149.1のProcess初期化Probeにより、`--approve-for-me`と`--sandbox workspace-write`の同時指定をCLI自身が拒否することを確認した。各optionの存在と期待値を別々に確認した結合試験では、この組合せ契約を保証できていなかった。

最初の是正では、Codex Executorの自動承認optionへ`workspace-write`選択を委ね、Process初期化の衝突を解消した。しかし実Provider境界では、Codexが初回と是正の双方で変更0件を返し、Reviewerが同じ未達を検出した。Process開始を実変更能力の成立と扱ったため、この是正だけでは不十分だった。

v0.19.0の固定Binary、Task計画および実変更Evidenceを比較し、Codex Executorを`approval_policy="never"`とRole別Filesystem権限Profileへ戻した。ただし最初の復元では、v0.19.0に存在しなかった`--sandbox workspace-write`を重ねており、実証済みのoption集合を正確に復元できていなかった。Task条件をRole共通へ是正した後もCodexだけが変更0件を返したため、差分を再確認し、重複する`--sandbox`をExecutor／Reviewer双方から外す。Root deny、ExecutorだけのWorkspace write、ReviewerのWorkspace read、Provider実行物read、Provider HomeのCommand read禁止、Dockerのread-only root、Capability drop、Network proxyおよびTask境界は変更しない。

この経路へ戻した後もCodex Executorは変更0件を返したため、v0.19.0との差をTask入力まで広げて再確認した。v0.20の検証Taskは、Reviewerへ投影判定を指示する一条件へ縮約され、Executorに必要な対象Path、既存BASEの置換および期待する最終内容が受入条件として分離されていなかった。Role共通の三条件へ戻した実測でもCodexだけが変更0件だったため、成立済みCapabilityの復元ではTaskの意味を要約し直さず、v0.19.0で成立したObjective、三条件、読取り範囲およびExecutor指示を同じ意味単位で復元する。Reviewer固有の候補投影と秘密情報保護は維持する。読取り範囲の復元では、直接のTask Packetだけでなく、`readPathCount`から導出されるReviewerの最大Turn数、CLI引数および試験Oracleも同じ変更単位として追従させる。結合試験はProcess初期化だけでなく、実Workspaceの許可対象1件が変更され、対象外変更0件、終了後残存0件になるまでを成立条件とする。

Task入力を正確に復元してもCodex Executorだけが変更0件だった。過去の試行順を再構成すると、明示的なSandboxを試した時点ではTask条件が未成立であり、Task条件を復元した後はSandboxを省略していたため、両方を満たす組合せは未検証だった。現行のCodex CLI公式契約では、非対話のWorkspace内書込みに`--sandbox workspace-write`を使用する。固定CLI、Role別Filesystem権限Profile、`approval_policy="never"`、Docker隔離を維持したまま、Executorへ`workspace-write`、Reviewerへ`read-only`を明示し、正しいTask入力との組合せを実境界で反証する。

この組合せでもCodex Executorは変更0件だった。固定CLI `0.149.1`が提供する無人実行用`--approve-for-me`は、明示的な`--sandbox`と同時指定できず、自身が自動ReviewとWorkspace書込みSandboxを選択する。過去は不十分なTask条件としか組み合わせていなかったため、復元済みTask入力との組合せを最後の固定CLI内候補として反証する。これでも実変更が成立しなければ、引数の局所調整を終了し、固定CLIと現在のService／Tool契約の互換性を配布更新として扱う。

復元済みTask入力と`--approve-for-me`を組み合わせた固定開発版でも、Codex Executorは初回・是正とも変更0件、Claude Executor経路は成功という同じ結果になった。さらに`approval_policy="never"`と明示的な`workspace-write`へ切り替えた比較でも結果は変わらなかったため、承認optionを原因とする仮説は否定し、変更を元へ戻した。以後はoptionを推測で入れ替えない。

次の固定候補は、Codex `0.149.1`のJSON Lines実行Eventから、Command実行とFile変更の開始・完了・失敗・拒否件数およびTurn完了だけを安全な診断として保持する。独立Reviewer不承認時にも、Executor申告Path、実候補Pathおよびこの診断を同じ結果へ接続する。生Event、Command、Event内PathおよびProvider本文は保持・公開せず、候補Filesystemの観測を正本のまま維持する。これにより、Tool未使用、Tool拒否・失敗、File変更完了後の捕捉不整合、またはProvider申告不整合を一回の実測で区別してから次の構造是正を決める。

診断付き固定候補`ebfdcb3f`の実測により、Codex ExecutorはCommand実行を2回開始して2回とも失敗し、File変更Event 0件、申告変更0件、実候補変更0件だったことを確認した。Claude Executor／Codex Reviewer経路は同じ測定で成立した。これにより、Reviewer入力、候補捕捉だけ、Provider未起動または単純な承認拒否を主原因候補から下げ、Codex固有のCommand実行、権限、Container内環境およびWorkspace Mountへ調査境界を縮約した。ここへ至るまで原因を区別できない実Provider実測と設定置換を反復し、Creditと経過時間を消費したため、同じ外形の失敗を再現した時点で、次の一回が仮説集合を分割できる安全な診断を先に追加する規則を品質保証へ還元した。

この学びは検証手順だけでなくArchitectureの不足でもあった。外部境界は、入力・構成、要求・受理、開始・完了、Effect・結果搬送および終了後状態を、機密を複製せず相関できる診断契約を実装と同時に持つ。Codex診断はCommand終了codeを`0`、`1`、`126`、`127`、その他の非0および欠落へ閉じて集計する。Docker Process境界は、実際に消費した起動構成から承認方式、Sandbox、Workspace mount、read-only root、非root userおよびworkdirを設定値として示し、Container作成、Provider Process開始・完了、終了code区分およびcleanupを実観測値として同じOperationへ相関する。Command本文、Path、生出力およびCredentialは保持せず、診断表示の失敗はAuthorityまたは本処理結果を変更しない。これにより、次の一回でCommand／Tool互換、Codex固有実行環境、承認・SandboxおよびContainer／Workspace境界の候補をさらに分離できるようにする。

固定候補`46dc79e5`の実測とProviderを使わない同一Image反証により、次を確認した。

| 観測対象 | 結果 | 判断 |
| --- | --- | --- |
| Codex外側Process | Container作成、Process開始・終了0、回収が成立 | Docker起動・結果搬送を主原因から除外 |
| Codex内側Command | 2件とも終了1、File変更開始0 | 内部Command選択またはTool Capability不整合へ縮約 |
| 承認 | `approve_for_me`設定、拒否0 | 単純な承認拒否を主原因から除外 |
| 同一Imageの局所反証 | UID 65534、`/work`、read-only root、bind mountで読取り・置換・再読取りが成立 | 基本Filesystem権限とmountを主原因から除外 |
| Image Tool Inventory | Python 3／POSIX text Toolあり、Git／`apply_patch` Commandなし | Task Packetの実行Capability説明不足を是正対象とする |

Task Packetへ、Git Metadataが存在しないこと、Gitと未提供の`apply_patch` Commandを使わないこと、検証済みのPython 3またはPOSIX text Toolを使ってCommand結果と変更後Fileを確認することを追加する。これはProvider固有の攻略文ではなく、隔離された外部実行境界が提供するCapabilityをConsumerへ伝播するArchitecture契約である。

このTask Packetを含む固定候補`80375631`でも、Codex Executorは初回・是正を通じて3件のCommandを開始し、全て終了code 1、File変更Event 0件、申告変更0件、実候補変更0件となった。非root user、read-write mount、read-only root、workdir、外側Process完了およびcleanupは実観測で成立し、Claude Executor／Codex Reviewer経路も成立した。したがって、利用可能Toolの説明不足だけを原因とする仮説を否定し、次の実測前にJSON LinesからCommand本文と生出力を公開せず、使用Tool系統と既知の失敗理由だけを閉じた分類へ追加する。同じ外形の実測を再反復せず、次の一回がCommand選択、Path、権限、Sandboxまたは構文の候補を分割できることを実行条件とする。

固定候補`9852bc79`の一回の実測では、Codex Executorが使用したCommandはPOSIX text系であり、3件全てがSandbox分類で終了1となった。Git、`apply_patch`、Python、権限、read-only Filesystem、Path不存在、Command不存在および構文の分類は0だった。Providerを呼ばない同一Docker制約のbubblewrap Probeは、非特権user namespaceを作成できない固定理由で再現した。Docker Engine 29.7.2ではContainer限定の`kernel.unprivileged_userns_clone`変更も許可されない。したがって、Task内容やProvider判断ではなく、外側Docker隔離の内部へ固定Codexのbubblewrapを重ねた実行構成が直接原因である。

Codex CLI自身が外部Sandbox環境専用として提供する非対話入口へExecutorを切り替え、隔離のAuthorityを外側Dockerへ一意化する。非root user、read-only root、Capability全削除、限定Workspace mount、Network proxy、Provider Home保護、Process tree終了およびContainer／Network不存在は維持する。危険名のoptionが存在することだけで許可せず、実際のDocker起動構成と終了後状態を同じOperation診断へ接続し、固定Binaryの実Workspace変更を結合試験で確認する。

固定候補`b8a5954f`ではCodex Executorの実変更が成立したが、署名前監査で、Sandbox無効化によりmodel生成Commandが同じContainer内のread-write Provider Homeへ到達できることを検出した。外側Dockerだけを隔離所有者にする設計は撤回する。Providerを使わない段階的反証では、Moby既定seccompへ`clone`、`clone3`、`mount`、`pivot_root`、`unshare`、`umount2`だけを追加すると、Capability追加なしで固定Codexのbubblewrapが成立した。Executorは`--approve-for-me`とこの固定profileを使い、Reviewerのread-only境界は維持する。profileはRuntime実行Identityへ含め、Path、byte長またはSHA-256が一致しなければProvider Effect 0で停止する。

### 7.7 Sandbox契約の利用側閉包

固定profileを追加した最初の候補では、Adapterが生成するCodex Executor Commandだけが更新され、Docker Effect側の許可Command再構成が旧option列のまま残った。単体試験と直接Docker試験は成功したが、実Provider結合ではDocker起動前にPlanが拒否され、Cleanup不明へ畳まれた。

是正では、固定profileのPath、byte長およびHashを検証するResolverを一つの所有者へ分離し、AdapterとDocker Effectの両Consumerが同じ正規結果を使用するようにした。Codex Executorの正規Commandを実際のDocker Effect検証へ渡す契約試験を追加し、Producer単独の成功ではなく、副次的な安全Consumerを含む受理までを回帰条件とした。責務・Canonical Contract・保護optionを変更する場合は、主機能だけでなく、再検証、署名、回復、診断およびRelease入口を含む全Consumerへ同じ意味が伝播したことを、代表例ではなくConsumerごとの契約試験と最終入口の縦断で確認する。

### 7.8 開発候補の回復Context伝播

Sandbox契約の初回固定候補は、Docker Effectの許可Command再構成が旧option列のまま残り、Provider開始前に停止した。Runtimeは開始意図を耐久化したため正確なDocker回復義務を返したが、通常Release用の回復入口だけでは、固定開発候補に結合されたRuntime State Rootを観測できなかった。Docker資源は実在しなかったものの、開発測定の認証Contextが回復の観測、処置および事後Inventoryまで伝播しない限り、資源不存在を根拠に記録だけを消してはならない。

是正では、新しい開発用Trustを生成せず、測定開始時に検証済みの同じProcess内CapabilityをDocker回復の全観測段へ渡す。通常Releaseでは従来どおり署名済みRuntimeの観測だけを使用し、開発Contextを渡した場合は、固定Package、Repository Revision、Native Release、期限およびTask集合の再検証に成功した場合だけ同じRuntime State Rootへ到達する。Focused回帰に加え、失敗を発生させたexact Recovery Identityについて、Docker資源不存在、耐久記録の完了および終了後Inventoryを固定開発候補から実確認する。

## 8. 完成条件

- CRDD正本とTemplateから各試験レベル、適用条件、非適用条件および相互に代替できない保証を再構成できる。
- 既存試験の全件がexactに一つの主試験レベルへ分類され、未分類・重複・消失が0である。
- 実在試験集合、試験カタログおよびrunner到達集合の欠落・余剰を機械検出できる。
- 変更した意味から必要なUT／IT／STを選択し、未実行範囲と理由を報告できる。
- PT／LTは明示AuthorityなしでEffect 0となり、任意の未実行が通常監査を停止しない。
- 必須としたPT／LTまたはUATを未実行の場合は、実施済みや全体`Pass`へ集約しない。
- 既存の必須試験、公開入口、正式署名およびRelease Gateを分類変更によって脱落させない。

## 9. 目指さないこと

- すべてのRepositoryへ同じTest Frameworkやcommandを強制すること
- 試験本数、coverage率またはDirectoryの存在だけで品質を判定すること
- 全変更で全試験、実Provider、UAT、PTまたはLTを実行すること
- 任意試験を増やしてReleaseを恒常的に停止すること
- 人間による受入判断を自動テストの成功で代替すること
- 既存試験を意味確認なしにfilenameだけで一括分類すること
