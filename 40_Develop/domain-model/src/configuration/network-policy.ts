/**
 * Repository追加通信設定の値とJSON文法を所有する。
 * @responsibility 閉じた版・配列・上限を確認し、技術通信許可は判定しない。
 * @trace ARCH-000011
 */

/**
 * Repositoryが宣言する追加Hostを表す。
 * @responsibility 非秘密設定の版と不変の文字列配列を所有する。
 * @trace ARCH-000011
 * @shape version=1、allowedHosts。
 * @invariant 最大32要素・各253文字で深く凍結する。
 * @boundary JSON設定とDomain値。
 * @security この値は認可・通信許可ではない。
 * @compatibility 空配列は追加Hostなし。
 */
export type NetworkPolicy = Readonly<{
  version: 1;
  allowedHosts: readonly string[];
}>;

export const DEFAULT_NETWORK_POLICY: NetworkPolicy = Object.freeze({
  version: 1,
  allowedHosts: Object.freeze([
    "registry.npmjs.org",
    "pypi.org",
    "files.pythonhosted.org",
  ]),
});

/**
 * 有界JSONの閉じた設定文法を解析する。
 * @responsibility escaped Keyを含むトップ重複と未知・欠落項目を拒否する。
 * @trace ARCH-000011
 * @input text: bounded readerから得たUTF-8本文。
 * @returns 不変設定またはnull。
 * @precondition 呼出し元がFile容量を制限する。
 * @postcondition 元配列への参照を保持しない。
 * @effect N/A: 局所計算だけ。
 * @failure 不正JSON・版・Key・要素・上限はnull。
 * @invariant Hostnameの技術判断を含めない。
 * @boundary JSON本文と値契約。
 * @security 設定をAuthorityへ昇格しない。
 * @concurrency N/A: 同期局所計算。
 */
export function parseNetworkPolicyDocument(text: string): NetworkPolicy | null {
  try {
    const value: unknown = JSON.parse(text);
    if (!value || typeof value !== "object" || Array.isArray(value))
      return null;
    const keys = new Set<string>();
    let depth = 0;
    for (let index = 0; index < text.length; index += 1) {
      const character = text[index];
      if (character === '"') {
        const begin = index;
        index += 1;
        while (index < text.length && text[index] !== '"') {
          if (text[index] === "\\") index += 1;
          index += 1;
        }
        let next = index + 1;
        while (" \t\r\n".includes(text[next] ?? "\0")) next += 1;
        if (depth === 1 && text[next] === ":") {
          const key: unknown = JSON.parse(text.slice(begin, index + 1));
          if (typeof key !== "string" || keys.has(key)) return null;
          keys.add(key);
        }
      } else if (character === "{" || character === "[") depth += 1;
      else if (character === "}" || character === "]") depth -= 1;
    }
    if (keys.size !== 2 || !keys.has("version") || !keys.has("allowedHosts"))
      return null;
    const record = value as Record<string, unknown>;
    if (
      record.version !== 1 ||
      !Array.isArray(record.allowedHosts) ||
      record.allowedHosts.length > 32 ||
      record.allowedHosts.some(
        (host: unknown) => typeof host !== "string" || host.length > 253,
      )
    )
      return null;
    return Object.freeze({
      version: 1,
      allowedHosts: Object.freeze([...record.allowedHosts] as string[]),
    });
  } catch {
    return null;
  }
}
