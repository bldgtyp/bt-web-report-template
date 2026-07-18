#!/usr/bin/env node
import fs from "node:fs";
import { pathToFileURL } from "node:url";

import YAML from "yaml";

const API_BASE_URL = "https://api.cloudflare.com/client/v4";
const ACCESS_MODE_PUBLIC = "public";
const ACCESS_MODE_CLOUDFLARE_OTP = "cloudflare_access_otp";
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

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
  return readProjectPublishing(projectYamlPath).productionUrl;
}

export function readProjectPublishing(projectYamlPath) {
  const project = YAML.parse(fs.readFileSync(projectYamlPath, "utf8"));
  return {
    productionUrl: project?.publishing?.production_url,
    access: project?.publishing?.access,
  };
}

export function normalizeAccessConfig(access) {
  if (access === undefined || access === null) {
    return { mode: ACCESS_MODE_PUBLIC, allowed_emails: [] };
  }
  if (typeof access !== "object" || Array.isArray(access)) {
    throw new Error("publishing.access must be an object.");
  }
  if (access.mode === undefined) {
    throw new Error("publishing.access.mode is required when publishing.access is present.");
  }
  if (access.allowed_emails === undefined) {
    throw new Error("publishing.access.allowed_emails is required when publishing.access is present.");
  }
  if (![ACCESS_MODE_PUBLIC, ACCESS_MODE_CLOUDFLARE_OTP].includes(access.mode)) {
    throw new Error(`publishing.access.mode must be ${ACCESS_MODE_PUBLIC} or ${ACCESS_MODE_CLOUDFLARE_OTP}.`);
  }
  if (!Array.isArray(access.allowed_emails)) {
    throw new Error("publishing.access.allowed_emails must be a list.");
  }

  const allowedEmails = access.allowed_emails.map((email, index) => {
    if (typeof email !== "string" || !EMAIL_PATTERN.test(email)) {
      throw new Error(`publishing.access.allowed_emails[${index}] must be a valid email address.`);
    }
    return email;
  });
  if (access.mode === ACCESS_MODE_CLOUDFLARE_OTP && allowedEmails.length === 0) {
    throw new Error("publishing.access.allowed_emails must include at least one email for cloudflare_access_otp.");
  }
  return { mode: access.mode, allowed_emails: allowedEmails };
}

export function accessApplicationName(hostname) {
  return `bt-web-report ${hostname}`;
}

export function accessApplicationPayload({ hostname, access, otpIdentityProviderId }) {
  return {
    name: accessApplicationName(hostname),
    type: "self_hosted",
    domain: hostname,
    destinations: [{ type: "public", uri: hostname }],
    session_duration: "24h",
    app_launcher_visible: false,
    allowed_idps: [otpIdentityProviderId],
    policies: [
      {
        name: "Allow project report readers",
        decision: "allow",
        precedence: 1,
        session_duration: "24h",
        include: access.allowed_emails.map((email) => ({ email: { email } })),
      },
    ],
  };
}

