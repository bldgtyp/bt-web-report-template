#!/usr/bin/env node
import assert from "node:assert/strict";

import {
  accessApplicationName,
  candidateZoneNames,
  ensureCloudflareAccess,
  ensureCloudflarePages,
  hostnameFromProductionUrl,
  normalizeAccessConfig,
} from "./setup-cloudflare-pages.mjs";

assert.equal(hostnameFromProductionUrl("https://project-2606.bldgtyp.com"), "project-2606.bldgtyp.com");
assert.throws(() => hostnameFromProductionUrl(""), /production_url is required/);
assert.deepEqual(candidateZoneNames("project-2606.bldgtyp.com"), [
  "project-2606.bldgtyp.com",
  "bldgtyp.com",
]);
assert.deepEqual(normalizeAccessConfig(undefined), { mode: "public", allowed_emails: [] });
assert.throws(() => normalizeAccessConfig({ mode: "public" }), /allowed_emails is required/);
assert.throws(
  () => normalizeAccessConfig({ mode: "cloudflare_access_otp", allowed_emails: [] }),
  /must include at least one email/,
);

const createdCalls = [];
const createdFetch = async (url, options) => {
  createdCalls.push({ url, options });
  const path = new URL(url).pathname;
  if (options.method === "GET" && path.endsWith("/pages/projects/bt-proj-2606-vandam")) {
    return jsonResponse({ success: false, errors: [{ message: "not found" }] }, 404);
  }
  if (options.method === "POST" && path.endsWith("/pages/projects")) {
    assert.deepEqual(JSON.parse(options.body), { name: "bt-proj-2606-vandam", production_branch: "main" });
    return jsonResponse({ success: true, result: { name: "bt-proj-2606-vandam" } });
  }
  if (options.method === "GET" && path.endsWith("/pages/projects/bt-proj-2606-vandam/domains")) {
    return jsonResponse({ success: true, result: [] });
  }
  if (options.method === "POST" && path.endsWith("/pages/projects/bt-proj-2606-vandam/domains")) {
    assert.deepEqual(JSON.parse(options.body), { name: "project-2606.bldgtyp.com" });
    return jsonResponse({ success: true, result: { name: "project-2606.bldgtyp.com", status: "initializing" } });
  }
  if (options.method === "GET" && path.endsWith("/zones")) {
    const name = new URL(url).searchParams.get("name");
    return jsonResponse({
      success: true,
      result: name === "bldgtyp.com" ? [{ id: "zone-id", name: "bldgtyp.com" }] : [],
    });
  }
  if (options.method === "GET" && path.endsWith("/zones/zone-id/dns_records")) {
    assert.equal(new URL(url).searchParams.get("name"), "project-2606.bldgtyp.com");
    return jsonResponse({ success: true, result: [] });
  }
  if (options.method === "POST" && path.endsWith("/zones/zone-id/dns_records")) {
    assert.deepEqual(JSON.parse(options.body), {
      type: "CNAME",
      name: "project-2606.bldgtyp.com",
      content: "bt-proj-2606-vandam.pages.dev",
      ttl: 1,
      proxied: true,
    });
    return jsonResponse({ success: true, result: { id: "record-id" } });
  }
  throw new Error(`unexpected request: ${options.method} ${path}`);
};

const created = await ensureCloudflarePages({
  accountId: "account-id",
  apiToken: "token",
  projectName: "bt-proj-2606-vandam",
  productionUrl: "https://project-2606.bldgtyp.com",
  fetchImpl: createdFetch,
  apiBaseUrl: "https://api.example.test/client/v4",
  log: () => undefined,
});

assert.equal(created.domainCreated, true);
assert.equal(created.domainStatus, "initializing");
assert.deepEqual(created.dnsRecord, { zoneName: "bldgtyp.com", recordId: "record-id", created: true });
assert.deepEqual(created.access, { mode: "public", applicationId: null, action: "skipped" });
assert.equal(createdCalls.length, 8);

const existingCalls = [];
const existingFetch = async (url, options) => {
  existingCalls.push({ url, options });
  const path = new URL(url).pathname;
  if (options.method === "GET" && path.endsWith("/pages/projects/bt-proj-2606-vandam")) {
    return jsonResponse({ success: true, result: { name: "bt-proj-2606-vandam" } });
  }
  if (options.method === "GET" && path.endsWith("/pages/projects/bt-proj-2606-vandam/domains")) {
    return jsonResponse({
      success: true,
      result: [{ name: "project-2606.bldgtyp.com", status: "active" }],
    });
  }
  if (options.method === "GET" && path.endsWith("/zones")) {
    const name = new URL(url).searchParams.get("name");
    return jsonResponse({
      success: true,
      result: name === "bldgtyp.com" ? [{ id: "zone-id", name: "bldgtyp.com" }] : [],
    });
  }
  if (options.method === "GET" && path.endsWith("/zones/zone-id/dns_records")) {
    return jsonResponse({
      success: true,
      result: [
        {
          id: "record-id",
          type: "CNAME",
          name: "project-2606.bldgtyp.com",
          content: "bt-proj-2606-vandam.pages.dev",
          proxied: true,
        },
      ],
    });
  }
  throw new Error(`unexpected request: ${options.method} ${path}`);
};

