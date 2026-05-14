#!/usr/bin/env node
import assert from "node:assert/strict";

import { ensureCloudflarePages, hostnameFromProductionUrl } from "./setup-cloudflare-pages.mjs";

assert.equal(hostnameFromProductionUrl("https://project-2606.bldgtyp.com"), "project-2606.bldgtyp.com");
assert.throws(() => hostnameFromProductionUrl(""), /production_url is required/);

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
assert.equal(createdCalls.length, 4);

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
assert.equal(existingCalls.length, 2);

function jsonResponse(payload, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

console.log("cloudflare pages setup ok");