export async function ensureCloudflarePages({
  accountId,
  apiToken,
  projectName,
  productionUrl,
  access,
  otpIdentityProviderId,
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
  const normalizedAccess = normalizeAccessConfig(access);
  validateCloudflareAccessPreflight({ access: normalizedAccess, otpIdentityProviderId });
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
  const accessResult =
    access === undefined || access === null
      ? { mode: ACCESS_MODE_PUBLIC, applicationId: null, action: "skipped" }
      : await ensureCloudflareAccess({
          accountId,
          apiToken,
          productionUrl,
          access: normalizedAccess,
          otpIdentityProviderId,
          fetchImpl,
          log,
          apiBaseUrl,
        });
  return { projectName, domainName, domainCreated, domainStatus, dnsRecord, access: accessResult };
}

export function validateCloudflareAccessPreflight({ access, otpIdentityProviderId }) {
  if (access.mode === ACCESS_MODE_CLOUDFLARE_OTP && !otpIdentityProviderId) {
    throw new Error("CLOUDFLARE_ACCESS_OTP_IDP_ID is required when publishing.access.mode is cloudflare_access_otp.");
  }
}

export async function ensureCloudflareAccess({
  accountId,
  apiToken,
  productionUrl,
  access,
  otpIdentityProviderId,
  fetchImpl = globalThis.fetch,
  log = console.log,
  apiBaseUrl = API_BASE_URL,
}) {
  const domainName = hostnameFromProductionUrl(productionUrl);
  const normalizedAccess = normalizeAccessConfig(access);
  validateCloudflareAccessPreflight({ access: normalizedAccess, otpIdentityProviderId });

  const existingApplication = await findManagedAccessApplication({
    accountId,
    apiToken,
    hostname: domainName,
    fetchImpl,
    apiBaseUrl,
  });

  if (normalizedAccess.mode === ACCESS_MODE_PUBLIC) {
    if (!existingApplication) {
      log(`Cloudflare Access gate absent: ${domainName}`);
      return { mode: ACCESS_MODE_PUBLIC, applicationId: null, action: "none" };
    }
    await cloudflareRequest({
      accountId,
      apiToken,
      path: `/access/apps/${encodeURIComponent(existingApplication.id)}`,
      fetchImpl,
      apiBaseUrl,
      method: "DELETE",
    });
    log(`Cloudflare Access gate removed: ${domainName}`);
    return { mode: ACCESS_MODE_PUBLIC, applicationId: existingApplication.id, action: "deleted" };
  }

  const body = accessApplicationPayload({
    hostname: domainName,
    access: normalizedAccess,
    otpIdentityProviderId,
  });
  if (existingApplication) {
    const updated = await cloudflareRequest({
      accountId,
      apiToken,
      path: `/access/apps/${encodeURIComponent(existingApplication.id)}`,
      fetchImpl,
      apiBaseUrl,
      method: "PUT",
      body,
    });
    log(`Cloudflare Access gate updated: ${domainName}`);
    return { mode: ACCESS_MODE_CLOUDFLARE_OTP, applicationId: updated.result.id, action: "updated" };
  }

  const created = await createAccessApplicationOrUpdateExisting({
    accountId,
    apiToken,
    hostname: domainName,
    body,
    fetchImpl,
    apiBaseUrl,
  });
  log(`Cloudflare Access gate ${created.action}: ${domainName}`);
  return { mode: ACCESS_MODE_CLOUDFLARE_OTP, applicationId: created.response.result.id, action: created.action };
}

async function createAccessApplicationOrUpdateExisting({ accountId, apiToken, hostname, body, fetchImpl, apiBaseUrl }) {
  try {
    const response = await cloudflareRequest({
      accountId,
      apiToken,
      path: "/access/apps",
      fetchImpl,
      apiBaseUrl,
      method: "POST",
      body,
    });
    return { response, action: "created" };
  } catch (error) {
    if (!/already exists|already have|conflict/i.test(error?.message ?? String(error))) {
      throw error;
    }
    const existingApplication = await findManagedAccessApplication({
      accountId,
      apiToken,
      hostname,
      fetchImpl,
      apiBaseUrl,
    });
    if (!existingApplication) {
      throw error;
    }
    const response = await cloudflareRequest({
      accountId,
      apiToken,
      path: `/access/apps/${encodeURIComponent(existingApplication.id)}`,
      fetchImpl,
      apiBaseUrl,
      method: "PUT",
      body,
    });
    return { response, action: "updated" };
  }
}

async function findManagedAccessApplication({ accountId, apiToken, hostname, fetchImpl, apiBaseUrl }) {
  const applications = await cloudflareRequest({
    accountId,
    apiToken,
    path: `/access/apps?domain=${encodeURIComponent(hostname)}&exact=true`,
    fetchImpl,
    apiBaseUrl,
  });
  return (applications.result ?? []).find((application) => isManagedAccessApplication(application, hostname)) ?? null;
}

function isManagedAccessApplication(application, hostname) {
  return application?.name === accessApplicationName(hostname) && applicationMatchesHostname(application, hostname);
}

function applicationMatchesHostname(application, hostname) {
  if (application?.domain === hostname) {
    return true;
  }
  return (application?.destinations ?? []).some((destination) => destinationHostname(destination?.uri) === hostname);
}

function destinationHostname(uri) {
  if (typeof uri !== "string" || uri.trim() === "") {
    return null;
  }
  try {
    const value = uri.includes("://") ? uri : `https://${uri}`;
    return new URL(value).hostname;
  } catch {
    return null;
  }
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
  for (let index = 0; index < argv.length; index += 1) {
    const key = argv[index];
    if (!key?.startsWith("--")) {
      throw new Error(`Expected --key value arguments, got: ${argv.join(" ")}`);
    }
    const next = argv[index + 1];
    if (next === undefined || next.startsWith("--")) {
      args.set(key.slice(2), true);
      continue;
    }
    args.set(key.slice(2), next);
    index += 1;
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

  const publishing = readProjectPublishing(projectYamlPath);
  if (args.get("preflight-access")) {
    validateCloudflareAccessPreflight({
      access: normalizeAccessConfig(publishing.access),
      otpIdentityProviderId: process.env.CLOUDFLARE_ACCESS_OTP_IDP_ID,
    });
    return;
  }

  if (!projectName) {
    throw new Error("--project-name is required.");
  }

  await ensureCloudflarePages({
    accountId: process.env.CLOUDFLARE_ACCOUNT_ID,
    apiToken: process.env.CLOUDFLARE_API_TOKEN,
    projectName,
    productionUrl: publishing.productionUrl,
    access: publishing.access,
    otpIdentityProviderId: process.env.CLOUDFLARE_ACCESS_OTP_IDP_ID,
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  });
}
