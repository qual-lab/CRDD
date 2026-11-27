/** 受付・スキーマが共有する識別子の文字列形式。存在や認可は判定しない。 @trace ARCH-000012 */
export const RESOURCE_ID_SOURCE = "[A-Za-z0-9][A-Za-z0-9._-]{0,127}";
export const RESOURCE_ID = new RegExp(`^${RESOURCE_ID_SOURCE}$`, "u");

export const UUID_V4_SOURCE =
  "[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}";
export const UUID_V4 = new RegExp(`^${UUID_V4_SOURCE}$`, "u");
// 受付時の起動ID・作業領域IDは書式を確認し、バージョンまでは要求しない。
export const UUID = /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/u;
export const GIT_OBJECT_ID = /^(?:[a-f0-9]{40}|[a-f0-9]{64})$/u;
