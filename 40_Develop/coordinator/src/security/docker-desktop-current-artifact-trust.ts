import { createHash } from "node:crypto";

export const DOCKER_DESKTOP_CURRENT_ARTIFACT_TRUST_POLICY =
  "CRDD_DOCKER_RESTART_TRUST_V1|official-fixed-paths|Docker Inc|cache-only|deny-write-delete|optional-dev-envs";

export const dockerDesktopCurrentArtifactTrustPolicySha256 = createHash(
  "sha256",
)
  .update(DOCKER_DESKTOP_CURRENT_ARTIFACT_TRUST_POLICY, "ascii")
  .digest("hex");

export function describeDockerDesktopCurrentArtifactTrustContract() {
  return Object.freeze({
    officialFixedPathsRequired: true,
    publisherOrganization: "Docker Inc",
    authenticodeRequired: true,
    revocationMode: "cache_only",
    exactVersionRequired: false,
    exactHashRequiredAcrossOperations: false,
    sameIdentityAndHashRequiredWithinOperation: true,
  });
}
