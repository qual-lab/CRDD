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


## 取得待機後の失効競合の局所是正 — 2026-10-03

### 対象と着手前確認

基準Commitは`feb4ac712ddf49479f3c7df2f60eba6ea5da5e5c`。最初に作成前排他の接続を計画したが、初期化writer内の清掃、同期Doctor／検証Script、およびreadiness失敗後の排他なし清掃を確認したため、接続前に計画を修正した。この母集団を未処置のまま非同期作成へ切り替えない。第一Source単位は、既存の`activateOwnedHostOperationGenerationLock`における取得await後の失効再検証へ限定した。

親と読取り専用確認者は、Coordinator詳細設計、既存取得・readiness・通常清掃、Task／助言利用側、Coding Standards、PRL-UT-006の既存義務を照合した。確認者は、Hashを参照でなく値として捕捉すること、fresh再検証と公開の間にawaitを置かないこと、後着Lockだけを一回回収すること、回収不明時のprocess停止、元の取得分類保持を条件に着手可とした。Source・試験・QAの対応と本記録を同じ固定差分で技術独立レビュー、文書・品質／直接影響確認へ渡す。公開契約・準拠基準・リリース判断を変更しないため準拠監査は行わない。実Process／Root／Docker／Provider操作はこの単位で行わず、実OS排他・署名E2E・全回帰の成立を主張しない。

| 処置対象 | 今回の処置 |
|---|---|
| 取得前の所有者・Identity・世代・Hash | 同じ可変世代参照だけでなくHash値を捕捉する。 |
| 取得後の公開 | Capability・世代・耐久記録をfreshに読み、参照・Hashが一致し、未失効かつLock未設定の場合だけ公開する。 |
| 待機中の失効・置換・記録変更・別Lock設定・観測不能 | 新取得Lockを旧世代へ代入せず、そのLockだけを一回解放して終端を待つ。 |
| Lockを伴う取得回収不明 | 同じ現在世代へだけ保持する。不一致では新Lockを回収し、元の不明分類とprocess停止を維持する。 |
| 取得例外・解放throw・不明 | 正常・非取得へ丸めず停止対象にする。Root清掃成立とは分ける。 |
| 正常Task・助言 | 同じ既存有効化関数へ接続済み。readiness・loss監視・通常清掃・結果Schemaは変更しない。 |
| Doctor・検証Script・同期負例seam | 今回変更しない。作成前排他への全利用側移行はOPEN。 |
| 旧三Root・署名候補・実操作許可 | 不変。新Sourceの局所合格を旧Rootの非使用または処置許可にしない。 |

### 実装と自己確認

`execution-environment.ts`の本番有効化関数から、同じ取得settlementへfresh再検証を渡した。試験入口は同じsettlementを使う非Authorityの依存差替えであり、公開`index.ts`へ追加していない。局所fixtureの六つの差分は、失効、binding置換、Identity置換、世代置換、記録Hash変更、別Lock設定を個別に与える。既存Lockへの解放0と、後着Lock一回の解放を観測する。これは実Root・実Supervisorの観測ではない。

同じSource改訂版で、Formatter確認、production／test型検査、Warningを失敗とするLintを順に実行し、全て終了コード0だった。続くRuntime Capability Graph、旧Coordinator Traceability、旧Project Runtime Design Traceabilityの静的確認も終了コード0だった。旧JSONのacceptedを廃止判断またはReality Audit成立へ流用しない。その後、`host-operation-lock-activation.contract.test.ts`と既存`host-generation-loss-transition.contract.test.ts`だけを実行し、19件Pass、Fail／Cancel／Skip／Todo 0、終了コード0だった。新規親試験一件と17子試験、既存試験一件を含む件数である。全Coordinator回帰、実OS排他、作成前排他、Root清掃、独立レビューまたはv0.22完成を意味しない。

完成後の独立確認は未実施。既存の清掃側Gap、初期化writerの保持処置、全利用側移行、旧形式の非使用、実処置Authority、公開入口と通信断の原因層は未成立で、新実Task停止を維持する。

### 初回三観点の指摘と統合是正

初回の固定四fileに対する技術独立レビュー、文書監査、品質／直接影響確認は全て完了し、Findingは5件だった。初回候補は限定Passではない。基準HEADは`feb4ac712ddf49479f3c7df2f60eba6ea5da5e5c`。Source `c14bc7b0516dbef9254cd55df53b01682133d5afe3cb43f4a00ecd4269b2f97e`、新試験 `5b99610f4f4e518a19f21e31a644d0569fc73acd041029adc7c6d5607fe756ba`、QA定義 `a2dde68560cfd57a599a9b624fad7d960c6933c5693daf8a49f3ead9fa2854a2`、本記録 `9e666336a27ac5dedcf1f93af14a4cc8ea8641c58257477681e1c6ce1f162dfd`の開始・終了Hashは一致した。直前の19件は、この初回候補の当時の自己確認要約であり、以下の是正後候補へ遡及適用しない。

全三結果の統合後、同じ確認者へ期待処置、適用先、反証と変更禁止範囲を提示し、実施可を確認してから是正した。

| 編集単位 | 指摘 | 原因と今回の処置 |
|---|---|---|
| 取得不明の失効処理 | HLA-T01 | 今回導入した回帰。Lockなし回収不明で既存の失効処置を落としていた。取得例外も同じ不明経路へ収束し、freshに同じ現在世代と確認できた場合だけretire／Context Capability取消へ接続する。不一致・観測不能は旧世代変更0、既存Lock操作0、process停止を維持する。 |
| 試験の責務記録 | HLA-D01 | 既存規約の適用漏れ。全Case宣言箇所と返却七Helperに固定8項Headerを付け、fixtureの終端条件を実際に保留した取得・解放Promiseへ限定した。未使用通知PromiseのstubはI/O／handleを持たない。 |
| 試験の識別子 | HLA-D02 | 既存命名規約の適用漏れ。Booleanと関数の識別子を責務に沿う表現へ変更し、machine statusとOracleは保持した。 |
| 実在試験の登録 | HLA-Q01 | 固定候補前の利用側照合漏れ。Catalogへ`coordinator:unit:host-operation-lock-activation`、Symbolへ同Pathのtest-suiteを追加し、QA-000003／PRL-UT-006／本番execution-environmentへ接続した。Local Item新設や品質件数の変更はしない。 |
| 新しい検証記録 | HLA-Q02 | 監査へ渡した再識別根拠の不足。是正後のactual commands、cwd、時点、終了code、Tool結合出力、入力と検証器の前後Identityを用途限定repo-local記録へ保存した。旧19件の原記録を捏造しない。 |

Lockなしunknownと取得例外それぞれへ、現在、失効、binding／Identity／世代置換、Hash変更、別Lock設定、観測不能の八条件を与えた。後着Lockの解放が確認付き失敗となる条件も追加し、元分類を維持する。今回の指摘は既存規則の適用・母集団照合不足であり、新しいRuleや管理IDを増やさない。既存の全数登録検査と同じsettlementの反証試験へ接続した。

### 是正後候補の自己確認記録

