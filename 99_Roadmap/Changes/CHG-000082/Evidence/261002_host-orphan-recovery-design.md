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

## Windows保護方式 — 自己生成二対象の限定実測

**結論: 同じProcess内のhandle共有制限について、Directory保持だけの反例、file保持中の拒否、明示close後の正例を観測した。** 本番の連続排他、別Process、Process喪失後の再入場、旧三Rootの非使用・清掃は未成立のままである。

### 範囲と着手前確認

基準Commitは`66a9a17239e5920f59b8159ce783a06681218e7d`。読取り専用の着手前確認で、Node metadataとWin32 Identityを未確認変換しないこと、Directory renameの拒否時にchild handleを残さないこと、異常時はDropを終了成功へ代用しないことを具体化した。新しい人間判断は不要だった。

変更は`windows.rs`の`#[cfg(test)]`内のhelperとignored fixture、およびRepository-local診断TSに限定する。Production処理、公開protocol、OS共有Root、旧三Root、署名済み実行物、新Provider Taskへ接続しない。自己生成対象は固定run親の`fixture/`とその中の`record`だけであり、別名への改名と復元も同じ親内の固定名に限定した。一回につきDirectory一実体・file一実体、file内容5bytes、開始時の両fixture名は明示不存在とした。10秒は新しいFilesystem Effectの点検期限であり、保留syscall取消・厳密な全処理終了期限ではない。

Buildは既存Cargo cacheを読取り元にし、checksum一致した23archiveと24sparse index、registry設定一件をRepository-localの専用`CARGO_HOME`へコピーした。49 entry、集計対象約5.8MBであり、設定一件のbytesを集計値に含めていない。copy操作のTool原返却は保存しておらず、この準備の全操作再現性を主張しない。Windows選択依存はrootを含む24 packageで、欠けていた`fiat-crypto`と`libc`は選択外だった。metadataの取得とBuildは`--frozen --offline`、固定Rust 1.94.1実体、wrapper／追加Rust flagsなしで行った。target、build、TEMP／TMPも同じ検証Rootへ限定した。依存の外部取得と既存cache書込みは行っていない。

### 初回の搬送失敗と新実行

初回はNative exit 0、exit／close、Node側の親Identity一致と両fixture名の`ENOENT`を観測したが、固定JSON行を解析できず`failed_or_unconfirmed`だった。初回のPassへ遡及しない。生Native出力は非保存であり、接頭辞を直接観測したとは扱わない。

