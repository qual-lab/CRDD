# Coordinator Runtimeの実行アーキテクチャ

状態: Candidate（v0.20.0、Released Baseline: v0.19.0）
担当責任者: Qual-Lab
最終更新日: 2026-09-06

## 1. 文書責務

本書は、Agent Organizationを実行するReference Runtimeとして、Coordinatorが依頼、Authority、Provider、候補、取消、回復および結果をどう接続するかを定義する。Role、Independent Review、Cost、Human Boundary等の上位原則は[Agent Organization](../../04_Agent_Organization.md)、利用手順は[Workflow](../../19_Workflows/01_Coordinator_Runtime.md)、具体的な利用者向け挙動は[振る舞い仕様](../../05_SPEC/01_Behavior_Specification.md)が所有する。

実装は[40_Develop/coordinator](../../40_Develop/coordinator)、Windows固有境界は[platform-access](../platform-access/01_Architecture.md)、検証義務は[検証設計](../../07_Quality/03_Verification_Design.md)へ接続する。

## 2. 現行Profileと公開入口

### 内部ブロック図

以下は主要責務の接続を示す。`security/`は現在も複数責務を含むため、一つの箱にせずファイル名のまとまりと役割で分ける。新しいDirectory配置を要求する図ではない。

```text
CLI・共通Launcher（bin/）
  ├→ Task実行編成（coordinator-task-*）
  │    ├→ 入力・選定・結果判定（core/ のTask・Provider群）
  │    ├→ 実行許可・署名検証（Authority・package検証群）
  │    ├→ Provider実行（codex-* / claude-*）
  │    │    └→ Docker・Process制御（docker-* / 実行環境群）
  │    └→ 候補・Repository操作（candidate-* / repository-*）
  │
  ├→ Project接続（composition/）
  │    ├→ Project Runtime【別package：意味・状態・調停】
  │    └→ Port実装（security/project-runtime-*）
  │         実行・永続化・Lease・判断・候補統合・回復
  │
  └→ 診断・明示回復
       ├→ Task資源回復（docker-recovery-* 等）
       └→ Docker修復／検証付き再起動（desktop-* / restart-*）

上記の環境依存処理
  ├→ Native接続・OS観測 → Platform Access【別package】
  └→ 観測Adapter → Execution Intelligence【別package】

署名・検証・配布補助（scripts/）
  → 同じ配布物・実行依存集合の検証を利用
```

Provider・候補・回復・署名の実装群は主に`src/security/`、純粋な判定・契約は`src/core/`に所在する。矢印は主要接続であり、全importや実行順序ではない。各操作のAuthority・回収順序は後続節に従う。検証付き再起動は本版で接続中であり、図への掲載を署名済み配布物での実機成立と扱わない。

現行Profileは`local_personal`である。利用可能な公開CLIは次の閉集合に限定する。

| command | 利用目的 | 主なEffect |
|---|---|---|
| `task --request-stdin --json` | 一般Taskの委譲・独立確認・限定是正 | Provider送信、隔離候補作成 |
| `doctor` | 診断、Docker Task回復、Docker Desktop最終復旧 | 既定は観測。明示復旧だけ限定Effect |
| `candidate export/discard/recover-store` | 候補の明示操作 | 指定候補またはStoreへの限定Effect |
| `capabilities --json` | 現行Profileと公開Capabilityの機械確認 | Effectなし |

Local Personalは永続的なRuntime有効化状態、Platform Provisioningまたは事前Activation Recordを持たない。削除済みの有効化・無効化・準備commandは、parser、help、実装、互換shimまたは失敗専用入口として残さない。

利用者向けの安定入口`template/tools/crdd-coordinator.ts`は、同じ改訂版の共通起動入口`bin/launch.ts`へ接続する。共通起動入口は用途、Node版、stdio接続および引数を確認し、同じProcessで対応する既存mainへ接続する。新しいShell、cwd変更、stdio横取りまたはsignal ownerを作らない。MCP Serverは`template/tools/crdd-mcp.ts`が別の構成Rootとして所有し、Coordinator CLIのsubcommandにしない。

<a id="3-主実行シーケンス"></a>

## 3. 一般Taskの主シーケンス

```text
Task Request
  ↓ exact Schema・Repository・予算
署名済みCRDD配布物とPlatform Access成果物の検証
  ↓
選択ユーザー・Provider Home・Runtime Stateの観測
  ↓
外部送信Policy・Authority・Provider適格性
  ↓
Executor選定と理由の固定
  ↓
隔離Workspace・Mount Grant・Egress制約
  ↓
Executor
  ↓ structured result
Candidate検証
  ↓
Independent Reviewer
  ├ Pass → Result integration
  └ Finding → 同じExecutorへ一回限りの限定是正 → 再検証
  ↓
全Provider・Container・Mount・Lock・一時領域の回収
  ↓
構造化結果
```

各段階は前段の候補値をAuthorityへ自動昇格しない。Provider同士を直接spawnさせず、Coordinatorが各Processを独立して起動する。Provider出力、Credential、Host Pathまたは未検証候補をそのまま公開しない。

<a id="8-不変条件"></a>

## 4. 状態と遷移

| 状態 | 入口条件 | 次の状態 | 終了後条件 |
|---|---|---|---|
| `preflight` | exact request | `authorized`または`blocked` | Effect前拒否なら資源0 |
| `authorized` | package・Repository・送信・Authority成立 | `executing` | 未消費Capabilityを失効 |
| `executing` | Executor Capability消費 | `reviewing`、`cancelling`、`blocked` | 子ProcessとContainerを所有 |
| `reviewing` | 候補Identity固定 | `completed`、`remediating`、`blocked` | Reviewerは候補を書き換えない |
| `remediating` | 閉集合Finding、一回限り | `reviewing`または`blocked` | 元Scopeを拡張しない |
| `cancelling` | Human取消、timeout、owner loss | `cancelled`または`recovery_required` | 新Effectを停止し回収を待つ |
| `recovery_required` | cleanupまたはIdentity不明 | `recovered`または停止継続 | exact Recovery IDだけを受理 |
| `completed` | 結果とcleanupの両方が成立 | terminal | Canonical Repositoryは未変更 |

Provider成功だけで`completed`にしない。cleanup不明、候補Identity不明、Recovery競合またはEffect状態不明は、成功結果が存在してもfail closedにする。

<a id="4-資源所有"></a>
<a id="docker-cliの結果と子プロセスの所有"></a>

## 5. 資源所有

| 資源 | 所有者 | 取得 | 解放・確認 |
|---|---|---|---|
| Host Operation lock | Host supervisor | Operation開始前 | 全子・Container・Console reader停止後 |
| Provider Home lock | Home session controller | Home観測後 | 対応Stage終了後 |
| Mount Grant | Mount Grant runtime | 対象PathとStage固定後 | Stage終了・取消・失敗時に失効 |
| Docker container/network | Docker process controller | Provider起動時 | `docker wait`／inspectと不存在確認 |
| Candidate Workspace | Repository operation runtime | Executor前 | 採用候補の保存または破棄後 |
| Candidate Store lock | Candidate Store | 保存・export・discard時 | 同一Identity再読取り後 |
| Console reader | 対話境界 | 必要なHuman入力前 | reader、pipe、childの終了確認 |
| Recovery record | 対応Effect controller | Effect前に耐久化 | 復旧完了のread-back後だけ完了化 |

同じstream、handle、Processまたは一時Directoryを複数役割で共有しない。共有が避けられない場合は所有者、開始、終了、競合およびcleanup後条件を同じ設計・実装・試験へ結ぶ。

<a id="5-lock順序と解放窓"></a>

## 6. Lock順序

基本順序は次のとおりである。

```text
Host Operation
  → Provider Home
    → Candidate StoreまたはDocker Recovery
      → Console reader（必要時だけ）
```

逆順取得、待機中の未知lock削除、別OperationのRecovery ID流用を禁止する。取消は新規取得を止め、既に所有する内側資源から順に回収し、最後にHost Operation lockを解放する。

## 7. Authorityと外部送信

Repository読取り、外部送信、Provider起動、候補書込み、候補export、Docker復旧は別Authorityである。RoleはAuthorityを意味しない。

外部送信はRepository-local Policyと認証済みローカルユーザーの初期確認を境界とする。許可したProvider、情報分類、目的、Subscription、候補保持および取消条件が変わらない限り、Operationごとの確認コードを要求しない。Password、秘密鍵、Session Token、API Keyその他の秘密値をPrompt、Task Packet、logまたはProvider投影へ含めない。API key課金fallbackと追加購入は非対応である。

費用上限の個別確認は、利用者が明示した場合または既存Policyの上限を超える場合だけ必要とする。通常速度を既定とし、高コストmodel／effortは難易度・Risk・判断影響から説明可能な場合だけ選ぶ。

### 7.1 最小信頼境界

Coordinator Runtimeは、正常に動作するOSの認証、Filesystem、Process、AppContainerおよび署名検証機能と、OSが認証した選択ローカル対話ユーザーを信頼計算基盤（Trusted Computing Base、TCB）として扱う。

- 人間は、真正性を確認した公式署名済みCRDD Releaseの公開Coordinator入口からTaskを開始しなければならない（MUST）。
- Runtimeは外部Effect前に、署名manifest、Repository Revisionおよび同梱した単一のWindowsプラットフォームアクセス成果物を検証しなければならない（MUST）。
- 別ローカルユーザー、Repository内容、Provider／Workerとその出力、Network入力、未検証artifact、未検証Authority／Revisionおよび呼出し元が渡したPathは信頼対象へ昇格しない。Identity差または判定情報不足では処置前にFail Closedとしなければならない（MUST）。

同一ローカルユーザー、machine Administrator／SYSTEM、kernel、OSまたはVerifierが悪意を持ち、起動前置換、検査回避、debugger、injection等によってTCB自体を破る攻撃への完全なtamper resistanceは保証対象外である。この対象外境界を、署名manifest、artifact／Provider／Repository／Revision Identity、Authority、Provider Home、Egress、隔離、Process Effectまたは終了確認の省略根拠にしてはならない（MUST NOT）。より強い耐性が必要な場合は、OS保護済みbootstrap、managed install root、実行制御またはhardware-backed trustを別のHardened／Managed変更として再評価する。

### 7.2 専用Provider Homeの観測

専用Provider Home保護基盤（Dedicated Provider Home Protection Foundation）は、Windowsのlocal userとProvider単位の永続Home方針、固定配置および読み取り専用のRuntime所有観測をCoordinator側に保持する。OS観測だけをprivateな[Windowsプラットフォームアクセス部](../platform-access/01_Architecture.md)へ限定する。

**入力と取得**

- 呼出し元が渡したWindows絶対Pathは、Authorityを持たない字句候補に限る。
- Runtime observerのrequestへPath、SID、ACL、Profile IDまたはOperation IDを含めてはならない（MUST NOT）。
- observerはWindows既知フォルダーのローカルアプリデータ（Windows Known Folder local app data）からRootを独立取得しなければならない（MUST）。

