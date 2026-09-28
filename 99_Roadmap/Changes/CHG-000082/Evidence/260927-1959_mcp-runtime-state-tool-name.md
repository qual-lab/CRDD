# MCP Project Runtime状態Tool命名検証

成果物種別: Verification Result
対象変更: [CHG-000082](../change.md)
対象Local Item: `RFD-IT-013`
観測日時: 2026-09-27 19:59 JST
対象状態: Commit `a565fb7f`以降の未Commit変更候補。Project Context MCP Toolの完成Evidenceではない。

## 結論

Project Runtimeの実行状態を返すMCP Toolを`crdd.get_project_runtime_state`へ改称し、MCP packageの型、Format、Lintおよび32契約試験はすべてPassした。

旧名`crdd.get_project_state`をProject Context取得へ流用しない。Project ContextはProject Management Projectionの別契約から導出する。

## 自動検証

```text
mcp
tests 32 / pass 32 / fail 0
format pass / typecheck pass / lint pass
```

## 入力Manifest

| 入力 | SHA-256 |
|---|---|
| `40_Develop/mcp/src/protocol/project-runtime-protocol.ts` | `62ca19b19e8d05fca319fde1314612f5bfbf5b9785be8151bed2055e5720f040` |
| `40_Develop/mcp/tests/system/streamable-http-transport.integration.test.ts` | `abe12221f1e5a94e644d8c4d98d063c207b52d19b5575ff5861681dd3562347c` |

## 限定

- Project Context、TopicまたはMeetingのMCP Tool／Resourceは本Evidenceで成立していない。
- 旧名のAliasを残していない。v0.22利用側は新しいTool名へ移行する必要がある。
- Shared CROS ServerのTLS配置またはCredential設定を証明しない。

## Checklist

- [x] Project Runtime StateとProject Contextを名前で区別した。
- [x] Tool一覧、呼出し、mirror headerおよび不正JSON反例を同じ名前へ更新した。
- [x] 旧名をProject Context Toolとして再利用していない。
- [x] Project Context MCP契約を完成済みと表示していない。
