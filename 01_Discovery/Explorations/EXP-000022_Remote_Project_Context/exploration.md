# 別の端末から、安全にProject Contextへ届く

探索ID: `EXP-000022`
状態: 要求採用
主な情報源: Remote MCP、Personal／Shared CROS構想
判断する人: Qual-Lab
記録の性質: Remote MCP、Personal／Shared CROSおよびCredential Grantの対話から再構成
時系列根拠: 2026-09-13に固定したv0.21構想群で、Local入口の後に扱う依存順とした。

## きっかけ

ChatGPTなど別HostのClientから、CROSが扱うProject Contextへ接続したいという要求が出た。Localhostで動くMCP／HTTPは既にあるため、listen先を広げれば済むようにも見えた。

Remote化すると、Localでは同一利用者とHostの内側に隠れていた境界が表へ出る。接続した主体、利用できるWorkspace、Workspaceへ公開されたRepository、各Repositoryの実アクセス可能性は別々に変化し得る。また、Network切断により「Serverでは完了したがClientは結果を受け取れない」状態が生じる。

```text
接続できた
  ≠ Workspaceを使える
  ≠ Repositoryを読める
  ≠ 結果を外へ返してよい

要求を送れた
  ≠ 未実行
  ≠ 実行中
  ≠ 完了結果を受信済み
```

## 本当の問題

Network接続だけでは、誰がどのProjectを読めるか、途中で応答を失った時に同じ処理をどう確認するかが決まらない。Serverが読める情報と、接続した利用者へ返してよい情報も同じではない。

## 置いた仮説

接続Credentialに利用可能なWorkspaceを結び、Sessionではその範囲だけを使う。Workspaceに公開されたRepositoryだけを解決し、応答が途切れても同じRequest IDで結果を取り直せる形を考えた。

```text
Credential
    ↓
Sessionで使えるWorkspace
    ↓
Workspaceに公開されたRepository
    ↓
許可されたProject Contextだけを返す
```

独自の利用者RoleやRepositoryごとの細かなACLは、CROSがIAM製品になるため初期範囲から外した。

| 方向 | 評価 | 採否 |
|---|---|---|
| Local HTTPのlisten先だけを広げる | 接続はできるが、Content Grantと再取得がない | 不採用 |
| CROS独自の利用者RoleとACLを作る | 細かい制御は可能だが、IAM責務が膨張する | 不採用 |
| CredentialからWorkspace Grantを作り、Repository Exposureを解決する | 小さな権限モデルで利用範囲を表現できる | 採用 |
| Timeout時に同じ要求を再実行する | 実装は単純だが、Effectを重複し得る | 不採用。Request Identityで結果を照会する |

## 守ること

- TLSなどの暗号化と認証を前提にする。
- 認証成功と、内容を読めることを同一視しない。
- 読めない情報源の名前や件数を漏らさない。
- Timeoutを取消完了とみなさず、結果を再取得できるようにする。

## 現在の判断

Remote利用はv0.21で代表経路を設計する。目的はHTTP公開ではなく、Project Contextへ安全に到達することである。

## 次工程で確かめること

認証失敗、Workspace範囲外、部分的に読めるProject、応答喪失、同じRequestの再取得を含める。Local利用へRemote Serverを強制しないことも確認する。

<a id="remote-context-actor-process"></a>

```text
Client          CROS Server           Repository
  │                 │                     │
  ├─ 認証・要求 ───>│                     │
  │                 ├─ 利用範囲を確認     │
  │                 ├─ 許可済み取得 ─────>│
  │                 │<─ 状態と改訂版 ─────┤
  │<─ 結果または不足 ┤                     │
  └─ 応答喪失時は同じRequestを照会する
```

## 採用した要求

`REQ-000011`: Remote ClientへProject Contextを提供する場合、接続認証、SessionのWorkspace Grant、Repository Exposureおよび各Repositoryの実アクセス可能性を別々に検証し、許可された内容だけを返さなければならない。

`REQ-000021`: Remote要求の応答を失った場合、Timeoutを取消完了または未実行と推定せず、同じRequest Identityで状態と完了結果を安全に再取得できなければならない。
