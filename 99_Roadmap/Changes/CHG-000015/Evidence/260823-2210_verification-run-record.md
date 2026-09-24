# CHG-000036 現在適用性確認記録

- 対象変更: [`CHG-000036`](../CHG-000036_AppContainer_Provision_Worker_Candidate.md)
- 記録種別: `record_only_applicability_review`
- 直前の実行記録: [`0de33481`記録](CHG-000036_Verification_Run_Record_0de33481.md)
- それ以前の履歴: [`2a671485`記録](CHG-000036_Verification_Run_Record_2a671485.md)、[`87c35af6`記録](CHG-000036_Verification_Run_Record_87c35af6.md)
- 確認日: 2026-08-23（Asia/Tokyo）
- Git HEAD: `38f6a310ff6d00d9479674fe268985dbfc7dd443`
- tracked diff blob: `4c5d0f5ee4b9461fe4b5e633b7e33fb074c0a56f`
- 未追跡CHG SHA-256: `0c19065343190ed933d701cc7f607a50e6b50a5c2e7738ecefcd7a7c769498ad`
- 未追跡build.rs SHA-256: `70c236fa3fb6387d457bebb7fa55decf91447564f5bb546adae0b44007f9c8e5`
- 本記録自身を除くdirty／untracked 43 file manifest: UTF-8の`repository-relative-path<TAB>lowercase-sha256<LF>`をpath昇順で5,214 byte、SHA-256 `c1eeb1b2df5d88dea4731cc656b5210af27144929fda657408f381a1b7ac3706`。履歴Evidence 3件、CHG、build.rsを含み、Git-ignored fileと本記録自身は含めない。
- 状態: 検証済みcomponent候補。採用、統合、Release、Gate openまたはoperational one-shotの成立記録ではない。

## 直前実行結果の適用性

`0de33481`記録の固定後に変更したのは、CHGの`VirtualQuery function`行にある公式更新日を`2023-02-09`からMicrosoft Learnの現行表示`2024-02-06`へ訂正した1セルと、同実行記録を内容不変のSHA-256 `0de334818057024a8849ddc83e74b989511f75b3017f79565075f268af099bc4`で履歴化した処置だけである。tracked diff blobは同記録の実行対象`4c5d0f5ee4b9461fe4b5e633b7e33fb074c0a56f`から変わらず、実装、package／build設定、試験、coverage script、脅威境界、FU状態および他の外部根拠表cellに差分はない。直前manifestの42 entryとの比較では、CHG entryのHash変更と`0de33481`履歴entryの追加だけで、残る41 entryはpath／Hash一致である。

したがって、`0de33481`記録のTypeScript 436 passed、Rust 16 passed、format／lint、native PE再現build、成果物Identityおよび2回一致coverageは、変更していない実装・検証対象の現在品質根拠として適用する。今回のmetadata訂正をこれらの実行結果として扱わず、新しい試験runを実行したとも主張しない。metadata訂正は公式`VirtualQuery function`ページの`Last updated on 2024-02-06`表示との再照合で確認した。

Evidence固定後のfull checkerは親エージェントの共通監査入力として実行し、本記録へ循環的に結果を書き戻さない。本記録またはdirty manifest、実装、試験、coverage script、脅威境界、外部根拠の意味が変わった場合、この適用性判断を流用せず再固定する。

## 安全状態と未完了

- mapped supervisor image結合: `blocked_before_worker_spawn`
- worker Process Effect: false
- operational Filesystem Effect: false
- 正式Ed25519 manifest／Authenticode実往復、同じrunのJob／tree／module／Network確認: 未完了
- OS実行制御、信頼済みout-of-process launcherまたはspawn 0維持の選択: 人間判断
- 採用、統合、残存risk受容およびRelease: 人間の決定権限

検証用証明書をCurrentUser Root／TrustedPublisherへ登録する処置は実行していない。正式署名材料または、目的・期間・追加／除去対象・残存riskを特定した別の人間承認なしにTrust Storeを変更しない。
