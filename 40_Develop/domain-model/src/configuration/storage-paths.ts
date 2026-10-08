/**
 * Repository-localの宣言済み配置定数。
 *
 * @responsibility 用途・設定Pathの閉集合を所有し、Filesystem操作を発行しない。
 * @trace ARCH-000011
 */
export const REPOSITORY_MANIFEST_RELATIVE_PATH =
  ".crdd/config/repository-manifest.json" as const;

export const EXTERNAL_SEND_POLICY_RELATIVE_PATH =
  ".crdd/config/external-send-policy.json" as const;

export const TESTS_RELATIVE_PATH = ".crdd/tests" as const;

export const REPOSITORY_AREAS = Object.freeze([
  "config",
  "orchestrator",
  "coordinator",
  "execution-intelligence",
  "candidates",
  "release",
  "communication",
  "tests",
  "tmp",
] as const);

export const AREA_PATH_KEYS = Object.freeze({
  config: "config",
  orchestrator: "orchestrator",
  coordinator: "coordinator",
  "execution-intelligence": "executionIntelligence",
  candidates: "candidates",
  release: "release",
  communication: "communication",
  tests: "tests",
  tmp: "temporary",
} as const);
