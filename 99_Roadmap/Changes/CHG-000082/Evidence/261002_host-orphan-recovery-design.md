# 元の回復参照を確定できないHost残存の限定保守

成果物種別: 変更の設計・検証記録
変更ID: `CHG-000082`
基準Commit: `a14b0d6461d3dfb295dd4dca954a9ee83015ffcf`
記録日: 2026-10-02
維持責任者: Qual-Lab

## 現在の結論

同じCHGで限定的な人間承認付きRecovery経路を追加する方針が承認された。第一単位は候補設計、Authorityを発行しない内部Policyと局所UTである。**実観測・実処置・公開入口は未接続であり、Recoveryは未完成。** 新しい実Taskの停止は維持する。

今回の承認は今回観測した資源クラスの設計・実装・試験・独立確認を対象とする。実在三件の削除はexact対象を提示した別の承認が必要である。元Tokenの手動生成、汎用強制削除、Provider再送、Docker再起動、永続Dockerデータ削除およびReleaseは対象外である。旧署名候補d36a9decと過去のEvidenceは変更しない。

## 人間判断と変更経路

| 項目 | 確定した処置 |
|---|---|
| Intent | 実Taskで観測された、元の回復参照を確定できない残存から安全に回復できるようにする。 |
| 同じCHGとする理由 | 既存Recovery責務の実反例への是正であり、別の汎用清掃機能ではない。 |
| 限定クラス | Coordinatorのhost_only記録に対応し、固定六childが空のHost作業領域。非空、別状態、由来不明およびDocker資源は範囲外。 |
| 不変条件 | 人間のexact承認、fresh Identity・所有範囲・非使用確認、不明時の停止、処置後の直接不存在観測。 |
| レビュー／監査 | 第一単位の技術独立レビュー、文書監査、品質・影響監査を同じ固定差分へ実施する。 |
| 今回行わない確認 | 削除Authority・実OS処置・公開入口がないため、実在Root清掃、Native清掃E2EおよびProvider再送は行わない。局所Passで代替しない。準拠基準やRelease判断は変更しない。 |

## 着手前整合確認

親の正本照合と読取り専用の専門確認で、次の不足を検出した。

| 根拠 | 判明した境界 | 設計への処置 |
|---|---|---|
| `execution-environment.ts`のgeneration登録と`coordinator-task-runtime.ts`のSupervisor取得順 | Root、marker、Capability作成後にLockが取得される。 | 初期化中も含めた排他を別の必須条件とする。現在Lockを取れたことだけを非使用証明にしない。 |
| `doctor.ts`の受動Doctor経路 | 同じGeneration LockなしでRootを利用・清掃する利用側がある。 | producer／consumer母集団と旧形式の移行根拠を閉じるまで、非使用不明として拒否する。 |
| `platform-access/src/windows_directory.rs`とNative Sourceの限定検索 | 既存部品はSystem Directory読取りであり、差替えを防ぐhandle-based deletionは確認できない。 | OS処置境界をOPENとして保持する。通常のPath削除を必要保証の成立へ読み替えない。 |
| 耐久記録と再入場のAuthority規則 | 次Processへ削除許可を与えるintentはRecovery Authorityである。 | `.crdd`自己申告をAuthority正本にしない。非Authority checkpoint案では毎回fresh承認と保護済みlineageへ再結合する。 |

元markerからTokenを作り直す案は、記録を元Authorityへ昇格させるため不採用。強制削除も非使用不明を解除するため不採用。採用方向は対象を狭く固定した新しい保守承認である。ただし承認だけでは根拠不足を補えない。

## 契約と反証例