Rust 1.94.1の[標準試験ランナー実装](https://github.com/rust-lang/rust/blob/1.94.1/library/test/src/formatters/pretty.rs)は、単一thread実行で試験名の進捗を改行なしに出力する。原因候補はこの共有stdout上の進捗とfixtureのJSON行の結合だった。是正計画を読取り専用確認へ再提示し、fixtureの`println!`先頭改行と新しい`.r2`相関参照だけを変更した。Nodeの行先頭一致、一件、10 fieldの閉Schemaは弱めていない。

初回原記録は`.crdd/verification/chg-000082-native-protection-261003/run-initial.json`、SHA-256 `7890a39e10f634aafa2870b2fd6781d1871b08f3492dc7ece64190af2678c9a5`。新実行原記録は同Rootの`run-r2.json`、SHA-256 `fc9bc97374b87d728f6d66327c4c7259f29f569cb07d0e55fe8e8e07d009f2ea`。新実行前にRust Formatter確認、test binaryのcompile、Warningを失敗とするClippy、診断TSのstrict noEmit、Formatter／Lintのstdin実適用と入力完全一致、構文確認が全てExit 0だった。旧原記録は不変である。

### 新実行r2の観測

| 観点 | 局所観測 |
|---|---|
| 保護構造 | 作成時に指定したselected user所有、protected DACL、selected user／SYSTEM二ACEをhandleから再読取りした。別主体のアクセス実証ではない。 |
| Directory保持のみ | childへの5bytes書込みとそのhandleのchecked-closeが成功。その後child handleなしでDirectory自身のrenameがWin32 error 32で拒否された。 |
| file自身の保持 | read成功。固定access／shareでのwrite・delete access取得、実deleteとrenameはerror 32で拒否された。他の失敗codeを成功へ畳まない。 |
| 明示終端後 | 保持・観測・Token handleのchecked-close後、同じfileへのwrite、fileとDirectoryのrename／元名への復元が成功した。 |
| 清掃 | Native側のfresh Volume／File ID一致後、自作fileと空Directoryだけを非再帰で除去し、直接不存在を確認した。Node側の別読取りでも両fixture名は`ENOENT`だった。 |
| 搬送・Process | 閉Schemaを解析でき、NativeとNodeはExit 0、exitとcloseを観測。121ms、出力525bytes、output上限超過・Process errorなし。 |

Nodeのdev／ino／birthtimeの前後一致とNativeのVolume／File IDの前後一致は別観測とし、両Identityを同一と主張していない。清掃確認は自己生成二対象だけであり、診断Source、入力記録、cacheおよびtest binaryの不存在を主張しない。これらは同CHGの後続確認用に保持し、確認結果の移送・再実行要否の解決時に検証Root単位で保持終了を判断する。由来不明の対象はこの清掃へ含めない。

新実行のSource／binary Hashは前後一致した。Native Sourceは`41b2d826e959fb86fc0103560c200862b864017ff0956a28ea966710b5d9ff08`、診断TSは`96722c7146baca354cfb90cec0ba384e5d3e7b15eb4f8db83d52f51ccd1a0776`、test binaryは`80506fb8196550150472632ba411a208a5c63952729d64e9f345cf5fab4c54a0`。Buildの全推移的入力の網羅的Hash固定ではなく、Native production署名の更新でもない。

scoped Checkerは29035ms、Exit 0、Finding 0、Warning 0。要求scopeにNative Sourceも指定したが、実際の展開は関連六Markdown、391リンク、42anchorであり、Native Sourceの意味・HeaderまたはGit非追跡診断物の検査成功を主張しない。原記録は同検証Rootの`document-check.json`、SHA-256 `3431a3de4c9e690e08de6b154899b720634345663eea361860fabf4358990a6e`。実行入力の本記録Hashは`f053759e2512dc1a850a4030bfa0c708bf540cc53b8428732b69f2e4cc75b722`であり、本段落追記後の独立確認版と区別する。差分空白確認もExit 0だった。

**現在状態: 局所実測の自己確認済み、固定候補の技術・51文書・品質／53直接影響の独立確認待ち。** 既存QAの一部根拠であり、ERB項目全体の完了、品質件数変更、本番保護、実Recoveryまたは全体Quality Readyへ昇格しない。次に必要な実測・接続は、別Processの排他、所有処理の実終了・再入場、耐久記録と本番利用側である。

### 固定版レビューの指摘と新実行r3

基準HEAD `66a9a17239e5920f59b8159ce783a06681218e7d`、Native Source `41b2d826e959fb86fc0103560c200862b864017ff0956a28ea966710b5d9ff08`、本記録 `05804984ccca81e4e736f3959addb0f3ed32881cf15b0d33ae88052537f4e07f`を三観点で独立確認した。技術は正常局所観測と閉Schema搬送に限定Pass、文書と品質／直接影響はFailだった。三Findingを全結果確定後に統合し、修正計画を同じ確認者へ再提示した。旧結果のPass化、実RecoveryおよびQA件数への昇格は行っていない。

| 指摘 | 適用した是正 | 不変範囲 |
|---|---|---|
| NP-D01 | Headerで清掃開始前の失敗と、清掃中の部分成立・以後停止を区別した。既発行処置を未発行にしない。 | 実装本体と合否条件を変更していない。 |
| NP-D02 | 二helperの前提に固定run親Directoryのread-only観測を含めた。全呼出しを照合し、親への変更を許可しない。 | 任意Path、親清掃、公開契約を追加していない。 |
| NP-Q01 | 実cwd、UTC時点、実行物と設定の前後識別を新記録へ保存し、新しいrun `.r3`で静的段階と局所実測を再実行した。 | 初回／r2／準備／旧Checkerの四原記録は指定Hashのまま保持した。旧環境を現在値で補完しない。 |

着手前の是正方針は三観点で条件付きAcceptとなり、追加条件も全て適用した。解決したNode実体・版・Hash、Rustのcargo／rustc／rustfmt／cargo-clippy／clippy-driver、TypeScriptの入口・解決helper・package・選択Native、Biomeの入口・package・選択Nativeと主要設定、Native Source、診断TSを含む28入力を前後で識別した。`NODE_OPTIONS`は空、`NODE_PATH`は未設定、`BIOME_BINARY`は選択実体へ固定した。全exec inputにRepository Rootのcwdを明示し、UTCの開始・終了とToolの実返却を保存した。Rust Buildの全推移的入力、型定義全件または環境全体の固定を主張しない。

新原記録は`.crdd/verification/chg-000082-native-protection-261003/run-r3.json`、SHA-256 `06aa9884141d217e1ecc43b285c6c5796fcff236ac4bed43450287a5cb9bd549`。12 invocationのcwd・UTC・完結返却と28入力の一致を別の機械照合で確認した。静的六段階は全てExit 0。再実測は168ms、Native／Node Exit 0、閉Schema搬送、handleの明示終端とfixture二名の直接不存在が成立し、終了後の別読取りでも確認した。新Sourceは`5f33e29c24fe9b22ff873160266f51337b1aa4caff704aad271d2dc3e10640b1`、診断TSは`dd20cea82a87aee2a07ac8c87a817c07f39836634b9b9226f3354286f5c82653`、Build後のtest binaryは`9b7bf8f8816d28ad709a71e63847eecfcef1a136abeaddfa9b02fbfa23cc4b23`で前後一致した。

新しいscoped Checkerも関連六Markdown・391リンク・42anchor、30287ms、Exit 0、Finding 0、Warning 0だった。`document-check-r3.json`（SHA-256 `da52f4f60b862b3fd170d31b0b7294f60ec1f2abb27f9b10a1108dfc1cc4db7a`）にexplicit cwd、UTC、初期／wait返却を保存した。Node実体は新実測の事前識別へ接続し、Checker入口・packageと文書のHashは実行中・終了後の観測で一致した。Checkerの全推移的依存固定ではない。実行入力文書Hash `87938b7c8eebb8e1c3274740368286bb85ab0fbcd30a85d61ada978317997622`と本段落追記後の確認版を分け、Native Header・Git非追跡診断物・Repository全体の確認へ昇格しない。

**現在状態: 三指摘の適用・自己確認済み。新固定版の三観点再確認待ちであり、Resolvedまたは独立Passではない。** 別Process保護、本番の連続排他、Process喪失、実Recovery、実在三件の処置、署名および全体品質の未成立は不変である。

### 新固定版r3の独立確認結果

技術、51文書、品質／53直接影響の三必須観点を同じ新固定版で再確認し、全結果を統合した。三観点とも限定Pass、Finding 0、NP-D01／NP-D02／NP-Q01はResolvedだった。開始・終了HEADは`66a9a17239e5920f59b8159ce783a06681218e7d`、結果書戻し前の本記録は`68127abe76863c00c26c9062c2f1012eaddba47b6e5e0b7000acdc4069545f92`で一致・不変。Source、TS、test binary、新二記録と旧四原記録の指定Hashも一致した。Checker入力文書`87938b7c8eebb8e1c3274740368286bb85ab0fbcd30a85d61ada978317997622`と区別し、旧FailへPassを遡及していない。

確認者は四Header修正、実呼出しの親読取り、清掃前停止と部分清掃、12 invocationのcwd・UTC・完結返却、28入力前後一致、168msの局所結果および別読取りの不存在を照合した。編集・再実行・外部操作は行っていない。本結果節とChecklist一行だけを書き戻し、Source、原記録、署名、QA件数、Authorityおよび停止Gateは不変である。

限定Passは同一Processの自己生成二対象に対する局所診断と記録に限る。別Process、本番の連続排他、親Process喪失、厳密期限、耐久caller、全Recovery、実在三件の処置および全体品質はOPENのままである。

## Windows保護方式 — 別Processからの限定実測r4

**結論: 同じ利用者の別Processからも、親のfile／Directory保持中の拒否と、明示解除後の正例を観測した。** 自作二対象の局所確認であり、本番連続排他、親Process喪失、耐久caller、旧三Rootの非使用・実清掃は未成立である。

### 計画と不変範囲

基準Commitは`5b190b8dd2e4ee6246846e232d6c320d42ca2af5`。読取り専用の着手前確認で、失敗JSONと成功Oracleを分け、起動・終端不明の部分結果を保持すること、各role一回・同時一Workerとし、失敗後のWorker再試行とfixture清掃を禁止することを補強した。Windows uptimeによる10秒の共有cutoffを明示環境で渡し、Workerは新しいwrite／delete／renameの直前に点検する。親の10秒点検とWorker wait 3秒・既存Job清掃観測最大2秒は別条件であり、保留syscall取消または厳密な全処理終了期限を主張しない。

変更は`windows.rs`の`#[cfg(test)]`内とGit非追跡診断TS、本記録だけである。既存`windows_owned_child.rs`は読取り入力とし、Production、公開protocol、署名実行物、旧三Root、DockerおよびProviderへ変更・操作を加えていない。本番設計・公開契約の採用を変えない診断なので、上位Template／Ruleの意味変更は非該当と評価した。ERB-IT-001／002の部分根拠に限り、QA件数と停止Gateは不変である。

親NativeはNodeが前後Hashを確認する固定test binaryから、同じ実行物のexact ignored Workerを起動する。子環境はrun、held／released、uptime cutoffとRepository-local TEMP／TMPだけであり、親の環境全体や秘密を継承しない。標準入出力は固定NULだけを渡す。既存OwnedChildのJobへ停止状態で結合した後に開始する。全assertionとfixture handleのchecked-close後に限り、heldはexit 71、releasedはexit 72を返す。exit 0だけでは選択Worker実行の証明にしない。親は役割別exitとexact Process終了・Job内Process 0の両方を要求する。Job、Process、NUL等の全OS handle checked-close保証とは区別する。

### 観測結果

| 場面 | 局所観測 |
|---|---|
| 保持中の別Worker | file readが成功し、write／DELETE access、実file削除、file rename、Directory renameがerror 32で拒否された。fileとDirectoryの両保持中の観測であり、Directory単独の因果証明にしない。既存のDirectory-only反例も維持した。 |
| 解除後の別Worker | checked-close後、同じfileへの5bytes書込み、file／Directoryの改名・復元が成功した。Workerの前後で親・Root・fileのNative Identityが一致した。 |
| Worker終端 | 両Workerが役割別71／72で完了し、各exact Processの終了と所有Job内Process 0を確認した。timeout・観測不能・期待外exitを成功へ読み替えない。 |
| 最終清掃 | 親が再度fresh Native Identityを確認し、自作fileと空Directoryだけを非再帰清掃した。Nativeの直接不存在、Nodeの別読取りおよび終了後の追加読取りで両fixture名が`ENOENT`だった。 |
| 搬送 | revision 2、12 fieldの閉Schema、Native／Node Exit 0、exit／closeを確認した。215ms、出力584bytes、output上限超過・Process errorなし。 |

閉Schemaは成功と合法な失敗結果の両方を解析する。`phase`、held／releasedの部分結果、固定reasonを保存し、起動の未発行／発行済み、終了確認／不明、timeout、取消、観測不能と期待外exitを分ける。`fixtureHandleClosuresConfirmed`はfixture handleだけに限定し、`separateProcessProtectionVerified`は両Worker receipt、親の後続Oracleと最終清掃が全て成立した場合だけtrueにする。失敗分類の全枝を故障注入したとは主張しない。

原記録は`.crdd/verification/chg-000082-native-protection-261003/run-r4.json`、SHA-256 `6e30827cd87efdcf9595b0f3ea2cb770bff0028283ff71c73fdc1f7fdd343a6c`。重複参照を除いた16 invocationのexplicit cwd・UTC・完結返却を照合した。初回TS型確認はunknownの型絞込み不足で失敗し、実測前に閉Schema確認後だけ型を確定する構造へ是正した。その失敗も原記録に残した。Rust SourceはこのTSのみの修正前後で不変であり、実測前のRust Formatter・compile・Clippyと、修正後のTS strict・Formatter／Lint・構文確認は全てExit 0だった。Native Source・診断TSと主要Tool／設定、既存OwnedChildを含む29入力の前後一致を確認し、旧六原記録は指定Hashのまま保持した。全推移的依存の固定ではない。

新Source SHA-256は`3f2e50163ca0c4940067e4a9326050f438479fac57e114527719d836daeb3b66`、診断TSは`75d28b90d99fa5437bfd1841e716444837869ec4326eb1dfdfb637c15f845184`、test binaryは`d21c7cfbb793427d2327ff28ccc67ac4ce1148b2af1dd8b7c4e93b7ddf4e3501`で一致・不変だった。Node IdentityとWin32 Identityを相互変換せず、別観測として保持した。診断用cache、Source、記録とbinaryは前節の同CHG検証用保持条件を継承し、fixture清掃から全検証Rootの不存在を主張しない。

**現在状態: 局所自己確認済み、固定版の技術・51文書・品質／53直接影響の独立確認待ち。** 同利用者・固定実行物以外の別主体、親喪失、本番利用側、耐久記録と実RecoveryはOPEN。実在三件の停止・削除、署名、全E2EおよびReleaseへ進まない。

### 自己照合の補強と新固定版r5

r4の成功観測後、親Headerのchecked-close対象をfixtureが登録した保持・観測・Token handleへ限定し、親の各点検もWorkerと同じuptime cutoffへ統一した。合法な失敗reasonの一覧には、未処置だった`receipts_missing`を追加した。成功Oracleを変更せず、r4原記録を保持した。r4診断TSも`native-protection-probe-r4.ts`へ同じHashで保持し、旧実行を現在のSourceで上書きした根拠にしない。中間のRust Formatter構文失敗は括弧不足を修正してから静的段階へ入り、記録時点を持たない準備操作を識別済みinvocation数へ含めていない。

新しい`.r5`の原記録`run-r5.json`（SHA-256 `83ab18dae71b3f802fafb1c9c45e64e29489e2cbf47804b677294a9d945aef56`）では、12 invocationのexplicit cwd・UTC・完結返却、静的六段階Exit 0、29入力前後一致と終了後の別読取りを確認した。222ms、出力584bytes、Native／Node Exit 0。held／releasedの両receipt、fixture handleの明示close、fresh Identityと非再帰清掃、直接不存在が再成立した。初回TS失敗とr4の記録をPassへ書き換えていない。

r5のSourceは`234ff21fa3bb51e34193b32cf919b08b69e2cec2910a9e41d0e1f939cbe8495f`、診断TSは`0056d80c2bdbf59430421ee470934a8c96ce5d8057bbf7f7955c77b6f3122116`、test binaryは`2d68a8795f6da7f8f313e59d9686f0e907f7868a76c2a9add145aa698e62313b`で前後一致した。限定結果と本番・親喪失・旧Root・実Recoveryの未成立を分ける。

r4文書入力のscoped Checkerは32871ms、Exit 0、Finding 0、Warning 0、実展開は関連六Markdown・391リンク・42anchorだった。`document-check-r4.json`に入口・package・文書の前後Hash、explicit cwd、UTCと初期／wait返却を保存した。Native意味、HeaderとGit非追跡診断物の機械保証へ昇格しない。この段落追記後の固定版確認とは別の入力版として保持する。

r5文書入力のscoped Checkerも25278ms、Exit 0、Finding 0、Warning 0、関連六Markdown・391リンク・42anchorだった。原記録`document-check-r5.json`（SHA-256 `00c067f3b0bb66b946a9b7b0abe2ce217ca87923b8eee301150c1a0b8f111382`）に入口・package・文書の前後Hash、explicit cwd、UTCと初期／wait返却を保存した。実行入力文書Hash `ca67ca46b1f84823e9576d80240b83a967b7089df0f4294b1e0bcdd7e3e3bc29`と本段落追記後の確認版を分ける。Git非追跡診断物、Native Header、全Checker依存またはRepository全体の確認へ昇格しない。差分空白確認もExit 0だった。

**現在状態: r5の自己確認済み、三必須観点の新固定版独立確認待ち。** 旧三件の実処置、本番接続、耐久caller、親喪失、署名および全体品質は未成立のままである。

### 新固定版r5の独立確認結果

技術、51文書、品質／53直接影響の三必須観点を同じ新固定版で確認し、全結果を統合した。三観点とも限定Pass、Finding 0だった。開始・終了HEADは`5b190b8dd2e4ee6246846e232d6c320d42ca2af5`、結果書戻し前の本記録は`bd4c544dc4760d6757aa9f20464ba8bf7e1cc2edd5572f3c0ecf90fb87332b5f`で一致・不変。Source、TS、binary、指定原記録、既存OwnedChild、保存r4 TSと旧六原記録も指定Hashと一致した。Checker入力文書`ca67ca46b1f84823e9576d80240b83a967b7089df0f4294b1e0bcdd7e3e3bc29`と区別し、旧Passを流用していない。

確認者は各role一回・直列、失敗後の停止、親子の共有cutoff、71／72とexact Process・Job終端の共同判定、fixture handleだけの明示close、合法な失敗搬送、12 invocation、29入力および222ms局所結果を照合した。編集・再実行・外部操作は行っていない。本結果節とChecklist一行だけを書き戻し、Source、原記録、QA件数、署名、Authorityと停止Gateは不変である。

限定Passは同利用者・固定別Process・自己生成二対象の局所診断と記録に限る。全失敗枝の故障注入、別主体、親喪失、厳密終了期限、本番連続排他、耐久caller、旧三Root、実Recovery／全E2EはOPEN。次は未接続の本番利用側・耐久記録・旧非使用の保証を具体化し、局所結果を実清掃許可へ読み替えない。

## 終端intentの形式と本番接続の具体化

**結論: 完全snapshotの閉Schemaを先に実装し、本番の保存・清掃への差替えは行わない。** 基準Commitは`f6d185870d9fd60ffe8ed940e070de21004b34d2`。同じCHGの承認済み限定Recoveryの実装であり、Windows再起動、実在三件の停止・削除、Docker／Provider操作、署名、統合・Releaseは含めない。

### 着手前の照合と変更経路

親はCoordinatorの終端候補、Runtime Dataの作成前caller参照、現行作成・清掃、元記録Loader、Capability初期化とNative Adapterを照合した。読取り専用確認者は同じHEAD・cleanで着手可とした。producer相関、完全snapshotへの限定、Win32／Node Identityの非互換、正規bytes、先行caller参照と容量予約を計画へ一括反映した。確認者は編集・実行・外部送信を行っていない。初期化途中を推測で埋めないこと、codec受理を実由来・Authorityへ昇格しないことも不変条件とした。

変更分類は非自明な回復契約の内部具体化。OwnerはCoordinator詳細設計、実装は既存security境界、UTは既存`PRL-UT-006`へ接続する。新しいSubsystem、公開index、Native protocol、QA IDや試験段階を増やさない。技術、51文書、品質／53直接影響の三観点を同じ固定版で独立確認する。準拠基準、外部公開またはRelease判断は変えないため、それらの監査・操作を今回の単位へ追加しない。

### 実装単位と本番の未接続条件

| 契約・利用側 | 今回の処置 | 次に成立させる条件 |
|---|---|---|
| 終端intentの形状とbyte搬送 | `host-terminal-record.ts`で閉Schemaと正規encode／decodeを実装。完全snapshotだけに限定する。 | actual producer出力とNative読取りから同じcodecへ接続する。 |
| 元参照・保守選択との関係 | normalは元参照Hashだけ、maintenanceはsnapshot Hashと閉じた不明理由だけ。caller-known refは今回の保守選択Identityでもあり、codecは生成しない。 | publication前の元exact参照・対象・Hash照合、またはfresh承認と同じ保守選択への照合。 |
| `createOwnedOperationDirectories`／transactional作成 | 変更しない。現行の元initializing marker→Root→六child→host_onlyと、返却後のhostRef取得を確認した。 | 最初のEffect前の容量予約とcaller耐久参照。Root未作成／部分作成／Identity不明の再入場は新codecの適用外として別に閉じる。 |
| 完全対象観測 | Win32五u32を専用型とする。六childは実名で搬送する。 | creation time付き実Adapter、`providerHome`→`provider-home`の明示変換、現在の選択利用者・Runtime・Repositoryとの結合。Node Identityや既存Native三fieldから補完しない。 |
| stage・公開・容量 | 保存操作は未実装、OPENを維持する。 | Native保護、連続保持、bounded write／flush、no-replace link、実bytes／実体の照合と共通容量予約。 |
| sync／async cleanupとSupervisor | 変更しない。現行はRoot→失効／解放→markerである。 | 公開intent→Root直接不存在→marker直接不存在→lease共同終端を全利用側へ移行する。Promiseを同期wrapperへ渡すだけの変更をしない。 |
| 元Loader／cold再入場／管理清掃 | 変更しない。元Token Loaderをterminal Authorityへ流用しない。 | freshなOwner、同じcaller参照、保護、Identityと非使用へ再結合し、Evidence引渡し後だけ記録自身を限定清掃する。 |
| 旧三Root・実Provider Task | 停止Gateを維持、操作0。 | 旧形式の非使用とexact処置の根拠・別承認。形式UTのPassを清掃許可にしない。 |

Schemaの正本は[Coordinator詳細設計](../../../../06_Architecture/Details/coordinator/01_Architecture.md#終端intentの閉じた搬送形式)。正常例は両producerの完全snapshot、非発火例はRoot未作成、境界例はu32／8KiB・bytes差、情報不足例は欠落Identity・不明producerとして処置する。形状を受理しても実由来・現在権限・非使用・保存・清掃を証明しない。完全intentの現在のconsumerは内部UTだけであり、公開Capabilityとして表示しない。

### 局所検証結果

Production／Testの型確認、二SourceのFormatter・LintはExit 0。これらを先に通してから、形式UTと既存の保守候補・plain snapshot試験を実行し、15件Pass、Fail／Skip／Todo 0、350.2483msだった。両producer、閉集合の欠落・未知field、整数境界、同じfile indexの重複、実行可能property、正規bytes差、UTF-8不正、8192／8193bytesの拒否段階、共有・detach済みmemory、byte offsetと入力変更を確認した。各nestedの不正入力を全組合せで列挙したという主張ではない。共通のplain snapshot境界の反例も同じ実行へ含めた。

最終UTの前後で13入力のHashが一致した。Sourceは`a54066eaa7337dff6807329a7f094ab61e928ea0677c25f02b29bd1a65d9340b`、Testは`cd4720ad749e981c19e997986bc500438543562a03462b792797b25af0b81dfe`。Nodeは24.19.0、実体と主要Tool／設定を識別し、実cwd、UTCの開始・終了と実返却を保存した。全推移的依存・環境全体の固定ではない。最初の15件結果も保持し、Test補強前の入力へ後の結果を遡及しない。

六fileを指定したscoped Checkerは25679ms、Exit 0、Finding／Warning 0。実展開108Markdown、9801リンク・489anchorを確認した。summaryの展開一覧は100件で切れるが、確認件数108とは区別した。Codeの全HeaderやNative意味をCheckerが保証したという主張ではない。差分空白確認もExit 0だった。Checker入力の本記録Hash `9947bd54933a044e67be835d51eed336f4758df5271e09106469f49ed278ee9e`と結果追記後の独立確認版を区別する。

原記録はRepository-localの`.crdd/verification/chg-000082-terminal-codec-261003/run.json`（SHA-256 `f4a8a546fe6eb7d7d95ad58d96702bb063955e4a3ab28ca09864c102f6fbe44d`）。Git非追跡とし、同CHGの検証記録として保持する。現在参照中のため削除せず、CHGのEvidence引渡し時に保持・清掃を再評価する。診断記録は回復Authorityではない。

**現在状態: 静的・局所自己確認済み。新固定版の三観点独立確認待ち。** 全本番接続、初期化途中、旧三件、実Recovery／全E2Eおよび全体品質の未成立は維持する。

### 初回独立確認と是正方針

六対象と原記録を同じ固定版で三観点確認した結果、技術は限定Pass、51文書と品質／53直接影響はFail、統合Fail・Finding 2件だった。開始・終了HEADは`f6d185870d9fd60ffe8ed940e070de21004b34d2`、対象と原記録の指定Hashは一致・不変。前回NativeのPassは流用していない。

| 指摘 | 原因と適用する是正 | 不変範囲 |
|---|---|---|
| TC-Q01 | 新Source／Testが正方向のSymbolとTest Catalogに未登録だった。SourceをARCH-000008、TestをQA-000003／PRL-UT-006と`verifies`へ接続し、実在Testを既存unit／contractの登録契約へ追加する。 | 既存Relation、Local ID、試験段階、品質の観測状態と本番consumerは変更しない。 |
| TC-Q02 | 初回記録はTSの小さい入口だけを識別し、使用した実行本体・解決helper・Native・tests設定との対応が不足した。実解決chainと主要設定を新しい実行前後Hashへ追加し、静的・局所検証を新原記録で行う。 | 初回runとその値を不変保持し、過去の環境へ現在値を補完しない。codecと検証義務を緩めない。 |

三観点の是正方針整合は着手可・追加条件なし。登録二fileを含む新しい八file固定集合で再確認する。現在、新しい人間判断は不要。初回Failは保持し、指摘解消・Passの判定は是正後の独立再確認に委ねる。

### 是正後の新実行r2

TC-Q01の正方向登録を二fileへ追加した。Test Catalogの実在全数照合はFailure 0、新Testの一意登録と属性を確認した。Symbol Graph Ruleの直接読取り確認もFinding 0だった。試験の存在・Relationを実行済みEvidenceや本番接続と同一視しない。最初のCatalog確認用コマンドは誤ったproperty名`entries`を参照して失敗したため、実Schemaの`tests`へ診断だけを修正した。失敗返却も保存し、製品変更や過去結果の上書きを行っていない。

TC-Q02では、TS入口→`lib/tsc.js`→packageが指定する`lib/getExePath.js`→platform package→選択Native `tsc.exe`の実解決を確認した。Node 24.19.0／win32／x64と解決した絶対Pathを記録し、実型検証器、両tsconfig、登録二file、Checker入口と主要設定を含む23入力を新実行前後で識別した。全件Hash一致。型二段階とFormatter／LintはExit 0で、その後の15局所UTは364.7335ms、Fail／Skip／Todo 0だった。codec本体とTestの前回Hashも維持した。全推移的依存や環境全体の固定ではない。

新scoped Checkerは八file指定、25223ms、Exit 0、Finding／Warning 0。実展開108Markdown・9801リンク・489anchorだった。原記録は`run-r2.json`（SHA-256 `ad66f791e80fc2715ba1e4f95178275d09546cff49c2b18953c092ba4e3e2f44`）として同じRepository-local検証Directoryへ分離し、初回`run.json`は指定Hashのまま保持した。実cwd・UTC・完結返却と失敗した診断を含めた。実行入力の本記録Hash `5bb019ac9266f1b225bc2df2c6d76e4909a9172f2e57d6baab2831cedb4bb9b6`と、この結果追記後の独立確認版を区別する。保持と清掃の条件は初回と同じで、原記録を回復Authorityへ昇格しない。

**現在状態: 二指摘の適用・新しい自己確認済み。新固定八fileの三観点独立再確認待ち。** 初回Failを保持し、解消・Passは未判定。本番接続、初期化途中、旧三件、実Recovery／全E2E、署名と全体品質は未成立のままである。

### 新固定八fileの独立再確認結果

三必須観点の全結果を統合し、技術・51文書／追跡・品質／53直接影響はいずれも限定Pass、TC-Q01／TC-Q02は解消、新Finding 0だった。開始・終了HEADは`f6d185870d9fd60ffe8ed940e070de21004b34d2`。Source／Test／config／設計／QAの前掲Hashに加え、Symbol `7f3c3cafd70cb2254aa038c34e60bd83cf43d686a35ec48a293a1edd78728693`、Catalog `7a568e6bd6bf5ceb9bf7bcd8af7c9cb3a945f87abb87994fc3f004661b7859aa`、結果書戻し前の本記録 `1a0d04829fc2646df548829ad0529d5b180e2f7441894e186f0206b1fba4d898`、旧・新原記録の指定Hashが確認開始・終了で一致・不変だった。

確認者は純粋codec、正方向の一意登録、23入力の実解決・前後識別、静的先行、15UT、Catalog／Graphとscoped Checker、新旧結果の分離を照合した。編集・再実行・外部操作は行っていない。本節とChecklist一行だけを書き戻し、Source、登録、設計／QA、原記録、品質件数、署名、Authorityと停止Gateは不変である。初回FailへPassを遡及せず、実行入力Evidence `5bb019…bb9b6`とは別の確認版として扱う。

限定Passは完全snapshotの形式、局所UT、正方向登録と記録だけに限る。実由来、Authority、非使用、保存／publication、caller耐久参照／容量、Native Adapter、初期化途中、全利用側移行、旧三Root、実Recovery／全E2E、全体品質はOPEN。全依存固定やPRL-UT-006全義務の完成は主張しない。現在、新しい人間判断は不要である。

## 終端記録のNative保存・公開部品

**結論: 元の実体を保持したまま完全bytesを保存し、既存公開先を置換せず公開する内部部品を具体化する。** 基準Commitは`e149991815cc22ff55fa749d652f6cd624434fce`。同じCHGの限定Recoveryの内部実装であり、実在三件、Docker、Provider、署名済みRuntime、公開Adapterと全Recoveryへは接続しない。

### 着手前照合と適用範囲

読取り専用の着手前確認で、同じ保存handleを連続保持すること、no-replaceの通常`FileLinkInformation`を使うこと、同期handleとAPI構造の寿命を結合すること、完全write／flush／readbackおよびchecked-closeを区別することを計画へ統合した。結果は着手可で、追加の人間判断は不要だった。共有モードは公開後の読取りと保持中の書換え・削除拒否を両立させる。NTSTATUSを別APIのLastErrorへ読み替えず、要求発行後の失敗をEffect 0へ戻さない。

変更の一次キーは、Native内部部品・親module接続・既存windows-sys機能選択、platform-access詳細設計、QA-000006の部分検証、Source／Testの正方向登録および本記録である。Schema・AuthorityはCoordinator詳細設計が所有し、Nativeは1〜8192bytesのopaqueな非秘密記録だけを扱う。新しい公開Protocol、Subsystem、QA IDや品質観測件数を作らない。技術、51文書、品質／53直接影響を同じ固定差分で独立確認する。準拠基準・外部公開・Release判断を変えないため、それらの監査・操作は今回の局所単位には追加しない。

| 場面 | 予定処置・確認 |
|---|---|
| 正常 | 保護済み自己生成Directoryの祖先・実体を保持し、CREATE_NEW stageへ完全write／flushする。同じhandleから公開linkを作り、両名のIdentity・ACL・全bytesを照合する。 |
| 非発火 | 空／8193bytes、不正な参照はstage作成前に拒否する。試験fixture自身のEffectまで0だったという主張にしない。 |
| 境界・反例 | 既存公開先を上書きせず、既存Identity・bytesを維持する。保持中の書換え・DELETE access・rename・削除を拒否する。 |
| 情報不足・部分成立 | stage作成／write／flush／link要求／照合／closeのreceiptを単調に保持し、不明・失敗を清掃済みへ畳まない。保護を維持したstage名の除去はOPENとする。 |

専用のignored ITを固定binary・実cwd・一回の実行に限定する。Node所有者が入力Hashと自作fixtureの不存在を別観測し、Nativeはfresh Identity照合後に四自作fileと空Directoryだけを非再帰清掃する。失敗時は残存を保持し、別Identityでの再試行や自動清掃を行わない。15秒のNode待機上限は同期syscall取消・全OS handleの厳密終了期限の保証ではない。

現在のconsumerはこの内部ITだけである。caller耐久参照、共通容量、初期化途中、固定OS Runtime名前空間、親Process喪失、stageの連続保護付き収束、全利用側、旧三Root非使用と実処置は未成立。Owner／WRITE_DACの連続防御やhandle解除後の不変性も主張しない。Windows再起動は前提にしない。

### 保存試験r1の停止と診断

初回の自己生成試験はNative Exit 101、Node Exit 2で停止し、全保存・公開Oracleは未成立だった。178ms、Nativeのstderr230bytes／stdout269bytes。stageと公開先は各8192bytes、衝突用の既存先は5bytesで残った。自動清掃、元entryの再実行、別fixture作成および旧三Rootの操作は行っていない。初回Nodeは実行前のPath表記照合で停止したため、Native実行は一回だけだった。後段試験を増やす前に、この境界の原因診断へ戻した。

失敗literalを保存していない搬送上の不足があり、前回の失敗原因は現時点では未特定である。一般panic／Debug本文や秘密を保存するのではなく、別の固定診断entryでleading-newlineの閉packetを出す方針へ補強した。行頭packetだけを解析するOwnerとlibtest接頭辞が衝突し得る問題も分離した。これは今回のExit 101を説明する確定原因ではない。型定義の検索先、Errorの型絞込み、Biome stdinの確認方式は実行前に是正し、その失敗と最終静的成功を原記録へ保持した。

原記録`run-r1.json`（SHA-256 `2d7ada13b754363ef34c7e55997bf41bdb8c9886ce6a9d7cfd139819cecc3f40`）は失敗のまま保持する。30入力の前後Hashは一致し、静的成功後に一回実行した。最初のno-run compiler出力の一部は表示上限で切れており、完全compiler logを保持したとは主張しない。旧Sourceを挿入部分の除去と改行表現から再構成し、実行前Hash `93d467…2ad07`への一致を確認して別名保存した。前回binaryも`72fc292…2afa5`の同じbytesで保持し、現在のSource／binaryへ旧結果を付け替えない。

続くread-only診断は、現在の自作三fileだけの五field・属性・ACL・全known bytesとchecked-closeを確認した。195ms、Native／Node Exit 0、閉packet解析と現在Oracleがともに成立。第一／第二名の五fieldと属性32は一致し、衝突先は別実体だった。Nodeの入力前後観測も一致、fixtureは保持中である。この結果を過去のNTSTATUS、保持中変更拒否、保存試験r1または清掃成功へ遡及しない。原記録`readback-r1.json`（SHA-256 `e3014298475014997fe66e547abeca8b90b66b8ad54c799c75b6c7d4c40c2b95`）には34入力の前後一致、静的先行、exact entry／cwd／UTC／実返却を保存した。全推移的依存・環境全体の固定ではない。

次の自己生成第一stageだけの一回診断では、読取りで取得した現在Identity・bytes・ACLをfresh照合して保持し、write-open／DELETE-open／remove／非置換renameを個別に観測する。改名先は同じ自作親の固定leafを直接不存在確認し、`MoveFileExW`のflags0を使って既存先置換・別volume copy・再起動予約を禁止する。[Microsoftのmove契約](https://learn.microsoft.com/en-us/windows/win32/api/winbase/nf-winbase-movefileexw)に照合済みである。期待外成功・不明・32以外の拒否では後続要求を止め、成功時のLastErrorを読まない。取得済handleのclose結果と最初の失敗を両方保持して終端packetを返し、復元・再試行・清掃をしない。Nodeは後段再観測が不明でも取得済packetを失わない。

Catalog全数照合とSymbol Graphの直接確認は、入口呼出しの診断誤りを是正した後、Failure／Finding 0だった。二つの初回誤呼出しも保持し、製品修正や過去結果への補完にはしていない。全保存部品、全Recoveryと品質件数は未成立のままである。

第一stageの一回保持診断は152ms、Native／Node Exit 0だった。write-open、DELETE-open、remove、非置換renameの四要求がすべて失敗・error32であり、予想外のFilesystem Effectは発行されなかった。取得したhandleと親chainの明示closeは確認済み、fixtureは保持、改名先は直接不存在、Nodeの11観測入力と指定38入力の前後Hashは一致した。型・Formatter／Lint・Rust no-runを先に通した。最終実行前には本文だけの診断計画追記があり、その前後のSourceとToolは同じだった。

原記録`mutation-r1.json`（SHA-256 `29ca14986da07f432e5792edfcd2f31bb92212f0ededceef0fba7d114b8f8a4f`）を旧二記録とは別に保持した。使用Source `081932…c2a1`、binary `41cef7…13157`も同じbytesで別名保存した。保存場所と保持・清掃条件は前掲のRepository-local検証Directoryと同じであり、参照中の診断記録を回復Authorityにしない。

この診断は現在の第一stageだけを対象にする。初回のRust renameとはAPIが異なり、公開名の拒否、初回の停止箇所、衝突・過大入力の全Oracle、fixture清掃または保存部品全体のPassは証明していない。初回失敗は未特定のまま残し、個別の段階と終端を返す検証搬送へ補強してから、別の自己生成fixtureを一回だけ確認する。実在三Root、Docker、Provider、署名済みRuntimeと全体品質は変更しない。

### 新しい全局所試験r2の計画

同梱Rust 1.94.1の一次Source `std/sys/fs/windows.rs`の1311〜1362行を読取り、`fs::rename`がREPLACE指定と、条件によるDELETE open／POSIX fallbackを使うことを確認した。後段openがsharing violationで失敗しても、先行ACCESS_DENIEDを返す経路がある。Source HTMLのSHA-256は`ca5a5335a113f912427edc615cbc876384b7a9570d25c055f3b7e2e4b19e2034`。これは原「必ず32」という期待が契約に対して強すぎる可能性の根拠であり、原r1が実際にその経路で失敗した証拠ではない。

読取り専用の着手前整合で、r2は自己生成`fixture-r2`と専用runに固定し、stage／公開名の両方を同じguard保持中に非置換の四APIで反証する案を確認した。production内部部品は不変とし、既存先衝突、空・過大・不正参照の作成前拒否、全明示close、fresh実体／全bytes照合と四file・空Directoryの限定清掃を維持する。原r1のSource／binary／結果／残存には触れない。

段階、OS error、個別close結果、予想外変更および清掃要求数を`catch_unwind`の外に保持し、失敗でも閉packetへ搬送する。panic本文は搬送しない。失敗時の総合closeは未確認としてnullにするが、既知の個別結果は消さない。清掃途中失敗を「全fixture保持」や「清掃未発行」に戻さず、現在の明示不存在／残存／観測不能を別に返す。失敗以降は追加清掃・復元・再試行0。abort／timeout／packet欠落はcatch成功にせずNode側で未確認とする。静的確認後に新しい固定binaryを一回だけ実行する。

### r2で特定した公開名側の保護不足

新しい全局所試験r2は174ms、Native Exit 101／Node Exit 2で停止した。閉packetの解析は成立し、停止段階は`public_delete_open`、OS errorはnull、予想外に取得できたDELETE handleの明示closeはtrueだった。第一stageの四拒否と公開名のwrite-open拒否までは進んだが、公開名のDELETE accessを拒否できなかった。削除・改名の要求はこの段階では発行しておらず、予想外の変更0、清掃発行数0、自作`fixture-r2`は残存。総合closeはnullのまま保持し、既知の六個別close結果を失っていない。

原記録`run-r2.json`（SHA-256 `63da139c7cb50a3d294c1bb79f49e889c4a3546d5561f27b550ff6101d56581a`）へ、静的先行、41入力の前後一致、固定cwd／UTC／実返却を保存した。Source `f291c7…0462`、binary `4ef4d8…4eaa`も別名保存した。r1、readback、mutationの原記録と元fixtureは不変保持している。r2失敗を原r1の特定原因へ遡及せず、DELETE accessの取得を実削除成立に読み替えない。

この結果は、保存元のhandle一件だけから追加公開名の削除用access拒否まで推定できない反例である。全保存・公開OracleはFailのままであり、新しいfixtureの再実行・追加清掃を止め、公開名保護の再設計へ戻す。現在の内部部品は本番未接続で、実Root／marker、Docker、Provider、署名済みRuntimeの変更は0。実Task停止Gateは維持する。

### 公開名guardによるr3の是正計画

同じCHG内で、公開名には追加のREAD／READ_CONTROL guardを取得して保持する。DELETE accessは追加せず、shareREAD／WRITEで元writerとの互換を保ち、DELETE shareを禁止する。元stage guardも保持して内容を守る。取得済みの公開名guardについて原stageの五field・属性・ACL・全bytesをfresh照合し、両名の再読取り後だけ`link_verified`を立てる。要求済み、guard取得済みと照合済みを別に保持し、公開名guard→stageの個別closeと総合結果を残す。

取得前の候補公開gapを名前の連続保護へ読み替えない。取得不能・消失・差替え・観測不能は同じreceiptに残し、Root／marker処置0で停止する。固定版監査ではない読取り専用の計画確認で、最小READ guard案はこの条件付きで採用可能だった。実装中に確認対象Sourceは変わっており、その確認の前後Hash一致は主張しない。r2の実測結論は保存済みSource／binary／原記録だけに限定する。

新しい自己生成`fixture-r3`を専用run／Ownerへ固定し、静的確認後に両名の四反証、非置換衝突、過大入力・不正参照、guardの個別終端と限定清掃を一回確認する。r1／r2残存と記録は不変保持する。成功時の両名保護はこの実測までOPENであり、公開guard取得前の敵対的差替え、別Process、caller再入場、実Recoveryおよび全体品質の成立とは別に扱う。

### r3の局所確認結果

r3は153ms、Native／Node Exit 0、閉packet解析と全局所Oracleが成立した。8192bytesの保存・flush・非置換公開、追加公開名guardの実体・ACL・全bytes照合、stage／公開名の両方でwrite-open／DELETE-open／remove／非置換renameの拒否、既存先衝突と旧bytes不変、空／8193bytes／不正参照の作成前拒否、各guardの個別close、fresh実体／bytes照合後の四自作fileと空Directoryの清掃、終了後の直接不存在を確認した。清掃要求数は5、予想外変更0。個別closeの記録には同じguardの再確認と読取りhandleも含み、その件数を実資源数へ読み替えない。

Rust Formatter／Clippy、Node Ownerの型・Formatter／Lintを先行し、新しい固定binaryを一回だけ実行した。45入力のHashはその前後とNative既存試験後で一致した。Sourceは`76022c38c7859aceed0f15778109ddf5f495f7da6342b63f37a3c27ff8599991`、binaryは`50677fd56a710b58001420c945c53c31b218567ec205be6ddb7aedd32d9b8d0a`。Native既定回帰は28件Pass、Fail 0、明示ignored 13件、0.34秒だった。今回の専用fixtureは別実行であり、ignoredを実施済みに数えない。Docker実操作、Provider、署名Runtime、全E2Eは実行していない。

八file指定のscoped Checkerは24853ms、Exit 0、Finding／Warning 0。展開84Markdown、9079リンク・497anchorを確認した。実行入力の本記録Hashは`5c00c7c3098b07ef3716e2967e9b51220a4c53ca79c086c580b55dbcb3ceffea`であり、結果追記後の本文をその入力へ遡及しない。原記録`run-r3.json`（SHA-256 `53b3707f52196ac7adc650186c30082a3826e5731d79ab4957b88783aae0f423`）は旧Fail記録とは別に保持する。実cwd、UTC、実返却、主要Tool／設定を識別したが、全推移的依存・環境全体の固定ではない。

**現在状態: Native内部保存部品の静的・局所自己確認済み。新固定八fileの三観点独立確認待ち。** 原r1の原因不明とr2のFailを保持し、過去へPassを補完しない。今回の成立は成功照合後・二guard保持中の同一Process反証に限る。公開名guard取得前の敵対的差替え、別Process、初期化途中、stageの連続保護付き除去、caller耐久参照・容量、再入場、全consumer、旧三Root、実Recovery／全E2Eと品質件数は未成立である。

### 保存部品の初回独立確認と検証記録の是正

固定八fileを三観点で確認した初回独立判定はFailだった。技術と51文書／追跡は限定Pass、品質／53直接影響で次の二不足を検出した。Source不具合の検出はなく、r3の153ms局所結果、28件の既存Passと13件ignored、旧失敗および未接続境界は維持した。開始・終了HEADは`e149991815cc22ff55fa749d652f6cd624434fce`、八対象と六原記録のHashは前後一致した。

| 指摘 | 原因と是正 | 変更しない範囲 |
|---|---|---|
| TP-Q01 | 後段Checkerの`final-checks.json`には実入力・待機返却・外側時点が不足した。旧記録を保持し、一時storeに残った実入力と返却を別記録へ移した。旧完了直後UTCは未保存と明示し、内部時計から復元しない。新しい読取り専用Checkerには実入力、cwd、環境設定、開始・終了時計、初回および全待機返却、八対象とHEADの前後照合を結合した。 | 旧記録、Source、Oracle、品質件数と停止Gate。 |
| TP-Q02 | `cargo fmt`／`cargo clippy`の実入口を前後入力へ含めていなかった。指定toolchainの`cargo-fmt.exe`／`cargo-clippy.exe`と既存検証器の解決先・Hashを含む47入力を、Formatter／Clippyの新しい実入力・cwd・UTC・完結返却へ結合した。 | 旧r3の入力と153ms実測、fixture、既存残存および全推移的依存の未固定。 |

三観点の全結果を統合し、上の一括是正方針を確認者へ再提示して着手可・追加競合なしを確認してから実施した。新しいFormatter／ClippyはExit 0、読取り専用CheckerもExit 0、Finding／Warning 0だった。完全な開始・終了記録を持つ後段Checkerは22419ms、展開84Markdown・9079リンク・497anchor。開始前と完了後のHEADおよび47入力Hashは一致し、r3 Source `76022c38c7859aceed0f15778109ddf5f495f7da6342b63f37a3c27ff8599991`は不変だった。Native fixture、既存Native回帰、Docker、Provider、実三Root、署名Runtimeは再実行・変更していない。

旧`final-checks.json`はSHA-256 `8a03c9f90aacd066e88c8dfb42b6bc4c4419db9ab17116cb0ccf1c6ac60c5f64`のまま保持する。旧実入力の別保存`legacy-final-invocation.json`は`b5f97c5a7f131af438258d5a6edf641990bd0fb40192f830db4cc40167f2cfcc`、新しい静的・Checker記録`new-static-checks.json`は`1d827a52a8a95d670fb33871d068aa2d042fbfd54d99595ae8e8088c85754892`。いずれも前掲Repository-local検証Directory内に保持し、旧入力の不足を新結果で遡及補完しない。新実行の本記録入力Hashは`cf0f2ce6b5a8da9cd11b4967d13fbb76de6959babf0999d4ef3b748bd3d273cb`であり、本節追記後の確認版とは別である。

現在は二指摘に対する新自己確認済みであり、新固定八fileの三観点再確認待ちである。解消・限定Pass・完了Checklistへ先行して書き戻さず、本番接続、公開前競合、別Process、stage連続保護付き除去、耐久参照、容量、初期化、再入場、旧三Root、実Recoveryと全体品質のOPENを維持する。

### 保存部品の新固定候補の独立再確認結果

新固定八fileの技術、51文書／追跡、品質／53直接影響の全結果を統合し、いずれも限定Pass、新Finding 0、TP-Q01／TP-Q02はResolvedだった。開始・終了HEADは`e149991815cc22ff55fa749d652f6cd624434fce`、八対象・旧六原記録・新二原記録のHashはすべて指定値と一致し、不変だった。確認版の本記録は`151131e866cd9baf5c9f486f93ad332cd0e82d52afc3254954885f357fa104c9`、QAは`95757f474cf695debf26aa6b258b1ff5654981d539a7e2b9a8c610ffad418ffd`。他六対象は前掲の新実行記録と同じであり、Sourceは`76022c38c7859aceed0f15778109ddf5f495f7da6342b63f37a3c27ff8599991`のままだった。

確認者は同じreceipt、Pending時のmemory／handle寿命、両guard相関、非置換公開・個別close、旧Fail保持、実入口と前後識別、完全Checker搬送および未接続境界を照合した。編集・再実行・外部／実資源操作はしていない。旧完了直後UTCを補完せず、新しい別実行によって記録不足を処置した。本節・該当Checklist一行、および現在形の確認待ちを実行時履歴と限定結果参照へ直すQAの指定一文だけを書き戻す方針を、三観点で追加確認し、許容・新Finding 0だった。

限定Passはこの私有部品と局所結果・追跡の確認に限る。初回Fail、r1原因不明、旧入力不足、公開guard取得前の競合、別Process、stage連続保護付き除去、caller耐久接続・容量、初期化・再入場、全consumer、旧三Root、実Recovery／全E2Eおよび全体品質のOPENは不変である。Source、登録、原記録、品質件数、署名、Authorityと停止Gateを変更せず、新しい人間判断は不要である。

## 保護を維持した準備名の収束候補

**次の目的は、保存元のwriterを閉じずに準備名を直接不存在へ収束できるか確認することである。** 基準Commitは`f61706558ea3a7fc0cd54cde85dce029461aeca2`。前単位のSource `76022c38c7859aceed0f15778109ddf5f495f7da6342b63f37a3c27ff8599991`とbinary `50677fd56a710b58001420c945c53c31b218567ec205be6ddb7aedd32d9b8d0a`を同じbytesで別名保持した。前単位の限定Pass・実測を次方式へ付け替えない。

| 候補 | 判断と保持条件 |
|---|---|
| stage保持handleから通常disposition | 要求受理と名前消失を区別する。非POSIXでは全handleの終了、POSIXでは削除handleの終了を伴う一次記述だけから、writer保持中のstage除去を保証できないため今回採用しない。 |
| 同じhandleで非置換rename | writerを閉じずに準備名を公開名へ移せれば二名状態を避けられる。試験内の候補として一回反証する。改名後の名前保護、直接不存在、実体・bytesと衝突拒否はまだ未成立。 |
| 別guardへのhandoff | 現public guardはWRITE共有ありで、元writerを閉じた後のbytes保護を単独では担えない。不共有WRITEの新guardは生存するwriterと衝突し得る。close／reopenやOwner ACLへの置換で保護の空白を作らない。 |

読取り専用の着手前確認で、rename後の追加noDELETE共有guardは元DELETE accessと衝突し得るため必須にしない計画へ整合した。元RW／DELETE・shareREADの同じhandleを保持したまま、SDKの`FILE_RENAME_INFORMATION`／class10、`ReplaceIfExists=false`、RootDirectory NULL、同Directoryの単純leafで一回要求する。[Microsoftのrename構造契約](https://learn.microsoft.com/en-us/windows-hardware/drivers/ddi/ntifs/ns-ntifs-_file_rename_information)と[NtSetInformationFile契約](https://learn.microsoft.com/en-us/windows-hardware/drivers/ddi/ntifs/nf-ntifs-ntsetinformationfile)を入口・必要access・ABIの根拠とするが、開いたfileの実際の共有意味は試験で別に反証する。Ex／POSIX／force／bypass／既存先置換は使わない。

変更は`windows_terminal.rs`のtest内候補と本記録だけに限定し、現在のproduction保存部品・公開契約は変更しない。自己生成`fixture-rename-r1`と専用Node Ownerを固定する。正常は元handle保持中のstage直接不存在、公開名の五field・ACL・全8192bytes、元handleだけによるWRITE／DELETE open・remove・非置換rename拒否を確認する。衝突例では別stageへの要求一回だけを行い、既存先と元stageの実体・bytesが維持されることを確認する。

要求発行、NTSTATUS、直接不存在、保持中拒否、個別close、清掃要求数と現在の残存／不明をcatchの外へ保持する。公開名readerはshareREAD／WRITE／DELETEで元writerとの互換を保つ。PendingではABI memory・IO_STATUS・handleを実終端まで保持する。失敗・予想外成功・観測不能では後続mutation・復元・清掃を止め、現在の同じ参照と既発行Effectを失わない。正常Oracleと全明示close後だけ、自作三fileと空Directoryをfresh照合し非再帰清掃・直接不存在を確認する。Nodeの15秒観測上限をOS-I/O取消完了の保証にしない。

静的確認を先行し、新しい固定binaryのexact test一件を一回だけ実行する。技術、51文書／追跡、品質／53直接影響を新固定候補で独立確認する。現在の限定候補を本番へ採用せず、公開前競合、別Process、Process喪失、caller耐久参照・容量、初期化・再入場、全consumer、旧三Root非使用と実処置、全E2EはOPENを維持する。実Process停止、実三件削除、Docker再起動、Provider、署名とReleaseは今回実行しない。

### 同じhandleの改名候補の局所結果

自己生成`fixture-rename-r1`へのexact test一件を一回実行し、131ms、Native／Node Exit 0だった。正常renameのNTSTATUSは0、既存先衝突は`STATUS_OBJECT_NAME_COLLISION`（-1073741771）。元writerを保持中にstage名の直接不存在、公開名のfresh五field・ACL・全8192bytes、WRITE／DELETE open・remove・非置換renameの拒否を確認した。衝突例では旧先と新stageの実体・bytesが不変だった。個別close後のfresh照合と自作三file・空Directoryの非再帰清掃も成立し、清掃要求数4、終了後直接不存在、予想外変更0だった。22個別close記録には一時readerと再観測が含まれ、実資源数を表さない。

Rust Formatter／ClippyとNode Ownerの型・Formatter／Lintを先行した。最初のClippyは試験内closureの不要括弧で失敗し、括弧だけを是正後にFormatter／Clippy Exit 0を確認してからbuild・実測へ進んだ。Sourceは`80979d32db8f2e410a03ad0daa9a513400f0d90ca15f1cf5ed6b1f94f423d7f6`、binaryは`372b5bc1198ff72c5b91dc7c2cf2de3f0476ba9f9bd6cc4b0a8cbc16f61a66fe`、Node Ownerは`9d01c431c537f20207011b4eadc10e34eb986dd3b012d2e8e7cb331da80e42a1`。開始前・終了後・既定Native回帰後のHEADと51主要入力Hashは一致した。これは全推移的依存・環境全体の固定ではない。

同じtest binaryの既定Native回帰は28件Pass、Fail 0、明示ignored 14件、0.29秒。新しい専用fixtureは別実行であり、ignoredを全実施済みに数えない。読取り専用の実入口解決先、実入力・cwd・設定、外側UTCと完結返却も結合し、原記録`rename-run-r1.json`を前掲Repository-local検証Directoryへ保存した（SHA-256 `90985bac6924196425f6c90b6cb9ac7a555d793c0f25fbbe21376d7eb49ce9dd`）。旧Source／binary／原記録と旧自作残存を変更していない。

現在は**試験内候補の局所自己確認済み、新固定二fileの三観点独立確認待ち**である。現在のproduction保存方式はhardlinkのまま変更していない。renameへの本番採用、改名途中の観測不能／Process喪失、cold再入場、caller耐久参照・容量、初期化、全consumer、旧三Root非使用と実処置、実Recovery／全E2Eおよび全体品質は未成立である。今回の局所結果をこれらの完成へ昇格しない。

### 改名候補の新固定版の独立確認結果

新固定二fileを技術、51文書／追跡、品質／53直接影響の三必須観点で独立確認し、全結果は限定Pass、Finding 0だった。開始・終了HEADは`f61706558ea3a7fc0cd54cde85dce029461aeca2`で一致し、二対象、専用Owner、新binary、原記録と保存済み旧r3 Source／binaryの指定Hashも一致・不変だった。前回Passは流用していない。編集・fixture再実行・実資源操作はなく、確信度は高である。

実測入力の本記録は`5085701e80c13e12457c5c288d24bef9f2ab443cdb07f368b2da82bb80b55bb4`、Checker／レビュー入力版は`4ddddc9997742646ae9d84c637ba06366b76f5197da32589910001be48bdb650`であり、結果追記後の版をこれらへ遡及しない。二file指定のCheckerは23946ms、Exit 0、Finding／Warning 0、実範囲7Markdown・425リンク・47anchorだった。実入力・cwd・設定、外側UTC、初回返却・二待機返却と完了後51入力／HEAD一致を`rename-checker-r1.json`（SHA-256 `858f88a1542070ad10b245d6c2607fd316962d381f65b62aab125867bcf6ebd4`）へ別保存した。実測原記録`rename-run-r1.json`（`90985bac6924196425f6c90b6cb9ac7a555d793c0f25fbbe21376d7eb49ce9dd`）は不変保持する。

書戻しは本節とChecklist一行に限定し、三観点で許容を確認した。Source、productionのhardlink契約、QA件数、旧記録、署名、Authorityと実Task停止Gateは変更しない。限定Passは同一Process・自己生成対象・同writer保持中の候補だけに適用し、本番採用、別Process、Process喪失、cold再入場、caller耐久接続・容量、初期化、全consumer、旧三Root非使用／実処置、実Recovery／全E2EのOPENは維持する。現在、新しい人間判断は不要である。

## 私有保存部品への改名方式の反映計画

基準は`a596ac82d611db6aa049fb7c2abfd03079cd377c`。次単位は私有`publish`を同handleのclass10・非置換renameへ置換する実装変更であり、公開Recoveryへの採用ではない。着手前の読取り専用確認で、下表の補強を条件に着手可だった。親はplatform／coordinator Details、QAの限定ITと前単位のSource・実測へ照合し、旧Capabilityの完全write／flush／readback、非置換、保持中のbytes／名保護、部分receiptと明示closeを新方式へ対応付けた。旧二名への再入場は方式・producer版との整合が未成立のため移行しない。

| 編集の一次対象 | 予定処置と保持条件 |
|---|---|
| Native私有保存部品 | rename要求済み、最終NTSTATUS、stage不存在確認、public相関確認、reader／writer個別closeを分ける。元writerを唯一の保護Ownerとして保持し、追加public guardを除去する。 |
| 新full fixtureと専用Owner | 候補helperでなくpublish本体を直接通す。正常、衝突、処置前拒否、重複要求拒否と部分receiptを新fresh対象・新閉packetへ結合する。 |
| platform／coordinator Details | 方式の現行責務と本番未接続を整合させる。stage不存在を観測時点の事実とし、後続stage新規作成禁止やclose後不変性にしない。 |
| QAの限定検証説明 | 保持中stage不存在・public照合、三file清掃を新方式へ接続する。旧hardlink結果は履歴として保持し、Local Item全義務と品質件数を更新しない。 |
| 本記録 | 静的先行、新固定binary一回、実入力／返却／前後識別、新三観点独立確認を記録する。旧Source／binary／原記録・旧fixtureは不変。 |

rename後の観測不能では、成立可能性と同じ参照・発行済みEffectを保持し、再rename、別参照、復元、清掃とRoot処置を止める。close不明は単調保持し、Dropを成功Oracleにしない。Process喪失ではstageのみ／publicのみ／未知を推測せず、caller耐久参照・cold再入場をOPENのまま維持する。Cargo版・feature、codec、参照形式、公開dispatch、OS namespace、容量、全consumer、旧三Root、Docker／Provider／署名、Authorityと停止Gateは変更しない。

技術、51文書／追跡、品質／53直接影響の新固定集合を完成後に独立確認する。専門安全性・lifecycleをこの三観点へ含めるが、公開Capabilityや準拠基準を新設しないため52準拠・全Release監査は今回の完成主張へ使用しない。必要な実Recovery／全E2Eは後段の未成立条件として維持する。

### 私有publish本体の新方式の局所結果

新full fixture-r4は候補helperでなく現在のpublish本体を一回通し、182ms、Native／Node Exit 0だった。元writer保持中の非置換rename、stage直接不存在、publicの五field・属性・ACL・全8192bytes、四変更拒否、重複publish拒否、既存先衝突と旧先／新stageの実体・bytes不変を確認した。不正参照・空／8193bytesは作成前に拒否された。正常receiptはrename要求済み・最終NTSTATUS 0・stage不存在・public相関・reader／writer終了を別々に保持し、衝突receiptは要求済み・NTSTATUS -1073741771・public未確認・reader未取得・writer終了を保持した。既発行作成／write／flushをEffect 0へ畳んでいない。

27個別close記録にはreaderと再確認を含み、実資源数にしない。全通常Oracle・明示close後だけ、自作三fileと空Directoryをfresh照合して非再帰清掃し、清掃要求数4・終了後直接不存在・予想外変更0を確認した。Nodeの15秒観測上限をOS-I/O取消または全資源終端の保証にはしていない。

静的先行のFormatter／Clippy、Node Ownerの型・Formatter／Lintは全てExit 0。同じ新binaryの既定Native回帰は28Pass・Fail 0・明示ignored 14件、0.25秒だった。専用fixtureの別実行をignored全件の実施へ数えない。Sourceは`5b933c34392bb58f5a282b112a596b6a4c711bc6b0cb31c7456ddddcbbc77273`、binaryは`fe2c702db2fc7a579e3a1138918440fafb993dcc2ce4da305db836daefc5ddf7`、Ownerは`66b1b817bb22843a0e866f9203a0d752527081a100721bd516741f54dd3b1385`。実測前後・既定回帰後のHEADと57主要入力は一致した。全依存・環境全体の固定ではない。

原記録`run-r4.json`（SHA-256 `3a7ff8d83d6a3af8670159660d8725f7ecc376c67625d4615f7b72c8673163b4`）へ実入力、cwd・設定、外側UTC、実返却・実入口と前後識別を保存した。前単位の試験内候補Source／binaryも別名で不変保存し、旧hardlinkのSource／binary／Fail・Pass原記録と残存は変更していない。現在は新固定五fileの三観点独立確認待ちであり、この自己確認を本番接続、実Recovery、旧三Root清掃またはLocal Item全義務／品質件数の完成へ昇格しない。

### 私有publish本体の新固定版の独立確認結果

新固定五fileを技術、51文書／追跡、品質／53直接影響の三必須観点で独立確認し、全結果は限定Pass、Finding 0だった。開始・終了HEADは`a596ac82d611db6aa049fb7c2abfd03079cd377c`で一致し、五対象、専用Owner、新binary、実測・Checker原記録、保存済み前単位Source／binaryと旧失敗記録の指定Hashも一致・不変だった。前単位のPassは流用していない。確認者は編集、fixture再実行、外部・実資源操作を行っておらず、確信度は高である。

実測入力の本記録は`3fb482d3f750ba9683a429742b5ef05835cfd0a30f538b37b15899ed64340ce1`、Checker／レビュー入力版は`609b1995f9e34132067477337eefa482df859ab1e113fa8d6aeccb46443db2b7`であり、本節追記後の版をこれらへ遡及しない。五file指定のCheckerは23419ms、Exit 0、Finding／Warning 0、実検査104Markdown・9959リンク・587anchorだった。展開範囲の表示一覧は`expanded_scope_truncated:true`を保持し、その一覧を全件表示や全Source Headerの機械保証へ読み替えない。実入力、cwd・設定、外側UTC、初回・一待機の完結返却および完了後57入力／HEAD一致を`checker-r4.json`（SHA-256 `bffa4282bb09621a379f48a1c99059bbb389dcda44ecc47846643e4221d206a2`）へ保存した。前掲`run-r4.json`は不変保持する。

三観点は、同writerの非置換rename、Pending時の寿命、要求・最終NTSTATUS・stage不存在・public相関・個別closeの分離、衝突と重複拒否、部分receiptの単調保持、旧二名方式の自動移行禁止、実測と未接続境界を照合した。書戻しは本節とChecklist一行だけに限定し、三観点で許容を確認した。他四file、契約、QA件数、旧記録、署名、Authorityと実Task停止Gateは変更しない。

限定Passは私有保存部品と同一Processの局所結果・記録に限る。全失敗枝の故障注入、公開dispatch、OS namespace、caller耐久接続・容量、Process喪失／cold再入場、全consumer、旧三Rootの非使用／実処置、実Recovery／全E2Eは未成立のままである。現在、追加の人間判断は不要である。

## 別Process終了後の記録読取りの反映計画

基準は`851cb5b2bb6b2f0d9efb857811ab039edb20e279`。目的は、自己生成記録を保持するProcessの意図的な終了後、caller既知の同じ参照・五field／属性Identity・期待bytesへfreshに再結合できることを確認することである。突然のcrash、rename途中、OS喪失、callerの耐久参照、公開Recoveryと旧三Root処置は対象外であり未成立を維持する。

読取り専用の着手前確認で、技術・lifecycle、文書OwnerおよびQA直接影響を照合して着手可だった。私有readerは両名観測→唯一名のguard取得→Identity／属性／owner／protected二ACE／全bytes→他名の直接不存在→親のfresh再検証を行う。Prepared／Publishedは今回のstageだけ／publicだけという観測であり、過去のwrite／flush／rename／close receiptを復元しない。取得後失敗にも同じ参照、今回open要求／取得と個別close確認を残す。

| 一次編集対象 | 予定処置・反証と非変更範囲 |
|---|---|
| Native私有reader | OPEN_EXISTING・READ／READ_CONTROL・shareREADだけで保持し、write／rename／removeは行わない。両名、両なし、不一致、Directoryと観測不能を拒否し、取得後失敗では明示closeを記録する。 |
| fresh fixture・限定Worker | 親の全record／Directory明示close後だけ、固定test binaryのexact Workerを所有Jobで起動する。Preparedはreader保持中exit 71、Publishedはfixture専用writer再取得・publish本体の照合後に保持中exit 72。役割別exitとProcess／Job終端の両方を必要とし、timeout後の回収を成功にしない。 |
| 判定のモデル反証 | 実readerが使うmetadata解釈と単調close保持を純粋判定へ分け、不明の不存在化とfalse→true上書きを反証する。これはOS実故障や実handle終端の観測ではない。 |
| 二Details・QA・本記録とFile Relation | platformが保持読取り、Coordinatorが参照／lineage／Authority、QAがERB-IT-001／002および003の限定区間を所有する。試験File登録は既存entryを使用するが、Case／HelperのTrace和集合とSymbolのLocal Item Relationを別に照合し、003を接続する。Local Item全義務・件数を更新しない。 |

異常・予想外mutation・close不明・Worker不明では次Worker、復元と自作清掃を止める。通常Oracleと明示close後だけ、fresh実体・bytesを確認した自作fileと空Directoryを非再帰処置し、直接不存在を観測する。Node観測期限を硬いOS-I/O期限にしない。ACL改変、reparse、OS観測失敗、CloseHandle実失敗はこの実測では未観測であり、Source接続とモデル判定を実OS拒否へ昇格しない。

Formatter／Clippy、専用Ownerの型・Formatter／Lintを先行し、新固定binaryを一回だけ実行する。実入力、外側時計、完結返却と主要入力の前後識別を保存する。完成後は同じ固定五fileで技術、51文書／追跡、品質／53直接影響を独立確認する。公開Capability、準拠基準または配布有効化を変更しないため、52準拠／Release監査をこの内部結果の判定へ使用しない。OwnedChild、公開dispatch、codec、容量、署名、旧fixture／原記録、旧三Root、Docker／Provider、Authorityと停止Gateは不変である。

### 別Process終了後の局所観測結果（cold-r1）

2026-10-03の自己生成fixtureで限定観測を完了した。本番Recovery、caller耐久再入場、旧三領域の回収および全体E2Eは未成立である。独立確認は、この新しい候補と結果に対して別途行う。

| 観点 | 結果と根拠 |
|---|---|
| 実行前検査 | Rust Formatter／Clippy、専用OwnerのTypeScript型検査／Biomeは全てexit 0。新しい依存を追加していない。 |
| 固定実行 | 基準HEAD `851cb5b2`。Native binary SHA-256 `9da41277bcc5b82043bb90d3d8edf41489877a6a5863d0dbfc4d0da061db37f4`、Source `770b7b162fa45fb5b45806e0609c5d0288b70bc3c3d15f8eb318e3e027694fe9`、Owner `2bb72097ed7a7f633f6822eb5eccc8ecf1f0c5d2f31e3bedb033bf50b10aecf7`。cold-r1の新fixtureだけをNativeで一回実行した。 |
| 前段停止 | 最初のOwner起動はbinary引数の区切り表現不一致を事前検査で拒否した。Native／Workerは未起動。実行入力の表現だけを修正し、61主要入力とHEADの不変を確認した。拒否記録を成功結果へ上書きせず保持した。 |
| 意図的Process終了 | prepared reader保持中はexit 71、published writer保持中はexit 72。親が同じexact Process／Jobの終端を確認した。子の明示close成功や突然crashを主張しない。 |
| fresh読取り | 同じ既知参照・五field／属性・protected二ACE／owner・8192bytesを両形状で照合。保持中のwrite／delete-open、removeと非置換renameはerror32で拒否。 |
| 拒否 | 二名、両不存在、bytes／Identity不一致とDirectoryを拒否。取得前と取得後closeを分け、同じ参照を保持した。 |
| 局所判定モデル | 実readerが使うmetadata判定でNotFoundだけを不存在にし、その他をunknownとした。close初回falseを後続trueで上書きしない。合成入力であり、OS実故障注入ではない。 |
| 自己生成清掃 | 33件の個別close観測行は全てtrue。重複・観測handleを含む行数であり、全OS資源件数ではない。通常oracleと全既知close・Worker終端の後、四fileと二空Directoryへ非再帰処置6件を発行。直接不存在、予想外変更0。実残存三件には触れていない。 |
| 時間・返却 | Owner計測235ms、Node／Native exit 0、専用test 1件成功。packet解析、Native相関とtest件数を共同確認した。硬いOS I/O期限を主張しない。 |
| 回帰と不変範囲 | Native通常回帰28件成功・0失敗・16 ignored、0.27s。局所実行と回帰の前後で61主要入力とHEAD不変。全推移依存・環境不変の証明ではない。旧fixture・旧結果・署名Runtime・QA件数・停止Gateは変更していない。 |
| 保存記録 | Repository-local `.crdd/verification/chg-000082-terminal-publication-261003/cold-run-r1.json`、SHA-256 `681095519e16d34cb120985d29ef7dfbe25832996bdaecfaac42ded0d42bd9b6`。実コマンド、UTC前後、返却、入出力Hash、前段拒否、回帰と前後比較を保持した。前版binaryを別名へ保持し、SourceのLF正規化控えを元byte Hashと同一視していない。 |

ACL異常、reparse、OS metadata失敗、実CloseHandle失敗、rename途中、初期化途中、caller再起動接続、容量と固定OS保存境界は未確認のまま保持する。この局所成立だけで追加Taskを再開しない。

### cold-r1の独立指摘と是正計画

固定五file（本記録 `f7b1284fd33eff91a0834cb225cdfa54c60ccbd7f119682854dca225c480e112`）の三必須観点を完了した。技術は限定Pass、51文書／追跡と品質／53直接影響はFailだった。全結果を統合し、次の是正計画を三観点へ再提示して着手可を確認した。これは指摘解消または新候補のPassではない。

| 指摘 | 原因・処置 | 非変更範囲・確認 |
|---|---|---|
| COLD-Q01 | 既存File登録をCase／Helperの新しいTrace和集合の十分条件と扱った。`platform-access.test.integration.windows-terminal`の`localTestIds`へ`ERB-IT-003`一値を追加し、File登録と和集合照合を編集計画・Checklistで分ける。 | 既存ID／qaIds／verifies／義務／品質件数／観測状態を維持。Catalogは既存File entryで足りる。六fileの新固定集合で関係を再確認する。 |
| COLD-Q02 | 旧保存記録に実行入力の一部・時計・全待機搬送が欠けた。旧二rawを不変保持し、実履歴から残る情報だけを別補足へ保存する。未明示defaultや未保存時点は`not_saved`とし推定しない。 | 235msの旧実測と欠測を保持。Native fixtureは再実行しない。静的確認・Checkerだけを、明示cwd、実Tool input全体、前後時計、初回と全wait、HEAD／主要入力の前後を一体保存して再確認する。 |

Source／Oracle、旧fixture、署名Runtime、Authority、停止Gateと実残存三件は不変である。Clippy生成物は既存Repository-local領域内に限る。一般化可能な原因は、試験Fileの存在だけで新Traceを接続済みと扱ったことと、Tool inputを手作業で抜粋して返却を上書きしたことだった。既存Trace規則は変更せず和集合照合を追加し、検証記録は実入力object全体と全返却を追記保存する。

### cold-r1の是正後確認

新しいNative実測は発行していない。Source／binary／Oracleを維持してFile Relationを補強し、静的確認・関係照合・Checkerだけを新記録へ保存した。指摘解消の最終判定は新固定六fileの三観点再確認へ渡す。

| 確認 | 是正後の結果・保存範囲 |
|---|---|
| COLD-Q01 | SourceのCase／HelperのERB Trace和集合とFile Relationが001／002／003で一致した。qaIds／verifiesとCatalog既存entryは不変。全Local Item義務や観測件数の成立にはしていない。 |
| COLD-Q02の旧記録 | `cold-run-r1.json`と`cold-checker-r1.json`は旧Hash不変。実Tool call履歴と残存情報だけを`cold-recording-supplement-r1.json`（SHA-256 `6cf0851a8fd598d69516c80d05a2357d7422ff681a536e155c98e8719f2665df`）へ別保存した。明示しなかったdefaultや未保存時計は`not_saved`であり、cwd・時点を推定して補完していない。 |
| 新静的確認 | Formatter／Clippy、専用Ownerの型／Biome、Trace和集合の読取り照合はexit 0。各実入力object、明示cwd、前後時計と返却を保存した。生成物は既存Repository-local領域だけ。 |
| 新Checker | 六file指定、23094ms、exit 0、指摘／警告0、実検査104Markdown・9960リンク・588anchor。展開表示は`expanded_scope_truncated:true`を維持し、全Sourceやignored Ownerの保証にはしない。実入力、明示cwd、初回返却、全3waitの入力／前後時計／返却と完結返却を追記保持した。 |
| 前後識別 | 新静的確認前、Checker直前、完了後で64主要入力とHEADが一致。全推移依存・環境不変の保証ではない。実行入力の本記録は`193a0f54458ea7c597e091a176adffa6f9a180e0006e9a5e813729f1f6ac6393`であり、本節追記版へ遡及しない。 |
| 新原記録 | `cold-remediation-r1.json`、SHA-256 `9eff7355b40fbfbafb7c0f8925d36a36efd0f98d21d5e805f4b8dc263826810c`。新入力と新確認だけを保持し、旧235ms・61入力の局所実測へ付け替えていない。 |

### cold-r1是正後の独立再確認

新固定六fileを技術、51文書／追跡、品質／53直接影響の三必須観点で独立再確認し、全て限定Pass、COLD-Q01／Q02解消・新Finding 0だった。確信度は高である。開始・終了HEADは`851cb5b2bb6b2f0d9efb857811ab039edb20e279`で一致し、六対象、旧二raw、新補足と是正原記録の指定Hashは一致・不変だった。確認者は編集、再実行、外部・実資源操作を行っていない。

入力版の本記録`193a0f54458ea7c597e091a176adffa6f9a180e0006e9a5e813729f1f6ac6393`とレビュー版`33dd44406ce72dc4ab1284ede96c34f056a48d7130e781c1a786a7e2a8047a12`を区別し、本節へ遡及しない。三観点は、File Relationの003一値追加とTrace和集合、旧欠測の`not_saved`、新実入力全体・明示cwd・時計・初回と全3waitの搬送、64主要入力とHEADの前後一致を照合した。Native再実行はなく、旧235ms実測を新記録へ付け替えていない。

書戻しは本節とChecklist一行だけを三観点で許容した。他五file、旧raw、契約、品質件数、署名、Authorityと停止Gateは変更しない。限定Passは私有読取りと自己生成fixture・記録の区間だけであり、本番再入場、caller耐久接続、OS故障、旧三Root、全Recovery／E2Eは未成立のままである。現在、追加の人間判断は不要である。

### 本番同期排他の失敗保持是正（2026-10-03）

基準HEADは`50f3d23fb641802b9f05cba847a2d83629405e7a`。本番への接続確認で、解放前にOwner参照を消すため、一度解放が失敗しても次のcloseではtrueを返す欠落を確認した。再取得null／例外の後にも同じ成功化が可能だった。別Intentではなく、同じCHGの「不明を成功へ畳まない回復責務」の是正とする。

| 経路・範囲 | 今回の処置 |
|---|---|
| 変更分類 | 実装の失敗保持と直接の設計・検証・Relation追随。新しい公開Capability、Authorityやリリース判断は追加しない。 |
| 着手前整合 | 読取り専用の技術／lifecycle・Owner／文書・品質直接影響確認を統合し、着手可。controller内部も同期集約もliteral trueだけを成功とする具体化を採用した。 |
| 実装 | 世代別release一回、解放失敗時Owner保持、再取得失敗の保持、失敗後の作業・取得0、close反復false。正常な新世代と正常close反復は維持する。 |
| 直接利用側 | `docker-recovery-runtime-internal.ts`の同期解放集約がfalse／例外を既存のblocked理由へ搬送する。戻り型と公開理由は維持し、成功化を防ぐ。非同期wrapper移行は混ぜない。 |
| 予定検証 | Formatter→型→Lintを局所試験より先に実行する。PRL-UT-006の同じcore注入試験、既存PRL-IT-013の自己生成排他／Process二件、関係照合とscoped Checkerを行う。 |
| 固定後の確認 | 技術、51文書／Trace、品質／53直接影響の三必須観点を同じ固定候補で独立確認する。全結果を得るまで是正しない。 |
| 今回実行しないもの | 基準・準拠表明は変えないため52準拠監査は非該当。実残存三件、Docker／Provider、署名E2E、全回帰、本番非同期化・耐久caller接続は今回の局所是正から成立を主張しない。 |
| 人間判断 | 今回の限定是正には追加判断不要。既存三件のexact停止・処置承認と、広い未接続経路の採用判断は代替しない。 |

**現在状態:** 是正実装と以下の局所検証を完了した。独立確認は未完了であり、既存の停止Gateを維持する。

| 検証 | 結果・限界 |
|---|---|
| 静的確認 | Formatter・scoped型検査・Lintを試験前に実行した。初回Lintは意図的thenable fixtureを拒否したため、その一行だけへ理由付き抑止を付け、三確認を再実行してexit 0。Lint失敗時には試験を開始していない。 |
| 局所UT | 既存四件と追加四件、計8件成功・0失敗、128.1137ms。解放失敗8組、再取得失敗4組、正常三世代、初回null／例外、集約の非boolean九入力を処置した。件数はCase／fixtureの区分であり、全回復義務のCoverage率ではない。 |
| 既存IT | 自己生成したrandom bindingの排他と子Processだけを使用した二件成功・0失敗、1466.1326ms。同期解放窓前後の他Process取得と、試験所有Process終了後の取得を確認した。実解放失敗注入、全Native終端、実残存三件の非使用を証明しない。 |
| Relation | 既存unit File登録のverifiesへcontroller一値を追加した。PRL-UT-006と二Source IDの実在、公開indexに試験入口がないことを読取り照合した。Catalogの既存File entry、Local Item義務・観測件数は維持した。 |
| Checker | 七fileを指定してexit 0、指摘／警告0、26807ms。実検査108Markdown・9807リンク・494anchor。expanded_scope_truncated:trueとGit-ignored除外を維持し、全実装・ignored原記録の保証にはしない。 |
| 入力識別 | 静的確認前と試験／Checker後に13主要入力とHEADを照合した。途中の差は意図したUTのLint抑止一行のみで、Source・利用側・IT・fixture・Ownerは不変。全推移依存・環境不変は主張しない。 |
| 原記録 | Repository-local `.crdd/verification/chg-000082-lock-settlement-261003/local-r1.json`と`checker-r1.json`に各実入力object、明示cwd、UTC前後、初回返却と全wait、完結返却を保存した。最初のFormatterによる整形は原記録の対象外であり、後続の読取り確認へ付け替えていない。 |

同じcoreの局所注入と既存の正常実境界は区別する。本番の同期consumerはfalseを既存blocked理由へ搬送するが、耐久caller接続、保護済み終端intent、全async利用側移行、旧三領域のexact処置、署名E2Eは未成立のままである。

#### 同期排他r1の独立指摘と是正計画

固定七file（本記録`75a5e51e1d777d23a221b4c202e55cbc5807e0262e2f31ce8ba6a2c901c0dd5b`）の三必須観点を完了した。技術／lifecycleは限定Pass、51文書／Traceと品質／53直接影響はFail、未解決二件だった。全結果を統合し、次の是正計画を三観点へ再提示して着手可を確認した。新候補のPassではない。

| 指摘 | 原因・処置 | 非変更範囲・確認 |
|---|---|---|
| DLS-D01 | 三つの合成Ownerのrelease処理をCase Headerだけで説明していた。各property直前へPRL-UT-006の固定Test Headerを追加し、失敗mode、初回Owner、正常世代の計数・返値をそれぞれ記録する。 | 本体・返値・計数・Oracle・Source・Relation・義務不変。三Headerの内容と本文不変を照合する。 |
| DLS-Q01 | 原記録は実入力と搬送を保存したが、検証器の実行物・設定・Worker入口の再識別が不足した。旧二rawを不変保持し、Node、実解決TS Native、Biome、設定、Checker、Worker接続Sourceと関連package／lockを新しい主要入力集合へ追加する。 | 全推移closureの保証へ拡張しない。静的→同じ8UT→自己生成2IT→関係／Checkerを新実行として全入力・時計・全返却・前後Hashと一体保存する。旧結果へ遡及しない。 |

旧`local-r1.json`のSHA-256は`38591c5fffe3f40b303dcaa5490759141e2fb4d81f7ebcb017bdf48da4a7a16a`、旧`checker-r1.json`は`44243a2acf246fe0b31faaedf58c50fdfe10eef04456a0a4b9328937ba0bbf46`。実残存、Authority、署名、production本体、品質件数と停止Gateは不変である。新実行・再確認は未完了のまま保持する。

#### 同期排他r2の是正後検証

新しい検証器・主要入力集合へ結合した実行だけを以下へ記録する。旧r1の返却と原記録は変更していない。二Findingの解消と新候補のPassは、三観点の再確認へ渡す。

| 確認 | r2の実績・限界 |
|---|---|
| DLS-D01 | 三propertyへ固定Test Headerを追加した。追加三blockを読取り上だけ除いたbytesのHashはr1の`9d4c860e33b9b62e050ba194bdfc517ef151ec5f633110c507fdae0cf36856ec`と一致し、本文・Oracleの不変を確認した。比較の初回起動はshell引用の構文誤りで未成立、修正した読取り比較がexit 0。実試験やSource処理の失敗へ読み替えない。 |
| DLS-Q01の入力 | 明示した33主要入力を前後照合した。Node v24.19.0の実binary、TS 7.0.2のbin／wrapper／Resolver／packageと実解決win32-x64 `tsc.exe`、Biome binary／設定、継承strict設定、Checker入口／package／lock、二Worker接続Sourceと関連package／lockを含む。全推移closure・環境全体の識別とは区別する。 |
| 新静的・試験 | Formatter→scoped型→Lintはいずれもexit 0。その後の同じUT8件は124.2854ms、自己生成排他／試験所有Processだけの既存IT2件は1380.5094ms、全て成功・0失敗。実解放失敗・全Native終端・実残存三件は未確認のまま。 |
| 関係・Checker | File Relationと公開indexの読取り照合はexit 0。新Checkerは23027ms、exit 0、108Markdown・9807リンク・494anchor、指摘／警告0。expanded_scope_truncated:trueとignored除外を保持する。 |
| 新原記録 | 同じRepository-local領域の`remediation-r2.json`、SHA-256 `25482711b1d0051b4a0e8a7662e79725f433dd4b5e8f508afda1556237b5f95a`。全実入力object、明示環境上書き・cwd、UTC前後、初回・全wait・完結返却、33入力とHEADの前後一致を一体保存した。実行入力の本記録Hashは`4a0f450c3909842edf5669c2a3c5e640b835d5186cfa2b6b23b5a5df69cbf51c`であり、本節追記版へ遡及しない。 |

production本体、返値、Oracle、Authority、署名、旧二raw、品質件数および停止Gateは不変。今回の追加は試験Headerと再識別記録だけである。caller耐久接続、async移行、本番終端記録、旧三領域の処置と全Recoveryは未成立のまま保持する。

#### 同期排他r2の独立再確認

新固定七fileを技術／lifecycle、51文書／Trace、品質／53直接影響の三必須観点で独立再確認し、全て限定Pass、DLS-D01／Q01解消・新Finding 0、確信度は高だった。開始・終了HEADは`50f3d23fb641802b9f05cba847a2d83629405e7a`で一致し、七対象・旧二raw・新二rawの指定Hashは一致・不変だった。確認者は編集、再実行、外部／実資源操作を行っていない。

独自の読取り比較でも三Header除去後の旧UT bytesとの一致を確認した。33主要入力とHEADの実行前後一致、実解決Native、明示環境上書き・cwd・時計・初回／全wait／完結返却、新旧結果の分離は原記録と整合した。実行入力Evidence`4a0f450c3909842edf5669c2a3c5e640b835d5186cfa2b6b23b5a5df69cbf51c`、レビュー版`3e70a5403df243051bd78d913c952fb286605a55a95f746ba549e3cf71bada66`と本書戻し版を区別する。r1の未完了表示は当時の状態であり、今回の同期是正区間は独立確認済みである。

書戻しは本節とChecklist一行だけを許容した。他六file、旧raw、品質件数・署名・Authority・停止Gateは変更しない。限定Passは同期controller・解放集約と今回の根拠区間だけであり、全Native終端、実解放故障、async移行、耐久caller、本番終端記録、旧三Rootおよび全Recovery／E2Eは未成立のまま保持する。現在、追加の人間判断は不要である。

#### 助言初期化失敗の分類と初回参照保持 — 着手

着手前の読取り確認はHEAD `105a467bf59a29d41e62cecf8fcd863d2827499e`で行った。caller耐久接続を先行する案は修正した。現Host factoryは作成後に参照を返し、Nativeの現在読取りはcaller既知のfile Identityと全bytesを必要とする。参照fieldだけを既存Project状態へ追加しても、作成後・返却前の喪失を解決できない。未使用のRequest保存port、一律Task拒否または旧参照の遡及生成は追加しない。

同じCHGの先行是正を、助言初期化失敗の既知分類と初回Runtime結果への参照保持に限定した。下位で清掃確認済みでもOperation未返却のため外側catchが未確認へ読み替える原因を修正し、未解決の取得済み参照を同じ初回結果へ私有結合する。公開Schema、Provider入力、署名、Authority、実残存三領域および品質件数は変更しない。

Formatter→scoped型→Lintはいずれもexit 0。その後に助言Runtime、Provider Executor、Dispatchおよび実行計画の局所UTを実行し、33件成功・失敗0、640.9608msだった。本番と同じ初期化関数へ偽依存を接続し、作成／activation／readiness各段の清掃true／false、元参照あり／なし、未知例外、元結果とcopyの分離、公開JSON非漏えいおよびProvider開始0を確認した。実OSの清掃・Lock終端または別Process再入場の証明ではない。

初回のscoped型は試験設定のNode型探索先不足で停止した。設定を明示した次の型確認では、追加fixtureの清掃Receipt返値不足を検出した。偽Receiptを型契約へ合わせ、Formatter・型・Lintを再実行した後だけUTへ進んだ。失敗した二確認を成功記録へ読み替えない。

scoped Checkerは25185ms、exit 0、101Markdown・9872リンク・566anchor、指摘／警告0。expanded_scope_truncated:true、ignored除外および範囲外のリンク未確認を維持する。27主要入力とHEADはUT／Checker前後で一致した。Node、TSの実解決Native、Biome、設定、下位作成境界、公開indexおよびChecker入口を含むが、全推移入力closureではない。

原記録はRepository-local `.crdd/verification/chg-000082-advice-initialization-261003/local-r1.json`、SHA-256 `fdabf57805dee62c2ef3037a424d01e24d8ddf373821321a9158d5520a72b10e`。実入力、明示環境上書き・cwd、UTC前後、初回／全wait／完結返却、新旧静的結果および27入力Hashを保存した。実行時の本書Hashは`84521121ec4fe8a3244fe044af4bd76ec6b52d9bb15d37d3692ae6a5a3ebae5b`であり、この結果追記版へ遡及しない。

固定差分の技術／lifecycle、51文書／Trace、品質／53直接影響の三観点のr1独立確認は全てFail、指摘2件だった。AI-T01はErrorの通常own propertyから元参照を列挙できる不一致、AI-Q01は実行した直接UT4fileのうち3fileが27入力Hash集合へ未収載である不一致。実外部漏えいの観測ではない。対象6file、HEADおよび旧原記録Hashは開始・終了で一致した。確認者は編集、試験再実行、外部／実資源操作をしていない。

統合是正は三観点と整合確認済み。Error専用WeakMapへ分類を移し、公開getterやown propertyを追加しない。作成／activation／readiness各段でErrorのJSON、Object.keys、spreadへの元参照非漏えいと、同じErrorを外側catchが消費する分類・参照保持を確認する。新原記録には直接3UTを加えた30主要入力を静的確認前とUT／Checker終了後に照合する。旧r1原記録と3UT本文は不変で保持し、旧実行へHashを推定補完しない。

r2の局所検証は以下のとおり完了した。三観点再確認は未完了であり、初回結果から後段の投影・Request Owner・fresh Processへ伝播する接続、本番耐久終端記録、async移行、実回復／全E2EはOPENを維持する。

#### 助言初期化r2の是正後検証

| 確認 | 新しい実績と限界 |
|---|---|
| AI-T01 | Error専用WeakMapへ分類を保持し、元参照をown propertyへ置かない。作成／activation／readiness各段の同じErrorについて、Object.keys・JSON・spreadへの元参照非漏えいと、外側catchによる分類・参照保持を確認した。公開getter・Schema・理由・Authorityは追加していない。 |
| 静的確認 | Formatterの整形後、読取りFormatter→scoped型→Lintを全てexit 0で完了してから試験へ進んだ。Node v24.19.0、TS 7.0.2の実解決NativeおよびBiome 2.5.6を識別した。 |
| 局所UT | 同じ直接4fileで33件成功・失敗／skip／cancel 0、653.3568ms。既知清掃true／false、未知例外、初回結果の私有結合とcopy非結合、Provider開始0を確認した。実OS回収・別Process再入場の証明ではない。 |
| Checker | 六file指定、23831ms、exit 0、101Markdown・9872リンク・566anchor、指摘／警告0。expanded_scope_truncated:true、ignored除外と展開範囲外のリンク未確認を維持し、全実装の保証へ拡張しない。 |
| AI-Q01と前後識別 | 直接4UT全てを含む30主要入力を静的確認前とUT／Checker完了後に照合し、HEADと全Hashが一致した。全推移入力closure・環境全体不変を主張しない。追加した直接3UT本文と旧r1原記録は変更していない。 |
| 新原記録 | `.crdd/verification/chg-000082-advice-initialization-261003/remediation-r2.json`、SHA-256 `f886f21d3a09140b425fded6d173a5daf9a70a7ae5d20c1e6f06e5f4773265e1`。実入力object、明示cwd・環境上書き、UTC前後、初回／全wait／完結返却および30入力の前後識別を保持した。旧r1へ遡及補完しない。 |

新実行入力の本記録Hashは`e1a66b22dce2d4f6e56ca0d5b9c5b661748f83124281c4e11bc95890b6032b4a`であり、本節追記版を試験入力へ付け替えない。署名Runtime、品質件数、実残存三領域、Docker／Provider操作および停止Gateは不変。指摘解消と限定Passの判断は、この新しい固定六fileの三必須観点へ渡す。

#### 助言初期化r2の独立再確認

固定六fileを技術／lifecycle、51文書／Trace、品質／53直接影響の三必須観点で独立再確認し、全て限定Pass、AI-T01／AI-Q01解消・新Finding 0、確信度は高だった。開始・終了HEADは`105a467bf59a29d41e62cecf8fcd863d2827499e`で一致し、六対象、旧r1と新r2原記録の指定Hashは不変だった。確認者は編集、試験再実行、外部／実資源操作を行っていない。

Error専用WeakMapと三段の同じErrorによる列挙反証、初回結果への分類保持、Header・ERB-UT-023・File Relation、直接4UTを含む30入力の前後一致と新実績を照合した。実行入力Evidence `e1a66b22dce2d4f6e56ca0d5b9c5b661748f83124281c4e11bc95890b6032b4a`、レビュー版`a0e1e8bc126301ced486d76344b84751124a8cbcb7be28aa04ae48dbd3f75b2f`と本書戻し版を区別する。上記の独立確認未完了は今回結果追記前の状態であり、旧Fail・原記録・実行入力版へPassを遡及しない。

書戻しは本節とChecklist該当一行だけを許容した。他五file、公開Schema・理由、Authority、署名、品質件数と停止Gateは不変。限定Passは助言初期化失敗の初回結果保持と今回の根拠区間だけであり、caller耐久接続、async移行、旧三Root処置、全Recovery／E2EはOPENである。現在、追加の人間判断は不要である。

#### 同参照の現在候補観測 — 設計と実装単位

基準Commit `af579151`で次の単位へ進む。読取り専用の着手前確認は、caller-known参照、独立保持した完全intent／対象binding、現在実体観測と過去証明の分離を条件として着手可だった。既存strict readerへ現在Identityを旧期待値として渡す案、未使用保存port、参照だけでのAuthority発行は採用しない。

| 一次編集対象 | 今回の処置・反証と非変更範囲 |
|---|---|
| Native私有reader | 既知Identity照合と現在候補観測を明示した方針で分離し、同じ保持・ACL・全bytes・前後Identity・今回closeへ接続する。新型は現在Identityだけを返し、過去receiptや元file連続性を返さない。 |
| 新しい限定fixture／Owner | 新run・freshなRepository-local対象だけ。prepared／public、二名／両不存在／内容／Directory／参照／byte境界、同bytes別実体、strict旧Identity拒否、保持中変更拒否と今回closeを確認する。全Oracle後だけ自作六file・空二Directoryを非再帰清掃する。失敗時は保持して停止する。 |
| 二Details・QA・本記録 | 上位Schema／producer／対象bindingとNative opaque bytes相関、現在観測と履歴、局所成立と本番接続を分ける。既存Local Itemへ区間を追加し、件数・停止Gateは変えない。 |
| 直接Relation | 既存Native Source登録と試験Fileの001／002／003、Case／Helper Trace和集合を照合する。既存値で足りる場合は追加しない。 |

Formatter／Clippy、Owner型／Formatter／Lintを試験前に行い、新固定binaryとOwnerの一回実行、Native通常回帰、限定Checkerを新原記録へ保存する。実入力object・明示cwd・時計・全返却と主要入力前後を保持する。技術／lifecycle、51文書／Trace、品質／53直接影響の三必須観点を同じ固定候補で独立確認し、全結果の前に是正しない。

既存strict reader、旧fixture／原記録、公開dispatch／Protocol、caller耐久接続、共有容量、async移行、実残存三件、Docker／Provider、署名、Authorityと停止Gateは不変。新現在候補の受理だけで本番再入場・処置Gate、旧対象清掃または全E2Eを成立にしない。準拠基準・公開Capabilityを変更しないため52準拠／Release監査はこの内部単位の判定へ使用しない。新しい人間判断は不要である。

**現在状態:** 実装と局所検証を完了し、独立確認へ渡す。現在実体観測の部品からcaller耐久保存と本番Adapterへ順に接続する。Windows再起動は既定の前提にしない。

#### 同参照の現在候補観測 — 新局所検証r1

| 確認 | 今回の実績と限界 |
|---|---|
| 試験前の静的確認 | Rust Formatter／Clippy、限定Ownerの型／Formatter／Lintを全てexit 0で完了した。初回型確認はmodule設定不足で停止し、ignoredなOwnerの専用設定にmoduleを明示して再確認した。ignored pathへ直接実行したFormatterの「0 file」は確認実績に数えず、固定Biomeのstdinによる整形・読取り確認を別に行った。 |
| 新しい実体試験 | 固定binaryと新runの自己所有対象で175ms、exit 0。prepared／publicの現在観測2件、拒否7件、同bytes別実体の区別、旧Identityを期待するstrict readerの拒否、保持中変更拒否を確認した。現在Identityを過去receiptへ付け替えていない。 |
| 終了後条件 | 今回の個別close記録43行は全てtrue。これは全OS handleの不存在証明ではない。試験刺激の自作file改名を明示し、全Oracle後に自作六file・空二Directoryだけを非再帰で回収した。NativeとOwnerで試験Rootの不存在を確認した。旧三Rootへの処置ではない。 |
| Native通常回帰・Relation | 28成功・失敗0・ignored 17、0.28s。新しい実体試験は通常回帰ではignoredとし、上記一回の実行を重複実績にしない。Case／HelperのTrace和集合とFile Relationは既存ERB-IT-001／002／003に一致し、既存Catalog接続を確認した。Local Item全義務を確認済みとは表示しない。 |
| 限定Checker | 五file指定、24031ms、exit 0、104Markdown・9961リンク・589anchor、指摘／警告0。展開上限、ignored除外、展開範囲外リンク未確認を維持する。先行する誤ったCLI引数はexit 2であり、Checker実行成功へ読み替えず原記録へ保持した。 |
| 入力識別 | 静的確認前45主要入力と、新build後・試験前46主要入力を、全局所確認終了後と照合した。HEADと各Hashが一致した。新binaryのSHA-256は`8f0fc4e9dbf1460cca584f2692c63767f17273e779307a38038bf6757f966ec9`。全推移入力closure・環境全体不変を主張しない。 |
| 原記録 | `.crdd/verification/chg-000082-terminal-current-261003/current-run-r1.json`、SHA-256 `b928ddee06c61c1fd021db25ceb16656b93d59c66e4043a3c8777c2c3497390e`。実入力object・明示cwd／環境・UTC前後・初回／全wait／完結返却、失敗した静的確認とCLI入力、前後Hashを保持する。 |

実行入力時の本記録Hashは`7c2b2b055c4bfe7ceca928cc1fe660556ad3182e185035429a486ab872a6e6d0`であり、この追記版を試験入力へ遡及しない。新fixtureは同一Process・opaque bytesの局所確認である。上位Schema／producer／対象binding、caller耐久保存、fresh Process再入場、公開Native Adapter、共有容量、OS故障注入、async移行、旧三Root処置、全Recovery／E2EはOPEN。署名・Authority・停止Gate・品質件数は不変である。

#### 同参照の現在候補観測 — 初回独立確認と文書是正

固定五fileの三必須観点は、技術／lifecycleと品質／53直接影響が限定Pass、51文書／TraceがFailだった。CUR-D01は共用`TerminalObservedRecord`型Headerが全利用でcaller既知Identityを必要とすると述べ、新しい現在候補入口と不一致である。開始・終了のHEAD、五file、原記録と支持入力Hashは一致した。

全結果を統合して三観点と是正整合を確認後、該当`@compatibility`一行だけを修正した。Known入口の旧Identity照合、現在候補入口の今回Identity観測と、両方式に独立した期待bytesが必要であることを分けた。本体、Oracle、Owner、旧原記録、公開契約、品質件数、Authority、署名と停止Gateは変更していない。文書是正に伴う新しいOS実測は行わず、旧実行と是正版のHashを区別する。新版の三観点再確認は未完了であり、完了Checklistを更新していない。

Rust Formatter確認はexit 0。一行をメモリ上で旧Headerへ戻した全file Hashが実測版`a5388700d074828445e731a19896f87a8e24db066cdc769fdb630ece2c8f2dea`と一致し、本体・Oracle不変を確認した。是正後Source Hashは`6dbb5e8cc2ac92e0075de2dcd854b2c1b24bf3bc7cfaa99126cf17a6365af899`。この文書是正確認の原記録は`.crdd/verification/chg-000082-terminal-current-261003/header-remediation-r2.json`、SHA-256 `9e7cffc60c379415a1cf095ef35328214a5a0750b65380d5cb6644b7a50f9935`であり、新しい実体試験結果ではない。

#### 同参照の現在候補観測 — 是正後の独立再確認

新固定五fileを技術／lifecycle、51文書／Trace、品質／53直接影響の三必須観点で再確認し、全て限定Pass、CUR-D01解消・新Finding 0、確信度は高だった。開始・終了HEAD `af579151874167c0b3d7d71a472bab78e0eb4f96`、五file、旧実行原記録・補助原記録と支持入力Hashは一致した。確認者は編集、試験再実行、外部送信または実資源操作を行っていない。

実測Source `a5388700…`と実行入力Evidence `7c2b2b05…`、初回レビューEvidence `f8a51aef…`、Header是正後Source `6dbb5e8c…`と今回レビューEvidence `5d48e982…`、本書戻し版を区別する。前節の再確認未完了は本結果追記前の状態であり、旧Failと原記録へPassを遡及しない。Headerの一行以外の本体・Oracle不変を再確認し、新OS実測は発生していない。

書戻しは本節とChecklist該当一行だけに限定した。限定Passは現在候補の私有観測部品と今回の根拠区間であり、Known正常系の新OS実測、上位binding／producer／Schema、caller耐久保存、公開Adapter、共有容量、async移行、旧三Root処置、全Recovery／E2EはOPEN。署名、Authority、停止Gateと品質件数を変更していない。現在、追加の人間判断は不要である。

## Checklist

- [x] 助言初期化失敗の既知清掃分類を維持し、取得済み参照を初回結果の私有結合まで保持する局所UTを完了した。
- [x] 助言初期化失敗の新固定六fileを三必須観点で独立再確認し、AI-T01／AI-Q01解消・限定Pass・新Finding 0を記録した。初回結果保持と全RecoveryのOPEN、旧Failと新検証を区別した。
- [x] 同参照の現在候補観測を新自己所有対象で局所確認し、新固定五fileを三必須観点で独立再確認した。CUR-D01解消・限定Pass・新Finding 0と、現在Identity／過去証明／Authority、本番接続と全RecoveryのOPENを区別した。


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
- [x] Windows保護方式の新実行r3を三観点で独立再確認し、三指摘の解消・限定Pass・Finding 0を記録した。同一Processの局所観測と本番保護・実Recoveryの未成立を分け、旧Failと旧原記録を保持した。
- [x] 別Processの新固定版r5を三観点で独立確認し、限定Pass・Finding 0を記録した。役割別receiptとProcess／Job終端をfixture handle closeと区別し、本番・旧Root・全体品質の未成立を保持した。
- [x] 終端intent codecと正方向登録の新固定八fileを三観点で独立再確認し、二指摘解消・限定Pass・新Finding 0を記録した。本番・実Recovery・PRL-UT-006全義務の未成立、初回Failと旧原記録を保持した。
- [ ] OPEN: 旧形式の非使用、初期化排他、OS処置境界、保護済み再入場、SPEC／Workflow・公開入口と実境界検証が未成立。根拠取得後に同じCHGで接続する。
- [x] Native保存・公開のr1／r2失敗とr3局所成立を分け、公開名保護不足を是正し、主要入力の前後一致と明示close／自作対象の限定清掃を記録した。
- [x] Native保存部品の新固定八fileを三観点で独立再確認し、二指摘解消・限定Pass・新Finding 0を記録した。本番・実Recovery・Local Item全義務と全体品質の未成立は保持した。
- [x] 同handle改名の試験内候補を新固定二fileで三観点から独立確認し、限定Pass・Finding 0を記録した。旧hardlink結果を流用せず、本番採用と実Recoveryの未成立を保持した。
- [x] 私有publish本体への同handle改名を新固定五fileで三観点から独立確認し、限定Pass・Finding 0を記録した。部分receipt、実測入力と確認版の区別、旧方式履歴および公開Recovery・全体品質の未成立を保持した。
- [x] cold-r1のCase／Helper Trace和集合、File Relation、実入力・時計・全返却を新固定六fileの三観点で独立再確認し、限定Pass・COLD-Q01／Q02解消・新Finding 0を記録した。旧実測／欠測を保持し、本番再入場・実Recovery・全体品質の成立とは分けた。
- [x] 同期排他の失敗保持を新固定七fileの三観点で独立再確認し、DLS-D01／Q01解消・限定Pass・新Finding 0を記録した。失敗後の成功化を是正し、33主要入力の新検証と全Recoveryの未成立を区別した。
- [ ] OPEN: 実在三件のexact処置承認と清掃未実施。必要保証成立後に対象を提示し、別に承認を得る。
