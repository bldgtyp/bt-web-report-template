#!/usr/bin/env node
import assert from "node:assert/strict";

import { candidateZoneNames, ensureCloudflarePages, hostnameFromProductionUrl } from "./setup-cloudflare-pages.mjs";

assert.equal(hostnameFromProductionUrl("https://project-2606.bldgtyp.com"), "project-2606.bldgtyp.com");
assert.throws(() => hostnameFromProductionUrl(""), /production_url is required/);
assert.deepEqual(candidateZoneNames("project-2606.bldgtyp.com"), [
  "project-2606.bldgtyp.com",
  "bldgtyp.com",
]);

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
assert.equal(existingCalls.length, 5);

function jsonResponse(payload, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

console.log("cloudflare pages setup ok");
