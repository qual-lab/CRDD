import assert from "node:assert/strict";
import test from "node:test";

import {
  containsRecognizedSecretMaterial,
  containsRecognizedSecretScope,
  containsRecognizedSecretText,
  describeSecretMaterialPolicyContract,
  isRecognizedSecretBearingPath,
} from "../../src/security/secret-material-policy.ts";

test("固定形式Secretと名前付き実値を検出し明示placeholderを誤検出しない", () => {
  assert.equal(
    containsRecognizedSecretText(`token=sk-${"A".repeat(24)}`),
    true,
  );
  assert.equal(
    containsRecognizedSecretText("password=correct-horse-battery-staple"),
    true,
  );
  assert.equal(containsRecognizedSecretText("password=Password123!"), true);
  assert.equal(containsRecognizedSecretText("password=correcthorse!"), true);
  assert.equal(containsRecognizedSecretText("api_key=abc123def456"), true);
  assert.equal(
    containsRecognizedSecretMaterial(
      "src/oauth.ts",
      "const accessToken = oauth2Token;\naccessToken=resolvedOAuth2Token;\npassword=resolvedPassword2;\n",
    ),
    false,
  );
  for (const sourceLiteral of [
    "// password=Password123!",
    "//password=Password123!",
    "/* password=Password123! */",
    "/*password=Password123!*/",
    "/**password=Password123!*/",
    "/*!password=Password123!*/",
    "/*password=Password123!",
    "/**\n * docs\n *password=Password123!\n */",
    "/*docs\n*password=Password123!\n*/",
    "/*docs\r\n!password=Password123!\r\n*/",
    "/*docs\n*password=Password123!",
    'const note = " password=Password123!";',
    'const note = "password=Password123!";',
    "const note = ` password=Password123!`;",
    "const re = /password=Password123!/;",
  ]) {
    assert.equal(
      containsRecognizedSecretMaterial("src/auth.ts", sourceLiteral),
      true,
      sourceLiteral,
    );
  }
  assert.equal(
    containsRecognizedSecretMaterial(
      "src/auth.ts",
      "/**\n * session_token=placeholder_long_value\n */",
    ),
    false,
  );
  for (const sourceReferenceAfterComment of [
    "/*c*/password=resolvedPassword2;",
    "/**/accessToken=oauth2Token;",
  ]) {
    assert.equal(
      containsRecognizedSecretMaterial(
        "src/auth.ts",
        sourceReferenceAfterComment,
      ),
      false,
      sourceReferenceAfterComment,
    );
  }
  assert.equal(
    containsRecognizedSecretMaterial(
      "src/view.tsx",
      "<div>password=Password123!</div>",
    ),
    true,
  );
  assert.equal(
    containsRecognizedSecretMaterial(
      "src/oauth.cjs",
      "accessToken=resolvedOAuth2Token;",
    ),
    false,
  );
  assert.equal(
    containsRecognizedSecretMaterial(
      "src/auth.py",
      "password=resolvedPassword2",
    ),
    true,
  );
  assert.equal(
    containsRecognizedSecretMaterial(
      "config/settings.env",
      "password=Password123!",
    ),
    true,
  );
  assert.equal(
    containsRecognizedSecretText("session_token=abcdefghijklmnopqrstuvwx"),
    false,
  );
  assert.equal(
    containsRecognizedSecretText(
      "DATABASE_PASSWORD='correct-horse-battery-staple'",
    ),
    true,
  );
  assert.equal(
    containsRecognizedSecretText("const password = process.env.PASSWORD;"),
    false,
  );
  assert.equal(containsRecognizedSecretText("apiKey: config.apiKey"), false);
  assert.equal(
    containsRecognizedSecretText("accessToken=tokenStore.read()"),
    false,
  );
  for (const sourceReference of [
    "password = options.password",
    "password = request.password",
    "password = appConfig.password",
    "password = this.config.password",
    "password = env.PASSWORD",
    "password = module.settings.password",
    'apiKey=process.env["API_KEY"]',
    "apiKey=import.meta.env['API_KEY']",
    'apiKey=os.environ["API_KEY"]',
    "password = resolvedDatabasePassword",
    "password=resolvedDatabasePassword;",
    "apiKey = applicationConfigurationKey",
    "apiKey=applicationConfigurationKey;",
    "password = options.password!",
    "password = options!.password",
    'password = options!.config?.["password"]!',
    'password = options?.["password"]',
  ]) {
    assert.equal(containsRecognizedSecretText(sourceReference), false);
  }
  for (const literalAssignment of [
    'this.password = "correct-horse-battery-staple"',
    'config.apiKey = "correct-horse-battery-staple"',
    'process.env.SESSION_TOKEN = "correct-horse-battery-staple"',
    'config["apiKey"] = "correct-horse-battery-staple"',
    'password = "password123"',
    'session_token = "abcdefghijkl"',
    'password = "options.password"',
  ]) {
    assert.equal(containsRecognizedSecretText(literalAssignment), true);
  }
  assert.equal(
    containsRecognizedSecretText(
      "password=eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.signature_value",
    ),
    true,
  );
  assert.equal(
    containsRecognizedSecretText("-----BEGIN ENCRYPTED PRIVATE KEY-----"),
    true,
  );
  assert.equal(
    containsRecognizedSecretText("-----BEGIN DSA PRIVATE KEY-----"),
    true,
  );
  assert.equal(
    containsRecognizedSecretText(`github_pat_${"A".repeat(40)}`),
    true,
  );
  assert.equal(containsRecognizedSecretText("password=REDACTED"), false);
  assert.equal(
    containsRecognizedSecretText(
      "Explain that password values are prohibited.",
    ),
    false,
  );
});