候補契約の正本は[Coordinator詳細設計§11](../../../../06_Architecture/Details/coordinator/01_Architecture.md#元の回復参照を確定できないhost残存の保守候補)。この記録は採用理由・進行・検証状態を所有し、契約を複製しない。

| 例 | 第一単位の処置 | 後段の必要根拠 |
|---|---|---|
| 全十一条件が局所fixtureで成立 | `candidate_ready`。Authority非発行・清掃未確認・本番未接続。 | 実在する根拠の観測と別の処置Capability。 |
| 元exact Recovery IDが有効 | 既存回復経路を使用する。新しい候補判定で置換しない。 | 既存Authority・Recovery契約。 |
| 非空、未知child、別状態、Docker結合 | 対象外として拒否する。 | 将来の別クラスを暗黙に追加しない。 |
| 空の六childとKernelLockだけ確認できる旧形式 | 非使用・初期化中・旧consumerの根拠がunknownならblocked。 | 閉じた母集団、観測完全性、連続排他、旧形式移行根拠。 |
| 部分処置後に再入場 | 現在は処置自体が未接続。将来は固定対象と許可した進行を保持する。 | fresh承認と保護済みlineage、残存・処置済み・不明の個別観測。 |

<a id="host-orphan-legacy-non-use-decision"></a>

## 旧形式の非使用を確認する方式 — 2026-10-02時点の未採用案

この節は2026-10-02時点の検討履歴である。第一単位の候補判定は完了したが、旧形式の三領域を使う処理がすべて終了したという根拠はなかった。Windows再起動方式は未採用であり、実再起動または削除も承認されていない。現在の方針は後述の「Coordinator所有範囲で閉じる再設計」を参照する。

| 方式 | 現在の評価 | 利用者への影響・限界 |
|---|---|---|
| 起動中の観測だけで非使用を確認する | 既知Process一覧、空領域と現在Lockだけでは、初期化途中や旧consumerの利用を除外できない。現状では採用できない。 | Windows再起動は不要だが、根拠不足のまま削除を許可できない。 |
| 検証したWindows再起動の境界と、旧領域の再利用防止を組み合わせる | 当時の設計候補。採用には再起動前後の同じmachine・実際の起動世代・対象との順序と、旧領域の再利用防止が必要だった。 | 作業中の他Applicationも中断する運用が必要になり得る。再起動したという申告や時刻差だけでは不足し、再利用防止・freshな対象照合・限定OS処置・不存在確認も別に閉じる。 |

当時は後者の検討を推奨したが、**Windowsを再起動すれば清掃可能になると実証したわけではなかった**。2026-10-03の人間との認識合わせで、この推奨は早計と整理した。Coordinator範囲内の終了・排他で必要保証を閉じられるかを先に調べ、Windows再起動を前提にしない。方式の変更だけから旧三領域の回収や新しい実Taskの再開を許可しない。

実再起動と実在三件の削除は、方式の設計採用後も別の判断単位である。対象、影響する作業、実行時点、保持・回復条件を提示した承認なしには実行しない。Native試験自身の一時領域清掃は[別の調査記録](261002_native-test-cleanup-preflight.md)で扱い、その進行を旧形式の非使用根拠へ転用しない。

この節は基準Commit `bc7511c7e583c9e1e329a5b7c3f12e9383e508e6`からの判断状態の記録更新である。Architecture契約、Policy、Source、試験、署名候補、旧実行結果および品質件数は変更しない。文書・判断境界・品質への直接影響を同じ固定差分で独立確認し、本更新に実OS試験、全回帰、再署名、準拠監査またはRelease判断を要求しない。未採用の方式を実装済みと表示せず、第一単位の旧Passを本節へ流用しない。

## 所有者と伝播

| 所有者／利用側 | 現在の対応 | 残る接続 |
|---|---|---|
| Architecture | 詳細設計§11に候補・停止条件を追加。診断断面をARCH-000008へ接続。 | 実処置契約は診断Authorityへ混ぜず、SPEC／Architectureの処置責務へ伝播する。 |
| 内部Policy | `host-orphan-recovery-policy.ts`。閉じた入力を照合し、外部Effect・永続化・Authority発行なし。 | 信頼された実観測実装。確認値自体は根拠の実在性を証明しない。 |
| Quality | QA-000003／PRL-UT-006に純粋判定、QA-000006に実境界・再入場・不存在・利用者判断を接続。 | IT／ST／UAT未観測。既存件数を増やさない。 |
| Workflow／CLI | 既存exact IDの回復入口を変更しない。 | 対象提示・fresh承認・実処置が成立後に正式入口へ接続する。未完成cleanをHelpへ載せない。 |
| Native／配布 | 現在変更なし。旧署名候補を維持。 | Native追加時はPlatform Access設計・protocol・署名閉包まで再確認する。 |
| Project Context／Quality Center | 追加方針の承認済みを投影。全体停止・未完成を保持。 | 実観測の進行時だけ現在値を更新する。 |

## 第一単位の検証

Formatter、型、Lintを局所試験の前に実施する。局所UTは十一条件の不成立／unknown／欠落、不正構造、未知クラス、Accessor／Proxy拒否、肯定例でも非Authorityであることを確認する。

現在結果:

| 確認 | 結果 | 主張の範囲 |
|---|---|---|
| Formatter／Lint | 対象二つのTypeScript fileを確認し、エラーなし。 | 新しいPolicyと試験だけ。 |
| 型 | Coordinatorのstrict／tests二構成がPass。 | 型整合。実OS保証ではない。 |
| 局所UT | 新規三件と隣接する既存三件、計6／6 Pass。新Policyの行100%、分岐94.74%、関数100%。 | 条件照合・Host遷移の局所根拠。実Root清掃・公開Recoveryではない。 |
| Capability Graph／二つのTraceability検査 | accepted。 | 既存検査が扱う母集団との整合。新しい実処置は検査対象に追加していない。 |
| Repository Checker | 1 Error／0 Warning。既知の`stable-release-tag-identity-mismatch`のみ。 | v0.21公開tagとv0.22作業HEADの差。今回の局所修正から公開tagを変更しない。Checker全体Passとは表示しない。 |
| `git diff --check` | Pass。 | 差分の空白破損なし。 |
| 独立レビュー・監査 | 初回の実行再識別不足HOP-Q01を是正し、新固定版に対する技術・文書・品質／影響の三つの限定再確認がPass、新規Finding 0。HOP-Q01はResolved。 | 第一単位の確認だけ。未接続の実Recoveryは合格対象外であり、全体の停止・未観測件数は不変。 |

Provider、Docker、実在Host Rootの操作は行っていない。

### 第一単位の実行再識別情報

HOP-Q01への是正として、旧実行へ現在Hashを遡及適用せず、安全な同一確認を新たに実行した。以下を正式な局所根拠とする。実行前後で十八の対象file、五つの検証器file、Node実行物、HEAD／Tree、Index差分、Worktree差分と未追跡集合が一致した。この追記後の文書Hashを、実行時の文書Hashと取り違えない。

| 再識別項目 | 記録 |
|---|---|
| Repository／Git | `qual-lab.crdd-standard`、Object Format `sha1`、HEAD `a14b0d6461d3dfb295dd4dca954a9ee83015ffcf`、Root Tree `b445e4e10bb50de84ba4ce12a620976db7f70fae`。Index差分なし。Worktree七fileと未追跡三fileを完全記録の前後snapshotへ保持した。 |
| 実行観測区間 | UTC `2026-10-02T05:53:45.1901891Z`〜`2026-10-02T05:55:42.2473947Z`。各commandの開始・完了観測時点も完全記録へ保持した。 |
| 環境・検証器 | Windows、Node `v24.19.0`、TypeScript `7.0.2`、Biome `2.5.6`。Node binary、TypeScript wrapper／Native compiler、Biome wrapper／Native binaryのSHA-256を前後取得した。`NODE_OPTIONS`／`NODE_PATH`なし。依存設定はpackage／lockfileのHashで識別する。 |
| 固定対象 | 監査十file、隣接UT二fileと対象Source二file、tests設定、package／lockfile、Biome設定の十八file。全件regular fileを確認し、PathごとのSHA-256を前後snapshotへ保持した。Tracked対象の差分も完全記録へ保存した。 |
| 新Policy／試験 | Policy `312dce589ed96f7634d278b27f9681fd1579882d9887f849345fec3718935f52`、新UT `6bf96f17d6d157952a1125047e34180f4cdeb4a5b26a7264c954d17a5764a946`。前後一致。 |
| 結果保存先 | Repository-local `.crdd/verification/chg-000082-host-orphan-policy-261002/run.json`。全command、cwd、前後snapshot、終了code、完全なTool結合出力、差分、未証明範囲を保持。SHA-256 `3ff2d6933cd0979ea0cface0db4d0473b399d4508b1f5ed15c30b60a79cb7eab`。JSONはUTF-8であり、出力はToolが返したUnicode結合文字列として保存し、分離した生stdout／stderr bytesとは主張しない。 |
| 保持・無効化 | 原記録はPhase 5の結論固定まで保持し、廃棄前に必要な非秘密根拠を正式Evidenceへ移す。未取得範囲を補完しない。原記録を失った場合は再実行するまでこの局所結果を再識別可能な根拠として用いない。Source、試験または検証器の入力が変わった場合も再実行する。 |

Formatter・型・Lintを先に実行し、その後UTを実行した。下表のcwdはRepository相対で示す。実際の絶対cwdと全出力は完全記録にある。

| 順 | cwd | command | Exit／結果 |
|---|---|---|---|
| 1 | `40_Develop/coordinator` | `./node_modules/.bin/biome.cmd format src/security/host-orphan-recovery-policy.ts tests/unit/host-orphan-recovery-policy.contract.test.ts tsconfig.strict.json` | 0、書換えなし。 |
| 2 | `40_Develop/coordinator` | `npm run typecheck` | 0、strict／tests二構成。 |
| 3 | `40_Develop/coordinator` | `./node_modules/.bin/biome.cmd lint src/security/host-orphan-recovery-policy.ts tests/unit/host-orphan-recovery-policy.contract.test.ts tsconfig.strict.json --error-on-warnings` | 0。 |
| 4 | `40_Develop/coordinator` | `node --test --experimental-test-coverage --test-coverage-include=src/security/host-orphan-recovery-policy.ts ./tests/unit/host-orphan-recovery-policy.contract.test.ts ./tests/unit/host-generation-loss-transition.contract.test.ts ./tests/unit/docker-host-transition-state.contract.test.ts` | 0、6／6 Pass、0 Skip、0 Fail、184.153ms。新Policyの行100%、分岐94.74%、関数100%。 |
| 5 | `40_Develop/coordinator` | `npm run runtime-capability-graph:check` | 0、accepted。 |
| 6 | `40_Develop/coordinator` | `npm run runtime-traceability:check` | 0、accepted。 |
| 7 | `40_Develop/coordinator` | `npm run project-runtime-design-traceability:check` | 0、accepted。 |
| 8 | Repository Root | `node template/tools/crdd-check.ts` | 1、既知のtag／HEAD不一致一件、Warning 0。全体Passではない。 |

実際のHost非使用、清掃、Native Recovery、公開RecoveryとProvider E2Eは、この新結果でも未観測である。ログはEvidenceであり、処置Authorityまたは実在三件の削除許可を発行しない。

### 限定再確認の完了記録

三確認者は同じ固定十fileを読取り専用で確認した。対象EvidenceのSHA-256は`d7729fca5f837159972635a328873625652534213621c2a6be85e4645c18abb3`、機械記録は上記の`3ff2d6933cd0979ea0cface0db4d0473b399d4508b1f5ed15c30b60a79cb7eab`である。他九fileは初回確認時のHashと一致した。実行記録の前後一致、旧結果へのHash遡及がないこと、および実Recovery未完成・新実Task停止の維持を独立確認した。

この節と結果行・Checklistは全確認完了後の結果書戻しであり、確認対象または実行時のHashを変更して表現しない。確認者は結果だけの書戻しを整合済みとし、実試験・実Root処置の再実行は行っていない。Source、Quality義務、許可範囲、機械記録および他のOPENは変更しない。

### 方式判断記録と現在投影の限定確認

作成担当と別の確認者が、基準Commit `bc7511c7e583c9e1e329a5b7c3f12e9383e508e6`からの二文書差分を固定し、技術・判断境界、文書・追跡、品質・直接影響の三観点を全て完了した。全観点は限定Pass、Finding 0で、開始・終了Hashは一致した。対象は結果書戻し前の本記録SHA-256 `8be41605ff628400193161251e542e851353cb0baeee80d95fb30c59b39ca6e0`と、`PROJECT_CONTEXT.md`の`2b61b05278024b96de776d45dba4d3474607bc04cae2f0b2087a99a4970fd895`である。

確認範囲は、承認済みの追加範囲、第一単位完了、方式判断待ち、実再起動・実削除の別承認、および停止の表示整合である。方式の実証、OS保証、Source、清掃、E2EまたはReleaseは対象外。旧十文書のPass・実行結果・Hashへ流用しない。三結果の統合後、この節とChecklist一行だけを結果として書き戻した。結果だけの書戻しは確認者と整合済みで、現在投影、承認状態、Source、署名候補と品質件数は変更していない。

## Coordinator所有範囲で閉じる再設計 — 2026-10-03

### 結論と許可範囲

人間は、Windows全体の再起動を前提にせず、Coordinatorが所有する処理の終了確認・新規利用抑止・排他・限定清掃で閉じる方向の調査と是正を承認した。実在三件の削除、全Coordinator停止の実行、Provider再送、Docker再起動またはReleaseの承認ではない。現在は方式の採否待ちではなく、この承認範囲内での設計確認中である。

観測された三件はCoordinatorの管理記録に対応する作業領域であり、出所不明の任意フォルダとは区別する。ただし、今回Taskとのexact結合と非使用は未確定である。最新一件の六childが空だった観測を他二件へ一般化しない。Docker資源が空でも、Windows側のRoot・記録・Node／Supervisor等の終了は別に確認する。

### 着手前確認と適用先

基準Commitは`4407e53a6e4f63f1f432e71ec43662707c2bb8cd`。親は実装の取得・利用・通常回収経路、Architecture§11、QA-000003／006、CHGおよび現在投影を照合した。読取り専用の専門確認は、下表六文書の第一編集単位に条件付き着手可を返した。初回編集ではSource、Native、公開入口または実在Rootを変更せず、以下を予定義務と現在の未成立範囲として記録する。技術独立レビュー、文書監査、品質・直接影響の確認を同じ固定差分で行う。実処置がないため、実OS試験、全回帰、再署名、Provider E2Eおよび準拠監査はこの文書単位では行わない。

| 編集 | 適用先 | 処置 |
|---|---|---|
| 1 | 本記録の旧方式節と本節 | 未採用Windows案の履歴を保持し、現在の人間選択と実操作の別承認を記録する。 |
| 2 | `Coordinator`詳細設計§11 | 所有処理、利用抑止、連続排他、旧形式の別根拠を予定契約へ接続する。 |
| 3 | `QA-000006`のHost限定回復節 | 同じ所有境界の反証と清掃後観測を既存Local Itemへ対応付ける。 |
| 4 | `CHG-000082`の範囲追加行 | 再設計方針と現在のOPENを保持する。 |
| 5 | `PROJECT_CONTEXT.md`の判断欄 | 現在の方式採否待ちを除き、調査・是正進行中と投影する。 |
| 6 | `Quality Center`の現在判断行 | 同じ選択を投影し、停止・未観測・件数は変更しない。 |

Source読取りでは、`createOwnedOperationDirectories`のmarker／Root／六child作成後にGeneration登録が行われ、Supervisor Lockの取得は後段の別呼出しだった。受動Doctorは同じ作成処理と同期清掃を使用し、同じSupervisor Lockの取得を通らない。通常のexact ID回復は別のRecovery generationを取得する。したがって、新しいLockを一箇所へ追加するだけでは全利用側や旧形式へ保証を適用できない。

次のSource候補では、作成、診断、通常Task、通常回収、署名検証Scriptおよび限定保守を利用側母集団として再照合する。同期から非同期への取得変更が必要なら、待機後の取消、取得失敗、途中失敗の保持と全利用側の終了後条件を接続してから編集する。具体的なOS方式、旧形式の閉包と全利用側移行はOPENであり、文字列によるProcess検索、既知Process件数0、名前や空Directoryだけから清掃可能と判定しない。詳細契約はArchitecture、観測と反証はQAが所有する。

今回の六文書の完成後独立確認は未実施。過去の限定Pass、Source／署名候補、検証結果、品質件数および新実Task停止は変更しない。

### 本再設計単位の限定独立確認

作成担当と別の確認者が、基準HEAD `4407e53a6e4f63f1f432e71ec43662707c2bb8cd`からの同じ六文書を固定し、技術独立レビュー、文書監査、品質・直接影響確認を全て完了した。三観点とも限定Pass、Finding 0、確信度は高であり、HEADと下表のHashは開始・終了で一致した。前節の「完成後独立確認は未実施」は、この結果追記前の状態を指す。

| 確認対象 | 結果書戻し前SHA-256 |
|---|---|
| `06_Architecture/Details/coordinator/01_Architecture.md` | `fa0ade80399c9149a3454643d6e1593fe6d95d76239e53a27bcf24986cda7ae6` |
| `07_Quality/01_Quality_Center.md` | `428fe14f71bf235dc0e24608106c072c503e23de0c874a0be9bfc2b9543a5f8c` |
| `07_Quality/Definitions/QA-000006/quality_definition.md` | `8951bb7f0298d5dd75293453020bcbf7118c3e91245de81c754c52f020997d88` |
| `99_Roadmap/Changes/CHG-000082/Evidence/261002_host-orphan-recovery-design.md` | `69039104da788408360ab1897fa6d694bf2601a44dd27a036432943fd32002bb` |
| `99_Roadmap/Changes/CHG-000082/change.md` | `351bf8ed4fdf7ea8e677cf8c9a8bf3429316f051f3d2e420735ea0f7a83803d1` |
| `PROJECT_CONTEXT.md` | `7660a24e21e3bedbe369c22c30524e5fdf6b81d8b47c965cbd9c4f9df608d488` |

確認者は、作成前排他、診断・通常回収・検証Scriptを含む利用側、旧形式への保証非遡及、所有Process実終了とDocker空観測の区別、所有外巻込み禁止、部分処置後の再入場を確認した。Source、Native、実Process、Root、DockerまたはProviderは操作していない。具体的OS保証、旧利用側の閉包、全利用側移行、実処置・公開入口・清掃後条件は未成立である。このPassは方針・予定条件とその伝播だけに適用し、Source採用、実Recovery、全体品質またはReleaseへ流用しない。

親の別診断では、`node ./40_Develop/checker/bin/crdd-check.ts --root . --json --summary`を実行した。`executed_at: 2026-10-03T02:04:33.563Z`、33181ms、Markdown 1164件、Link 18365件、Anchor 2259件で、終了コード1、Error 1／Warning 0だった。指摘は既知の`stable-release-tag-identity-mismatch`一件だけで、今回差分由来の新規指摘はなかった。Checker全体Passとは扱わない。原記録はRepository-local `.crdd/verification/chg-000082-coordinator-local-recovery-261003/checker-summary.json`、SHA-256 `63663aafcb81c67f71977261f693199100f798f63128524d75490802bf0e7e0f`である。

全三結果を統合し、確認者と整合した後、本節と今回のChecklist一行だけを結果として書き戻した。旧限定Pass・旧Hash・他五文書・Source・署名候補・品質件数・実操作の別承認・新実Task停止は変更しない。上表の確認時Hashを追記後Hashへ置き換えない。


## Checklist

- [x] 同じCHGのIntent、限定対象、対象外と人間承認を記録した。
- [x] 元の回復Authorityと新しい保守候補を区別した。
- [x] 空領域・Lockだけでは非使用を証明できない反証を残した。
- [x] 各Ownerと後段の伝播対象を特定した。
- [x] 局所判定の合格を実Recovery・清掃成立へ昇格させない。
- [x] 静的確認・局所UTの結果と、Checkerの既知不一致を分けて記録した。
- [x] 固定差分の技術・文書・品質／影響の限定再確認を完了し、HOP-Q01の解消と第一単位限定Passを記録した。
- [x] 当時の第一単位の完了と旧形式の非使用方式の判断待ちを分けた記録を保持した。現在の方針は2026-10-03の再設計節へ接続し、方式採用・実停止・実削除を同じ許可にしていない。
- [x] 方式判断記録と現在投影の二文書を同じ固定版で三観点から独立確認した。未実証の方式をOS保証・実清掃・全E2E成立へ昇格していない。
- [x] 2026-10-03の人間選択を記録した。Coordinator所有範囲で調査・是正し、Windows再起動を前提にしない。方式の選択を実停止・削除許可へ読み替えない。
- [x] 今回の六文書の固定差分を技術・文書・品質／直接影響の三観点から独立確認し、限定Pass・Finding 0を記録した。旧限定Passを流用せず、実装・清掃・全体品質は未成立と分けた。
- [ ] OPEN: 旧形式の非使用、初期化排他、OS処置境界、保護済み再入場、SPEC／Workflow・公開入口と実境界検証が未成立。根拠取得後に同じCHGで接続する。
- [ ] OPEN: 実在三件のexact処置承認と清掃未実施。必要保証成立後に対象を提示し、別に承認を得る。