**結合条件**

observerは固定`Qual-Lab/CRDD/ProviderHomes/{codex|claude}`を、現在Processのlocal interactive primary token、同じlogin session、Root handle／Identity、local fixed volume、全固定segmentのnon-link／non-reparse、selected user ownerおよびprotected DACLへ結合しなければならない（MUST）。Provider Homeのwrite-capable ACEは、selected userとSYSTEMの継承付きFull Controlだけに限定する。別writer、未保護DACL、Identity差または情報不足では修復せずFail Closedとする。

**出力とCapability**

- 結果は、Provider、nonce、既知flagおよびProvider Home Identity／保護／local user bindingのdomain-separated Hashだけへ限定する。
- Path、SID、login LUID、ACLまたはCredential内容を返してはならない（MUST NOT）。
- 固定署名manifest、Release artifactの起動前後一致および上限付きProcess終了を同じRuntime invocationで確認できない場合は、観測Capabilityを発行しない。
- 観測CapabilityはProcess-local、opaque、短命かつ一回限りとする。単独でAuthority、Operation Capability、Mount Grant、mount、loginまたはProvider spawnを成立させてはならない（MUST NOT）。

observerはHome作成またはDACL修復を行わない。明示bootstrap Effect、回復、logout／revoke／削除は別Lifecycleとして再評価する。

### 7.3 Provider Homeマウント許可

Runtime所有Provider Homeマウント許可（Runtime-owned Provider Home Mount Grant）は、同じOperation世代のopaque management Capabilityと、一回限りのRuntime所有Provider Home観測Capabilityからだけ発行しなければならない（MUST）。呼出し元が渡したOperation ID、観測Hash、時刻、Path、SID、ACLまたはCredential値を発行Authorityとして受理してはならない（MUST NOT）。

Grantは、Process-local atomic store、Runtime所有の壁時計と単調時計、暗号学的乱数参照、最長5分、使用上限1回へ固定する。Provider、Profile、Operation、Provider Home Identity／保護状態およびselected local user bindingを結合する。

発行control、使用useおよび消費後mount authorizationのaliasは分離する。use時にはfreshなRuntime所有観測を再結合する。Operation終了時またはmount完了後の取消では、全aliasとrecordを失効しなければならない（MUST）。Process restartではGrantを永続復元せず、全て失ってFail Closedとする。active mount、ContainerおよびOperation Filesystemの回復は、別のDocker／Host Recovery契約が所有する。

Mount Authorizationは、Provider Home Path、token、session、Credential、一般Runtime AuthorityまたはOperation Capabilityを含まない。実mount／unmount、Filesystem Effect、Provider spawnおよびcleanup確認が未成立なら、実行可能へ昇格してはならない（MUST NOT）。

<a id="development-provider-measurement"></a>

## 8. Providerとモデル選定

別Providerへの委譲を基本とし、同一Providerは、委譲不要、能力上の適合、Provider利用不能または独立した別Contextを説明できる場合だけ選ぶ。Front CodexからはClaude Executor、Front Claude CodeからはCodex Executorを優先するが、品質条件を満たす適格集合の中で判断する。

選定前に、Role、work class、plan state、Risk、難易度、判断影響、利用可能性、Authority、Costを固定する。Provider、model family、effort、速度、選定理由、高コスト選択の有無、再選定条件をProvider Effect前に記録する。AvailabilityやScopeが変わった場合は、元の選定を暗黙fallbackせず再評価する。

選定Grantは30秒の一回限りCapabilityであり、Provider Homeの実観測やMount照合より前に発行したGrantを、その前処理後のProvider Effectへ持ち越さない。Stageは最初の選定をProviderとProfileのMount照合にだけ用い、二回目のHome観測とMount Grant消費後に旧Selectionを明示失効する。同じ入力から新しいSelectionをEffect直前に発行し、Provider、Profile、model、effort、速度および選定理由が最初の選定と完全一致した場合だけ、選定表示、Task PacketおよびProvider準備へ進む。再発行失敗、旧Grantの失効失敗または意味差がある場合はProvider Effect 0で停止する。期限を伸ばして前処理時間を吸収せず、短命なAuthorityの有効期間を必要なEffect境界へ合わせる。

固定開発版によるProvider実測は、検証済みのSource、Native成果物、Repository、期限、Task数およびCLI呼出し数へ閉じた開発Sessionだけを発行し、Release AuthorityまたはProvider送信Authorityを与えない。このSession開始時に外部送信とは別の対話確認を重ねない。実際のProvider送信は通常運用と同じ初期外部送信許可だけが制御し、永続境界が同じ間は既存許可を再利用する。許可が存在しない、変更・失効・取消された、または状態を確認できない場合は、Provider Effect前に初期確認へ戻るかEffect 0で停止する。固定開発版のIdentityやTask上限から、外部送信範囲、実行AuthorityまたはRelease Authorityを拡張してはならない。

開発Sessionの完全Identity観測と進行中作業の生存確認を分ける。完全観測は、Admission前後、Task予約、Operation結合、Native lifecycleへの初回進入、各Provider Effect直前、各Provider終了後およびcleanup lifecycleへの初回進入で行う。同じNative／cleanup lifecycle内の補助観測、進捗参照、取消・期限・Process停止の確認およびread-onlyな利用量集計は、直前の完全観測で固定したSession bindingと現在時刻へ結合し、配布物全体を再Hashしない。各Native Adapterはこの固定を配布全体の同一性証明として再解釈せず、使用するNative成果物をProcess実行前後に個別照合する。Provider終了後の完全観測が不成立なら、Provider結果が成功でもTask成功を公開しない。生存確認または同一lifecycle内の補助観測は、新しいAuthority、別のNative lifecycleまたはProvider Effectを発行できず、次の境界の完全再観測を代替しない。

<a id="release-artifact-binding"></a>

## 9. 署名済み配布物

CRDDはGit clone／submoduleだけでRuntimeを利用できる配布構造を採る。Release候補TreeにはSource、文書、試験および固定成果物`template/tools/coordinator/windows-x64/crdd-platform-access.exe`を含める。署名manifestは`template/tools/coordinator/coordinator-package-manifest.json`へ置く。

配布には二つのIdentityを用いる。

- リリースIdentity（Release Identity）は、Version、tag、Repository Commit／Tree、文書、移行およびCHANGELOGを含み、「このCRDD Releaseは何か」を示す。
- Runtime実行Identity（Runtime Execution Identity）は、実行に影響する閉じた依存集合、Security Policyおよび固定Platform Access成果物を含み、「何の実行へAuthorityを与えるか」を示す。

manifest revision 5は、Coordinatorのproduction distribution allowlistである`bin/**`、`src/**`、`runtime/**`、`policies/**`および`package.json`全体に加え、共通Launcherの正本が選ぶ署名・4経路・Recovery入口と、そこから静的に到達する選択済み`script`依存を自動走査する。2つの公開Launcherと、責務分離されたMCP、Project Runtimeおよび実行知（Execution Intelligence）は、公開入口からcanonicalな静的importで到達する許可済み`src/**`と、そのNode module解釈を決める各componentの`package.json`を同じ実行閉包へ含める。したがってallowlist内の未参照Coordinator production sourceはIdentityを変えるが、未到達の兄弟Component、文書、試験およびbuild-only sourceは変えない。到達した兄弟Component／Launcher／protocol source、または到達Componentのpackage名・版・`private`・module種別を含むmetadataはIdentityを変える。package metadataの欠落・不正と実行集合外importは拒否する。このcontent root、Root Protection／Key Storage Policy Hash、Platform Access成果物のPath・target・protocol・toolchain・byte長・SHA-256からRuntime実行Identityを決定論的に算出し、Ed25519署名へ結合する。

TypeScript依存は正規表現ではなく、コメント、文字列、template、正規表現literalおよび構文tokenを区別するFail Closedの字句解析で抽出する。静的import、再export、動的import、型専用bindingおよび値bindingは、前のsemicolonや改行位置から逆算せず、括弧と宣言の終端を先頭から対応付ける一つのmodule宣言解釈から導出する。許可するmodule指定は、Node.jsが実在を確認できる`node:`組込みmoduleと、閉じた実行集合内へ正規解決されるrelative pathだけである。bare package、絶対Path、`file:`／`data:` URL、escapeを含むspecifier、許可された一つの検証入口を除く非literalの動的import、解析不能なsource、実行集合外へ解決される依存を拒否する。`createRequire`、bare `require`または`process.getBuiltinModule`による保護moduleの再取得も許可しない。共通Launcherは入口表の各対象をliteral importとして所有し、入口表とliteral依存を双方向に照合する。

子Process、Workerおよび実行後Lifecycleの利用側閉包は、手書き一覧の存在だけでは成立しない。本番実行集合から導出したmodule宣言、能力binding、直接呼出しおよび全値利用と、許可するsource、所有関数、primitive、実行対象式、引数式、事前Authority証明および期待件数を持つ宣言集合を双方向に照合する。未知の実行対象、追加呼出し、別名・namespace・再export・関数値・property・依存注入による再搬送、または宣言だけで実利用がない状態を拒否する。CanonicalなPath、Identity、StateまたはCapabilityをConsumerが別の基準で再解釈・再構成してはならない。純粋な型import／型re-exportは実行能力取得とせず、値re-exportや未使用の値importは取得済み能力として扱う。固定`taskkill.exe`等の非Node成果物も、source単位の広い許可ではなく、正規の呼出し位置と証明済み実行対象へ結合する。旧revision、削除済みfield、別Path alias、Identity不一致または欠落fallbackを受理しない。

content rootでは、署名対象の`.ts`、`.json`、`.policy`、`.py`、`.txt`および`.Dockerfile`をLFへ正規化する。Windows CheckoutのCRLFとLFは同じ正本内容として扱うが、行内容、終端改行、単独CRその他の差分は同一視しない。Native成果物その他の非テキストは生バイトの長さとSHA-256を完全一致させる。README、CHG、Roadmap、品質記録、試験source、build設定その他の実行集合外の変更はリリースIdentityを変えるが、Runtime実行Identityを変えない。

Runtimeは現在CheckoutのRepository Tree全体を実行Authorityとして要求しない。固定manifest、閉じた実行集合、PolicyおよびNative成果物を起動前後に照合し、Runtime実行Identityの一致からAuthority候補を得る。これにより文書だけの修正後も同じRuntime実行Identityと既存の署名・E2E根拠を再利用できる一方、実行集合、PolicyまたはNative成果物が1 byteでも変われば再署名が必要になる。RecoveryもRepository Treeではなく、Runtime実行Identity、Operation、Resource、Provider／Home bindingおよびRecovery契約revisionへ結合する。