新結果は、UTC `2026-10-03T02:36:02.493Z`〜`2026-10-03T02:38:05.735Z`の実行である。Node `v24.19.0`、Windows x64を使用し、`NODE_OPTIONS`／`NODE_PATH`／`BIOME_BINARY`は未設定だった。Node、npm入口、TypeScript wrapper／実JS／解決helper／選択Native、Biome wrapper／選択NativeのSHA-256を前後記録した。2058件のGit管理対象と非ignore未追跡regular fileのPath／Hash集合の集約SHA-256は、前後とも`ca6f142766a695741dc584389309cf084fa2e31eadf5f76de6658df6d590b46a`だった。HEAD／Tree、対象六file、検証器、Index／Worktree差分、未追跡集合も一致した。本節は結果記録後の追記であり、追記後の文書Hashを実行時の文書Hashへ置き換えない。

原記録はRepository-local `.crdd/verification/chg-000082-host-lock-activation-261003-r3/run.json`、SHA-256 `a18eb1dd77e8c507322b1dca84239b3ff7bcbc2714254d3c7d04541e1170ebe9`。Toolが返したUnicode結合出力を保持し、分離した生stdout／stderr bytesとは主張しない。途中の型失敗では試験を開始せず、Source是正後にFormatterから再開した。途中記録は同用途の`261003-r2/run.json`へ分離して保持する。Phase 5結論固定まで保存し、廃棄前に必要な非秘密根拠を正式Evidenceへ移す。記録消失または入力変更では、再実行まで再識別可能な根拠として使用しない。

| 順 | cwd | actual command／処理 | 結果 |
|---|---|---|---|
| 1 | `40_Develop/coordinator` | `npm run format:check` | Exit 0、689 file、書換えなし。 |
| 2 | 同上 | `npm run typecheck` | Exit 0、production／test二構成。 |
| 3 | 同上 | `npm run lint` | Exit 0、690 file、Warningを失敗とする。 |
| 4–6 | 同上 | `npm run runtime-capability-graph:check`、`npm run runtime-traceability:check`、`npm run project-runtime-design-traceability:check` | 全てExit 0、accepted。旧JSONの廃止やReality Audit成立ではない。 |
| 7 | 同上 | `node --test ./tests/unit/host-operation-lock-activation.contract.test.ts ./tests/unit/host-generation-loss-transition.contract.test.ts` | Exit 0、35／35 Pass、Fail／Cancel／Skip／Todo 0、229.634ms。新親一件・33子・隣接一件。 |
| 8 | Repository Root | 既存`inspectTestCatalog`／`discoverRepositoryTestFiles`と`realitySymbolGraphRule`を読取り専用で実行。exact invocationは原記録。 | Exit 0、実在試験267件、Catalog／GraphのFinding 0、新試験PathとQA／Local Item／実装Relationを確認。 |
| 9 | 同上 | `node ./40_Develop/checker/bin/crdd-check.ts --root . --json --summary` | Exit 1、Error 1／Warning 0。既知の`stable-release-tag-identity-mismatch`のみ。1164 MD／18365 Link／2259 Anchor、38014ms。全体Passではない。 |

新試験は非Authorityの局所依存だけを使用する。実Host Root、実Supervisor、Docker、Providerまたは既存三件への操作は行っていない。自己確認結果はApplied／Self-checkedであり、5指摘のResolvedまたは再レビューPassはまだ主張しない。次の同じ固定六fileの三観点再確認で解消を判定する。既存清掃Gap、全利用側移行、旧形式の非使用、通信断、署名候補、新実Task停止は不変である。

### 再確認後の検証器結合補強

固定六fileの技術独立レビューと文書監査はPassだった。品質／直接影響確認ではHLA-Q01を解消し、HLA-Q02だけを未解消とした。原因はnpmが起動する`tsc.cmd`／`biome.cmd`のHashと、shimから選択されるNodeの根拠がr3に含まれていなかったことだった。35件の実行結果を否定する指摘ではない。全三結果を統合し、同じ確認者へ是正計画を提示して実施可を確認した。

Production、試験Oracleおよび他五fileは変更せず、新記録r4を作成した。UTC `2026-10-03T02:46:07.865Z`〜`2026-10-03T02:47:32.271Z`。原記録はRepository-local `.crdd/verification/chg-000082-host-lock-activation-261003-r4/run.json`、SHA-256 `18b95d74d65692efd839ad24a4aed2ab97362723f926883e8f8af8fe83095863`。r3は不変で、遡及補正しない。保存・再実行条件はr3と同じである。

両shimのcmd／PowerShell／shell入口、npmのlifecycle PATH構成とcommand構成、COMSPEC、PATHから解決されるNode実体を前後記録した。shim直下の優先`node.exe`はlstatのENOENTで明示不存在だった。npm内の解決結果も前後一致し、既定cmdから両cmd shimを通り、`C:/Program Files/nodejs/node.exe`と記録済みJS／Nativeへ至る選択条件を保存した。これはOSのProcess image生成を実測した記録ではない。対象六file・検証器・2058件の入力集約・Index／Worktree差分は実行前後で一致した。本節追記後の文書Hashは実行時Hashと分ける。

前節の同じ九処理を同じ順序で再実行した。Formatter→型→Lint、三静的Contract、Catalog／GraphはExit 0。局所試験は35／35、Fail／Cancel／Skip／Todo 0、184.3109msだった。CheckerはExit 1、既知tag不一致一件のみ、Warning 0、1164 MD／18365 Link／2259 Anchor、30139msだった。全体Passではない。HLA-Q02は自己確認済みであり、同じ六fileの最終三観点確認が完了するまでResolvedとは扱わない。実OS保証、全利用側移行、旧三Rootの非使用・処置、新実Task停止は不変である。

### 取得待機後の局所是正の最終限定確認

作成担当と別の確認者が、同じ六fileの技術独立レビュー、文書監査、品質／直接影響確認をすべて完了した。三観点は限定Pass、未解決Finding 0。HLA-T01／D01／D02／Q01／Q02をResolvedとした。基準HEADは開始・終了とも`feb4ac712ddf49479f3c7df2f60eba6ea5da5e5c`、確認対象のHashも開始・終了で一致した。

| 確認対象 | SHA-256 |
|---|---|
| `execution-environment.ts` | `d579618054a9636935bd4e9afc4ca01d3f96f92725d0a3a4b7249c31dc8301b6` |
| `host-operation-lock-activation.contract.test.ts` | `a33af296fb509e83d7ee95b4f7c4ae475bc4dddaf5991a9d30c03c4e7c70bc49` |
| `QA-000003/quality_definition.md` | `e12a2407b3d4ebcaaf2c1ac014aa79b1f73c0022e679e0cdabf00628434ff7d7` |
| `test-catalog.json` | `3335ebef591f26d626c3cd9a9bcbc49999a0c70ded2097e02e1715d97c915f15` |
| Coordinator `symbol.json` | `2e4a744c25bb3adc364f4cec413e3b98607bacb13c3c63799d7f5e159023c42f` |
| 本記録の結果書戻し前 | `3964c0408e08cda46390b4a1a7becd5fa6c29f58dca29ee5cb6806ebc8c92ace` |

r4原記録と旧r3は不変だった。起動shimまでの再識別、35件の局所結果、Catalog／Symbol対応、未知取得の現在世代だけの失効、後着Lock一回の解放と実終端待機を確認した。Checkerの既知tag不一致一件は別診断のまま保持する。

本節とChecklist一行だけを全結果統合後に書き戻した。確認者はこの結果書戻しを整合済みとした。他五file、旧Hash、旧結果、品質件数、許可範囲および新実Task停止は変更しない。作成前排他、全利用側移行、readiness／cleanup、旧三Rootの非使用、実OS保証、実Recovery、署名適用および全体品質は引き続きOPENである。

