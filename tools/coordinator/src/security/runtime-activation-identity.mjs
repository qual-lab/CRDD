// @ts-check

export const RUNTIME_ACTIVATION_ID_MAX_LENGTH = 128;

const ACTIVATION_ID = /^ACTIVATION-[0-9]{6,}$/u;

/** @param {unknown} value */
export function isRuntimeActivationIdCandidate(value) {
  return typeof value === "string" && value.length <= RUNTIME_ACTIVATION_ID_MAX_LENGTH &&
    ACTIVATION_ID.test(value);
}