const existing = await ensureCloudflarePages({
  accountId: "account-id",
  apiToken: "token",
  projectName: "bt-proj-2606-vandam",
  productionUrl: "https://project-2606.bldgtyp.com",
  fetchImpl: existingFetch,
  apiBaseUrl: "https://api.example.test/client/v4",
  log: () => undefined,
});

assert.equal(existing.domainCreated, false);
assert.equal(existing.domainStatus, "active");
assert.deepEqual(existing.dnsRecord, { zoneName: "bldgtyp.com", recordId: "record-id", created: false });
assert.deepEqual(existing.access, { mode: "public", applicationId: null, action: "skipped" });
assert.equal(existingCalls.length, 5);

const gatedAccess = { mode: "cloudflare_access_otp", allowed_emails: ["ed@bldgtyp.com", "john@bldgtyp.com"] };
const accessCreateCalls = [];
const accessCreateFetch = async (url, options) => {
  accessCreateCalls.push({ url, options });
  const parsed = new URL(url);
  const path = parsed.pathname;
  if (options.method === "GET" && path.endsWith("/accounts/account-id/access/apps")) {
    assert.equal(parsed.searchParams.get("domain"), "project-2606.bldgtyp.com");
    assert.equal(parsed.searchParams.get("exact"), "true");
    return jsonResponse({ success: true, result: [] });
  }
  if (options.method === "POST" && path.endsWith("/accounts/account-id/access/apps")) {
    assertAccessApplicationPayload(JSON.parse(options.body), gatedAccess);
    return jsonResponse({ success: true, result: { id: "access-app-id" } });
  }
  throw new Error(`unexpected request: ${options.method} ${path}`);
};

const createdAccess = await ensureCloudflareAccess({
  accountId: "account-id",
  apiToken: "token",
  productionUrl: "https://project-2606.bldgtyp.com",
  access: gatedAccess,
  otpIdentityProviderId: "otp-idp",
  fetchImpl: accessCreateFetch,
  apiBaseUrl: "https://api.example.test/client/v4",
  log: () => undefined,
});
assert.deepEqual(createdAccess, { mode: "cloudflare_access_otp", applicationId: "access-app-id", action: "created" });
assert.equal(accessCreateCalls.length, 2);

const accessUpdateCalls = [];
const accessUpdateFetch = async (url, options) => {
  accessUpdateCalls.push({ url, options });
  const path = new URL(url).pathname;
  if (options.method === "GET" && path.endsWith("/accounts/account-id/access/apps")) {
    return jsonResponse({
      success: true,
      result: [
        {
          id: "access-app-id",
          name: accessApplicationName("project-2606.bldgtyp.com"),
          domain: "project-2606.bldgtyp.com",
        },
      ],
    });
  }
  if (options.method === "PUT" && path.endsWith("/accounts/account-id/access/apps/access-app-id")) {
    assertAccessApplicationPayload(JSON.parse(options.body), {
      mode: "cloudflare_access_otp",
      allowed_emails: ["owner@example.com"],
    });
    return jsonResponse({ success: true, result: { id: "access-app-id" } });
  }
  throw new Error(`unexpected request: ${options.method} ${path}`);
};

const updatedAccess = await ensureCloudflareAccess({
  accountId: "account-id",
  apiToken: "token",
  productionUrl: "https://project-2606.bldgtyp.com",
  access: { mode: "cloudflare_access_otp", allowed_emails: ["owner@example.com"] },
  otpIdentityProviderId: "otp-idp",
  fetchImpl: accessUpdateFetch,
  apiBaseUrl: "https://api.example.test/client/v4",
  log: () => undefined,
});
assert.deepEqual(updatedAccess, { mode: "cloudflare_access_otp", applicationId: "access-app-id", action: "updated" });
assert.equal(accessUpdateCalls.length, 2);

const accessDeleteCalls = [];
const accessDeleteFetch = async (url, options) => {
  accessDeleteCalls.push({ url, options });
  const path = new URL(url).pathname;
  if (options.method === "GET" && path.endsWith("/accounts/account-id/access/apps")) {
    return jsonResponse({
      success: true,
      result: [
        { id: "foreign-app-id", name: "manual gate", domain: "project-2606.bldgtyp.com" },
        {
          id: "access-app-id",
          name: accessApplicationName("project-2606.bldgtyp.com"),
          domain: "project-2606.bldgtyp.com",
        },
      ],
    });
  }
  if (options.method === "DELETE" && path.endsWith("/accounts/account-id/access/apps/access-app-id")) {
    return jsonResponse({ success: true, result: { id: "access-app-id" } });
  }
  throw new Error(`unexpected request: ${options.method} ${path}`);
};