署名入口は、非秘密条件と配布候補を確認するP検査、秘密入力、P検査が発行した一回限りの不透明な能力を消費する独立S検査、秘密鍵読取り、署名、配置、公開結果の順序を唯一の実行経路とする。P検査は入力のdata propertyを一度だけsnapshotし、Accessor、Proxy、欠落または追加fieldを拒否する。S検査はP検査の観測値を署名値として流用せず、同じ固定入力から配布物、Runtime実行Identity、Release Identityおよびstaging sessionを再観測する。S検査へ渡す能力を偽造、再構成または再利用できず、別のoptions、fallback値またはP／Sの観測値を混ぜない。

保護対象経路の検証は、一般的なTypeScript解析器をRuntimeへ追加せず、CRDD公式Runtimeが宣言した署名、実行能力、回復および昇格の経路だけを限定した構文・binding・値由来グラフとして扱う。Actualグラフは実sourceの正規named import、所有関数、直接call、引数、結果binding、guard、最初のEffectおよび公開結果から導出し、独立に宣言したExpectedグラフと不足・余分の両方向で完全一致させる。別名、shadow、property化、関数値化、wrapper、結果再構成、guard前Effectまたは判定不能なescapeは拒否する。本文Hashとtoken列は変更検知の補助であり、binding、到達可能性、支配または値由来の証明を代替しない。

署名Source Aからmanifest carrier Bへの境界は、署名済みManifestをJSON文書として再生成する境界ではなく、不透明なbyte列を固定Pathへ昇格するRelease Effectである。署名器がRepository-local stagingで完成・flush・再読取り済みのfileを入力とし、昇格Coreはstaging Root、Source file、Repository Rootおよび両親DirectoryのIdentityを保持する。昇格コード自身も署名対象の閉じたRuntime実行集合へ含め、署名済みstaging内のLauncherだけを実行入口にする。作業Checkoutの未署名コードへstaging Pathを渡してはならず、実行元が配置先Repository直下の`.crdd/release-staging/<候補ID>`と一致しない場合はEffect 0で停止する。最終Pathへ段階的に書き込まず、同一Filesystem上の排他的なhard link作成によって完成fileだけを一度に公開し、開始時のsourceと公開後の二名が同じfile objectを指すこと、byte数およびSHA-256を確認する。公開Effectの中ではPathによるsource削除を行わない。staging側の名前はRepository-local stagingの所有範囲を再確認する別の明示破棄へ委ね、昇格成功結果には残存状態を返す。公開昇格入口はそれに先立ち、固定公開鍵による署名、Source AのCommit／Tree、staging内の閉じたRuntime実行集合、Policy、Native成果物、配置先Repositoryの現在HEADおよび配置先不存在を同じ候補へ結合し、昇格後にも同じ検査をやり直す。Git管理外の依存物や一時物をSource AのCommit／Tree検証へ混入させず、実行集合のbyte完全性は署名済みstagingから検証する。API呼出し、link要求またはfile存在だけを昇格完了としない。

昇格前の観測不能は不存在へ畳まずEffect 0で停止する。Process消失後は、`stagingだけに存在`、`stagingと最終Pathが同じfile objectを指す`、`明示破棄後に最終Pathだけに存在`の三状態を、同じ署名済みbyteとRoot／親Directory Identityで再構成して再入場する。二名が同じfile objectを指す状態を昇格成功の耐久状態とし、別Identityの二重存在、内容変化、Root／親Directory置換または観測不能では自動削除しない。公開後の失敗を推測rollbackせず、同じ昇格入口で正確な状態から収束させる。昇格成功はRelease Authority、Runtime Authority、Capability、Commit B、staging破棄完了または公開を単独では成立させない。

リリースIdentity、Runtime実行Identityおよび作業対象のExecution Revisionは同一ではない。一般Task開始前後に観測するExecution Commit／Treeは変更候補を作るRepositoryのIdentityであり、Executor候補の`baseCommit`／`baseTree`はこれへ一致しなければならない。CRDD自身のDogfoodingと、親RepositoryがCRDDをsubmoduleとして利用する場合を同じIdentityへ畳み込まない。

作業対象Commitから外部送信Policy等の明示ファイルだけを読む場合、Git object readerは許可された読取り投影へ到達するTreeと対象fileだけを処理する。投影外の通常file、symlinkまたはgitlinkは作業対象へ含めず、親Repositoryが別位置にCRDD等のsubmoduleを持つことだけで対象fileの読取りを拒否しない。ただし、選択Path自体またはその祖先がsymlink／gitlink／未対応modeである場合と、Commit全体を隔離候補へ展開する場合は従来どおり拒否する。限定投影を、gitlink配下の横断読取りや全体展開の許可へ拡張しない。

<a id="task-result-transport"></a>
<a id="task-turn-budget"></a>

## 10. Provider実行と候補

Provider CLIは固定Docker image、最小環境、専用Provider Home session、限定Egress、上限付きstdout／stderr、turn、時間およびProcess treeで実行する。親環境、Proxy、PATHまたは別Provider Credentialを無条件に継承しない。

Host上のDocker CLIは固定の公式配置からだけ取得し、OSが有効と判定したDocker IncのAuthenticode署名、Filesystem実体および必要Capabilityを確認する。通常TaskではDocker DesktopまたはDocker CLIの過去の特定Version、Hash、byte数との一致を実行条件にしない。TaskまたはRecoveryへの再入場ごとにCLI IdentityとHashを観測し、その一つのOperation内では同じ値を保持する。観測中または実行中の差替え、署名不成立、Publisher不一致、配置不一致または必要Capability不成立ではDocker Effect前に停止する。特定VersionとArtifactを固定するDocker Desktop修復PolicyはHost状態を変更する限定修復だけに用い、通常Taskの互換性判定または更新許可へ流用しない。

Authenticode検査を実行するPowerShellには、Docker CLI用の中立化環境を流用しない。読み込み済みOS moduleから検証したWindows Directoryを基に、`SystemRoot`、`WINDIR`、OS標準Directoryだけの`PATH`および固定`PATHEXT`からなる専用環境を構成する。親ProcessのUser Profile、Proxy、Credential、NodeまたはDocker設定は継承せず、PowerShellの成立に必要なOS初期化情報だけを与える。環境更新をVersion／Hash固定で拒否せず、署名検査Process自体とPublisher Trustの両方を確認できない場合だけDocker Effect前に停止する。

Providerへ指定するturn数は、検証済み作業量から算出する実行目標であり、Runtimeが直接強制した絶対上限とは扱わない。Providerが指定値を超える成功応答を返し得る境界では、Runtime所有のtimeout、出力量およびProcess停止を実効的な強制境界とし、Provider報告turn数は別の絶対受理上限まで検証する。指定値超過を正常な上限遵守へ読み替えず、有用性評価とProvider更新判断で追跡する。絶対受理上限を超える結果、turn数が不正な結果または上限到達を示す失敗結果は採用しない。

Provider ProcessのLifecycleはTypeScriptが所有する。固定Digest image、exact Provider CLI versionおよび自動更新停止を管理対象依存として扱う。Shell、PATH、Host既定Home、Host CLIまたはAPI keyへfallbackしない。更新時はimage／CLI Identity、利用側、検証および復旧を再評価し、人間が有効化する。

Process、Workerまたは対話入力Readerの生成を所有する本番leafは、起動前提の確認、handle取得、取消登録、完了観測およびcleanup後条件を一つのLifecycleへ接続する。生成済みhandle以降の状態遷移を共通化する場合、専用の内部Lifecycle moduleへ閉じ、本番では対応するleafだけが利用する。内部Lifecycle moduleは、対象module、公開symbol、利用leaf、所有関数、引数の由来、事前に成立すべきhandle生成／観測、および結果を既存の終端cleanupへ渡す後続処理を一組として照合する。再export、動的import、別名import、関数値化、property経由または兄弟実装からの利用によって起動前提や実行targetの検証を迂回してはならない。試験は同じ状態機械を試験支援境界から利用できるが、本番用factoryや任意の生成関数を公開しない。取消listenerを登録した直後に取消状態を再確認し、生成と登録の間に発生した取消も通常の取消経路へ収束させる。終了、timeout、取消、出力上限および観測不能の全経路で、handle、listener、streamおよび関連資源の回収結果を確定し、未確認を成功へ畳まない。

上限付きプロセス（Bounded Process）は、固定argv、環境、入出力、時間および成果物Identityを制限した内部Process境界を指す。通常のProcess Adapterは、固定Release Trust、artifact／Provider Identity、Authority、Repository／Revision、Provider Home、Egress、隔離および終了確認を実装・検証するまでProcessを起動しない。入力Pathまたはhelper Processより前に`blocked`へ閉じる。上限付きProcessを、Root保護、Authority、CapabilityまたはEffectの成立へ流用しない。

ExecutorはCanonical Repositoryを直接変更せず、隔離候補だけを生成する。Coordinatorは変更Path、実行Repositoryのbase Commit／Tree、内容、構造化結果を照合する。Reviewerには、候補固定後にRuntimeが`readPaths`から生成したUTF-8内容投影だけを渡す。内容投影は候補のPatch Hashと内容Manifest Hashへ結合し、合計1 MiB・256ファイルを上限として、認識済みSecret、非UTF-8、上限超過、候補差替えまたは読取り不能をProvider開始前に拒否する。投影EnvelopeとCandidate bindingはRuntimeが保証するReview Evidenceであり、埋め込まれた候補内容は指示やAuthorityとしてだけ非信頼とする。候補内容自身の評価根拠まで非信頼へ畳まず、ReviewerへFilesystem再読取りを要求しない。ReviewerはFilesystem／Shell Toolを持たず、投影された候補内容から閉集合Findingを返す。自由文および候補内容はAuthorityや修正指示へ直接昇格しない。

Provider実行とReviewer判定は、最終4経路E2Eで初めて結合してはならない。固定候補では、CodexとClaudeをExecutorおよびReviewerの双方で一回ずつ使用し、Role別Tool／Approval、stdin搬送、隔離Workspaceの実変更、変更Path申告、候補捕捉、署名済み実行Identity、候補内容投影、構造化判定、必要な一回是正、Provider終了、候補処置、資源不存在および安全な結果記録までを明示実行の二経路結合試験として先に確認する。起動失敗、非ゼロ終了、timeout、取消、不正結果、申告差、投影失敗およびcleanup不明は、同じ実Process／Docker境界へ決定論的に注入して反証する。通常回帰は外部Provider Effectを発行しない。実Reviewerが拒否した場合は、生の応答や自由文を公開せず、判定、Finding件数、severity／path／category／criterion、message Hash、投影Hash、対象fileのbyte長／Hashおよび是正有無だけを保持し、投影不一致とProvider判断を切り分けられる状態にする。

