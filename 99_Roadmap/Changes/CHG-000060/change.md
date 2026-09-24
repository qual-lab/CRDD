# 変更トレース: CRDD公式ブランドアイコンの採用

変更ID: `CHG-000060`
- 状態: `Released`
- 決定権限者: Qual-Lab
- 判断日: 2026-09-02
- 対象: Qual-Labが提示したCRDDブランドアイコン2解像度の原本保存と、公式商標素材としての識別
- 対象リリース: `v0.19.0`
- 変更分類: `additive`
- `migration_required`: `false`。既存利用者の文書、Runtime、UIまたは商標利用許可を変更しない
- リリースレベル: `MINOR`への収載。ブランド素材だけからversionまたはReleaseを確定しない
- リリース: `v0.19.0`（2026-09-05）

正本: [商標方針](../../../TRADEMARK.md)、[UI素材](../../../04_UI/assets/brand)

## 1. 契機と人間の判断

Qual-Labの人間の決定権限者は、提示した2枚の画像をCRDDのブランドアイコンとしてRepositoryへ保存することを決定した。元の添付名は写真の連番で意味を表さないため、画像形式と実寸から事実を再構成できる名前へ変更する。

決定権限者は、特定の第三者著作物を模倣する意図なくChatGPTを用いて自身の指示・選択・調整を反映して生成した素材であることを確認し、CRDD公式Repositoryへの収載およびCRDDのライセンス条件に従った公開・再配布を許可した。この確認は生成経緯と決定権限者による許可を示すものであり、第三者権利の不存在、商標としての独占性または法的登録可能性を保証しない。

## 2. 変更内容

- [`crdd-brand-icon-512x512.jpg`](../../../04_UI/assets/brand/crdd-brand-icon-512x512.jpg): JPEG、512×512 pixel
- [`crdd-brand-icon-400x400.jpg`](../../../04_UI/assets/brand/crdd-brand-icon-400x400.jpg): JPEG、400×400 pixel
- [商標方針](../../../TRADEMARK.md): 両ファイルを同じCRDDマークの解像度variantとして識別する


画像byteは受領した原本から変更しない。二つの画像を別のマーク、別ブランドまたは用途別のロゴとして扱わない。CRDDのRuntime、CLI、Web、印刷物その他の利用先へ自動適用せず、今回の判断をBrand System、利用ガイドまたは公開承認へ拡張しない。

### 影響ファイル

<details>
<summary>全ファイルを表示</summary>

