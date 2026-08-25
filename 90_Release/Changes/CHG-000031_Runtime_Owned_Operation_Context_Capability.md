# 変更トレース: Runtime所有Operation Context Capability（Runtime-owned Operation Context Capability）

- 変更ID: `CHG-000031`
- 状態: `In Review`
- 決定権限者: Qual-Lab
- 判断日: 2026-08-23
- 対象: CRDD公式Repositoryのprivate CoordinatorにおけるOperation IDのRuntime生成、opaque Capabilityへの結合および終了時失効
- 対象version: v0.18.0 Candidate
- 変更分類: `non-breaking`（新しいcontext／management APIを追加し、既存のprivate mount CapabilityとDocker隔離の回復遷移をfail-closedに強化する）
- 移行要否: `migration_required: false`（公開Schema、永続形式、実mountおよびProvider process出力は変更しない。新しいcontext／management APIのproduction consumerは0だが、既存mount Capabilityのproduction consumerである`docker-isolation.ts`は直接影響を受ける）
- 関連正本: [`16_Quality_Assurance.md`](../../16_Quality_Assurance.md)、[`19_Maintenance.md`](../../19_Maintenance.md#33-internal-typescript-runtime)、[`Coordinator README`](../../tools/coordinator/README.md)、[`脅威モデル`](../../tools/coordinator/threat-model.md)、[`CHG-000029`](CHG-000029_Provider_Home_Mount_Grant_Lifecycle_Foundation.md)、[`CHG-000030`](CHG-000030_Provider_Home_Mount_Grant_Runtime_Store.md)、[`Product Roadmap`](../../99_Roadmap/01_Product_Roadmap.md)

## 結論と変更経路

Runtimeが所有するOperation directoryの生成時にOperation IDを内部生成し、同じfactory所有object、生成時刻、root／parent／prefix、rootと全childのstable Filesystem Identity、Host recovery nonceおよび現行record Hash世代を確認できる間だけopaqueなOperation context Capabilityを発行する。同じprivate owner世代のcontext Capabilityとmount Capabilityからだけ、後続store用のopaqueなmanagement binding Capabilityを発行する。plain objectの複製、caller supplied Operation ID、別OperationのCapability組合せ、置換されたIdentity、失効済み世代およびOperation終了後の全Capability aliasは拒否する。確認済みroot／child置換では世代を`retired`へ不可逆に固定し、Filesystemを元へ戻しても同じ世代からCapabilityを再発行しない。

この変更はCHG-000030で確認したAuthority provenance欠陥への先行是正であり、Runtime store、Grant issuer、Provider Home保護、mount、Claude process、Credential、Networkまたは課金Effectを発火しない。後続storeはplainなOperation ID、plainな検証結果または既存mount Capability単独をAuthority入力として受けず、opaqueなmanagement binding Capabilityを直接受ける専用Effect境界からだけOperation bindingを取得する。

変更はCredential Homeの将来mount Authorityへ接続する非自明なsecurity変更である。着手前整合では実行環境、Provider Home、Mount Grant、QA、内部TypeScript境界およびCHG-000030の却下理由を確認した。完成固定版ではAgent／Architecture／Security Review、Document Audit、Gap／Impact AuditおよびConformance Auditを同じ改訂版へ実施する。公開CLI、採用Repository Schema、Communication、Discovery、管理対象依存および外部情報処理は変更しないため非該当である。

## 発火、非発火、境界および情報不足

- 発火例: Runtimeが生成し所有中のOperation objectから、置換されていないrootと全child、同一の回復世代を確認できる場合だけopaque context Capabilityを発行する。同じowner世代のcontextとmountからだけopaque management bindingを発行し、検証時に同一のRuntime生成Operation ID、生成時刻およびmanagement scope結合済み状態だけを返す。
- 非発火例: caller suppliedのOperation ID、plain object、Capabilityのspread copyおよび未知objectはCapabilityとして受理しない。Capability発行と検証はProvider Home、mount、Credential、Network、Provider processまたは課金Effectを発火しない。
- 境界例: 同じOperationへcontext、mountおよびmanagementの複数aliasを発行しても同一Operation ID、回復nonceおよび現行record Hash世代へ結合する。rootまたはchildの確認済み置換ではrootが残っていても世代を`retired`へ固定して全aliasを不可逆に失効し、Identity復元後も再発行を拒否する。正常cleanupまたは検証済みHost recoveryが同一世代のroot消滅とmarker除去を確定した場合だけ世代記録を終了する。
- 判定情報不足例: Runtime所有Identity、root／parent／prefix、child集合、stable Filesystem Identity、回復nonceまたは現行record Hashを確認できない場合は、Pathが存在してもCapabilityを発行・検証しない。active rootに対する別nonceまたは古いrecord Hashはroot観測・削除・世代失効より前にblockedとし、active世代へ作用させない。Identityが一致したままのaccess error、未知entryまたはmarker不成立でcleanup／recoveryが停止した場合はcurrent callをblockedとするが、Operation終了やalias失効を先取りしない。

## 保持する意図と目指さないこと

既存subscription OAuthだけを使い、API key、追加credit購入、Host Credential、token copy／injectionおよびPath開示を許可しない境界を保持する。ローカルOS user単位、Provider単位の専用Home、最長5分・1回限りのMount GrantおよびOperation終了時失効という後続要件も変更しない。

本変更はselected local user binder、Provider Home owner／DACL／non-reparse保護Effect、Provider settings分離、Grant store／clock／issuer、mount Adapter、実login、実Provider AdapterまたはGate openを目指さない。Operation context Capabilityの成立をProvider Home保護済み、Grant発行済み、実Provider readiness、StableまたはReleaseへ読み替えない。

## 検証設計と現在品質状態

- Runtime生成IDの形式、同一Operationのbinding、context＋mountの同一owner結合、opaque表示、複製・偽造・cross-operation拒否、root／child置換後の不可逆な世代失効、通常cleanup／Host recovery後の全alias失効、非置換型の処置停止で早期失効しないこと、同一nonceでのrecord Hash遷移、古いHashおよび別nonce markerがactive世代へ作用しないことを直接試験する。
- Coordinator strict typecheck／lint／format、全contract test、Checker package testおよびRepository全体checkerを確認する。
- 完成候補commitとtreeを固定して必須監査集合を実施し、指摘を一括統合してから是正する。

初回実装候補commit `93293b82aecffd735d91a0a4b3490dfbb24d7616`／tree `515470075011ede7c8a7a33c47e593b5bc744e53`と監査対象commit `686e29551ddf4cbceb722c4e3a48d8acc620e861`／tree `ee484ef9ff723e0a548e47d42aabbd97c3a85c87`を固定した。基準Node.js `v24.19.0`でCoordinator strict typecheck／Biome lint／formatはPass、全contract testは401／401、Checker contract testは151／151、Repository全体checkerは542 files、346 Markdown、1,994 local links、577 anchors、Error 0／Warning 0だった。

初回監査の統合是正後、Coordinator checkはPass、全contract testは405／405となった。直接試験はRuntime生成ID、同一Operationの複数alias、opaque表示、plain copy／偽造、contextとmountのcross-operation組合せ、rootだけの置換、child置換、非置換型cleanup／recovery停止、通常cleanupおよびHost recovery成功によるcontext／mount／management全alias失効を確認した。実Provider、Docker、Network、OAuth、Provider Home保護／mountまたは課金Effectは発火していない。contract testは所有する一時Operation directoryと外部回復recordを作成・cleanupする試験Filesystem Effectを含む。

最新是正後の全contract testは410／410である。新しいcontext／management APIのproduction consumerは引き続き0だが、既存mount Capabilityのconsumerである`docker-isolation.ts`は、通常probe、動的Fake異常scenario、取消verificationおよび明示Docker recoveryで直接影響を受ける。通常probe／異常scenario／取消のsubmission開始・送信前取消は同じopaque mount CapabilityをHost record遷移へ渡し、active process-local世代のnonce、直前Hash、次Hashおよびroot／child Identityをmarker書換え前に再確認する。`docker_absent_confirmed`はDocker module内の3軸不存在one-shot Capabilityを検証した非公開経路だけがmarkerを更新し、active世代のHash同期は書換え済みrecordを変更しない狭いadopt境界へ分ける。process再起動後の明示recoveryも同じ非公開のDocker不存在Capability経路を維持し、raw token、mount Capabilityおよび状態文字列だけではabsenceへ遷移できない。出力Schemaと永続record Schemaは変えず、既存contract testの通常／異常／取消／recovery経路および追加したactive／no-active、wrong mount、old Hash、別nonce、Hash遷移試験で確認した。実Docker Engineの再実行は本変更の単体固定版では発火しておらず、全実Docker failure分岐をVerifiedとはしない。

Coverageは`npm run dynamic-fake-provider:coverage --prefix tools/coordinator`がNodeの`--experimental-test-coverage`、単一process、逐次test、LCOV reporter、固定10 source／7 testを連続2回実行し、exact LCOV parserで分母・分子と未到達`line/block/branch`を検証した同一結果を使用する。payload SHA-256は`b32892272a1b99bbf50c136894de9444cd2024b9809f7ae66e273b66140ec507`が2回一致した。

`execution-environment.ts`はlines `1269/1350`（94.00%、不足81）、functions `57/58`（98.28%、不足1）、branches `247/305`（80.98%、不足58）である。未到達branchの一意な母集団は`196/B8`、`205/B9`、`220/B11`、`232/B13`、`296/B33`、`314/B41`、`324/B46`、`328/B48`、`330/B49`、`334/B51`、`339/B52`、`349/B56`、`356/B58`、`366/B59`、`372/B61`、`374/B62`、`393/B65`、`398/B67`、`441/B78`、`497/B87`、`514/B89`、`530/B91`、`595/B97`、`603/B98`、`640/B99`、`684/B100`、`700/B102`、`716/B104`、`720/B106`、`725/B113`、`733/B117`、`804/B136`、`843/B147`、`848/B148`、`871/B156`、`872/B158`、`875/B160`、`881/B161`、`955/B175`、`958/B177`、`1005/B195`、`1022/B199`、`1029/B207`、`1035/B210`、`1051/B212`、`1069/B220`、`1096/B231`、`1105/B232`、`1117/B238`、`1168/B254`、`1177/B256`、`1180/B258`、`1182/B260`、`1213/B264`、`1215/B266`、`1235/B274`、`1262/B289`、`1348/B304`である。

既存production consumerの`docker-isolation.ts`はlines `1358/2767`（49.08%、不足1,409）、functions `58/99`（58.59%、不足41）、branches `225/280`（80.36%、不足55）である。未到達branchの一意な母集団は`252/B4`、`265/B12`、`438/B17`、`483/B19`、`510/B24`、`570/B26`、`660/B40`、`690/B44`、`750/B59`、`778/B79`、`861/B92`、`862/B93`、`905/B118`、`1372/B142`、`1373/B143`、`1374/B144`、`1397/B151`、`1433/B157`、`1535/B171`、`1538/B172`、`1560/B174`、`1645/B198`、`1653/B202`、`1661/B204`、`1666/B206`、`1672/B209`、`1679/B214`、`1682/B215`、`1695/B222`、`1697/B224`、`1702/B228`、`1708/B232`、`1712/B233`、`1719/B234`、`1721/B235`、`1722/B236`、`1894/B243`、`1937/B246`、`1951/B247`、`2549/B249`、`2554/B250`、`2559/B251`、`2559/B252`、`2560/B253`、`2569/B255`、`2570/B256`、`2573/B257`、`2578/B258`、`2587/B259`、`2588/B260`、`2591/B261`、`2648/B272`、`2651/B275`、`2673/B278`、`2748/B279`である。

`execution-environment.ts`の未到達理由は、初期化中の世代衝突、WeakMapの内部recordだけを破壊しなければ到達しない防御分岐、Windowsで安定再現できないclose／rename／permission／同時消滅、回復record状態および削除後存在確認の低水準Filesystem異常を、production test hookや不正な自己書換えで捏造していないためである。残存riskは、該当する稀なRuntime／Filesystem故障で分類が粗くなり処置停止または手動回復が増える可能性に加え、未到達のmount元置換または部分回復分岐に退行があれば所有外entryへ影響する可能性である。利用者・運用上の最大影響は、外部データの誤削除／破損または手動回復の増加であり、軽微な分類差として扱わない。代替確認は、root／child／junction置換、未知entry、marker改変、部分child欠落、invalid／old-Hash／別nonce token、root消滅、cleanup失敗後の復元、世代`retired`後の再発行拒否、cross-operation／plain／stale Capability、および全contract testである。

`docker-isolation.ts`は実Docker、敵対的置換、全recovery分岐および同期process errorの全短絡を同じunit coverage runで到達していない。残存riskは、稀なDocker failureでcontainer不存在またはHost cleanupを誤分類する可能性である。利用者・運用上は、containerがmountを使用中なのにHost cleanupへ進むことによる作業データ破損、または不存在を確定できずOperation領域と手動回復を不要に保持する影響があり得る。代替確認はDocker normalizer、Identity、inspect、submission、3軸absence、cleanupおよびrecoveryの正負・境界試験と固定環境integrationである。安全策は、3軸不存在one-shot Capabilityを非公開に保ち、adopt不成立・未確認・出力不正時にHost cleanupとCapability利用を拒否し、実Providerと全外部Effectを未接続に保つことである。

両sourceのOwnerはQual-Lab、人間による追加判断は現在不要とする。Operation Identity／cleanup／recovery／Capability、Docker CLI／image／mount／lifecycle／recovery、Node coverage形式、固定母集団または実Provider接続を変更した時に再確認する。100%達成、Gate、Releaseまたは実Provider安全性は主張しない。

Checker packageのcheckはPass、contract testは151／151だった。Repository全体checkerは542 files、346 Markdown、1,996 local links、577 anchorsを確認し、Error 0／Warning 0だった。固定commit `c99f69ef593e3e9082920c188fabe0c6ad4980cc`／tree `d7fa9de26d3b49bca061aef46687966a5acc4400`への独立再監査は、Agent／Architecture／Security Review、Document Audit、Gap／Impact AuditおよびConformance AuditのすべてがPass、Finding 0だった。対象変更scopeは準拠表明適格（Eligible）と評価されたが、これは準拠表明の発行、採用、Gate open、StableまたはReleaseを意味しない。

## 初回独立監査と統合是正

固定commit `686e29551ddf4cbceb722c4e3a48d8acc620e861`／tree `ee484ef9ff723e0a548e47d42aabbd97c3a85c87`へのAgent／Architecture／Security ReviewはFail（High 1、Medium 1）、Document AuditはFail（Major 2）、Gap／ImpactおよびConformance AuditはFail／Not Eligible（Major 2）だった。全監査の一次走査後、次の4是正単位へ統合し、修正開始前に全監査へ再提示して整合を確認した。

- context Capabilityとmount Capabilityが同じprivate ownerを指すことを結合するAPIがなく、後続storeがcross-operationの組合せを拒否できなかった。mount Capabilityのprivate recordへownerを保持し、同一owner世代のcontext＋mountからだけopaque management bindingを発行する。management binding自身も同一alias集合へ登録し、Path、Filesystem Identityまたはplain Authorityを返さない。
- Operation root自身のstable Identity確認がcreate／verifyから欠落し、root文字列だけの失効索引が別世代へ縮退し得た。root／parent／prefix、rootと全childのstable Identityおよび`root + Host recovery nonce`世代を共通validatorで確認し、回復recordの状態遷移でHashが変わっても安定nonce世代を維持する。
- 確認済みIdentity置換と、Identityが正常なままの処置停止を分けていなかった。前者は同一世代の全派生Capabilityを即時・不可逆に失効し、後者はcurrent callをblockedとしてOperation終了や失効を先取りしない。正常cleanup／検証済みrecoveryがroot消滅を確定した場合にだけ終了失効する直接試験を追加した。
- README／脅威モデルへの現在状態伝播と、100%未達時のcoverage義務が不足していた。是正後契約を両文書へ伝播し、測定tool、分母・分子・不足、未到達母集団、理由、risk、代替確認、安全策、Owner、人間判断および再確認条件を上記へ固定した。

初回Findingはすべて`Applied / Self-checked — pending independent re-review`であり、旧監査結果を新固定版の合否へ流用しない。

## 再監査指摘と統合是正

固定commit `b084ef115d4f9929c8e644f1abf22a0fe9fdacd8`／tree `1b1a6f91ca52a9850701e89d1316bfb2073cea3d`への再監査は、Agent／Architecture／Security ReviewがFail（Medium 1）、Document AuditがFail（Major 1）、Gap／ImpactおよびConformance AuditがFail／Not Eligible（Major 2）だった。全結果を次の4是正単位へ統合した。

- 確認済みroot／child置換後もFilesystemを復元すると同じ世代からCapabilityを再発行できた。世代へ不可逆な`retired`状態を追加し、全aliasを失効したまま安全なcleanup／recoveryに必要な所有Identityだけを保持する。正常cleanup／recoveryでrootとmarkerの除去を確定した場合だけ世代記録を終了する。
- Host recoveryのunknown entry、置換、record Hash遷移および別nonce markerに対する直接試験が不足した。同一世代の3 alias保持／失効、復元後の再発行拒否、old Hash拒否、別nonceがactive世代へ作用しないこと、および停止原因除去後の安全な回収を追加した。
- 新APIのconsumer 0という記述が、既存mount Capabilityを使う`docker-isolation.ts`への直接影響を隠していた。新context／management consumerと既存mount consumerを分け、通常probe、異常scenario、取消およびrecoveryの影響と非移行根拠を記録した。
- Coverageの残存riskがrunner正本より弱かった。変更後の分母・分子、未到達branchおよびpayload Hashを再計測し、所有外entryへの影響と利用者・運用上の誤削除／破損可能性を明示した。

上記は`Applied / Self-checked — pending independent re-review`であり、現作業treeを固定して機械確認と独立再監査をやり直すまでPassへ昇格しない。

固定commit `c73fdb81ffd8972cfcb0fec198a65da19b542d10`／tree `f11fbf30646d7db4f6027ecd1b2eedb125b392cd`への次の再監査は、Agent／Architecture／Security ReviewがFail（High 1）、Document AuditがFail（Major 1）、Gap／ImpactおよびConformance AuditがFail／Not Eligible（Major 1）だった。旧Findingはすべて解消と判定された一方、前回是正で生じた次の2候補を統合した。

- 汎用のHost recovery状態遷移APIをexportしたため、active世代ではmount Capabilityだけ、process再起動後はraw tokenと状態文字列だけで`docker_absent_confirmed`を生成でき、Docker 3軸不存在one-shot Capabilityを迂回できた。汎用遷移を削除し、export境界はactive世代の送信開始／送信前取消に限定してstate不存在を拒否する。absence遷移はDocker moduleのprivate one-shot検証後だけ行い、active世代との同期はmarkerを変更しない狭いadopt境界へ分離した。null、未知action、wrong-operation mount、state不存在ではmarkerを変更しない直接試験を追加した。
- 既存production consumerの`docker-isolation.ts`を直接変更したのに、source別coverage根拠を`execution-environment.ts`だけに限定していた。同じrunnerからDocker sourceのline／function／branch分母・分子・不足、未到達branch全数、未達理由、container不存在／Host cleanup誤分類risk、利用者・運用影響、代替確認、安全策、Ownerおよびrecheck条件を追加した。

この是正も`Applied / Self-checked — pending independent re-review`であり、新しい固定版の合否へ旧結果を流用しない。

## 最終独立再監査

固定commit `c99f69ef593e3e9082920c188fabe0c6ad4980cc`／tree `d7fa9de26d3b49bca061aef46687966a5acc4400`へ、旧合否を流用せず必須監査集合を再実行した。Agent／Architecture／Security ReviewはPass（Finding 0）、Document AuditはPass（Finding 0）、Gap／Impact AuditおよびConformance AuditはPass／Eligible（Finding 0）だった。`AAS-CHG31-003`、`DOC31-CONSUMER-COVERAGE-004`および`GCI-031-R04`を含む旧FindingはすべてResolved、新規候補は4分類とも0と判定された。

確認済み範囲は、`c73fdb8..c99f69e`の差分、Operation世代／Capability／遷移／adopt／cleanup／recovery、Docker不存在の非公開one-shot経路、公開exportと全caller、追加contract test、CHG／README／脅威モデル／実装残件台帳、および両production sourceのcoverage根拠である。source、call site、変更契約、直接利用側および文書は全数走査し、サンプリングしていない。実Docker再実行、process crash／rename／permission等のOS故障注入、敵対Host管理者、未実装Provider／store／mount Effectは未評価のまま保持する。

独立再監査後の変更は、本節への監査結果記録と実装残件台帳の状態伝播だけに限定する。実装、試験、README、脅威モデル、Coverage結果、公開形式および永続形式は変更しない。記録後の新固定版ではRepository全体checkerを再実行し、この限定差分を独立確認へ戻す。

## 未完了事項と人間判断

`FU-018-PROVIDER-HOME`は`In Progress`のまま維持する。次にselected local user binderとProvider Home保護観測を成立させ、両Capabilityからだけ新しいRuntime store／clock／issuerを実装する。その後にmount／失効Effect、settings分離およびClaude Adapterへ接続する。

現在、人間による追加判断は必要ない。保護対象の採用、リスク受容、統合またはReleaseは行わない。
