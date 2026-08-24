import { parseUnambiguousJsonDocument } from "./claude-structured-result.ts";

export const CODEX_STRUCTURED_RESULT_CONTRACT =
  "crdd-coordinator/codex-structured-result";
export const CODEX_STRUCTURED_RESULT_CONTRACT_REVISION = 1;

function blocked() {
  return Object.freeze({
    status: "blocked" as const,
    normalizedResult: null,
    rawOutputReported: false,
  });
}

export function normalizeCodexStructuredResult(raw: unknown) {
  if (typeof raw !== "string" || Buffer.byteLength(raw, "utf8") > 16_384) {
    return blocked();
  }
  const value = parseUnambiguousJsonDocument(raw);
  if (
    !value ||
    typeof value !== "object" ||
    Array.isArray(value) ||
    Reflect.ownKeys(value).length !== 1 ||
    !Object.hasOwn(value, "status") ||
    (value as { status?: unknown }).status !== true
  ) {
    return blocked();
  }
  return Object.freeze({
    status: "confirmed" as const,
    normalizedResult: Object.freeze({ status: true as const }),
    rawOutputReported: false,
  });
}

export function describeCodexStructuredResultContract() {
  return Object.freeze({
    contract: CODEX_STRUCTURED_RESULT_CONTRACT,
    contractRevision: CODEX_STRUCTURED_RESULT_CONTRACT_REVISION,
    envelope: "single_unambiguous_json_document",
    duplicateKeysAllowed: false,
    normalizedResult: Object.freeze({ status: true as const }),
    maximumBytes: 16_384,
    rawOutputReported: false,
  });
}