test("引用符とescapeを跨いでも既知SecretとSource参照を分離する", () => {
  const prefixes = [
    "const note = 'ordinary';\n",
    `${String.raw`const note = 'it\'s ordinary';`}\n`,
    `${String.raw`const note = "an escaped \" quote";`}\n`,
    `${String.raw`const note = '\\';`}\n`,
  ];
  for (const prefix of prefixes) {
    assert.equal(
      containsRecognizedSecretMaterial(
        "src/auth.ts",
        `${prefix}password=resolvedPassword2;`,
      ),
      false,
    );
    assert.equal(
      containsRecognizedSecretMaterial(
        "src/auth.ts",
        `${prefix}password='Password123!';`,
      ),
      true,
    );
  }
  for (const source of [
    "const note = 'password=Password123!';",
    String.raw`const note = 'it\'s password=Password123!';`,
    String.raw`const note = "escaped \" password=Password123!";`,
    "const note = 'password=Password123!",
  ]) {
    assert.equal(containsRecognizedSecretMaterial("src/auth.ts", source), true);
  }
});

test("秘密用Pathを拒否し公開用env例と通常Sourceを許可する", () => {
  assert.equal(isRecognizedSecretBearingPath(".env"), true);
  assert.equal(isRecognizedSecretBearingPath("config/.env.production"), true);
  assert.equal(isRecognizedSecretBearingPath("keys/release.pfx"), true);
  assert.equal(isRecognizedSecretBearingPath("home/.aws/credentials"), true);
  assert.equal(isRecognizedSecretBearingPath(".aws/credentials"), true);
  assert.equal(isRecognizedSecretBearingPath("home/.ssh/id_ecdsa"), true);
  assert.equal(isRecognizedSecretBearingPath(".ssh/id_ecdsa"), true);
  assert.equal(isRecognizedSecretBearingPath("config/.env.example"), false);
  assert.equal(
    containsRecognizedSecretMaterial(
      "config/.env.example",
      "SESSION_TOKEN=placeholder_long_value",
    ),
    false,
  );
  assert.equal(
    containsRecognizedSecretMaterial(
      "config/.env.example",
      `SESSION_TOKEN=${"x".repeat(20)}`,
    ),
    false,
  );
  assert.equal(isRecognizedSecretBearingPath("src/index.ts"), false);
  assert.equal(
    containsRecognizedSecretMaterial(
      "src/session_token=abcdefghijklmnopqrstuvwx",
      "",
    ),
    true,
  );
  assert.equal(
    containsRecognizedSecretMaterial(
      "src/password=correct-horse-battery-staple",
      "",
    ),
    true,
  );
  for (const secretPath of [
    "src/session_token = abcdefghijklmnopqrstuvwx",
    "src/password = correcthorsebatterystaple",
    "src/session_token: abcdefghijklmnopqrstuvwx",
    'src/"session_token" : "abcdefghijklmnopqrstuvwx"',
  ]) {
    assert.equal(containsRecognizedSecretMaterial(secretPath, ""), true);
  }
  assert.equal(
    containsRecognizedSecretMaterial(
      "src/session_token = placeholder_long_value",
      "",
    ),
    false,
  );
  assert.equal(
    containsRecognizedSecretMaterial("src/index.ts", "export const value = 1;"),
    false,
  );
});

test("Task scopeは本文と全Pathを同じSecret境界で判定する", () => {
  assert.equal(
    containsRecognizedSecretScope(
      "Use password=Password123! for the request.",
      ["Keep behavior."],
      ["src/index.ts"],
      ["README.md"],
    ),
    true,
  );
  assert.equal(
    containsRecognizedSecretScope(
      "Update the fixture.",
      ["Keep behavior."],
      [".env"],
      ["README.md"],
    ),
    true,
  );
  assert.equal(
    containsRecognizedSecretScope(
      "Update the fixture.",
      ["Keep behavior."],
      ["session_token=abcdefghijklmnopqrstuvwx"],
      ["README.md"],
    ),
    true,
  );
  assert.equal(
    containsRecognizedSecretScope(
      "Update the fixture.",
      ["Explain that passwords must not be committed."],
      ["src/index.ts"],
      ["README.md", ".env.example"],
    ),
    false,
  );
});

test("公開契約はSource許可とSecret検出限界を区別する", () => {
  const contract = describeSecretMaterialPolicyContract();
  assert.equal(contract.contractRevision, 1);
  assert.equal(contract.promptSecretValuesAllowed, false);
  assert.equal(contract.readProjectionSecretValuesAllowed, false);
  assert.equal(contract.repositoryFileBytesEmbeddedInPrompt, false);
  assert.equal(contract.authorizedSourceProjectionAllowed, true);
  assert.equal(contract.unknownSecretAbsenceVerified, false);
});
