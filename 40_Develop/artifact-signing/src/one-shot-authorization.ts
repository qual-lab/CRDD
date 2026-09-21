/**
 * 一回利用Authorizationの状態遷移を所有する。
 *
 * @packageDocumentation
 * @responsibility 未使用、予約済み、消費済みのうち外部へ必要な一回利用境界をProcess内で原子的に強制する。
 * @trace ARCH-000014
 * @boundary Authority Tokenと保護対象値のProcess内状態境界。
 */

/**
 * 一回利用Authorization Stateの操作契約を定義する。
 *
 * @responsibility Tokenの登録と一回消費だけを公開する型境界を所有する。
 * @trace ARCH-000014
 * @shape registerとconsumeの二操作だけを公開する。
 * @invariant 同じTokenから保護対象値を取得できるのは一回だけである。
 * @boundary Process内Authority Tokenと利用側処理との型境界。
 * @security Token一覧、保護対象値および内部状態を公開しない。
 * @compatibility 利用側は登録と消費の結果だけへ依存する。
 */
export type OneShotAuthorizationState<Token extends object, Value> = Readonly<{
  register(token: Token, value: Value): void;
  consume(token: Token): Value;
}>;

/**
 * 一回利用Authorization Stateを生成する。
 *
 * @responsibility Tokenごとの未使用／消費済み状態と保護対象値を所有し、最初の消費だけを成功させる。
 * @trace ARCH-000014
 * @input invalidReason: 未登録または消費済みTokenを拒否するときの非秘密理由。
 * @returns registerとconsumeを持つ一回利用Stateを返す。
 * @precondition invalidReasonは空でない安定したエラー理由である。
 * @postcondition 登録したTokenは一回だけValueへ交換でき、失敗後を含む再利用要求は拒否される。
 * @effect Process内WeakMapへTokenの登録状態と消費状態を記録する。
 * @failure 空の理由、Tokenの二重登録、未登録Tokenまたは消費済みTokenを例外として拒否する。
 * @invariant consumeは保護対象値を返す前に状態を消費済みへ変更する。
 * @boundary Authority Tokenと保護対象値を結ぶProcess内Capability境界。
 * @security TokenやValueを列挙可能な構造へ保持せず、失敗理由へ含めない。
 * @concurrency JavaScriptの同期実行区間で確認と消費を連続実行し、競合要求の勝者を一件に限定する。
 */
export function createOneShotAuthorizationState<Token extends object, Value>(
  invalidReason: string,
): OneShotAuthorizationState<Token, Value> {
  if (invalidReason.length === 0)
    throw new Error("one_shot_authorization_reason_required");
  const records = new WeakMap<
    Token,
    { value: Value; state: "available" | "consumed" }
  >();
  return Object.freeze({
    /**
     * 未使用Tokenと保護対象値を登録する。
     *
     * @responsibility 一回利用Stateへ新しいTokenを重複なく登録する。
     * @trace ARCH-000014
     * @input token: 登録するAuthority Token、value: 一回だけ取得を許す保護対象値。
     * @returns N/A: 登録結果は例外の有無で返す。
     * @precondition tokenは呼出し側が新しく生成したobject Identityである。
     * @postcondition 成功したTokenは未使用状態で一件だけ登録される。
     * @effect Process内WeakMapへTokenとValueを登録する。
     * @failure 同じTokenの二重登録をinvalidReasonで拒否する。
     * @invariant 登録処理はValueを返却または消費しない。
     * @boundary Authority Token発行側と一回利用StateとのProcess内境界。
     * @security TokenとValueを列挙可能な構造や例外へ公開しない。
     * @concurrency 同期実行区間で存在確認と登録を連続して行う。
     */
    register(token: Token, value: Value) {
      if (records.has(token)) throw new Error(invalidReason);
      records.set(token, { value, state: "available" });
    },
    /**
     * Tokenを消費して保護対象値を一回だけ返す。
     *
     * @responsibility 未使用Tokenの最初の要求だけを成功させ、再利用要求を拒否する。
     * @trace ARCH-000014
     * @input token: 消費するAuthority Token。
     * @returns Tokenへ結合された保護対象値を返す。
     * @precondition tokenは同じStateへ登録済みで未使用である。
     * @postcondition 成否にかかわらず、成功したTokenは以後再利用できない。
     * @effect Process内WeakMapのToken状態を消費済みへ変更する。
     * @failure 未登録または消費済みTokenをinvalidReasonで拒否する。
     * @invariant Valueを返す前に状態を消費済みへ変更する。
     * @boundary Authority Token利用側と保護対象値とのProcess内Capability境界。
     * @security 敗者と再利用要求へValueを返さない。
     * @concurrency 同期実行区間で状態確認と消費を連続して行い勝者を一件に限定する。
     */
    consume(token: Token) {
      const record = records.get(token);
      if (record?.state !== "available") throw new Error(invalidReason);
      record.state = "consumed";
      return record.value;
    },
  });
}