- [`00_Overview.md`](<../../../00_Overview.md>)
- [`01_Principles.md`](<../../../01_Principles.md>)
- [`02_Terminology.md`](<../../../02_Terminology.md>)
- [`02_UX/01_User_Experience.md`](<../../../02_UX/01_User_Experience.md>)
- [`03_Documentation.md`](<../../../03_Documentation.md>)
- [`03_IA/01_Information_Architecture.md`](<../../../03_IA/01_Information_Architecture.md>)
- [`04_Agent_Organization.md`](<../../../04_Agent_Organization.md>)
- [`04_UI/01_User_Interface.md`](<../../../04_UI/01_User_Interface.md>)
- [`04_UI/assets/brand/crdd-brand-icon-400x400.jpg`](<../../../04_UI/assets/brand/crdd-brand-icon-400x400.jpg>)
- [`04_UI/assets/brand/crdd-brand-icon-512x512.jpg`](<../../../04_UI/assets/brand/crdd-brand-icon-512x512.jpg>)
- [`05_Autonomous_Operation.md`](<../../../05_Autonomous_Operation.md>)
- [`05_SPEC/01_Behavior_Specification.md`](<../../../05_SPEC/01_Behavior_Specification.md>)
- [`06_Architecture/Details/coordinator/01_Architecture.md`](<../../../06_Architecture/Details/coordinator/01_Architecture.md>)
- [`06_Architecture/Details/coordinator/02_Threat_Model.md`](<../../../06_Architecture/Details/coordinator/02_Threat_Model.md>)
- `06_Architecture/Details/coordinator/03_Project_Runtime_Design.md`（削除または旧Path）
- [`07_Quality/01_Quality_Center.md`](<../../../07_Quality/01_Quality_Center.md>)
- [`07_Quality/03_Verification_Design.md`](<../../../07_Quality/03_Verification_Design.md>)
- `07_Quality/Verification_Results/2026-09-03_Project_Runtime_Final_Signed_E2E.json`（削除または旧Path）
- `07_Quality/Verification_Results/2026-09-03_Project_Runtime_Final_Signed_E2E.md`（削除または旧Path）
- [`10_Agent.md`](<../../../10_Agent.md>)
- [`11_Skill.md`](<../../../11_Skill.md>)
- [`12_Change.md`](<../../../12_Change.md>)
- [`13_Release.md`](<../../../13_Release.md>)
- [`14_Workflow.md`](<../../../14_Workflow.md>)
- [`15_Progress.md`](<../../../15_Progress.md>)
- [`16_Quality_Assurance.md`](<../../../16_Quality_Assurance.md>)
- [`17_Communication.md`](<../../../17_Communication.md>)
- [`18_Context_Dependency.md`](<../../../18_Context_Dependency.md>)
- [`19_Maintenance.md`](<../../../19_Maintenance.md>)
- [`21_Discovery.md`](<../../../21_Discovery.md>)
- [`22_UX.md`](<../../../22_UX.md>)
- [`23_IA.md`](<../../../23_IA.md>)
- [`24_UI_Behavior_Specification.md`](<../../../24_UI_Behavior_Specification.md>)
- [`25_UI.md`](<../../../25_UI.md>)
- [`26_Behavior_Specification.md`](<../../../26_Behavior_Specification.md>)
- [`27_Architecture.md`](<../../../27_Architecture.md>)
- [`28_Implementation.md`](<../../../28_Implementation.md>)
- [`29_Verification.md`](<../../../29_Verification.md>)
- [`40_Develop/coordinator/bin/coordinator.ts`](<../../../40_Develop/coordinator/bin/coordinator.ts>)
- `40_Develop/coordinator/runtime/project-runtime-design-traceability.json`（削除または旧Path）
- [`40_Develop/coordinator/src/core/project-runtime-design-traceability.ts`](<../../../40_Develop/coordinator/src/core/project-runtime-design-traceability.ts>)
- `40_Develop/coordinator/src/security/mcp-project-runtime-adapter.ts`（削除または旧Path）
- `40_Develop/coordinator/src/security/mcp-project-runtime-stdio.ts`（削除または旧Path）
- [`40_Develop/coordinator/src/security/project-runtime-durable-foundation.ts`](<../../../40_Develop/coordinator/src/security/project-runtime-durable-foundation.ts>)
- `40_Develop/coordinator/src/security/project-runtime-execution.ts`（削除または旧Path）
- [`40_Develop/coordinator/src/security/project-runtime-objective-intake.ts`](<../../../40_Develop/coordinator/src/security/project-runtime-objective-intake.ts>)
- `40_Develop/coordinator/src/security/project-runtime-public-runtime.ts`（削除または旧Path）
- `40_Develop/coordinator/src/security/project-runtime-state.ts`（削除または旧Path）
- [`40_Develop/coordinator/tests/fixtures/project-runtime-lease-race-probe.ts`](<../../../40_Develop/coordinator/tests/fixtures/project-runtime-lease-race-probe.ts>)
- `40_Develop/coordinator/tests/mcp-project-runtime-adapter.contract.test.ts`（削除または旧Path）
- `40_Develop/coordinator/tests/mcp-project-runtime-stdio.integration.test.ts`（削除または旧Path）
- `40_Develop/coordinator/tests/project-runtime-durable-foundation.contract.test.ts`（削除または旧Path）
- `40_Develop/coordinator/tests/project-runtime-execution.contract.test.ts`（削除または旧Path）
- `40_Develop/coordinator/tests/project-runtime-full-flow.integration.test.ts`（削除または旧Path）
- `40_Develop/coordinator/tests/project-runtime-integration.contract.test.ts`（削除または旧Path）
- `40_Develop/coordinator/tests/project-runtime-objective-intake.contract.test.ts`（削除または旧Path）
- `40_Develop/coordinator/tests/project-runtime-public-runtime.integration.test.ts`（削除または旧Path）
- `40_Develop/coordinator/tests/project-runtime-queue-priority.contract.test.ts`（削除または旧Path）
- [`51_Document_Audit.md`](<../../../51_Document_Audit.md>)
- [`52_Conformance_Audit.md`](<../../../52_Conformance_Audit.md>)
- [`53_Gap_Impact_Audit.md`](<../../../53_Gap_Impact_Audit.md>)
- `90_Release/Changes/CHG-000057_Minimum_AI_Native_Project_Runtime.md`（削除または旧Path）
- `90_Release/Changes/CHG-000058_Reasoning_Context_and_Design_Intent.md`（削除または旧Path）
- `90_Release/Changes/CHG-000059_Dogfooding_Assurance_Route_and_Readability.md`（削除または旧Path）
- `90_Release/Changes/CHG-000060_CRDD_Brand_Icon_Adoption.md`（削除または旧Path）
- `90_Release/Changes/README.md`（削除または旧Path）
- `99_Roadmap/01_Product_Roadmap.md`（削除または旧Path）
- [`99_Roadmap/Changes/CHG-000060/change.md`](<../../../99_Roadmap/Changes/CHG-000060/change.md>)
- [`CHANGELOG.md`](<../../../CHANGELOG.md>)
- [`README.md`](<../../../README.md>)
- [`TRADEMARK.md`](<../../../TRADEMARK.md>)