const deletedAccess = await ensureCloudflareAccess({
  accountId: "account-id",
  apiToken: "token",
  productionUrl: "https://project-2606.bldgtyp.com",
  access: { mode: "public", allowed_emails: [] },
  fetchImpl: accessDeleteFetch,
  apiBaseUrl: "https://api.example.test/client/v4",
  log: () => undefined,
});
assert.deepEqual(deletedAccess, { mode: "public", applicationId: "access-app-id", action: "deleted" });
assert.equal(accessDeleteCalls.length, 2);

await assert.rejects(
  () =>
    ensureCloudflareAccess({
      accountId: "account-id",
      apiToken: "token",
      productionUrl: "https://project-2606.bldgtyp.com",
      access: gatedAccess,
      fetchImpl: () => {
        throw new Error("fetch should not be called without CLOUDFLARE_ACCESS_OTP_IDP_ID");
      },
      apiBaseUrl: "https://api.example.test/client/v4",
      log: () => undefined,
    }),
  /CLOUDFLARE_ACCESS_OTP_IDP_ID is required/,
);

await assert.rejects(
  () =>
    ensureCloudflarePages({
      accountId: "account-id",
      apiToken: "token",
      projectName: "bt-proj-2606-vandam",
      productionUrl: "https://project-2606.bldgtyp.com",
      access: gatedAccess,
      fetchImpl: () => {
        throw new Error("fetch should not be called before gated access preflight");
      },
      apiBaseUrl: "https://api.example.test/client/v4",
      log: () => undefined,
    }),
  /CLOUDFLARE_ACCESS_OTP_IDP_ID is required/,
);

const accessConflictCalls = [];
const accessConflictFetch = async (url, options) => {
  accessConflictCalls.push({ url, options });
  const path = new URL(url).pathname;
  if (options.method === "GET" && path.endsWith("/accounts/account-id/access/apps")) {
    return jsonResponse({ success: true, result: [] });
  }
  if (options.method === "POST" && path.endsWith("/accounts/account-id/access/apps")) {
    return jsonResponse({ success: false, errors: [{ message: "application already exists" }] }, 409);
  }
  throw new Error(`unexpected request: ${options.method} ${path}`);
};

await assert.rejects(
  () =>
    ensureCloudflareAccess({
      accountId: "account-id",
      apiToken: "token",
      productionUrl: "https://project-2606.bldgtyp.com",
      access: gatedAccess,
      otpIdentityProviderId: "otp-idp",
      fetchImpl: accessConflictFetch,
      apiBaseUrl: "https://api.example.test/client/v4",
      log: () => undefined,
    }),
  /application already exists/,
);
assert.equal(accessConflictCalls.length, 3);

const accessConflictRecoverCalls = [];
const accessConflictRecoverFetch = async (url, options) => {
  accessConflictRecoverCalls.push({ url, options });
  const path = new URL(url).pathname;
  if (options.method === "GET" && path.endsWith("/accounts/account-id/access/apps")) {
    const callCount = accessConflictRecoverCalls.filter((call) => call.options.method === "GET").length;
    return jsonResponse({
      success: true,
      result:
        callCount === 1
          ? []
          : [
              {
                id: "access-app-id",
                name: accessApplicationName("project-2606.bldgtyp.com"),
                domain: "project-2606.bldgtyp.com",
              },
            ],
    });
  }
  if (options.method === "POST" && path.endsWith("/accounts/account-id/access/apps")) {
    return jsonResponse({ success: false, errors: [{ message: "application already exists" }] }, 409);
  }
  if (options.method === "PUT" && path.endsWith("/accounts/account-id/access/apps/access-app-id")) {
    assertAccessApplicationPayload(JSON.parse(options.body), gatedAccess);
    return jsonResponse({ success: true, result: { id: "access-app-id" } });
  }
  throw new Error(`unexpected request: ${options.method} ${path}`);
};

const recoveredAccess = await ensureCloudflareAccess({
  accountId: "account-id",
  apiToken: "token",
  productionUrl: "https://project-2606.bldgtyp.com",
  access: gatedAccess,
  otpIdentityProviderId: "otp-idp",
  fetchImpl: accessConflictRecoverFetch,
  apiBaseUrl: "https://api.example.test/client/v4",
  log: () => undefined,
});
assert.deepEqual(recoveredAccess, { mode: "cloudflare_access_otp", applicationId: "access-app-id", action: "updated" });
assert.equal(accessConflictRecoverCalls.length, 4);

function jsonResponse(payload, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function assertAccessApplicationPayload(body, access) {
  assert.deepEqual(body, {
    name: accessApplicationName("project-2606.bldgtyp.com"),
    type: "self_hosted",
    domain: "project-2606.bldgtyp.com",
    destinations: [{ type: "public", uri: "project-2606.bldgtyp.com" }],
    session_duration: "24h",
    app_launcher_visible: false,
    allowed_idps: ["otp-idp"],
    policies: [
      {
        name: "Allow project report readers",
        decision: "allow",
        precedence: 1,
        session_duration: "24h",
        include: access.allowed_emails.map((email) => ({ email: { email } })),
      },
    ],
  });
}

console.log("cloudflare pages setup ok");