### 作成前排他へ向けた共有管理資源の是正

基準Commit `276f993e660a1ab2c041538b665953a9dfe100b5`のcleanな状態から、全利用側移行の前提となる共有回復記録Directoryの所有を確認した。親と読取り専用確認者は、`ensureHostRecoveryDirectory`内の失敗時rmdirが他Taskの使用と競合し得ることを照合した。Operation失敗時に共有Directoryを削除しない方針は、同じCHGで承認済みの限定Recoveryを成立させる前提是正として着手可だった。新しいphase、管理ID、公開Capabilityまたは実操作許可は追加しない。

契約の正本は[Coordinator詳細設計§11](../../../../06_Architecture/Details/coordinator/01_Architecture.md#元の回復参照を確定できないhost残存の保守候補)。共有DirectoryをOperation一時Rootと分け、mkdir呼出しのEEXISTだけをfresh検証へ合流させる。観測・検証失敗を通常Errorのまま上位の清掃確認trueへ既定化せず、既存InitializationFailureの清掃未確認・回復IDなしとして搬送する。Tokenは生成しない。不明時はOperator確認待ちで、元Task再開や自動retryは追加しない。

| 編集対象 | 処置・変更しない範囲 |
|---|---|
| Architecture§11 | 共有管理資源のOwner、初期化状態、停止と再入場を明確化する。連続OS排他や旧形式非使用はOPEN。 |
| `execution-environment.ts` | 同じensure入口から、削除依存を持たない初期化settlementへ接続する。Root／markerの作成・通常清掃と既存Token契約は変更しない。 |
| 既存局所試験 | 同じ本番settlementへ非Authority依存を渡す。実Root・Process・Docker・Providerを操作しない。 |
| QA-000003／PRL-UT-006 | 共有Directory削除0、EEXIST後のfresh拒否、不明分類を追加する。Local Item・全体品質件数は増やさない。 |

変更は共有資源の所有・初期化失敗の実装接続であり、技術独立レビュー、文書監査、品質／直接影響確認を同じ固定差分へ行う。準拠基準・Release判断を変えないため準拠監査は追加しない。静的確認と局所UTの後に独立確認へ渡し、作成前排他・全利用側移行・実OS保証・旧三Rootの非使用・実削除・署名E2Eの完了とは分ける。現在は是正作業中で、検証・独立確認のPassはまだない。

### 共有管理資源是正の自己確認

UTC `2026-10-03T03:00:11.776Z`〜`2026-10-03T03:03:59.001Z`で、前節の候補を検証した。Node `v24.19.0`、Windows x64を使用した。対象七file（変更五fileと不変のCatalog／Symbol）、HEAD／Tree、検証器と起動shim、npm内のNode／tsc／Biome解決、Index／Worktree差分、未追跡集合は前後一致した。2058件の入力集合の集約SHA-256は`e4051b8abe771e2bff12781aa1fa1c0f5f2de38d2442d5edd79ca446873a229e`。本節は実行後の結果追記であり、追記後の文書Hashを実行時Hashへ置き換えない。

原記録はRepository-local `.crdd/verification/chg-000082-shared-host-namespace-261003/run.json`、SHA-256 `bc39eae05e5ce325a106f705512ae9fc0cb4cbf0a25fd91e038703875b0efd2c`。actual command、cwd、時点、終了code、Tool結合出力と前後Identityを保存した。分離した生stdout／stderr bytesとは主張しない。保存・消失時の再実行条件は本記録の先行r3／r4と同じである。

| 確認範囲 | 結果 |
|---|---|
| Formatter→型→Lint | 同じ順で実行し、全てExit 0。689 fileの整形確認、production／test型二構成、690 fileのWarningを失敗とするLint。 |
| 三静的Contract | Runtime Capability Graph、旧Coordinator Traceability、旧Project Runtime Design Traceabilityは全てExit 0。旧JSON廃止やReality Audit成立とは分ける。 |
| 既存二fileの局所UT | `host-operation-lock-activation.contract.test.ts`と`host-generation-loss-transition.contract.test.ts`を実行。49／49 Pass、Fail／Cancel／Skip／Todo 0、212.028ms、Exit 0。共有初期化の親一件と13子Caseを含む。 |
| Catalog／Symbol Graph | 既存の読取り専用確認はExit 0、Finding 0。実在267試験、同じ試験PathとQA／Local Item／実装Relationを保持。新ID・登録は不要。 |
| Repository Checker | Exit 1、Error 1／Warning 0。既知の`stable-release-tag-identity-mismatch`のみ。1164 MD／18366 Link／2260 Anchor、30980ms。全体Passではない。 |

共有初期化試験は同じsettlementへ局所依存を渡した観測であり、実Filesystemのreparse拒否、連続排他または旧三Rootの非使用を実証していない。追加の隣接試験候補を確認したが、実OS Root作成Caseを含むため今回の局所範囲へ無条件に追加しなかった。実Root、Process、Docker、Providerおよび既存三件への操作はない。現在は自己確認済みであり、独立三観点の結果が揃うまで限定Passとは扱わない。

### 共有管理資源是正の独立確認結果

作成担当とは別の確認者が、同じ固定五fileの技術独立レビュー、文書監査、品質／直接影響確認をすべて完了した。三観点は限定Pass、Finding 0。開始・終了のHEAD／追跡先は`276f993e660a1ab2c041538b665953a9dfe100b5`で一致し、対象Hashと原記録`bc39eae05e5ce325a106f705512ae9fc0cb4cbf0a25fd91e038703875b0efd2c`は不変だった。追加試験・実操作は行っていない。

| 固定確認対象 | SHA-256 |
|---|---|
| Coordinator詳細設計 | `714bfba49cccbaeb87e415af662eb9b2b38eae88dcbcdbf3e423b4c75ac0be59` |
| QA-000003定義 | `249df43c72f84203ccef5a2af6e4a92beee42364fd451c09f9bcda12e9decbc7` |
| `execution-environment.ts` | `1ee48385077300fb634fd6acf3ee0328b75b3bcfb76b683c651b52dbf8898fa1` |
| `host-operation-lock-activation.contract.test.ts` | `a9b6e1d900810c18c5a31c1c274ae161a51a2262638abf944bd5e88c6ffd34e1` |
| 本記録の結果書戻し前 | `aabdfc7fcf8c1fc753050d2bb2063ca859d1bf8e7d1e09ca88e868951c43fad3` |

確認した成立範囲は共有namespaceの所有と初期化settlementである。Source上の上位停止分類、非Authorityの49局所試験と同じ試験登録、検証器までの再識別を確認した。実OS reparse、作成前連続排他、全利用側移行、旧三Rootの非使用、実清掃、署名E2E、全PRL-UT-006または全体品質の成立は主張しない。結果書戻しは全三結果統合後、確認者が整合済みとした本節とChecklist一行だけに限定した。他四file、旧結果・Hash、実行入力EvidenceのHash、原記録、品質件数、Authorityおよび新実Task停止は不変である。

### 同一Processの排他候補 — 限定実測

基準Commit `af1239ac1c00f54c95d81913456b06dbce25d84c`のcleanな状態で、全利用側を編集する前に排他の所有者を確認した。別Supervisorだけが終了し、親の同期Filesystem処理が継続する反例があるため、取得前後の`assertLive`だけを連続保証にしない。親と読取り専用確認者は、**同じCoordinator Node Process内でpipeを所有する小さい候補を先に実測する**計画を整合した。addonの新設、全Filesystem処理のNative移管または保証低下の受容を既定にしない。

外部読取りは公開API名・版だけを使用した。[Node v24.19.0のIPC／close契約](https://nodejs.org/download/release/v24.19.0/docs/api/net.html)と[同じtagのWindows pipe実装](https://github.com/nodejs/node/blob/v24.19.0/deps/uv/src/win/pipe.c)を確認し、Repository情報、診断logおよび秘密値は送信していない。公開契約ではWindows pipeは所有Process終了時に閉じられ、Serverのcloseは接続終了を待つ。固定Sourceの初回bindは`FILE_FLAG_FIRST_PIPE_INSTANCE`を使う。これらの意味を、Directory差替え防止や旧Root非使用へ拡張しない。

実測は用途限定のRepository-local `.crdd/verification/chg-000082-host-inprocess-lease-261003/`で行った。本番Source・Factory・公開入口には接続していない。自己生成した検証専用pipe名を同じ試験のIPC入力だけに搬送し、最大二つの自己所有Node子Processを使用した。通常のCoordinator、Provider、Docker、実在三件のRootまたはmarkerには操作しない。全体28秒の終了上限と20秒の停止開始を設定し、不明なら成功・再試行を禁止する。所有子の終了要求と実際のexit／closeを分けて観測した。

| 限定場面 | 実際の観測 |
|---|---|
| 同一Processの同期処理中 | 親がpipeを保持して750ms同期処理している区間内に、別の所有子が同名bindを試み、`EADDRINUSE`で拒否された。子の実exit／closeを確認後、親closeと別子の再bindを確認した。 |
| 接続がある状態のclose | 接続が残る間はclose完了を主張せず、両socketの終了後にServer closeと別子の再bindを確認した。 |
| listening前の取消 | Ownerの取消flagを先に設定した。後着listeningを実際に観測してからOwnerがcloseし、別子の再bindを確認した。listenへのAbortSignalによる自動closeは使っていない。 |
| 自己所有Processの終了 | pipeを保持する検証用の子だけへ終了要求を発行した。実exit／close後に別子の再bindを確認した。通常Processは終了していない。 |

実行区間はUTC `2026-10-03T03:22:09.883Z`〜`2026-10-03T03:22:11.539Z`。Node `v24.19.0`、libuv `1.52.1`、Windows x64で、`node probe.ts`はExit 0だった。実行前にFormatter確認→strict型→Warningを失敗とするLintを実行し、全てExit 0だった。初回型確認の`ForkOptions`不整合では実測を開始せず、不要なoptionを除いて静的段階から再確認した。

実行前後のNode binary SHA-256は`3602f2bb1a10f2cbab4c36886218a33c1ab3db87290e73b033c46c77147d0237`、probe Sourceは`e7bd7b43c276c219f0bcf5fca5be90def29cda2f4b43772d090dfb2a751bad4c`で一致した。固定結果`result.json`のSHA-256は`d341ca1da71b5f5a6934d2e49a443f3f41c87036cebdfb570b10534f2584e2b0`。actual command、cwd、Tool結合出力とExitは同じDirectoryの`invocation.json`へ保持した。probe、型／整形設定、結果は同じ用途限定Rootに保持する。原記録消失時は再実測まで新しい根拠に使用せず、保存条件は本記録の先行局所結果と同じとする。生Error、pipe名および秘密値は結果へ保存していない。

終了時は自己所有子二つ以下の全close、Server close、socket closeおよび試験timerの解除を確認した。全OS handleの網羅確認、正式QA項目成立または実RecoveryのPassとはしない。結果は候補primitiveの限定観測であり、固定候補の完成後独立確認はまだ行っていない。

次の実装前に、同じleaseの作成前取得とgenerationへの一回移管、取消後の後着取得、Root／marker処置後の解放不明でも同じ参照を保持する終端記録、および全利用側の待機・Lock順序を契約へ接続する。現在の同期wrapperへPromiseを渡すだけでは移行しない。限定清掃のNative操作は六空childの非再帰処置として別に評価し、通常Filesystem処理全体のNative移管と混同しない。旧三Rootの非使用・旧利用側の閉包、差替えを防ぐOS処置境界、実停止・実削除の別承認、新実Task停止および全体品質のOPENは維持する。

### 同一Process排他候補の独立確認結果

同じ固定候補を、作成担当とは別の確認者が技術解釈、文書監査、品質／直接影響の三観点から確認した。三観点は限定Pass、Finding 0。開始・終了HEADは`af1239ac1c00f54c95d81913456b06dbce25d84c`、本記録の書戻し前SHA-256は`b49eca5ef581568474c217c10bf1e740847ae8807e2fc3277c13cee877537085`で一致した。probe、result、invocationの固定Hashと実出力は一致し、差分空白検査はExit 0だった。確認者は再実行、編集、実操作を行っていない。

確認範囲は四場面の観測・assertionと記録の一致、結果の再識別、本番完成へ昇格しない境界である。確認者は公開API／固定Sourceを新規取得していない。保存invocationは実測実行の記録であり、静的段階の検証器までを独立再識別したとは扱わない。全OS handle不存在、本番の連続排他・取消・解放、旧三Root非使用、実Recovery、署名E2Eおよび全体品質は未成立のまま保持する。

全三結果を統合後、確認者が整合済みとした本節とChecklist一行だけを書き戻した。原記録、旧結果とHash、本番Source、品質件数、Authorityおよび新実Task停止は不変である。

### 同一Process排他の内部lifecycle候補

基準Commit `c60b166aa1c6b35e2114517c794c0b675c324261`から、前節の実測を本番未接続の内部状態機械へ具体化する。親と読取り専用確認者は、既存security Ownerの最小単位と同じアルゴリズムへの局所試験だけを着手可とした。既存Supervisor、公開入口、OS Adapter、Root／marker処置、全利用側移行、署名済みRuntime、旧三Rootおよび新実Task停止は変更しない。

| 対象 | 今回の処置 |
|---|---|
| Coordinator詳細設計§11 | 同一Process候補の状態・通知・終端条件を定義する。非Authority終端記録を先に確定し、Root→marker→排他の順で閉じる案を次段の前提とする。保存・保護・exact結合・保持上限はOPEN。 |
| `host-operation-inprocess-lease-internal.ts` | 取得、取消、後着通知、個別socket、期限、二重解放と未確認結果を一つのOwnerで処置する。OSや削除操作には接続しない。 |
| 既存局所試験 | 同じ内部状態機械へ非Authority依存を渡す。実timer、pipe、Process、Root、DockerおよびProviderを生成・操作しない。 |
| QA-000003／PRL-UT-006 | 追加局所義務を既存Local Itemへ接続する。正式項目全体の成立や全体品質件数は変更しない。 |
| 型構成／Symbol | 未接続Sourceもproduction型確認へ含め、既存Test Symbolの実装Relationへ追加する。新試験Path・新ID・公開indexは作らない。 |

発火例はlisten発行後の取得・取消・解放、非発火例は開始前取消、境界例は登録中取消・後着取得・接続が残るclose、情報不足例は依存例外・期限・通知不整合である。取消だけを資源不存在へ変換せず、結果確定後も必要な後着通知のOwnerを保持する。`closed`はTransport通知上の終端であり、native endgame、対象の非使用、削除権限またはOperation全体の清掃成功ではない。

変更分類は内部非同期lifecycleの候補具体化である。Formatter→production／test型→Warningを失敗とするLint→三静的Contract→局所UT→Catalog／Symbol Graphの順で自己確認し、同じ固定差分へ技術、文書、品質／直接影響の独立三観点を適用する。準拠基準・Release判断を変更しないため準拠監査を追加しない。実境界、署名E2E、PT／LTおよび全回帰はこの未接続候補の成立根拠にしない。結果は後節へ実測値として書き戻す。現在は実装・自己確認中で、独立Passは未成立である。

現在投影の停止条件・許可・旧三Root状態は変わっていないため、PROJECT_CONTEXTを実装経過だけで更新しない。現在、人間による追加の方式判断は必要ない。実停止・実削除には従前どおりexact対象の別承認が必要である。

### 内部lifecycle候補の自己確認

Node `v24.19.0`、Windows x64で、同じ候補をFormatter→production／test型→Warningを失敗とするLint→三静的Contract→局所UT→Catalog／Symbol Graph→Repository Checkerの順に確認した。結果原記録はRepository-local `.crdd/verification/chg-000082-inprocess-lifecycle-261003/run-r2.json`、SHA-256 `821e318933418d954512a7d371cb63427ec015431c90a464c1c0dc75830ce5cb`に保持する。actual command、開始・終了時点、Tool結合出力、終了codeおよび対象八fileの前後Hashを保存した。ただしFormatter、二型確認、Lint、Catalog／Graphの五処理は実行cwdを明示保存していなかった。八fileは七変更対象と不変のCatalogであり、前後Hashは一致した。cwdの不足を補った記録として扱わず、下記の独立指摘と是正へ接続する。本節は実行後の結果追記であり、文書の実行時Hashを書き換えない。全入力集合・全検証器のbinaryを網羅再識別したとは主張しない。原記録消失時は再確認まで新しい成立根拠にせず、保存条件は前節の局所結果と同じとする。

| 確認 | 実結果と限界 |
|---|---|
| Formatter／型／Lint | Source・Testの363 file整形／Lint、production／test二型構成は全てExit 0。未接続Sourceもproduction型構成へ明示登録した。 |
| 三静的Contract | Runtime Capability Graphと旧二Traceabilityは全てExit 0。旧JSON廃止、Semantic Coverageまたは新しい実境界の成立とは分ける。 |
| 既存二fileの局所UT | 61／61 Pass、Fail／Cancel／Skip／Todo 0、270.6645ms、Exit 0。新候補の12親Caseを含む。親Case内の条件数を正式QA項目数へ加算しない。 |
| Catalog／Symbol Graph | Exit 0、Finding 0。実在267試験、同じTest Path／QA-000003／PRL-UT-006を保ち、新Source-file SymbolへのRelationを確認した。 |
| Repository Checker | Exit 1。既知の`stable-release-tag-identity-mismatch`一件だけ。全体Passではない。 |

最初の確認では可視Checklistの追加項目が固定集合と不一致だったため、Checkerを弱めず、Architectureの既定Checklistを維持した。今回の評価・未成立条件は本文と本変更記録へ残した。期限解除中の取消と購読解除中の再入も追加で反証し、最新Sourceで静的段階から確認し直した。初回原記録`run.json`は上書きせず、最終結果へ混ぜない。

試験は同じ内部状態機械の通知処置であり、実OS排他、native endgame、旧三Rootの非使用・清掃、正式PRL-UT-006全体または実Recoveryの成立ではない。新しいOS Adapter、実timer、pipe、子Process、Root、DockerおよびProvider操作はない。次段の耐久終端記録、共同終端条件と全利用側移行はOPENである。現在は自己確認済みであり、独立三観点の結果が揃うまで限定Passとは扱わない。

### 内部lifecycle候補の独立指摘と是正

基準HEAD `c60b166aa1c6b35e2114517c794c0b675c324261`、固定七file、書戻し前Evidence SHA-256 `e4c5e22f0d23829304a8569b3ba86f1ba3b60d517008715bbc736a64dfd4a61a`を技術、文書、品質／直接影響の三観点で確認した。全結果を統合した判定はFail、Finding三件であり、61局所試験の成功を限定Passへ昇格しない。対象と原記録は確認前後不変で、確認者は再実行・編集・実操作を行っていない。

| 指摘 | 原因・固定した是正と反証 |
|---|---|
| IL-T01 | 期限登録中の取消で再入登録し、解除責任を上書きして取消後listenを発行し得た。登録中flagを追加し、返却責任を保持する。listen直前に取消を再確認し、未開始なら期限・購読を解除する。登録中取消の一登録・一解除・listen0を試験する。 |
| IL-T02 | 公開結果のunknownと取得要求のsettlementを混同し、先行closeで購読を外し得た。取得pendingを別管理し、保留中にcloseを先行しない。先行終端通知は後着取得の根拠にせず、後着取得→一回close→対応終端まで購読を保持する。期限後とlisten例外後の後着を試験する。 |
| IL-Q01 | r2の五処理でcwdを保存していなかった。旧原記録は不変で保持し、全commandへ明示workdirを渡す新r3で確認し直す。r2の不足は本記録で訂正する。 |

編集前に全三件の統合方針を指摘元へ再提示し、三観点との整合と是正着手可を確認した。方針整合は完成後Passではない。Source／試験／Architecture／QA／Evidenceだけを指摘へ対応付け、既存Supervisor・Factory・利用側・OS Adapter・Root／marker・Authority・署名・旧原記録・品質件数・停止Gateは変更しない。是正後は新しい固定七fileと新原記録を、同じ三観点で再確認する。

### 是正候補r3の自己確認

UTC `2026-10-03T03:57:10.677Z`〜`2026-10-03T03:58:05.769Z`に、是正後の同じ候補を静的段階から再確認した。新原記録は `.crdd/verification/chg-000082-inprocess-lifecycle-261003/run-r3.json`、SHA-256 `966df18956d662f037f4869d8be141990b2420f9063cec39a8e93337d6bb9444`。snapshotを含む全commandへ明示workdirを渡し、実command、cwd、時点、終了code、Tool結合出力と同じ八fileの前後Hashを保存した。前後Hashは一致した。旧r2は変更せず、旧指摘・旧結果を最終結果へ混ぜない。本節は実行後追記であり、実行入力の文書Hashを更新しない。

Formatter、二型構成、Warningを失敗とするLint、三静的Contract、Catalog／Symbol Graphは全てExit 0。局所二fileは64／64 Pass、Fail／Cancel／Skip／Todo 0、266.8113ms、Exit 0だった。追加三CaseがIL-T01／IL-T02を反証した。Repository CheckerはExit 1、既知tag不一致一件だけである。対象・操作・保存上の限界はr2節と同じであり、全検証器のbinary・全入力集合の網羅再識別を主張しない。

是正自己確認は独立Passではない。新固定七fileでの技術、文書、品質／直接影響の再確認を待ち、本番接続、終端記録、全利用側移行、旧三Root非使用・清掃、実Recoveryおよび全体品質はOPENを維持する。

### 是正候補r3の独立確認結果

新しい固定七fileの技術、文書、品質／直接影響をすべて再確認した。三観点は限定Pass、IL-T01／IL-T02／IL-Q01はResolved、新Finding 0。旧Passを流用していない。開始・終了HEADは`c60b166aa1c6b35e2114517c794c0b675c324261`、対象Hash・r3・旧r2は不変だった。確認者は再実行・編集・外部送信・実操作を行わず、差分空白検査はExit 0だった。

| 固定確認対象 | SHA-256 |
|---|---|
| Coordinator詳細設計 | `3f8d771430fb5b2acc951cae43b52fd634a2f864a6e80337cef22b266aa941c0` |
| QA-000003定義 | `792d7e69226cfc9e65ee8ea07d811c7c32c37cc967bf2650135e8865c23803bb` |
| 内部lease候補 | `1b2bde7d6907ee9896dca5ef5d42f936bdd0b3de94fd073e015f4bfc850a0eab` |
| 既存局所試験 | `ea3768a56ed628fcc134ccf35183004d0a85830c2aaa03d8a784950b81cd4dbf` |
| production型構成 | `fb4c7d29dcd60fd163834b5dec3a26daaf671cd0c723212e2b411b6c4eb72e89` |
| Coordinator Symbol | `c41db9cae8cfecf76736c09f98b0ad4c985c06b27bb8f229a98b04652d4638f6` |
| 本記録のレビュー版・結果書戻し前 | `0e0b9a24bd895b75ab9cc76fb68812dd1c86ecfedbbb33218d56809c9f232141` |

実行入力としての本記録Hashは`a78ace7db49d23945a8368ced17583bda7135927ec8fccb60fdf8085bf166e84`であり、上記レビュー版とは区別する。r3原記録Hashは`966df18956d662f037f4869d8be141990b2420f9063cec39a8e93337d6bb9444`。64局所結果と追加三反例、登録・Relation、全command／snapshotの明示cwd、八入力前後一致を照合した。

全結果統合後、確認者が整合済みとした本節とChecklist一行だけを書き戻す。他六file、旧Fail・Hash、旧r2／r3、品質件数、Authorityおよび停止Gateは不変である。成立範囲は本番未接続の内部通知処置だけ。本番連続排他、native終端／OS資源不存在、正式PRL-UT-006全体、耐久終端記録、全利用側移行、旧三Root清掃、実Recovery、署名E2Eおよび全体品質は未成立のままである。検証器・全入力の網羅再識別も主張しない。

## 終端記録の保存・再入場 — 候補契約の具体化

基準Commitは`2db37721f29ab16534e6237fdae2b4a0c4b723bb`。元markerを処置後も同じ回復対象へ戻れるよう、[詳細設計の候補契約](../../../../06_Architecture/Details/coordinator/01_Architecture.md#終端記録の保存再入場の候補契約)を具体化する。記録は対象・進行を追う手掛かりであり、元TaskのAuthorityまたは清掃成功の正本にしない。

### 変更経路と着手前整合

| 項目 | 今回の処置 |
|---|---|
| 変更分類 | 同じRecovery責務の設計具体化。非自明なArchitecture・Qualityの直接伝播。 |
| 着手前整合 | 親が現行Loader、Root／marker清掃順、Runtime Dataのstage／排他的link、Authority・保守・品質規則を照合。読取り専用確認者が保存／保護、二producer、参照保持、容量、管理清掃の六条件付きで文書編集のみ着手可。 |
| 固定範囲 | Coordinator詳細設計、QA-000006、今回のCHG記録の三文書。 |
| 独立確認 | 新固定三文書の技術、51文書、品質／53直接影響の三観点。全結果統合前は編集せず、旧Passを流用しない。 |
| 行わない確認 | Source・署名Runtime不変のため、型／Lint／全回帰・再署名・Provider E2Eを本更新の根拠として再実行しない。準拠基準・Release判断も不変。文書Checkerと差分・リンク確認は行う。 |
| 人間判断 | 現時点では新しい方法選択は不要。実Process停止、旧三Root処置、書込みRoot拡張およびReleaseは今回の許可に含めない。 |

語彙は既存の「終端記録」「回復参照」「非Authority」「再入場」を再利用し、本文では対象と進行の手掛かり、権限ではないことを先に説明する。新しい正式用語、Canonical IDまたは公開Token体系は定義しない。専門家向けの詳細表でも、保存条件・権限・停止・未成立を別に表示する。

### 専門判断の根拠と残る不確実性

| 観点・比較 | 設計への反映 |
|---|---|
| markerを残して排他解放後に除去する案 | 排他外の処置と参照喪失窓が残るため不採用。選定済みの終端intent先行→Root→marker→leaseを維持。 |
| markerから旧Tokenを復元する案 | 元参照不明の保守でAuthorityを復元するため不採用。通常清掃と保守のproducerを分け、後者は今回のexact選択へ結合。 |
| Runtime Dataのcaller-known stage／排他的公開 | 既存原理として照合。ただし別の保存境界・Authorityを持つ実装をHostへ接続済みとはしない。 |
| 書込み・flush後のrenameだけで確定する案 | 既存対象の置換、公開不明と実体差を除外できないため、そのまま採用しない。no-replace公開・両名の照合・stage不存在を接続前条件にする。 |
| 参照を局所変数だけへ保持する案 | Process喪失で再入場不能になるため不採用。最初のEffect前の参照とcaller耐久接続を必須とする。 |
| 記録を永久保持する案／古い順で消す案 | 前者は容量無制限、後者は未解決参照を壊すため不採用。stageも含めた容量予約と、共同終端後の別管理清掃へ分離。 |
| Windows modeとFilesystem原理 | [Node v24.19.0](https://nodejs.org/download/release/v24.19.0/docs/api/fs.html)、[Windows hard link](https://learn.microsoft.com/en-us/windows/win32/fileio/hard-links-and-junctions)、[FlushFileBuffers](https://learn.microsoft.com/en-us/windows/win32/api/fileapi/nf-fileapi-flushfilebuffers)を2026-10-03に確認。modeをWindows ACLへ昇格せず、file flushをDirectory／電源断の全耐久保証へ拡張しない。 |

探索範囲は同じCoordinatorの通常清掃・限定保守、固定保存境界、Process喪失、容量と記録清掃に限定した。汎用journal、全FilesystemのNative化、任意Path清掃、OS再起動および元Task再実行は対象外。候補値8KiB／1024entry／8MiBは接続前に確認する運用候補であり、容量超過を削除許可にしない。保存保護、no-replace公開、caller耐久接続、予約計数、引渡しReceiptと実管理清掃の実装・実観測は未成立である。

### 編集と利用側の対応

| 編集一次キー | 対象／適用位置 | 処置・確認方法 |
|---|---|---|
| HT-D01 | Coordinator詳細設計の同一Process候補末尾と新しい候補契約節 | 旧OPENを設計候補と実保証のOPENへ分離。保存、保護、二producer、段階別再入場、容量、共同終端と管理清掃を一つのOwnerへ定義する。 |
| HT-Q01 | QA-000006のHost限定回復節末尾 | 既存Local Itemへ各公開段階・取消／喪失・差替え・容量競合・marker消失・lease不明・Evidence失敗の反証を追加。全行未観測、件数不変。 |
| HT-E01 | 本記録のChecklist直前 | 採用理由、計画条件、編集対応、独立結果と残る未成立を記録。契約本文を第二の正本にしない。 |

通常Task・Doctor・検証Script・exact回復・限定保守・診断／公開結果・管理清掃が将来のconsumer母集団である。今回はすべてSource未変更・未接続とし、完成主張を止める。QA-000003の既存局所通知処置、Runtime Dataの既存一時Operation契約、配布／署名、PROJECT_CONTEXTの停止・判断状態は変更しない。前二者は設計原理／責務の参照であり、本番接続の証拠ではない。停止、旧三Root、Sourceと品質件数が不変のため、現在投影の内容更新はN/Aと評価する。

### 文書候補の自己確認

Node v24.19.0でRepository Checkerを実行し、Exit 1、既知の`stable-release-tag-identity-mismatch`一件だけを確認した。新しい文書不備は0、差分空白検査はExit 0だった。初回に検出したRuntime Data参照のanchorを訂正してから再確認した。全CheckerのPassとは表示しない。

原記録は`.crdd/verification/chg-000082-terminal-contract-261003/run.json`、SHA-256 `bca6daf2160f36fcc4466f19f8c56b91c7aa16dc0f710a4e5c4c15448872eda1`。明示cwd、実command、Tool結合出力、終了code、三文書の実行前後Hashを保存し、前後一致を確認した。本節は実行後追記であり、入力Hashとレビュー版Hashを区別する。Source確認・実処置・再署名・E2Eは実行していない。

### 初回独立確認とHT-Q02の是正

固定三文書を技術、51文書、品質／53直接影響の三観点で確認した。技術はPass、文書・品質／直接影響はFail。FindingはHT-Q02一件であり、上記原記録のChecker返却結果に実command／cwdを結合して保存していなかった。検査結果内の対象Rootは実cwdの代替ではない。「明示cwd、実command保存済み」という初回記載はChecker部分について不足していた。

全結果を統合した是正案を指摘元へ再提示し、整合と着手可を確認した。旧原記録・旧Hashを不変で保持し、推定による補完をしない。設計・QAの意味、Source、実操作、品質件数、Authorityおよび停止Gateは変更していない。

新しい確認は`.crdd/verification/chg-000082-terminal-contract-261003/run-r2.json`へ保存した。SHA-256は`b4106c9468c10fa829967ed5a94369cf5c8ed73470530f58d9931ae32bdddda9`。実際にToolへ渡すinputオブジェクトと、初期返却・全待機返却を結合した。前後のHEADは`2db37721f29ab16534e6237fdae2b4a0c4b723bb`、三文書と旧原記録のHashは一致した。これは新実行であり、旧実行の入力復元ではない。

Checkerは30315ms、Exit 1、既知tag不一致一件、Warning 0、新しい文書不備0。差分空白検査はExit 0。Source・OS・実Recovery・全回帰・E2Eの確認には昇格しない。

**現在状態: 是正候補r2の自己確認済み、独立再確認待ち。** 新固定三文書とr2を同じ三観点へ渡し、全結果を待つ。契約実装・Recovery完成・Quality Readyは未成立のままである。

### 文書候補r2の独立再確認結果

固定三文書を技術、51文書、品質／53直接影響の三観点ですべて再確認し、全結果は限定Pass、HT-Q02はResolved、新Finding 0だった。旧Passを流用していない。確認者の開始・終了HEADは`2db37721f29ab16534e6237fdae2b4a0c4b723bb`、下記Hashと新r2・旧runは一致・不変だった。確認者は再実行・編集・外部送信・実操作を行っていない。

| 固定確認対象 | SHA-256 |
|---|---|
| Coordinator詳細設計 | `2e4b4a7ade49eee6aedbf224b5457232b451d1a1cfa10d18f087e7c2244f13e0` |
| QA-000006定義 | `829ea107917b1eed2d1ed4f2355df6ffb8585a4e313b2cb9245fd69785dc5ef4` |
| 本記録のレビュー版・結果書戻し前 | `7b87afff862db062f4ebb05b9d9c4d8a828dbaeccb3243e6ca907efd8d61f36c` |

新r2の実行入力としての本記録Hashは`97e5a01d0cbacd6b71198d22584a177bfb181d765638665e2fe72e1d1c1b1964`であり、レビュー版と区別する。Checkerのinput、初期返却と同じsessionの全待機返却、前後HEAD／Hash、差分空白のinput／結果を独立照合した。30315ms、Exit 1、既知一件／Warning 0に一致する。限定Passは文書候補と根拠記録の整合に限り、Checker全体のPassではない。

全結果統合後、確認者が許容した本結果節とChecklist一行だけを書き戻す。他二文書、旧Fail、旧run／新r2、Source、Authority、品質件数および停止Gateは不変である。契約実装、Windows保護、実Recovery、E2Eおよび全体品質はOPENを維持する。

## 終端記録の公開方式 — Node APIの限定実測

**結論: 自己生成fileの六場面を観測できた。hardlinkによる公開はno-replaceを実現したが、内容の不変性を保証しない。** 本番の記録保護、Native Identity、連続排他、Process喪失後の再入場および実Recoveryは未成立のままである。

### 実行範囲と着手前確認

基準Commitは`4d47c4f0069abcd3581956800a82464154201d99`。着手前に現在投影、保守、品質、コーディング規約と候補契約を照合し、読取り専用確認者へ具体計画を提示した。期限は保留I/Oの取消保証にしないこと、意図的置換fileにも新receiptを保持すること、既存fixtureを変更しないことを条件として着手可だった。これらを試験本文へ反映し、方法選択の新しい人間判断は不要と確認した。

| 境界 | 固定した条件 |
|---|---|
| 実測対象 | Repository-local `.crdd/verification/chg-000082-terminal-publication-261003/fixture/`の自己生成固定file名だけ。開始時に既存なら停止。 |
| 容量・実行 | 作成するfile entryは累計12件、二名も二件として数える。物理bytes上限64KiB。実測は一Node Process、一回、retry 0。静的段階の検証器は別Processであり、実測Process数へ混ぜない。 |
| 期限 | 開始後10秒で新しい書込み／除去を拒否する点検。同期FS syscallの最大待ち時間、取消または厳密な全処理終了期限は保証しない。期限後も未終了を清掃済みへ変換せず、失敗・保持へ接続する。 |
| 取得・清掃 | `wx`で取得後は観測失敗もreceiptへ未確認として保持。close不明、予期しないIdentity差または清掃不明なら保持して失敗。既知の作成receiptへfreshに結合し、exact unlink／空Directory rmdirだけを行う。recursive除去は使用しない。 |
| 非操作対象 | OS temporary共有Root、旧三Root／marker、Docker、Provider、本番Process、署名済みRuntime、Production Source、公開入口とAuthority。 |
| 変更経路 | 既存QA反証の局所実測とEvidence更新。意味・準拠・Release契約は不変。技術、51文書、品質／53直接影響の三必須観点で新固定記録を独立確認する。全回帰・署名E2E・PT／LTはこの方式実測の成立根拠にしない。 |

試験Codeと入力は同じ検証Rootへ保存し、Git非追跡の診断物として保持する。入力のrun参照は実測前に固定した非Authorityの相関参照であり、Canonical IDや元Taskの回復Tokenではない。試験Codeを本番のParser、Loaderまたは管理清掃へ流用しない。

### 六場面の結果

| 場面 | 実観測 | 時間 |
|---|---|---|
| 完全公開とstage除去 | `wx`→完全write→fsync→close→link後、Node metadataと両名bytesが一致。stageと最後の公開名の直接不存在を確認。 | 20ms |
| 既存公開先の衝突 | 一回のlinkは`EEXIST`で拒否。既存公開先のIdentityとbytesは不変。 | 17ms |
| 不完全stage | 切れたJSONはparse不能。公開要求を発行せず、存在を完了にしない。 | 9ms |
| 同一実体の改変 | stageの意図的書換えは公開名にも反映した。Identityは同じでも元bytesとの不一致を観測できた。OSが改変を阻止した結果ではない。 | 14ms |
| 別実体への置換 | 元stageを保持して公開名だけを別fileへ置換し、新Identityとbytes不一致を観測。新fileは新receiptで回収した。 | 18ms |
| 三配置の相関 | stageのみ→二名→公開名のみで、事前固定した同じrun参照を読めた。同じProcessでの配置観測であり、Process喪失試験ではない。 | 10ms |

六場面、累計12 entry、残るreceipt 0、`ioUnconfirmed:false`、`cleanupConfirmed:true`、全体90ms、Exit 0だった。fixtureは実行後に別の読取りからも明示`ENOENT`を確認した。Node v24.19.0、Windowsでの結果である。`fsync`の返却をDirectory耐久化・電源断後の保証へ昇格していない。

### 静的段階と原記録

RootのBiome設定は`.crdd`を除外するため、無処理の成功にしない。実Codeをstdinとして同じRoot設定へ渡し、仮想的なintegration配置でFormatterとLintを適用した。Formatterは出力と入力の完全一致、LintはWarningを失敗とし、stdin用`--write`の出力も完全一致を要求した。Lint出力をSourceへ書き戻していない。仮想Pathに`40_Develop`のFileを作成していない。strict型検査は専用のnoEmit構成で同じCodeを検査し、構文確認を終えてから実測した。四段階は全てExit 0。準備時のLint stdin操作不足による失敗も原記録に残し、最終の成功へ混ぜない。

原記録は`.crdd/verification/chg-000082-terminal-publication-261003/run.json`、SHA-256 `1dcc279f6e94d5fc55953bcf99fd0fb0e84f936215c2c7b9e13b0e9b8c1f5011`。各Toolへ実際に渡したcommand／cwdと返却を結合し、静的段階、実測、前後Hashと終了後不存在観測を保存した。

| 再識別する入力 | SHA-256 |
|---|---|
| 診断TypeScript | `b197283c72cde560a7092878db3256be3b5faa3f5826b75595df472acb29a49e` |
| 固定入力 | `403466ae92f2d316aeb9173634c177255f1f28e78b17f1d7927e119ae9ad6027` |
| 専用strict構成 | `280ff68274b49266d3c27810e307e65079306fec95ef0ea43a52ecffb8922d66` |
| 診断のESM設定 | `89c47db7851f89caec72da4f215ebc21cf1e294aeef3b45d2583562d846ab035` |
| RootのBiome設定 | `2a0c976b0d0f37dcf2588518ed5ba170f74022f60b7a541324b847b5a34081e8` |

開始・終了HEADと同じ八入力Hashは一致した。八入力には上表の五FileとNode binary、Biome起動入口、TypeScript起動入口を含む。検証器の全推移的入力・binaryの網羅的再識別ではなく、Tool結合出力もstdout／stderrの独立取得ではない。

本記録を起点にしたscoped Checkerは、関連六Markdown、391リンク、42anchorを確認し、25066ms、Exit 0、Finding 0、Warning 0だった。差分空白検査もExit 0。原記録は`.crdd/verification/chg-000082-terminal-publication-261003/document-check.json`、SHA-256 `b1b69d54414d005167a90e3c5ee1a30561fb7f82393ecbd082d7f748f165e295`。明示input、初期／最終返却、前後HEAD・本記録と実測runのHashを結合した。本段落は実行後追記であり、実行入力Hashと独立確認版を区別する。Repository全体の文書確認、Git非追跡の診断物確認または既知Release tag不一致の解消を主張しない。

### 次段への意味と限界

原理の実測を、本番保護へ代用しない。現在の観測用Native handleは共有write／deleteを許しており、差替え防止の根拠ではない。protected DACLが同じ利用者へ書込みを許すことも、同じ利用者による改変阻止にはならない。次に必要なのは、同じ実体を保持したWindows保護・差替え防止と、そのhandle終端の確認である。

既存候補契約はhardlinkを不変Snapshotにせず、公開後のstage書換えを禁止し、実保護を接続前OPENとしているため、今回の観測からCanonical意味の変更は不要と評価する。既存QAのERB-IT-001／002／003に対する一部観測であり、正式Local Item全体の完了、品質件数の増加、全体Quality ReadyまたはPROJECT_CONTEXTの停止Gate更新は行わない。Native Identity、連続排他、Process喪失、caller耐久接続、容量予約と本番管理清掃は未観測のままである。

**現在状態: 限定実測の自己確認済み、独立三観点待ち。** 新実Task、旧三件の実停止・削除およびReleaseへ進まない。

### 限定実測の独立確認結果

新しい固定版を技術、51文書、品質／53直接影響の三必須観点で確認し、全結果を統合した。三観点とも限定Pass、Finding 0だった。旧Passを流用していない。開始・終了HEADは`4d47c4f0069abcd3581956800a82464154201d99`、結果書戻し前の本記録SHA-256は`fa159126a6b33c07985a73a66a5c75fd759b0c75e39eab0a3c86a64e2edfbe5f`で一致・不変だった。支持入力と原記録六件の指定Hashも一致した。Checker実行入力版`95b00ca6799139615d34d73b33defc3ffb5220f37e68909f5c24e107185da75a`と区別する。

六場面のassertionと保存結果、hardlinkの改変と別実体への置換、新receiptによる非再帰清掃、静的段階の実適用、原記録および終了後の別読取りを独立照合した。確認者は再実行・編集・外部送信・実操作を行っていない。本結果節とChecklist一行だけを書き戻し、原記録、Source、署名、QA件数、Authorityおよび停止Gateは不変である。

限定PassはNode APIの原理実測と記録の適合性に限る。検証器の全推移的依存、本番保護、Native Identity、Process喪失、耐久caller、容量予約および厳密期限終了はOPEN。ERB項目全体、実Recovery、旧三Rootの非使用・清掃および全体品質は未成立のままである。

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
- [x] 取得待機後の局所是正を同じ固定六fileで三観点から独立確認し、5指摘の解消と限定Passを記録した。実Recovery・全体品質の完了とは分けた。
- [x] 共有回復Directoryの所有・初期化是正を固定五fileで三観点から独立確認し、限定Pass・Finding 0を記録した。連続排他、実OS保証、旧三Root清掃および全体品質の成立とは分けた。
- [x] 同一Process排他の四場面実測を固定記録で三観点から独立確認し、限定Pass・Finding 0を記録した。本番接続、旧Root非使用、実Recoveryおよび全体品質は未成立と区別した。
- [x] 未接続内部lifecycleの三指摘を是正し、新固定七fileで三観点の限定Pass・新Finding 0を確認した。64局所結果と本番・実Recoveryの未成立を分けた。
- [x] 終端記録の文書候補を新固定三文書で三観点から独立再確認し、HT-Q02の解消・限定Pass・新Finding 0を記録した。Windows保護、実装、実Recoveryと全体品質は未成立と分けた。
- [x] Node APIの六場面実測と原記録を新固定版で三観点から独立確認し、限定Pass・Finding 0を記録した。hardlinkの不変性、本番Windows保護、実Recoveryおよび全体品質を未成立と分けた。
- [ ] OPEN: 旧形式の非使用、初期化排他、OS処置境界、保護済み再入場、SPEC／Workflow・公開入口と実境界検証が未成立。根拠取得後に同じCHGで接続する。
- [ ] OPEN: 実在三件のexact処置承認と清掃未実施。必要保証成立後に対象を提示し、別に承認を得る。
