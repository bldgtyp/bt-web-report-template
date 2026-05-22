#!/usr/bin/env node
import fs from "node:fs";
import { pathToFileURL } from "node:url";

import YAML from "yaml";

const API_BASE_URL = "https://api.cloudflare.com/client/v4";

export function hostnameFromProductionUrl(productionUrl) {
  if (typeof productionUrl !== "string" || productionUrl.trim() === "") {
    throw new Error("publishing.production_url is required for Cloudflare Pages custom domain setup.");
  }
  const url = new URL(productionUrl);
  if (url.protocol !== "https:" || url.pathname !== "/" || url.search || url.hash) {
    throw new Error(`production_url must be an https origin URL without a path: ${productionUrl}`);
  }
  return url.hostname;
}

export function readProductionUrl(projectYamlPath) {
  const project = YAML.parse(fs.readFileSync(projectYamlPath, "utf8"));
  return project?.publishing?.production_url;
}

export async function ensureCloudflarePages({
  accountId,
  apiToken,
  projectName,
  productionUrl,
  fetchImpl = globalThis.fetch,
  log = console.log,
  apiBaseUrl = API_BASE_URL,
}) {
  if (!accountId) {
    throw new Error("CLOUDFLARE_ACCOUNT_ID is required.");
  }
  if (!apiToken) {
    throw new Error("CLOUDFLARE_API_TOKEN is required.");
  }
  if (!projectName) {
    throw new Error("Cloudflare Pages project name is required.");
  }
  if (typeof fetchImpl !== "function") {
    throw new Error("fetch is not available in this Node runtime.");
  }

  const domainName = hostnameFromProductionUrl(productionUrl);
  const projectPath = `/pages/projects/${encodeURIComponent(projectName)}`;
  const pagesHostname = `${projectName}.pages.dev`;

  const project = await cloudflareRequest({
    accountId,
    apiToken,
    path: projectPath,
    fetchImpl,
    apiBaseUrl,
    allowNotFound: true,
  });

  if (project.status === 404) {
    await cloudflareRequest({
      accountId,
      apiToken,
      path: "/pages/projects",
      fetchImpl,
      apiBaseUrl,
      method: "POST",
      body: { name: projectName, production_branch: "main" },
    });
    log(`Cloudflare Pages project created: ${projectName}`);
  } else {
    log(`Cloudflare Pages project exists: ${projectName}`);
  }

  const domains = await cloudflareRequest({
    accountId,
    apiToken,
    path: `${projectPath}/domains`,
    fetchImpl,
    apiBaseUrl,
  });
  const existingDomain = domains.result.find((domain) => domain.name === domainName);
  let domainCreated = false;
  let domainStatus;
  if (existingDomain) {
    log(`Cloudflare Pages custom domain exists: ${domainName} (${existingDomain.status})`);
    domainStatus = existingDomain.status;
  } else {
    try {
      const domain = await cloudflareRequest({
        accountId,
        apiToken,
        path: `${projectPath}/domains`,
        fetchImpl,
        apiBaseUrl,
        method: "POST",
        body: { name: domainName },
      });
      domainCreated = true;
      domainStatus = domain.result.status;
      log(`Cloudflare Pages custom domain added: ${domainName} (${domain.result.status})`);
    } catch (error) {
      // Cloudflare's list-domains API can disagree with the add-domain API
      // (paginated list, recent attach, etc.). Treat "already added" as a
      // success — the goal of this script is to ENSURE the domain is
      // attached, not to fail loudly if a previous attempt got it there.
      const message = error?.message ?? String(error);
      if (/already added this custom domain/i.test(message)) {
        log(`Cloudflare Pages custom domain already attached: ${domainName} (treating as success)`);
        domainStatus = "active";
      } else {
        throw error;
      }
    }
  }

  const dnsRecord = await ensurePagesDnsRecord({
    apiToken,
    fetchImpl,
    apiBaseUrl,
    domainName,
    pagesHostname,
    log,
  });
  return { projectName, domainName, domainCreated, domainStatus, dnsRecord };
}