</details>

## 3. 権限と影響

Repositoryへの収載は、[商標方針](../../../TRADEMARK.md)§3の許可を拡張せず、§4の個別許可が必要な利用を解除しない。Apache License 2.0の著作権・特許許諾と商標利用許可も統合しない。

既存のCRDDフォルダ責務、適用先ひな型およびCoordinator Runtime実装は変更しない。[現在のRuntime実行Identity境界](../CHG-000056/change.md#4-新しい配布実行境界)が列挙する実行依存閉集合の外側であるため、Runtime実行IdentityとRuntime署名対象も変更しない。一方、本変更はv0.19.0のRepository内容へ追加され、最終Release Identityに含まれる。ブランド素材だけからversion、tagまたはReleaseを確定せず、採用Repositoryへ画像を必須配布したり、既存UIへ表示したりしない。

## 4. 検証と現在状態

- 受領元とRepository内コピーのSHA-256が各画像で一致することを確認した。
- JPEG形式と512×512／400×400 pixelの実寸を確認した。
- `04_UI/assets/brand/`が視覚・UI素材の責務内であり、Runtime、WorkflowまたはRelease配布物の実装領域へ混在しないことを確認した。
- 商標方針の相対リンク、同一マークの説明および権限非拡張を確認した。
- CRDD全体Checkerで画像と本変更トレースを含む782 file、399 Markdown、2,822 linkを確認し、Error 0、Warning 0だった。

保存、生成経緯の確認、決定権限者による収載・公開・再配布の許可および識別は完了し、v0.19.0へ収載した。第三者権利の不存在・商標としての独占性・法的登録可能性の評価、色管理、印刷再現、アクセシビリティおよび実UIへの組込みは未評価または別判断であり、本変更から完了を推定しない。

## 5. 切戻し

Release前に採用を取り消す場合は、2画像と商標方針の参照を同じ変更として除去し、本変更を理由付きで`Close without Release`とする。片方だけを別マークとして残したり、商標方針の許可範囲だけを変更したりしない。Release後は公開済み履歴を書き換えず、後続CHGで廃止または差替えを追跡する。