CLI optionは個別の存在だけでなく、同時指定する全optionの組合せを固定BinaryのProcess初期化で反証する。Codex Executorでは`--approve-for-me`が`workspace-write`の選択を所有するため、同時利用を拒否される明示的な`--sandbox`を重ねない。Runtimeが固定するFilesystem権限Profile、Docker隔離およびProvider Home保護は維持する。Reviewerは自動承認を持たず、明示的な`read-only` Sandboxを使用する。

<a id="7-cleanup依存順"></a>
<a id="22-docker-desktop最終復旧時の起動環境"></a>

## 11. 取消と回復

一回目のCtrl+C、timeoutまたはowner lossは取消要求であり、完了ではない。CoordinatorはProvider子孫、Container、network、Mount、Console reader、候補およびlockを依存の逆順で回収する。二回目の割込みは回収を省略する許可ではない。

回収を直接観測できなければ、exact Recovery ID、`manualRecoveryRequired`、`processRestartRequired`および`effectStateUnknown`を保持して停止する。新しいProcessで同じRepository・選択ユーザー・配布Identityへ再結合できた場合だけ復旧を続ける。復旧後も元Taskを自動再開しない。

Docker Desktopの破損時は通常Taskと分離した最終復旧経路を使う。対象Process、固定artifact、mutex、耐久記録、Directory Identityおよび再開条件を確認する。親Directory renameはWindowsの限定最終手段であり、推測削除や無条件再起動を行わない。

#### Docker外部境界の結合単位

Docker境界は一つのCLI呼出しとして扱わず、同じ状態、Authorityおよび資源のlifecycleを閉じられる単位に分ける。各単位を実Dockerまたは安全に同等な実境界へ段階的に接続し、最後に公開Task入口から組み合わせる。

```text
[Docker CLI Trust・同一Operation Identity]
                    ↓
[Task作成・実行] ──取消／応答不明──> [Task資源観測・回収]
        │                                  │
        │正常完了                          │残存・観測不能
        ↓                                  ↓
   [Task結果]                      [Task Recovery記録・再入場]
                                           │
                           Engine正常 ─────┤
                                           │ 既知のDesktop障害
                                           ↓
                              [Desktop障害修復Lifecycle]
                                           ↓
                              [Engine・資源のfresh観測]
                                           ↓
                              [Task固有Recovery・settlement]
```

障害修復の耐久状態は次の遷移だけを許可する。各Effectの発行前後で同じ修復ID、境界および記録prefixを照合し、不明状態を次へ進めない。

| 現在状態 | 成立条件／処置 | 次状態 | 不成立・取消・観測不能 |
|---|---|---|---|
| 未作成 | 境界、排他、修復対象を確認し初期記録を耐久化 | `prepared` | Effect 0で停止 |
| `prepared` | 対象Processをfresh観測し、存在時だけ公式停止と必要な限定強制停止を行う。不在時は各操作を`not_issued`として耐久化し、再開時にも同じ境界を再観測する | `processes_stopped` | 同じ修復IDで停止 |
| `prepared`／`processes_stopped` | stale対象がなく、既知Effectまたは履歴Effect不明を分類 | `no_stale_known_effect_recovery_pending`または`no_stale_historical_effect_unknown_pending` | 推測で不存在へ畳まない |
| `processes_stopped` | exactな`run` Directoryを同一親内へrenameし、新旧Identityを確認 | `renamed` | rename結果不明として同じ修復IDを保持 |
| `renamed` | Desktopを起動し、Engine応答、Host安全性、Evidence保持を確認 | `recovered_pending_disposition` | 起動を盲目的に再発行せず停止 |
| `recovered_pending_disposition` | 人間が残存Evidenceの保持を決定し、終了記録を耐久化 | `closed_retained` | 回復済みと表示しない |
| `no_stale_known_effect_recovery_pending` | 既知EffectのEvidence保持を決定し終了記録を耐久化 | `closed_no_stale_known_effect_retained` | 回復義務を保持 |
| `no_stale_historical_effect_unknown_pending` | 履歴Effect不明のEvidence保持を決定し終了記録を耐久化 | `closed_historical_effect_unknown_retained` | Effect不存在を捏造しない |

未終了の旧修復履歴はこの新規修復状態へ直接継ぎ足さない。由来、現在Session、現在Engine停止、Process集合、stale対象不存在、現在の`run` Identityおよびその既知lockを確認した場合だけ、Host Effect 0で旧履歴を証拠保持終了へ閉じ、新しい修復IDの`prepared`を別Operationとして開始できる。現在の`run`が旧履歴のIdentityと異なる場合は、旧対象が既定の`run`／stale位置に存在しないことと、新世代の`run`が同じfresh観測とlockで一致することを要求し、世代交代を旧Effect不存在の証明へ読み替えない。

`prepared`のProcess操作は、要求したかどうかだけでなく、freshな実状態から必要性を分類する。Engineが既知停止、修復対象の`run` Identityが一致、stale対象が不存在で、Docker Desktop Processも明示的不在なら、公式停止とNative強制停止は`known_not_needed`である。この場合はHost操作を発行せず、`issued=false`／`confirmation=not_issued`を同じ修復IDへ耐久化して次の段階へ進む。再開時は保存済みの`not_issued`だけを信用せず、同じ条件を再観測する。Processの再出現、Identity差、観測不能またはEngine状態の変化では後続Effectを発行しない。

署名済みRuntimeの更新をまたぐ未完了修復は、旧RuntimeのHost操作を新Runtimeから再発行しない。旧署名と引継ぎ連鎖を検証し、全Host Effectがsettledな`not_issued`であること、現在境界、現在`run` Identityおよび旧stale対象不存在をfresh観測できる場合は、過去のHost Effect 0だけを確定して旧Operationを証拠保持終了できる。現在Dockerの故障または復旧は同時に推定せず、新しい修復Operationが現在の証拠から改めて判定する。

### 正常復帰後の検証付き再起動（Source接続済み・正式E2E未完了）

  正常Engineへ戻った後にも作成結果不明のTaskを復旧できるよう、障害修復とは別に検証付き再起動を設ける。現在の署名済み配布物にはこの経路はなく、以下を既存機能の完成主張として扱わない。

| 責務 | 障害修復 | 検証付き再起動 |
|---|---|---|
| 発火 | 既知のDocker Desktop障害 | exact Taskの作成要求が未確定で、停止境界が必要 |
| 正常Engine | 新規修復を開始しない | 必要な対象・権限・排他を確認した場合だけ開始候補 |
| Filesystem | 障害時のrun退避を所有 | runの退避・削除を行わない。保護された復旧記録だけを所有 |
| 停止根拠 | 既存の修復履歴契約 | 作成要求より後の旧実行主体の停止完了と、後続起動を順序付きで記録 |
| Taskの完了 | 別のTask復旧が判定 | 別のTask復旧が判定。再起動成功だけでは完了しない |

#### 実行と回復の全体図

以下は責務間の接続図であり、新しい保存状態名の定義ではない。「Source接続」は実装上の接続だけを示し、署名・実機検証の完了を意味しない。再起動の終了とTask回復の終了を分け、Taskの自動再実行には接続しない。

```text
Task受付・境界検証
  ↓
許可されたTask実行
  ↓
結果と資源回収を確認
  ├─ 確認済み → Task結果を返す
  └─ 残存・観測不能 → 同じ回復IDを保持して停止
                         ↓
                     現在の回復条件を検証
                       ├─ 権限不足・競合・不明 → 停止を維持
                       ├─ 通常回復が可能 ──────────────┐
                       ├─ 既知のDocker障害             │
                       │    ↓                         │
                       │  既存の障害修復               │
                       │    ↓                         │
                       │  停止・再起動の根拠を検証 ────┤
                       └─ 作成結果不明・停止境界が必要 │
                            ↓                         │
                          検証付き再起動【Source接続】 │
                            ↓                         │
                          停止・再起動の根拠を検証 ────┘
                                                      ↓
                                             Task固有の資源回復
                                                      ↓
                                         対象資源と記録の終了条件
                                           ├─ 不成立・不明
                                           │    → 同じ回復IDで停止
                                           └─ 成立 → Task回復完了
                                                      ↓
                                             元Taskは再実行しない
```

#### 再起動内部の状態遷移

状態名は`docker-restart-state.ts`の設計状態に対応する。純粋な状態判定、実行制御、停止観測、保護記録および公開入口はSource上で接続済みである。実停止・再起動を含む正式E2Eは未完了であり、図の存在や契約試験の成功を実機対応の完了根拠にしない。

```text
準備（prepared）
  │ 境界・排他を確認し、停止意図を耐久記録
  ↓
停止意図記録済み（stop_intent）
  │ 旧ProcessとEngineの停止を確認・記録
  ↓
停止確認済み（stopped）
  │ 起動意図を耐久記録
  ↓
起動意図記録済み（start_intent）
  │ 起動完了とEngine応答を確認・記録
  ↓
起動確認済み（ready）
  │ helper回収・境界再確認・記録確定
  ↓
再起動終了（settled）── Task回復完了ではない

各段階の失敗・取消・観測不能
  ↓
停止結果（blocked）＋ 最後に到達したphaseを保持
  ├─ prepared：検証失敗・取消で先へ進めない
  ├─ stop_intent / stopped / start_intent：不明な処理を再発行しない
  └─ ready：回収不明・境界差・記録失敗では終了にしない

意図記録を試みた後の不明状態 → 同じ対象の回復義務を保持
※ blockedはphaseではなく結果分類。この図はEffect再発行を許可しない。
```

| 成立条件 | 不成立・不明時の扱い |
|---|---|
| exact Recovery IDと開始時の未確定要求集合へ結合する | 別Task、要求追加、Identity差では再利用しない |
| 別の実行中Taskとの排他とDocker全体への影響を確認する | 他利用者の稼働資源を停止する許可を対象Taskの復旧許可から推定しない |
| 旧実行主体の停止完了を確認する | shutdown要求の終了値、空一覧、固定待機時間だけで停止境界を発行しない |
| 停止より後の起動とEngine応答を確認する | 起動handle取得だけで利用可能へ進めない |
| 各Effect前に意図を記録し、実行後に結果を記録する | 取消・応答喪失・部分記録では同じIDの回復義務を保持し、未確定Effectを無条件に再発行しない |
| 現在の実行Authorityと過去の証跡の由来を別々に検証する | 旧manifestや履歴から現在の操作許可を発行しない |

新しい再起動記録を既存の修復記録v4へ偽装しない。旧修復履歴のrun生成時刻条件は保持し、新記録には停止完了の独立した根拠を要求する。各記録をそれぞれ検証した後だけ、Task復旧が使用する検証済み停止・再起動の根拠へ接続する。