export async function ensurePagesDnsRecord({
  apiToken,
  domainName,
  pagesHostname,
  fetchImpl = globalThis.fetch,
  log = console.log,
  apiBaseUrl = API_BASE_URL,
}) {
  const zone = await findZoneForHostname({ apiToken, hostname: domainName, fetchImpl, apiBaseUrl });
  if (!zone) {
    throw new Error(`Could not find a Cloudflare zone for ${domainName}.`);
  }
  const encodedName = encodeURIComponent(domainName);
  const records = await cloudflareRequestRaw({
    apiToken,
    path: `/zones/${encodeURIComponent(zone.id)}/dns_records?name=${encodedName}`,
    fetchImpl,
    apiBaseUrl,
  });
  const conflictingRecord = records.result.find((record) => record.type !== "CNAME");
  if (conflictingRecord) {
    throw new Error(`DNS record for ${domainName} already exists with type ${conflictingRecord.type}.`);
  }
  const cname = records.result.find((record) => record.type === "CNAME");
  const body = {
    type: "CNAME",
    name: domainName,
    content: pagesHostname,
    ttl: 1,
    proxied: true,
  };
  if (!cname) {
    const created = await cloudflareRequestRaw({
      apiToken,
      path: `/zones/${encodeURIComponent(zone.id)}/dns_records`,
      fetchImpl,
      apiBaseUrl,
      method: "POST",
      body,
    });
    log(`Cloudflare DNS CNAME created: ${domainName} -> ${pagesHostname}`);
    return { zoneName: zone.name, recordId: created.result.id, created: true };
  }
  if (cname.content === pagesHostname && cname.proxied === true) {
    log(`Cloudflare DNS CNAME exists: ${domainName} -> ${pagesHostname}`);
    return { zoneName: zone.name, recordId: cname.id, created: false };
  }
  const updated = await cloudflareRequestRaw({
    apiToken,
    path: `/zones/${encodeURIComponent(zone.id)}/dns_records/${encodeURIComponent(cname.id)}`,
    fetchImpl,
    apiBaseUrl,
    method: "PUT",
    body,
  });
  log(`Cloudflare DNS CNAME updated: ${domainName} -> ${pagesHostname}`);
  return { zoneName: zone.name, recordId: updated.result.id, created: false };
}

async function findZoneForHostname({ apiToken, hostname, fetchImpl, apiBaseUrl }) {
  for (const zoneName of candidateZoneNames(hostname)) {
    const zones = await cloudflareRequestRaw({
      apiToken,
      path: `/zones?name=${encodeURIComponent(zoneName)}`,
      fetchImpl,
      apiBaseUrl,
    });
    const zone = zones.result.find((item) => item.name === zoneName);
    if (zone) {
      return zone;
    }
  }
  return null;
}

export function candidateZoneNames(hostname) {
  const labels = hostname.split(".").filter(Boolean);
  const candidates = [];
  for (let index = 0; index <= labels.length - 2; index += 1) {
    candidates.push(labels.slice(index).join("."));
  }
  return candidates;
}

export async function cloudflareRequest({
  accountId,
  apiToken,
  path,
  fetchImpl,
  apiBaseUrl = API_BASE_URL,
  method = "GET",
  body,
  allowNotFound = false,
}) {
  return cloudflareRequestRaw({
    apiToken,
    path: `/accounts/${encodeURIComponent(accountId)}${path}`,
    fetchImpl,
    apiBaseUrl,
    method,
    body,
    allowNotFound,
  });
}

export async function cloudflareRequestRaw({
  apiToken,
  path,
  fetchImpl,
  apiBaseUrl = API_BASE_URL,
  method = "GET",
  body,
  allowNotFound = false,
}) {
  const response = await fetchImpl(`${apiBaseUrl}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${apiToken}`,
      "Content-Type": "application/json",
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await response.text();
  const payload = text ? JSON.parse(text) : {};
  if (allowNotFound && response.status === 404) {
    return { status: 404, result: null };
  }
  if (!response.ok || payload.success === false) {
    throw new Error(formatCloudflareError(method, path, response.status, payload));
  }
  return payload;
}

export function formatCloudflareError(method, path, status, payload) {
  const messages = [...(payload.errors ?? []), ...(payload.messages ?? [])]
    .map((item) => item.message)
    .filter(Boolean);
  const suffix = messages.length > 0 ? `: ${messages.join("; ")}` : "";
  return `Cloudflare API ${method} ${path} failed (${status})${suffix}`;
}

function parseArgs(argv) {
  const args = new Map();
  for (let index = 0; index < argv.length; index += 2) {
    const key = argv[index];
    const value = argv[index + 1];
    if (!key?.startsWith("--") || value === undefined) {
      throw new Error(`Expected --key value arguments, got: ${argv.join(" ")}`);
    }
    args.set(key.slice(2), value);
  }
  return args;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const projectYamlPath = args.get("project-yaml");
  const projectName = args.get("project-name");
  if (!projectYamlPath) {
    throw new Error("--project-yaml is required.");
  }
  if (!projectName) {
    throw new Error("--project-name is required.");
  }

  await ensureCloudflarePages({
    accountId: process.env.CLOUDFLARE_ACCOUNT_ID,
    apiToken: process.env.CLOUDFLARE_API_TOKEN,
    projectName,
    productionUrl: readProductionUrl(projectYamlPath),
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  });
}
