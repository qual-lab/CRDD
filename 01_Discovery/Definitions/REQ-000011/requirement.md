# REQ-000011 Remote接続のWorkspace限定

成果物種別: Discovery Definition
要求ID: `REQ-000011`
Discovery判断: 要求採用
判断する人: Qual-Lab

## 要求

Remote ClientへProject Contextを提供する場合、接続認証、SessionのWorkspace Grant、Repository Exposureおよび各Repositoryの実アクセス可能性を別々に検証し、許可された内容だけを返さなければならない。

## 対象と利用状況

別HostのChatGPT等からCROS Serverへ接続し、許可されたProject Contextを読む利用者の場面。

## 解く問題と望ましい変化

```text
現在: Network接続や認証成功だけでは、利用可能Workspace、Repository Exposure、実アクセス、返却可能な内容が決まらない。
    ↓
望ましい変化: Credentialから得たSession Grantの範囲だけでRepositoryを解決し、非開示情報を漏らさず結果を受け取れる。
```

## 採用理由と比較

listen先拡大ではContent Grantがなく、独自Role／ACLはIAM責務を膨らませるため、Credential→Workspace→Exposureの小さな権限モデルを採る。

## 成立条件

- 接続認証、Session Workspace Grant、Repository Exposure、実アクセスを段階別に検証する
- 許可範囲だけを返し、非開示Repositoryの存在、名前、件数を漏らさない
- 一部だけ読めるProjectを完全状態へ畳まず利用可能な範囲を返す

## 制約

- TLS等の安全なTransportを前提とし、Local利用へRemote Serverを強制しない
- System管理CapabilityとContent閲覧Grantを同一視しない

## 検証意図

認証失敗、Workspace範囲外、Exposureなし、アクセス不能、部分可視を与え、各境界の拒否と情報非開示を観測する。

## 工程引渡し

| 引渡し先 | 失ってはならない意味 | 下流で決めること |
|---|---|---|
| UX | Remote利用者、別端末からProjectへ届く状況、安全に利用可能範囲だけ理解する変化、locked／partialの体験をUXへ渡す。 | Goal、独立Outcome、重要場面、失敗、体験品質 |
| IA以降 | 本要求のIdentity、状態、関係、制約、反証条件 | 各工程固有の情報構造、操作、振る舞い、検証 |

## 関係

- Source Analysis: [EXP-000022](../../Analysis/EXP-000022/exploration.md)
- Formal downstream input: UXは本Definitionを一次入力として分析し、判断理由の再確認が必要な場合だけSource Analysisへ戻る。
