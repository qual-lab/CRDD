# 変更トレース: Runtime所有Provider Home観測（Runtime-owned Provider Home Observation）

- 変更ID: `CHG-000039`
- 状態: `Implementation in Progress`
- 決定権限者: Qual-Lab
- 判断日: 2026-08-24
- 対象: Coordinator Runtime 1.0のWindows selected-user binderと専用Provider Home保護観測
- 対象version: v0.18.0 Candidate
- 変更分類: `breaking`（private Provider Home契約revision 2から3、別Provider Home wire revision 1を追加）
- 移行要否: `migration_required: true`（Repository内producer／consumerを同時更新し、旧wireへのalias／fallbackを設けない。発行済み観測Capabilityとproduction Mount Grantは0）
- 関連正本: [`19_Maintenance.md`](../../19_Maintenance.md#33-internal-typescript-runtime)、[`CHG-000026`](CHG-000026_Provider_Home_Protection_Foundation.md)、[`CHG-000030`](CHG-000030_Provider_Home_Mount_Grant_Runtime_Store.md)、[`CHG-000031`](CHG-000031_Runtime_Owned_Operation_Context_Capability.md)、[`CHG-000038`](CHG-000038_Claude_Subscription_OAuth_Vertical_Slice.md)

## 結論

caller supplied PathをAuthorityへ昇格させず、通常RuntimeがWindows Known Folder、現在processの選択ローカル対話ユーザーtoken、Provider Homeのhandle Identityおよびowner／DACLを読み取り専用で再観測する候補を追加した。`coordinator.exe provision`は各起動で回復可能な`LowBoxConsoleEnabled` Registry Effectを所有するため通常Operationへ流用せず、既存`crdd-platform-access.exe`へcaller Pathを表現できない別の固定Provider Home wire revision 1を追加した。

requestはProvider閉集合とRuntime生成nonceだけ、responseはProvider、nonce、known flagsおよびProvider Home Identity／保護／local user bindingの三つのdomain-separated SHA-256だけを含む。Path、SID、Authentication LUID、ACL、Credential内容、Profile IDおよびOperation IDはwireと公開結果へ含めない。観測成功はAuthority、Operation Capability、Mount Grant、mount、loginまたはProvider spawnを発行しない。

## 着手前整合と代表例

- 変更経路: Security／Runtime共有契約を変更する非自明な実装変更。Provider Home、Rust platform-access、release artifact、Provider lifecycle、QAおよびMount Grant利用側を再開する。
- 着手前整合結果: `計画修正`。Provisioning supervisor再利用を棄却し、Registry Effectを持たない専用read-only observerへ変更後に着手可とした。
- 発火例: 正式Runtimeが`codex|claude`を選び、固定署名Release、通常local interactive primary token、Known Folder由来Home、stable local fixed-volume handle Identityおよびexact protected DACLが一致すると、10秒・一回限りのopaque観測Capability候補を作る。
- 非発火例: caller layout評価、doctor、unsupported Provider、restricted／service／batch／network／AppContainer tokenはHome作成、ACL修復、loginまたはGrant発行を行わない。
- 境界例: DACLはselected userとSYSTEMの継承付きFull Control 2 ACEだけを許可し、同じSIDでもAuthentication LUIDが変わればlocal user binding Hashを変える。
- 情報不足例: Known Folder、Home、固定parent chain、volume class、Identity、owner、DACL、token分類、artifactまたは終了状態を確認できない場合は候補を返さずfail closedとする。

## 実装とSecurity invariant

- `CRDDPH01` requestは44 byte、`CRDDHO01` responseは150 byteに固定し、余分byte、未知Provider、reserved byte、旧revisionを拒否する。
- native observerはKnown Folderから`Qual-Lab/CRDD/ProviderHomes/{provider}`を内部導出し、全固定segmentを`FILE_FLAG_OPEN_REPARSE_POINT`付きhandleで保持する。
- final Provider Home handleからDOS volumeを再構成してfixed driveを確認し、全handleのvolume／file index／creation time／attributesを観測前後で再確認する。
- current primary tokenはinteractiveかつnonzero-sessionを必須とし、service、batch、network、restrictedおよびAppContainerを拒否する。
- ownerはcurrent TokenUser、protected DACLはcurrent TokenUserとLocal SYSTEMの継承付きFull Control 2 ACEだけに限定し、current tokenのFull Controlを`AccessCheck`する。
- 三Hashは別domainへ分け、Provider Home IdentityはProvider＋handle Identity、保護HashはIdentity＋selected user＋exact ACL、local user bindingはTokenUser Hash＋Authentication LUID＋principal flagsを結合する。
- TypeScript adapterは固定module-relative distribution、署名manifestとrelease Identity、固定artifactの起動前後同一性、絶対Path、shellなし、PATH探索なし、空Environment、5秒、stdout exact 150 byte、stderr 0 byte、exit 0を要求する。
- observerはFilesystem／Network Effect、Home修復またはCredential readを行わない。opaque観測CapabilityはWeakMap所有、最大10秒、一回限りで、plain copyまたは再利用を受理しない。

## 探索・比較と収束

比較した案は、Provisioning supervisorの通常Runtime再利用、Node／PowerShellでのKnown Folder／ACL観測、caller Pathを既存PA03へ渡す方法、既存platform-accessへPathなし専用wireを追加する方法である。supervisor再利用は通常OperationへRegistry Effectを持ち込み、Node／PowerShellはOS権限判定をShellへ移し、既存PA03はcaller Pathの来歴をAuthorityへ誤用し得る。private Rust componentの既存token／DACL／Identity helperを再利用しつつ別frameで入力集合を閉じる案だけが、現在のTypeScript／Rust境界、Minimum Trust BoundaryおよびProvider Home Path非開示を同時に保持した。

弱点は、通常Runtime Process Controller、最終署名Release artifact、Mount Grant issuerおよび実mountがまだ接続前であることと、同一local user／Administrator／OS侵害へのtamper resistanceがv1対象外であることである。追加探索によって現在のobserver方式を変え得る未解決代替はなく、process tree終了は手順4、正式署名同時runはRuntime 1.0最終固定版で再評価する。

## 現在の検証結果と残件

- Rust固定toolchainのformat、全test、全target／featureのClippy Warning拒否およびrelease buildは成功した。
- protocol単体、CLI固定frame、Provider閉集合、旧revision／余分byte拒否、Hash domain差、login session差、bounded SIDおよび既存Root observer回帰を確認した。
- TypeScript strict typecheck、Biome lint／formatおよびProvider Home observation／layout／lifecycle直接試験は成功した。
- 通常Codex sandboxのrestricted tokenからの実行は専用reasonで拒否した。同じrelease buildを通常ローカルユーザーtokenでread-only実行すると、Claude Homeについてprincipal flags `131`、Home flags `511`、三Hash nonzero、stderr 0、exit 0となった。Credential内容は読まず、Path／SID／ACLは結果へ出していない。
- 現在の正式release配置は変更前artifact／manifestであるため、production adapterの署名Release Gateは意図どおり未成立である。全Runtime sourceを固定して一度だけ正式署名し、process tree終了、ETW Network非発火、artifact起動前後一致および観測Capability消費を同じrunで再確認する。
- Runtime-owned Mount Grant store／clock／issuer、mount／revoke、Docker／Egress、Provider E2E、双方向Coordinator invocation、独立レビュー／監査およびPRは後続である。

現在、人間による追加判断は必要ない。保護対象の採用、統合、Releaseまたはリスク受容は行わない。
