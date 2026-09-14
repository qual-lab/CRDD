# 公式署名と、利用者が実行を許す判断を分ける

成果物種別: Discovery Analysis
探索ID: `EXP-000028`
状態: 要求採用
主な情報源: CRDDのOSS配布、Runtime Execution Identityの運用
判断する人: Qual-Lab
記録の性質: v0.18以降の署名運用、OSS fork要件およびTrust Policy対話から再構成
時系列根拠: 2026-09-13に固定したv0.21構想群で、公開・実行境界を支えるTrust判断を最後に置く依存順とした。

## きっかけ

CRDDをforkしてCoordinatorを変更したい場合、Qual-Labの署名だけを実行資格にすると、利用者自身のBuildを正規に使えない。公式配布物の改ざん検知には署名が必要だが、OSSとしての変更可能性も守りたいという問題が出た。

利用形態には少なくとも三つある。Qual-Lab公式Build、組織がForkして自ら配布するBuild、開発者がLocalで試す未署名Buildである。それぞれのPublisherと許容条件は違うが、CRDD準拠やArtifact改ざんの確認まで同じ意味に変わるわけではない。

| 利用形態 | 証明したいこと | Trustを決める人 |
|---|---|---|
| Qual-Lab公式Build | Qual-LabがそのArtifactを配布した | Deployment Owner |
| 組織Fork Build | 組織のBuild／署名経路を通った | Deployment Owner |
| Local未署名Build | 開発目的の限定範囲である | LocalのDeployment Owner |

## 本当の問題

署名が厳しいことではない。「誰が作ったArtifactか」という証明と、「自分の環境で誰を信頼するか」という判断を一つにしていたことが問題だった。

## 置いた仮説

次の三つを分ければ、公式版とfork版を同じ原則で扱えると考えた。

| 確認すること | 意味 |
|---|---|
| CRDD準拠 | Runtimeが必要なContractを満たすか |
| Artifact Integrity | 配布後に内容が変わっていないか |
| Publisher Trust | 誰が作ったArtifactを利用者が信頼するか |

Qual-Labの署名は公式配布物であることを示す。利用者や組織は、自分のTrust PolicyでQual-Lab、自組織、Local開発Buildなどの扱いを決める。

| 方向 | 利点 | 問題 | 採否 |
|---|---|---|---|
| Qual-Lab署名だけを実行資格にする | 公式版の管理は単純 | Forkと組織Buildが成立しない | 不採用 |
| 署名検証をなくす | 改造は自由 | 改ざんとPublisherを確認できない | 不採用 |
| Integrity、Publisher、利用者Policyを分ける | 公式版とForkを同じ原則で扱える | Policyの既定拒否、失効、移行が必要 | 採用 |

利用者がPolicyを所有していても、未知Publisherや未署名Buildを暗黙に許可するなら安全境界は失われる。逆に、Qual-Labが利用者のTrust判断を固定するならOSSとしての目的を失う。

## 守ること

- Qual-Lab署名がないことだけでforkを実行不能にしない。
- 未署名Local Buildを本番の信頼済みArtifactへ自動昇格しない。
- Trust Policyの所有者をQual-Labへ固定しない。
- Publisherの信頼からCRDD準拠や安全性すべてを推定しない。

## 現在の判断

利用者所有のTrust Policyをv0.21で設計する。Policy所有者、既定拒否、鍵の更新と失効、Local開発例外、監査可能性をArchitectureとVerificationへ渡す。

## 採用した要求

`REQ-000018`: RuntimeのCRDD準拠、Artifact Integrity、Publisher IdentityおよびQual-Lab公式配布の表示は別々に判定でき、一つの署名結果から他の成立を推定してはならない。

`REQ-000025`: Deployment Ownerは、公式版、組織版およびLocal開発版をどの条件で信頼するかをPolicyとして所有し、既定拒否、鍵の更新・失効および移行を管理できなければならない。
