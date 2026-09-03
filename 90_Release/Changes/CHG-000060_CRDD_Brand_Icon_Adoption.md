# 変更トレース: CRDD公式ブランドアイコンの採用

変更ID: `CHG-000060`
- 状態: `In Progress`
- 決定権限者: Qual-Lab
- 判断日: 2026-09-02
- 対象: Qual-Labが提示したCRDDブランドアイコン2解像度の原本保存と、公式商標素材としての識別
- 対象リリース: `v0.19.0`
- 変更分類: `additive`
- `migration_required`: `false`。既存利用者の文書、Runtime、UIまたは商標利用許可を変更しない
- リリースレベル: `MINOR`への収載。ブランド素材だけからversionまたはReleaseを確定しない

正本: [商標方針](../../TRADEMARK.md)、[UI素材](../../04_UI/assets/brand/)

## 1. 契機と人間の判断

Qual-Labの人間の決定権限者は、提示した2枚の画像をCRDDのブランドアイコンとしてRepositoryへ保存することを決定した。元の添付名は写真の連番で意味を表さないため、画像形式と実寸から事実を再構成できる名前へ変更する。

決定権限者は、特定の第三者著作物を模倣する意図なくChatGPTを用いて自身の指示・選択・調整を反映して生成した素材であることを確認し、CRDD公式Repositoryへの収載およびCRDDのライセンス条件に従った公開・再配布を許可した。この確認は生成経緯と決定権限者による許可を示すものであり、第三者権利の不存在、商標としての独占性または法的登録可能性を保証しない。

## 2. 変更内容

- [`crdd-brand-icon-512x512.jpg`](../../04_UI/assets/brand/crdd-brand-icon-512x512.jpg): JPEG、512×512 pixel
- [`crdd-brand-icon-400x400.jpg`](../../04_UI/assets/brand/crdd-brand-icon-400x400.jpg): JPEG、400×400 pixel
- [商標方針](../../TRADEMARK.md): 両ファイルを同じCRDDマークの解像度variantとして識別する

画像byteは受領した原本から変更しない。二つの画像を別のマーク、別ブランドまたは用途別のロゴとして扱わない。CRDDのRuntime、CLI、Web、印刷物その他の利用先へ自動適用せず、今回の判断をBrand System、利用ガイドまたは公開承認へ拡張しない。

## 3. 権限と影響

Repositoryへの収載は、[商標方針](../../TRADEMARK.md)§3の許可を拡張せず、§4の個別許可が必要な利用を解除しない。Apache License 2.0の著作権・特許許諾と商標利用許可も統合しない。

既存のCRDDフォルダ責務、適用先ひな型およびCoordinator Runtime実装は変更しない。[現在のRuntime実行Identity境界](CHG-000056_Coordinator_Adoption_Interface_Correction.md#4-新しい配布実行境界)が列挙する実行依存閉集合の外側であるため、Runtime実行IdentityとRuntime署名対象も変更しない。一方、本変更はv0.19.0のRepository内容へ追加され、最終Release Identityに含まれる。ブランド素材だけからversion、tagまたはReleaseを確定せず、採用Repositoryへ画像を必須配布したり、既存UIへ表示したりしない。

## 4. 検証と現在状態

- 受領元とRepository内コピーのSHA-256が各画像で一致することを確認した。
- JPEG形式と512×512／400×400 pixelの実寸を確認した。
- `04_UI/assets/brand/`が視覚・UI素材の責務内であり、Runtime、WorkflowまたはRelease配布物の実装領域へ混在しないことを確認した。
- 商標方針の相対リンク、同一マークの説明および権限非拡張を確認した。
- CRDD全体Checkerで画像と本変更トレースを含む782 file、399 Markdown、2,822 linkを確認し、Error 0、Warning 0だった。

保存、生成経緯の確認、決定権限者による収載・公開・再配布の許可および識別は完了している。v0.19.0への最終収載と公開、第三者権利の不存在・商標としての独占性・法的登録可能性の評価、色管理、印刷再現、アクセシビリティおよび実UIへの組込みは未評価または別判断であり、本変更から完了を推定しない。

## 5. 切戻し

Release前に採用を取り消す場合は、2画像と商標方針の参照を同じ変更として除去し、本変更を理由付きで`Close without Release`とする。片方だけを別マークとして残したり、商標方針の許可範囲だけを変更したりしない。Release後は公開済み履歴を書き換えず、後続CHGで廃止または差替えを追跡する。