検証付き再起動と障害修復は、公式Path、Docker Incの有効な署名および同一操作中の実体Identity／Hash固定を共通のNative Trust境界として使用する。Dockerの版または過去操作のHashを次の操作へ固定せず、正規Updaterによる更新を再署名や再設定なしで受理する一方、署名不明、Path差、操作中の差替えまたは必要実体の欠落ではEffect 0とする。正常再起動は公式Desktop pluginの`S`停止を使用し、run Directoryを変更しない。正常起動が既知socket障害で成立しない場合は、同じ起動Effectを盲目的に再発行せず、正常再起動を終了してから既存の障害修復Lifecycleへ移る。障害修復だけが`K`停止、Docker WSL停止およびrun世代退避を所有する。子Job・EOF取消・応答の責務は[Native設計](../platform-access/01_Architecture.md#5-状態資源回復)を参照する。TypeScriptから渡したPathやHashだけをNative操作Authorityにしない。停止CLIのexit 0の後にも管理Process・CLI不存在、Linux Engineの既知停止およびWSL停止を確認する。起動後は信頼済みCLIによるLinux Engine応答を別に確認し、選択されたDocker backendの実装詳細であるWSL Distributionの`running`状態をEngine Readyの必須条件にしない。Engine観測は`ready`、`known_unavailable`、`unknown`を区別し、失敗やTimeoutを既知停止へ畳まない。Engine named pipeも`present`、`absent`、`unknown`で観測し、明示的な`ENOENT`だけを`absent`とする。権限・資源不足、一般エラーまたはopen後のclose失敗は観測不能として`unknown`を維持する。open後のclose失敗はEngine状態だけでなく資源回収状態にも保持し、Native helperのreleaseが成功しても上位のcleanupを確認済みにしない。

#### 保存状態からの限定再入場

現在署名から発行する操作権限と、`originReleaseRoot`で確認する旧署名の由来は別である。元の`engine-restart-*`を上書きせず、対象・submission・保護Rootを結合した`engine-handoff-*`と`engine-continuation-*`を追記する。旧署名は現在の実行権限を発行しない。

| `currentPhase` | 接続済み処置と限界 |
|---|---|
| 未記録 | 停止意図を記録して公式停止へ進む |
| 現在Runtimeの`stop_intent` | freshな停止観測だけで照合する。Desktop生存なら同じ停止を再発行せず未確定を保持 |
| `stopped` | 停止を再観測し、未発行の起動意図・起動へ進む |
| `start_intent` | 起動を再発行せずEngine Readyをfreshに観測する。成立時だけ`ready`を追記し、回収と確定へ進む |
| `ready` | Engineを再観測し、回収後の確定だけを進める |
| `settled` | 再起動Effectを再発行せず停止。完了Task復旧は別入口 |

別Runtimeの引継ぎは、元記録が単一`stop_intent`である限定契約だけを受理する。現在Runtimeの継続記録がまだなければ、元の`stop_intent`を現在phaseとして継承し、同じphaseの継続記録をseedとして追記する。その後は公式停止を再発行せず、停止状態のfreshな観測からだけ再開する。原記録は保持し、任意の旧phase継続は保証しない。Host・Home・Runtime Stateの3 Lock、Native実体と旧CLI不存在を確認して引継ぎを確定し、待機後にも境界・取消を照合する。これらはSource接続の説明であり、新署名・実機停止再開の成功は未確認である。

利用側への伝播対象は、公開Help／引数Parser／Dispatcher、Native要求と結果、保護記録の読取りと再入場、Task復旧、結果投影、署名依存集合およびWorkflowとする。正常再起動、対象なし、他Task稼働、観測不能、停止中断、起動失敗、資源残存、取消、親喪失および再入場を契約試験から公開入口の結合試験へ対応付ける。再入場は保存済みphaseごとに、前のEffectを再発行せず現在状態を観測して次の耐久phaseへ進める経路を持つ。とくに`start_intent`は起動要求済み・結果未確定を表すため、Engine Readyのfreshな観測から`ready`へ収束できなければならない。

Docker create要求の耐久化後に応答を失った状態は、Engineの空一覧だけから未作成へ収束させない。ただし、同じ選択ユーザー・保護Root・Policyへ結合されたDocker Desktop最終復旧が当該要求より後にProcess世代を切り、Engine再起動・安全状態・Evidence保持を確認して終了した場合、その署名済み履歴を再起動境界として利用できる。現在のRuntime Authorityと旧復旧記録の由来確認を分離し、旧manifestは履歴検証だけに使って実行Capabilityを発行しない。対象Taskのexact名と所有labelがともに不存在であることを再観測し、その結果と復旧記録hashをTaskのOperation Directoryへ耐久化した後だけ、未知のcreate結果をEffect 0へ収束させる。順序、由来、終了状態または不存在のいずれかが不明なら回復義務を保持する。

旧ReleaseのDocker Desktop修復履歴を引き継ぐ場合は、明示された修復記録の生成元Release Rootに新配置または旧配置の署名manifestがexactに一つだけ存在することを要求する。両配置の併存、両方の欠落、非canonical byte、署名不成立または履歴とのIdentity不一致では引継がない。旧配置を読むことは履歴検証に限定し、現在のRuntime Authority、修復AuthorityまたはProvider Effectへ流用しない。公開DoctorのHelp、引数ParserおよびDispatcherは、再起動Fence付きTask Recoveryに必要なexact Recovery ID、修復IDおよび、その修復IDを発行した署名済み配布Rootを`--repair-release-root`として同じ閉じた文法で到達可能にしなければならない。このRootはDocker Taskの生成元ではない。現在の署名版が修復IDを発行した場合は現在の署名配布Root、旧版が発行した場合はその旧署名配布Rootを指定する。

選択ユーザーの安定IdentityとログオンSession Identityを分離する。安定Identityは、再ログオンをまたいで同じ所有者の耐久記録を相関する根拠であり、それだけでは現在の変更権限にならない。旧記録のログオンSession Identityは発行時の証拠として上書きしない。現在の変更権限は、現在の署名済みRuntime、Native helper、Root Identityと保護、Policy、物理Lock、および変更直前・直後の現在Session観測がすべて成立した場合だけ得られる。旧Sessionのhandle、Capability、helper、Provider Home許可またはLockを再利用しない。

再ログオン後のDocker Desktop修復履歴は、元記録を変更せず、前後Session、安定Identity、Runtime実行Identity、直前の引継ぎhashを持つ順序付きの引継ぎ記録を別途追加する。終了済みの旧修復は、現在のDocker状態を観測・変更できない場合でも、由来、原記録、引継ぎ連鎖および現在境界を確認し、Effect 0で履歴の採用と終了を記録できる。現在のDocker障害は同じ修復の再開とはせず、新しい修復Operationとして扱う。未終了の旧修復は、段階ごとに安全な再開、現在状態のexactな観測と収束、または同じ修復IDを保持した停止へ分類し、履歴採用だけでHost Effectを再発行しない。

未終了の旧修復が現在Sessionへ正しく引き継がれた後、現在Engineが既知の停止、現在のDocker Process集合の存在または不存在が確定し、旧stale対象が明示的不在、かつ現在の`Docker/run`と同じIdentityに既知のlock障害がある場合は、明示終了操作により旧履歴の不確定Effectを証拠として保持して閉じ、新しい修復Operationを許可できる。現在の`Docker/run`が旧記録から別世代へ置換済みでも、freshな二回の観測とlock対象が同じ現在世代へ一致する場合だけこの分類を使う。この処置はDockerの復旧成功も旧Effectの不存在も意味せず、`manualRecoveryRequired`を維持し、Host Effectを発行しない。新しい修復だけが現在Authorityの下で停止、`run`世代退避、再起動およびEngine確認を行う。これにより「旧履歴を閉じるには既に復旧済みであることが必要だが、復旧するには旧履歴が閉じていることが必要」という循環を作らない。

既知のruntime directory lockは特定のsocket名へ固定しない。検証済みの`Docker/run`直下だけを有限件数で列挙し、子Directoryまたはlinkを拒否し、項目集合とDirectory Identityが観測前後で不変で、少なくとも一つの直下項目が既知のlock errorを返す場合だけ認定する。名前の追加だけで修復範囲を拡張せず、列挙不能、件数超過、境界変化または未知errorではEffect 0とする。修復Effectは個別項目を削除せず、信頼済みProcess停止後にexactな`run` Directory全体を同一親内へ退避する。

Runtime利用側は履歴の有無だけで処置を決めない。`不正 → 履歴なし → 終了済み → 現在Session結合済み → 旧Session結合`の順で排他的に分類する。現在Session結合はboolean表示だけでなく、履歴が返す現在Session Identityと準備済み境界のIdentityが一致した場合だけ成立する。旧Session結合ではStoreの正式な引継ぎ処理をexactに1回呼び、元Operation、元adoption、ledgerおよび履歴連鎖の不変fieldを保持したまま、handoff件数、handoff tipおよび現在Session結合だけが許可どおり変化したことを再読取りで確認する。Storeへの書込み後に返値検証または後段が失敗しても、正規記録をrollback、削除または上書きせず、同じ修復IDを保持して次回inventoryから再分類する。終了済み履歴では現在境界の認証とread-only報告に必要なhelper確認を許すが、新しいhandoff、closure、Host観測またはHost Effectを発行しない。

Docker Task Recoveryは元のRecovery IDと発行時Sessionの証拠を保持し、再ログオン時は同じ安定Identity、元の耐久記録、現在の保護境界および現在Sessionを結ぶ順序付き引継ぎ記録を追加する。引継ぎ後も変更前にHost世代、論理Home、Runtime Stateの各Lockを取得し、外部観測の間だけ解放したLockを同じIdentityで再取得してから続行する。Docker Desktop再起動Fenceは、終了済み修復記録と現在のfreshなEngine・資源不存在観測が両方成立した場合だけ利用でき、履歴の採用または引継ぎだけでは成立しない。

いずれの引継ぎ連鎖も件数を上限8に制限し、自己参照、循環、分岐、番号飛び、前後Session不一致、Identity不一致、改変、部分書込みまたは上限超過をEffect 0で拒否する。Releaseは`origin <= adoption <= handoff[0] <= ... <= handoff[n] <= closure <= current boundary`の単調な連鎖とし、同じRelease番号では同じ署名済みRelease Identityだけを許す。将来Release、降格または同じ番号の別Identityが混在する連鎖は採用しない。

新しい履歴記録は同一Filesystem上の準備fileをflush・再読取りした後にhard linkで排他的に公開し、単一の勝者だけを採用する。読取り専用の利用側は、公開済みtargetだけ、公開済みtargetと同一fileの準備残存、準備fileだけ、不正または観測不能を区別し、残存物を削除せず、準備残存を含む履歴全体を`verified`または完了へ昇格しない。現在の署名済みRuntime、検証済みRoot／保護／Policy、現在Sessionおよび外側Lockを確認済みの対象限定persist経路だけが、期待byteと同一file Identityの準備残存を削除して公開済みtargetへ収束できる。共有公開処理のbyte一致やhard link成立自体はAuthorityを作らない。別file、別候補、未知名、不正byte、部分file、観測不能またはDirectory境界の確定不能では何も削除せず、元記録と同じRecovery IDを保持して停止する。

公開成功は、Platform固有の確定確認、freshなtargetのexact byte、および準備fileの明示的な不存在を同じ最終判定で再確認した場合だけ成立する。POSIXではfileのflushに加えてDirectoryを`fsync`する。Windowsでは同じ呼出し中のDirectory Identity不変と最終形状を確認し、Process crashまたは再ログオン後に安全に再分類できることを保証するが、Directory metadataの電源断耐久性までは主張しない。したがって、この契約を「耐久公開」ではなく「回復可能な公開（Recoverable Publication）」と呼ぶ。

異なるbyteの同時公開では、勝者が作った最終共有状態と敗者の局所結果を混同しない。敗者は公開前の競合拒否としてEffect 0を返し、敗者固有の開始状態または終了状態を捏造しない。全Process終了後の共有観測は、targetが勝者のexact byte、準備fileが不存在、状態が`STATE-REPAIR-HISTORY-PUBLISHED`であることを別に確認する。

<a id="14-consoletask内部搬送回収の実装契約"></a>

## 12. 利用者との対話

利用者に示す質問は、何を承認するか、何が送信・変更されるか、入力後に何が起きるかを主要ロケールで先に示す。開始だけのEnter、公開確認値、秘密passphraseを区別する。通常運用では初期設定後の送信確認を再要求せず、Release鍵passphraseはRelease署名時だけHuman-only入力とする。

機械結果と人間表示を分離する。文字化け、二回Enter、入力reader失敗、ウィンドウ自動閉鎖または結果未保存はUX不具合であり、Security上のfail closedだけを理由に受容しない。

<a id="11-変更と検証"></a>

## 13. 検証接続

固定候補では、単体試験だけでなく次を確認する。

- 公開CLI閉集合と`capabilities --json`
- manifest revision 5、閉じたRuntime実行集合、Policy、単一Native成果物、改変・欠落・旧Schema拒否
- 正常、準正常、異常のTask／Review／Remediation
- timeout、cancel、Provider失敗、owner loss、cleanup不明、fresh recovery
- Codex→Claude、Claude→Codex、同一Provider例外の4経路
- 実端末の表示、一回入力、取消、結果保存
- cleanup後のContainer、network、Mount、lock、候補一時領域およびRecovery残存

設計要素から実装symbol、試験、観測方法および終了後条件への対応は`runtime/coordinator-runtime-traceability.json`で機械確認する。機械試験は独立レビュー、Architecture／Security、Gap／Impact、DocumentおよびConformance監査を代替しない。

### 13.1 機械Traceへ結合する設計ID

次のIDは本文の状態・資源・遷移・不変条件に安定した機械参照を与える。JSON側が意味を新設するのではなく、本節の集合と本文の設計を試験へ結合する。追加・削除・意味変更では、本文、JSON、実装所有者、正常・準正常・異常の試験および終了後観測を同じ変更で更新する。

資源ID:

```text
`RES-HOST-GENERATION`          Host Operation lockと作業Directory
`RES-LOGICAL-HOME-LOCK`       Provider Home単位の排他
`RES-RUNTIME-STATE-LOCK`      Runtime Stateの限定読書き排他
`RES-INTERACTIVE-CONSOLE`     Console lock、reader、pipe、child
`RES-MOUNT-GRANT`             一回限りCapabilityとMount lease
`RES-DOCKER-OWNED`            Provider child、Container、network
`RES-OPERATION-WORKSPACE`     隔離Workspace
`RES-CANDIDATE-ENTRY`         耐久Candidate Store entry
`RES-TASK-CONTROL`            Process-local取消・終端Capability
`RES-REPAIR-HISTORY-PREPARE`  修復履歴を排他的に公開する同一Filesystem上の準備file
```

状態IDは主系列と終端・回復系列を分ける。

```text
`STATE-ADMISSION`
→ `STATE-OPERATION-ACQUIRING`
→ `STATE-OPERATION-READY`
→ `STATE-TASK-AUTHORIZED`
→ `STATE-EXECUTOR-CLEAN`
→ `STATE-CANDIDATE-CAPTURED`
→ `STATE-REVIEWER-CLEAN`
→ `STATE-CANDIDATE-STAGED`
→ `STATE-HOST-CLEAN`
→ `STATE-RESULT-PUBLISHED`

`STATE-REMEDIATION-AUTHORIZED`
→ `STATE-REMEDIATION-EXECUTOR-CLEAN`
→ `STATE-REMEDIATION-CANDIDATE-CAPTURED`
→ `STATE-REMEDIATION-REVIEWER-CLEAN`

`STATE-BLOCKED-CLEAN`
`STATE-PROCESS-RESTART-REQUIRED`
`STATE-DURABLE-PAIR-PARTIAL-PRE-EFFECT`
`STATE-RECOVERY-REQUIRED`
`STATE-OPERATOR-TRANSFER-REQUIRED`
`STATE-RECOVERED`

`STATE-REPAIR-HISTORY-ABSENT`
`STATE-REPAIR-HISTORY-PREPARE-ONLY`
`STATE-REPAIR-HISTORY-TARGET-WITH-SAME-FILE-PREPARE`
`STATE-REPAIR-HISTORY-TARGET-ONLY`
→ `STATE-REPAIR-HISTORY-PUBLISHED`

拒否される永続形状:
`STATE-REPAIR-HISTORY-FOREIGN-PREPARE`
`STATE-REPAIR-HISTORY-CONFLICT-TARGET`
`STATE-REPAIR-HISTORY-CONFLICT-TARGET-WITH-PREPARE`
`STATE-REPAIR-HISTORY-UNKNOWN`

`STATE-REPAIR-HISTORY-PRIOR-SESSION`
→ `STATE-REPAIR-HISTORY-CURRENT-SESSION`

`STATE-SESSION-HANDOFF-RECOVERY-REQUIRED`
→ `STATE-RECOVERED`
```

遷移ID:

```text
`TRANS-ADMISSION-TO-OPERATION-ACQUIRING`
`TRANS-OPERATION-ACQUIRING-TO-READY`
`TRANS-OPERATION-TO-AUTHORIZED`
`TRANS-AUTHORIZED-TO-EXECUTOR-CLEAN`
`TRANS-EXECUTOR-TO-CANDIDATE`
`TRANS-CANDIDATE-TO-REVIEWER-CLEAN`
`TRANS-REVIEWER-TO-REMEDIATION`
`TRANS-REMEDIATION-AUTHORIZED-TO-EXECUTOR-CLEAN`
`TRANS-REMEDIATION-EXECUTOR-TO-CANDIDATE`
`TRANS-REMEDIATION-CANDIDATE-TO-REVIEWER-CLEAN`
`TRANS-REVIEWER-TO-STAGED`
`TRANS-REMEDIATION-REVIEWER-TO-STAGED`
`TRANS-STAGED-TO-HOST-CLEAN`
`TRANS-HOST-CLEAN-TO-RESULT`
`TRANS-ACTIVE-TO-BLOCKED-CLEAN`
`TRANS-ACTIVE-TO-RECOVERY`
`TRANS-ACTIVE-TO-OPERATOR-TRANSFER`
`TRANS-ACTIVE-TO-PROCESS-RESTART`
`TRANS-HOST-CLEAN-TO-PROCESS-RESTART`
`TRANS-PARTIAL-PAIR-TO-RECOVERY`
`TRANS-RECOVERY-TO-RECOVERED`
`TRANS-REPAIR-HISTORY-ABSENT-TO-PUBLISHED`
`TRANS-REPAIR-HISTORY-PREPARE-ONLY-TO-PUBLISHED`
`TRANS-REPAIR-HISTORY-SAME-FILE-PREPARE-TO-PUBLISHED`
`TRANS-REPAIR-HISTORY-ABSENT-TO-SAME-FILE-PREPARE`
`TRANS-REPAIR-HISTORY-ABSENT-TO-TARGET-ONLY`
`TRANS-REPAIR-HISTORY-TARGET-ONLY-TO-PUBLISHED`
`TRANS-REPAIR-HISTORY-CONCURRENT-SAME-BYTE-TO-PUBLISHED`
`TRANS-REPAIR-HISTORY-CONCURRENT-DIFFERENT-BYTE-WINNER-TO-PUBLISHED`
`TRANS-SESSION-HANDOFF-TO-RECOVERED`
`TRANS-REPAIR-HISTORY-PRIOR-TO-CURRENT-SESSION`
```

公開を拒否する試行は状態遷移ではない。次の試行分類を使い、観測した形状を変更せずEffect 0で停止したことを検証する。

```text
`ATTEMPT-REPAIR-HISTORY-FOREIGN-PREPARE`
`ATTEMPT-REPAIR-HISTORY-CONFLICT-TARGET`
`ATTEMPT-REPAIR-HISTORY-CONFLICT-TARGET-WITH-PREPARE`
`ATTEMPT-REPAIR-HISTORY-UNKNOWN`
`ATTEMPT-REPAIR-HISTORY-CONCURRENT-DIFFERENT-BYTE-LOSER`
```

不変条件ID:

```text
`INV-NO-PROVIDER-EFFECT-BEFORE-AUTHORITY`
`INV-LOCK-ORDER-AND-REVALIDATION`
`INV-SESSION-BOUND-AUTHORITY`
`INV-DURABLE-BEFORE-EFFECT`
`INV-STAGE-CLEAN-BEFORE-HANDOFF`
`INV-CANDIDATE-EXACT-AND-NONCANONICAL`
`INV-BOUNDED-REMEDIATION`
`INV-RESULT-AFTER-CLEANUP`
`INV-HOST-CLEANUP-AFTER-DOCKER-CLOSURE`
`INV-CLEAN-BLOCK-HAS-NO-RECOVERY`
`INV-UNKNOWN-PRESERVES-RECOVERY`
`INV-REPAIR-HISTORY-RECOVERABLE-PUBLICATION`
```

主系列外の遷移は、発生時点のActive状態から安全な終端へ移る。`BLOCKED-CLEAN`は全資源不存在とRecovery IDなし、`PROCESS-RESTART-REQUIRED`は資源回収済みだがProcess再利用不可、`RECOVERY-REQUIRED`はexact Authority付きEvidence保持、`OPERATOR-TRANSFER-REQUIRED`は安全な自動処置に足るAuthorityがない状態である。この四つを同じ`blocked`表示だけで同一視しない。

修復履歴のFilesystem形状と、呼出し単位の回復可能な公開成立は分ける。`STATE-REPAIR-HISTORY-TARGET-ONLY`はFilesystem上のtarget-only形状であり、その観測だけから現在の呼出しがPlatform固有の確定確認まで完了したとは扱わない。現在の呼出しがPlatform固有の確定確認、targetのexact byte、準備fileの明示的な不存在を再確認した場合だけ`STATE-REPAIR-HISTORY-PUBLISHED`へ進む。外来準備file、競合targetまたは観測不能は遷移させず、対応する`ATTEMPT-*`分類として元の形状を保持する。異byte競合の敗者は局所試行の拒否であり、最終共有状態は勝者の公開結果として別に観測する。

<a id="project-runtime-reference-architecture"></a>

## 14. Project Runtime参照アーキテクチャ

v0.19は既存Task Runtimeを複数Task対応へ直接膨張させず、その上位にProject Runtimeを置く。Interface、永続Record、資源・Lock、Effect順序、失敗注入点および実装・検証対応は[Project Runtime詳細設計](03_Project_Runtime_Design.md)を参照する。

```text
MCP／CLI
  → Objective Intake
    → Project Context／Milestone
      → Objective Planner
        → Task Graph／Scheduler
          → Single Task Runtime × N
        → Integration Verification
      → Project State／Replanning／Human Escalation
```

Parent CoordinatorはProject Context、Objective Planning、Task Graph、Scheduling、Project State、ReplanningおよびIntegrationを所有する。Single Task Runtimeは、Repository Revisionへ結合した一つのTask、Executor／Reviewer、Candidate、RecoveryおよびAccepted Resultの既存契約を保持する。子Taskは新しいTaskの作成、Authority拡張、他TaskのCandidate採用またはMilestone Acceptanceを自己決定しない。

SchedulerはTask Graph上のDependencyだけでなく、許可Path、共有資源、仕様・判断前提、Lock、Provider利用枠およびIntegration Boundaryを実行可能性へ含める。最大同時実行数5は資源上限であり目標値ではない。開始、完了、失敗、取消、依存先停止またはParent喪失のたびに実行可能集合を再計算し、古いReady判定をそのまま使用しない。

Project StateはRuntime所有の現在状態であり、Roadmap、CHGまたはProvider出力を状態Storeにしない。各TaskのOperation／Candidate／Recovery IdentityとProject／Milestone／Objectiveの関係を保持し、取消・回復・期限切れ後に別TaskのIdentityへ読み替えない。Project Runtimeのcleanupは、全子Taskの終了と所有資源の観測後にだけ成立する。

最初のMCP縦断経路は、`crdd.run_objective`でObjective Intakeから既存Single Task Runtimeを一回実行して結果を返す範囲に限定する。同じ認証済み主体・Project／Milestone・request identityの再送はOperationを増やさず、最新Project State、現在の判断要求または終端結果を返す。人間判断は`crdd.submit_decision`だけから現在の判断要求へ接続し、decision ID、Project／Milestone、世代、改訂版、選択肢、選択ユーザーのOS principal、および判断発行時にRuntimeが作った一回限り・期限付き継続CapabilityをRuntimeが再確認する。Capabilityのraw値はClientへ一度だけ返し、RuntimeはRepository外のOS管理・Runtime保護Rootへ、対象と主体へ結合したhash、期限、消費状態だけを保存する。Platform AdapterがRoot identity、選択ユーザー、固定Volume、非reparse chain、Owner／Protectionおよびatomic updateを確認できない場合はEffect 0にする。Root間の原子性は仮定せず、保護Recordへapplication IDとexpected／new Project世代を`prepared`として耐久化し、Decision／MilestoneをProject Stateへ一括適用してreadbackした後、保護Recordを`finalized`へ進める。Project Stateだけが不明で保護Rootを更新できる場合は、別の検証済みRecovery Storeへ回復意図を先に耐久化して保護RecordをRecoveryへ進める。保護Root自体が不明なら同Rootの遷移を主張せず、別Recovery Storeだけへexactな回復意図を残す。そのStoreも不明なら手動回復・Effect不明・Process再利用禁止とする。再起動時は回復意図、保護Root、Project StateのID・世代・dispositionをfreshに結合し、継続Recordを収束させてから回復意図をsettleする。Queueは`finalized`とProject Stateの一致を確認した後に別の短時間更新で一度だけLeaseする。無効入力は正規Capabilityを失効させない。応答喪失では同じ`run_objective`へ明示的な置換意図と置換request identityを渡し、旧hash失効後だけ新しい1件を発行する。MCP固有Project Model、Repository直接操作、MCP ClientからのAuthority継承、内部Task／Scheduler／再計画／統合の直接操作または複数Repository探索を追加しない。`crdd.get_project_state`はv0.20以降の保留候補であり、v0.19の公開面に含めない。

保護Root更新の応答・readback喪失は、更新種別とfreshな観測結果を組にして回復する。初回作成後のexactな`absent`＋raw未返却＋Project未適用、および期限更新後のexactな`expired`＋Project未適用は継続遷移なしで回復意図をsettleできる。freshな`issued`はRecovery Authorityで`invalidated`、freshな`prepared`は`recovery_required`へ進め、matching new／verified old-unappliedの既存照合へ接続する。必要な継続Record更新をreadbackする前に独立Recovery Intentをsettleしない。

### 14.1 状態の責務分離

Project Runtimeは、Task、Objective、Milestoneの状態を一つの`status`へ畳み込まない。Taskは実行と資源回収、Objectiveは複数Taskの意味統合、Milestoneは人間が与えた受入条件に対する全体結果を表す。

| 対象 | 状態 | 意味 |
|---|---|---|
| Task | `planned` | Graphに存在するが実行可能性をまだ確定していない |
| Task | `waiting_dependency` | 先行Taskまたは人間判断の結果を待つ |
| Task | `ready` | 現在世代でDependency、Authority、競合および容量を確認済み。ただし開始直前に再確認する |
| Task | `starting` | SchedulerがTask attemptを耐久記録し、Single Task Runtimeへ開始を委譲中 |
| Task | `running` | Single Task RuntimeのOperationが開始済み |
| Task | `cleanup_pending` | Provider処理は終了したが、Process、Docker、Candidateその他の資源回収が未確定 |
| Task | `completed` | Task結果とcleanupを確認済み。Objective受入はまだ意味しない |
| Task | `failed` | 当該attemptが失敗し、計画維持、部分再計画または人間判断の分類を待つ |
| Task | `cancelled` | 取消と終了・cleanupを確認済み |
| Task | `recovery_required` | 現在の呼出しは終了できるが、Task Operationは終端していない |
| Task | `superseded` | 部分再計画により後継Taskへ置換され、新規実行対象ではない |
| Objective | `planned`／`executing` | Task Graphを計画済み／実行中 |
| Objective | `integration_pending` | 必要Taskは終了したが、Objectiveとしての整合確認前 |
| Objective | `accepted` | Objective固有の受入条件と統合を確認済み |
| Objective | `blocked`／`cancelled` | 継続条件がない、または取消済み。Milestone全体の結論とは分ける |
| Milestone | `planned`／`executing`／`integrating` | 計画済み、実行中、または全Objectiveの統合確認中 |
| Milestone | `human_decision_required` | 自動処置できない判断を、根拠と影響付きで人間へ返した |
| Milestone | `recovery_required` | 所有資源またはTask Operationが未終端で、通常実行を再開できない |
| Milestone | `accepted`／`cancelled` | 全受入成立、または取消と全資源回収を確認済み |

`failed`はTask attemptの結果であり、Milestoneの最終結果ではない。`completed`はTaskの実行完了、`accepted`はObjectiveまたはMilestoneの意味上の受入である。`recovery_required`は呼出し終端になり得るがOperation終端ではない。Project Stateの世代、Task attempt IDまたは観測が不明な場合は、近い正常状態へ補正しない。

### 14.2 遷移と再評価

Project Runtimeは、次の処置を一つの状態更新として混ぜない。

1. 入力とProject Bindingを検証し、Milestone Scope、受入条件、Authority上限および実行予算を固定する。
2. ObjectiveとTask Graphを作り、cycle、欠落Dependency、許可Pathおよび共有前提を検証する。
3. 短時間のProject State更新で、現在世代に対するTask attemptと`starting`を耐久化する。
4. Project StateのLockを解放してからSingle Task Runtimeを呼び出す。
5. Task結果を受け取った後、Task attempt ID、Project世代、Operation／Candidate／Recovery Identityを再確認して状態へ反映する。
6. Taskの終了ごとに実行可能集合を再計算する。古い`ready`、空き枠、Provider状態または競合判定を再利用しない。
7. 必要Taskが終了したObjectiveだけを`integration_pending`へ進め、受入条件を独立に確認する。
8. 全Objectiveの受入後もMilestone全体のCross-task整合を確認し、その後だけ`accepted`へ進める。

Task失敗は、保持した計画で続行可能、承認Scope内の部分再計画、人間判断が必要、回復が必要、のいずれかへ分類する。部分再計画は置換前Taskを`superseded`として残し、後継Taskと理由を新しい世代へ接続する。既存Task IDの意味を書き換えない。Parent喪失後は新しいTaskを開始せず、所有Taskと回復Recordを照合してから、再開、判断移送または回復へ進む。

### 14.3 資源と所有者

| 資源 | 所有者 | 解放・終端条件 |
|---|---|---|
| Project Operation lease | Parent Coordinator | Parent終了後の所有喪失を観測し、全Taskを照合して引継ぎまたは終了 |
| Project Stateと世代 | Project Runtime State Store | Milestone終端と保持Policy成立。更新はexpected generation一致時だけ |
| Scheduler capacity slot | Scheduler | 対応TaskのProcess不存在とcleanupを確認後。cleanup不明では空きと推定しない |
| Task attempt binding | Parent Coordinator | exact Task／attempt／Single Task Operationの終端確認後 |
| Task固有資源 | Single Task Runtime | v0.18のCandidate、Mount Grant、Provider Home、Docker、Process、Recovery契約に従う |
| Conflict reservation | Scheduler | 変更Path、共有資源および意味前提への影響が解消済みと確認後 |
| Integration workspace | Integration owner | 統合結果の採用・破棄とcleanupを確認後。正本Repositoryへの採用とは分離 |
| Cancellation controller | Parent Coordinator | 全対象Taskへの通知後ではなく、終了とcleanup観測後 |
| Recovery evidence | 発行したRuntime | exact Recovery Identityで完了を確認後。別Taskや別Projectへ付け替えない |

同時実行数は`starting`、`running`および実行資源が残る`cleanup_pending`の合計を最大5とする。`recovery_required`はProcess不存在を確認できるまで容量を占有し、確認後もConflict reservationを回復完了まで保持できる。これにより、数値上の空き枠を理由に同じPath、Provider Homeまたは共有資源へ二重Effectを発行しない。

### 14.4 Lock順序と待機禁止

Project Runtimeの上位順序は、`Project Operation lease → Project State lock → 短時間の世代更新`とする。Single Task Runtime固有のHost、Runtime State、Provider Home、Candidate Storeその他のLockは、Project State lockを解放した後に既存順序で取得する。Project State lockを保持したまま、Provider、Docker、MCP response、子Process、Human DecisionまたはIntegrationの長時間処理を待たない。

外部処理後の状態反映ではProject State lockを再取得し、expected generation、Task attempt ID、Parent owner generationおよび結果Identityを再検証する。不一致なら結果を別Taskへ適用せず、観測済みのSingle Task側cleanup／Recovery情報を保持してProject側を`recovery_required`または`human_decision_required`へ閉じる。Lock取得失敗、解放不明または世代不明をRetryだけで正常化しない。

### 14.5 対話作業とスケジュール実行の競合

Project Operation leaseだけでは、Runtime外で進む対話編集を完全には観測できない。そこでProject Runtimeは、Repository Bindingごとに耐久Operation Queueと正本採用Leaseを持ち、対話起点を既定の優先Lane、スケジュール起点を待機可能Laneとして扱う。Queue recordは`.crdd`配下の機械可読状態であり、MDは人間向け投影に限定する。

スケジュール起点は、別の許可済み入口が作成したObjectiveを搬送する起点分類に限る。Project Runtime自身が時刻またはRepository EventからObjective、Scope、Authorityまたは優先順位を生成する構造にはしない。

Operation Queueは`queued → leased → running → integration_pending → completed`を正常系とし、`waiting_foreground`、`replan_required`、`human_decision_required`、`recovery_required`、`cancelled`を分ける。Queue leaseはOS排他、owner generationおよびProcess生存観測で所有者を確定し、時刻またはfile存在だけで奪取しない。対話Operationの到着は未開始のスケジュールOperationを`waiting_foreground`へ移せるが、実行中OperationのAuthority、Effect、cleanupまたはRecovery義務を消さない。

各Operationは固定Revisionから隔離Workspaceを持つため、候補作成は安全な範囲で並行できる。正本採用はRepository単位の採用Leaseで直列化し、取得後に現在Revision、dirty state、変更Path、共有判断および候補の基準Revisionを再検証する。競合がなければ採用し、承認Scope内で解消可能なら再計画し、意味変更またはAuthority拡張が必要なら人間へ返す。Runtime外の直接編集を排他できるとは主張せず、開始前と採用直前の再観測で検出する。

### 14.6 AuthorityとEffectの縮小

人間が開始時に与えるMilestone Authorityは、Project Identity、Repository Revision、目的、受入条件、許可する読取り／変更範囲、Provider送信境界、費用・回数・時間、最大同時実行数、再計画上限および取消条件へ結合する。Parent Coordinatorは各Taskへこの閉集合の部分集合だけを派生できる。

Task、Reviewer、MCP Client、Provider出力またはRepository内文書は、Authority拡張、Scope変更、Risk受容、追加購入、API key fallback、別Repository BindingまたはMilestone Acceptanceを生成しない。承認済みScope内でTaskを選び直すだけなら人間へ反復確認しない。Scope、受入条件、決定権限、重大Riskまたは費用上限を変える必要がある場合だけ、現在結果、選択肢、影響および推奨を一つの判断単位として返す。

### 14.7 MCPの薄い縦断経路

最初のMCP経路は`objective intake → Project Binding検証 → Task exact 1件の計画 → 既存Single Task Runtime → 構造化結果 → Project State`だけを通す。MCP AdapterはTransport decode、request identity、取消通知および結果encodeを所有し、Project Model、Scheduler、Repository操作またはAuthority判断を所有しない。

初期Adapterは[Model Context Protocol 2026-07-28](https://modelcontextprotocol.io/specification/2026-07-28)のstateless per-request方式を固定し、Protocol version、client capabilitiesおよび任意のclient infoを各Requestの`_meta`で検査する。`server/discover`、`tools/list`および`tools/call`の薄い閉集合だけを公開し、旧Handshakeのsession状態をProject Stateへ持ち込まない。後方互換が必要な場合もTransport Adapterでversion negotiationを行い、Project CoreのAuthority、Identityまたは状態遷移を変えない。client infoは自己申告の互換・表示情報であり、Project Bindingや実行Authorityの根拠にしない。

MCP接続切断はTask取消の依頼になり得るが、終了確認ではない。実行中取消の検証では、handle返却、選定通知またはController起動をProvider Process開始の代用にしない。Runtime所有ProcessがOSの起動成功と有効なPID／標準入出力の所有を確認し、対象Objective、Task Role、Providerおよび一意なOperation IDを持つ開始通知の書込み完了まで観測した後だけ取消要求を発行する。同期または非同期の起動失敗は開始通知0で停止し、通知の失敗または観測不能は取得済みProcessを終了して成功を返さない。E2Eは選定と開始を一列の閉じた順序として照合し、全実行間でOperation IDを再利用しない。同じ対象に属する終了、cleanup、回復義務と正本Effectを相関する。切断後もParent CoordinatorがTask cleanupを完了し、結果を再取得可能なProject Stateへ保存する。request重複は同じOperationを二重発行せず、同じidempotency identityに対する現在状態を返す。入力不正、Project Binding不明またはAuthority不足ではSingle Task Runtimeを呼び出さずEffect 0で停止する。

MCP AdapterはOS固有のConsole、Path、Process起動またはFilesystem IdentityをProject Coreへ持ち込まない。stdio／HTTP等の搬送方式とWindows／Linux／macOSのProcess・Filesystem方式を直交する境界として扱い、同じMCP requestを同じProject Runtime意味へ投影する。対応Platformごとにframing、UTF-8 byte、切断、取消、重複requestおよび終了後cleanupを実入口で確認するまで、その組合せを対応済みと表示しない。

### 14.8 正常・準正常・異常の設計基準

| 分類 | 代表経路 | 必要な終了観測 |
|---|---|---|
| 正常 | 独立Taskを1～5件実行し、Dependency順に後続を開始、Objective統合、Milestone受入 | 全Task cleanup、Conflict reservation解放、Integration成立、Project世代一致 |
| 準正常 | 5件超の待ち行列、1～4件だけの安全な並行、局所失敗後の部分再計画、同一request再送、取消済みTaskを除いた継続 | 上限順守、置換関係、重複Effect 0、取消Task終端、未実行TaskのAuthority非発行 |
| 人間判断 | Scope拡張、受入変更、共有判断の競合、重大Riskまたは費用上限超過 | 実行停止範囲、保持資源、選択肢と影響、再開条件を取得可能 |
| 異常 | cycle、欠落Dependency、6件目の同時開始、古い世代、結果Identity不一致、Parent喪失、cleanup不明、Recovery失敗 | 新規Effect 0または安全な停止、exact Recovery情報保持、成功非返却、別Taskへの結果混入0 |

設計上のPassはTask数や状態ラベルではなく、この表の終了観測とObjective／Milestone受入の成立で判定する。

<a id="project-runtime-platform-boundary"></a>

### 14.9 Project RuntimeのPlatform境界

Project Runtime Coreは、Project／Milestone／Objective／Task、Authority縮小、Task Graph、Scheduler判断、再計画、Integrationおよび受入意味を所有し、OS固有のPath構文、User Identity、Filesystem保護、Kernel Lock、Process tree、Console、Container HostまたはRecovery mechanismを所有しない。

```text
Project Runtime Core
  → Platform Contract
      → Windows Adapter（v0.19の実装対象）
      → Linux Adapter（後続判断。v0.19では未実装）
      → macOS Adapter（後続判断。v0.19では未実装）
```

Platform Contractは、実在する次の保証境界から抽出する。

| 境界 | Coreが要求する保証 | Windowsの現在方式 | Linuxの将来候補例 | macOSの将来候補例 |
|---|---|---|---|---|
| Principal／Provider Home | 選択ユーザー、固定Home Identity、所有・書込み主体、non-linkを検証 | Token、SID、Known Folder、DACL、reparse観測 | UID／GID、mode／ACL、local filesystem、symlink拒否 | UID／GID、POSIX ACL、Application Support等の明示Root、symlink拒否 |
| Filesystem／Repository | Root、Revision、Path、Identity、原子的更新、隔離を検証 | Windows handle／file identity、固定Root、atomic replace | directory fd、inode／device、境界付きPath解決、atomic rename | directory fd、inode／device、`openat`／`fstatat`等の境界付き解決、atomic rename |
| Lock／Lease | OS排他、owner generation、生存観測、時刻だけでない奪取 | named pipe／Windows kernel object、Process観測 | file descriptor lock、process identity、必要に応じたservice manager連携 | `flock`／`fcntl`等のKernel lock、process identity、必要に応じたlaunch service連携 |
| Process／取消 | argv、環境、Process tree、signal、終了、owner lossを観測 | Windows Process／Job／Console境界 | process group、signal、pidfd／cgroup等の観測 | process group、signal、process／event観測 |
| Container Host | 固定image、Network、mount、Process、cleanupを確認 | Docker Desktop Linux EngineとWindows Host接続 | Linux Docker Engineまたは同等の固定Container Runtime | 明示管理したVM／Container Runtimeと固定Host接続 |
| Runtime Root／Recovery | OS管理Root、権限、資源Identity、回復後不存在を確認 | Local App Data等の固定RootとWindows native観測 | XDG／system service等の明示RootとLinux native観測 | Application Support／Launch service等の明示RootとmacOS native観測 |

Linux／macOSの列は設計拘束ではなく、将来の専門探索候補である。同じAPI名または実装方式を要求せず、同じ保証を要求する。各Adapterを追加する変更で、対象OSの脅威、権限、配布、更新、cleanup、Recoveryおよび実測方法を確定する。

v0.19の責務分離では次を満たす。

- 新しいProject Runtime CoreはWindows固有module、`process.platform`分岐またはOS Path実値を直接参照しない。
- 既存Single Task RuntimeのWindows固有処理は、意味変更を伴わない単位からPlatform Adapterの背後へ移し、移行前後の同じ契約試験で保証を照合する。
- Platform AdapterはAuthorityを生成せず、Runtime Coreが与えた閉じたrequestを観測・限定操作へ変換する。
- 未実装PlatformをWindowsへfallbackせず、Platform Identity不明、Adapter不在または保証未成立ではEffect 0で停止する。
- Linux／macOS対応を理由にWindowsのSID／DACL、AppContainer、named pipe、Docker Desktop Recovery等の成立条件を弱めない。反対にWindows方式を他OSへ名前だけ移植しない。

この境界の完成はLinux／macOS対応の完成を意味しない。各Platform対応は別の成果物、Build、署名Identity、検証母集団およびRelease判断を必要とする。

## 15. 非目標

- Provider同士の直接spawn
- AIへのmerge、tag、Releaseまたは課金購入Authority
- API key課金fallback
- 永続Activation／Provisioning state
- Platform準備用SupervisorまたはAppContainer bootstrap
- 任意外部Toolへの無制限Authority
- Linux／Remote／Multi-projectの先行抽象化

将来Remote RuntimeやOrganization Runtimeが必要になった場合は、実在する利用者・運用・Authority・Recoveryから新しいArchitectureを設計する。削除済みのLocal Personal準備契約を互換性名目で復活させない。
