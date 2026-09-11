import assert from "node:assert/strict";
import test from "node:test";

import {
  inspectCrosTrustPolicy,
  inspectRepositoryManifest,
} from "../../src/index.ts";

test("Repository ManifestはIdentityと宣言だけを受理する", () => {
  const manifest = inspectRepositoryManifest({
    schema: "crdd/repository-manifest/v1",
    projectId: "qual-lab.crdd",
    displayName: "CRDD",
    repositoryRole: "crdd-standard",
    capabilities: ["project-runtime", "coordinator"],
    contextSurfaces: ["crdd-context"],
    externalSendPolicy: "config/external-send-policy.json",
  });
  assert.equal(manifest?.projectId, "qual-lab.crdd");
  assert.equal(
    inspectRepositoryManifest({ ...manifest, repositoryRoot: "C:\\secret" }),
    null,
  );
});

test("Trust PolicyはTrust Domainを明示し個別Authorityを所有しない", () => {
  const policy = inspectCrosTrustPolicy({
    schema: "cros/trust-policy/v1",
    trustDomainId: "qual-lab-local",
    trustedRuntimePublishers: ["qual-lab"],
    repositoryAdmission: "explicit-binding-only",
    maximumCapabilities: ["project-runtime", "read-projection"],
    transports: ["stdio", "local-http"],
    allowUnsignedLocalDevelopment: true,
  });
  assert.equal(policy?.trustDomainId, "qual-lab-local");
  assert.equal(
    inspectCrosTrustPolicy({ ...policy, operationAuthority: "granted" }),
    null,
  );
});

test("Schemaは重複配列と暗黙default Trust Domainを拒否する", () => {
  assert.equal(
    inspectCrosTrustPolicy({
      schema: "cros/trust-policy/v1",
      trustDomainId: "default",
      trustedRuntimePublishers: ["qual-lab", "qual-lab"],
      repositoryAdmission: "explicit-binding-only",
      maximumCapabilities: [],
      transports: [],
      allowUnsignedLocalDevelopment: false,
    }),
    null,
  );
});
