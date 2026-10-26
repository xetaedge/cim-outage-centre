import { prisma } from '@/lib/prisma';
import fs from 'fs';
import path from 'path';

export interface ServiceNowConfig {
  instanceUrl: string;
  username: string;
  password: string;
  authHeader: string;
}

export interface ServiceNowTestResult {
  success: boolean;
  instanceUrl: string;
  statusCode?: number;
  latencyMs?: number;
  recordCount?: number;
  message: string;
  isHibernating?: boolean;
}

// Canonical database key names
const SN_KEYS = {
  URL: 'SERVICENOW_INSTANCE_URL',
  USER: 'SERVICENOW_USERNAME',
  PASS: 'SERVICENOW_PASSWORD',
} as const;

interface CachedSession {
  instanceUrl: string;
  username: string;
  headers: Record<string, string>;
  expiresAt: number;
}

let cachedSession: CachedSession | null = null;

/**
 * Centrally resolves ServiceNow credentials — reads from:
 *   1. Runtime overrides (used only for transient testing)
 *   2. SystemSetting DB table (primary source of truth set in Admin UI)
 *   3. Environment variables (process.env / .env.local)
 */
export async function getServiceNowConfig(
  overrides?: Partial<ServiceNowConfig>
): Promise<ServiceNowConfig> {
  const overrideUrl = overrides?.instanceUrl?.trim();
  const overrideUser = overrides?.username?.trim();
  const overridePass = overrides?.password?.trim();

  // Layer 2: Database (single query)
  let dbUrl: string | null = null;
  let dbUser: string | null = null;
  let dbPass: string | null = null;

  try {
    const rows = await prisma.systemSetting.findMany({
      where: {
        key: {
          in: [
            SN_KEYS.URL,
            SN_KEYS.USER,
            SN_KEYS.PASS,
            'servicenow_url',
            'servicenow_user',
            'servicenow_password',
          ],
        },
      },
      select: { key: true, value: true },
    });

    for (const row of rows) {
      if ((row.key === SN_KEYS.URL || row.key === 'servicenow_url') && row.value?.trim()) {
        dbUrl = row.value.trim();
      }
      if ((row.key === SN_KEYS.USER || row.key === 'servicenow_user') && row.value?.trim()) {
        dbUser = row.value.trim();
      }
      if ((row.key === SN_KEYS.PASS || row.key === 'servicenow_password') && row.value?.trim()) {
        dbPass = row.value.trim();
      }
    }
  } catch (dbErr) {
    console.warn('[ServiceNow] Could not read SystemSetting from DB, falling back to env vars:', dbErr);
  }

  // Layer 3: Environment variables
  const envUrl = process.env.SERVICENOW_INSTANCE_URL?.trim();
  const envUser = process.env.SERVICENOW_USERNAME?.trim();
  const envPass = process.env.SERVICENOW_PASSWORD?.trim();

  // Priority: override > DB > process.env
  const storedUrl = (dbUrl || envUrl || '').replace(/\/$/, '');
  const instanceUrl = (overrideUrl || storedUrl).replace(/\/$/, '');
  // Stored credentials are only ever sent to the stored instance; a different URL must bring its own.
  const useStored = instanceUrl === storedUrl;
  const username = overrideUser || (useStored ? dbUser || envUser || '' : '');
  const password = overridePass || (useStored ? dbPass || envPass || '' : '');

  if (!instanceUrl) {
    throw new Error(
      'ServiceNow instance URL is not configured. ' +
      'Please go to Admin Settings → ServiceNow, enter your instance URL and credentials, then click Save.'
    );
  }

  if (!username || !password) {
    throw new Error(
      'ServiceNow credentials are incomplete. ' +
      'Please go to Admin Settings → ServiceNow and enter your username and password, then click Save.'
    );
  }

  const authHeader = 'Basic ' + Buffer.from(`${username}:${password}`).toString('base64');

  return { instanceUrl, username, password, authHeader };
}

/**
 * ADAPTIVE AUTHENTICATION ENGINE:
 * Automatically resolves the optimal authentication method for the target ServiceNow instance:
 * 1. Checks if a valid authenticated session (Cookies + X-UserToken) is cached.
 * 2. If not, performs a lightweight session authentication via `/login.do` and extracts `g_ck` (CSRF token).
 *    This completely bypasses REST API Basic Auth restrictions (common in Australia, Washington, and Xanadu instances).
 * 3. Falls back to standard Basic Auth (`Authorization: Basic ...`) if session login is not applicable.
 */
export async function getServiceNowAuthHeaders(
  config: ServiceNowConfig,
  forceRefresh = false
): Promise<Record<string, string>> {
  const { instanceUrl, username, password, authHeader } = config;

  if (
    !forceRefresh &&
    cachedSession &&
    cachedSession.instanceUrl === instanceUrl &&
    cachedSession.username === username &&
    Date.now() < cachedSession.expiresAt
  ) {
    return cachedSession.headers;
  }

  // Mode 1: Attempt session login to bypass REST API Access Policies / Basic Auth blocks
  try {
    const body = new URLSearchParams({
      user_name: username,
      user_password: password,
      sys_action: 'sysverb_login',
    }).toString();

    const loginRes = await fetch(`${instanceUrl}/login.do`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)',
      },
      body,
      redirect: 'manual',
    });

    const rawCookies = loginRes.headers.get('set-cookie') || '';
    if (rawCookies.includes('glide_session_store') || rawCookies.includes('JSESSIONID')) {
      const cookiePairs: string[] = [];
      rawCookies.split(/,(?=[^;]+=[^;]+)/).forEach((part) => {
        const pair = part.trim().split(';')[0];
        if (pair && pair.includes('=')) cookiePairs.push(pair);
      });
      const cookieHeader = cookiePairs.join('; ');

      // Extract CSRF token (g_ck) from navpage
      let userToken = '';
      try {
        const navRes = await fetch(`${instanceUrl}/navpage.do`, {
          headers: {
            Cookie: cookieHeader,
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)',
          },
        });
        const navHtml = await navRes.text();
        const tokenMatch = navHtml.match(/g_ck\s*=\s*['"]([0-9a-fA-F]{32,})['"]/);
        if (tokenMatch) userToken = tokenMatch[1];
      } catch {
        // Non-fatal if token extraction fails
      }

      const headers: Record<string, string> = {
        Cookie: cookieHeader,
        ...(userToken ? { 'X-UserToken': userToken } : {}),
      };

      cachedSession = {
        instanceUrl,
        username,
        headers,
        expiresAt: Date.now() + 25 * 60 * 1000, // 25-minute TTL
      };

      return headers;
    }
  } catch (sessionErr: any) {
    console.warn('[ServiceNow Auth] Session login attempt returned error, falling back to Basic Auth:', sessionErr?.message);
  }

  // Mode 2: Standard Basic Auth fallback
  return {
    Authorization: authHeader,
  };
}

/**
 * Returns a summary of the active ServiceNow configuration source.
 */
export async function getServiceNowConfigSource(): Promise<{
  instanceUrl: string;
  username: string;
  source: 'database' | 'environment' | 'unconfigured';
}> {
  try {
    const rows = await prisma.systemSetting.findMany({
      where: {
        key: { in: [SN_KEYS.URL, SN_KEYS.USER, 'servicenow_url', 'servicenow_user'] },
      },
      select: { key: true, value: true },
    });

    const dbUrl = rows.find((r) => r.key === SN_KEYS.URL || r.key === 'servicenow_url')?.value?.trim() || '';
    const dbUser = rows.find((r) => r.key === SN_KEYS.USER || r.key === 'servicenow_user')?.value?.trim() || '';

    if (dbUrl) {
      return { instanceUrl: dbUrl, username: dbUser, source: 'database' };
    }

    const envUrl = process.env.SERVICENOW_INSTANCE_URL?.trim() || '';
    const envUser = process.env.SERVICENOW_USERNAME?.trim() || '';
    if (envUrl) {
      return { instanceUrl: envUrl, username: envUser, source: 'environment' };
    }

    return { instanceUrl: '', username: '', source: 'unconfigured' };
  } catch {
    const envUrl = process.env.SERVICENOW_INSTANCE_URL?.trim() || '';
    const envUser = process.env.SERVICENOW_USERNAME?.trim() || '';
    return {
      instanceUrl: envUrl,
      username: envUser,
      source: envUrl ? 'environment' : 'unconfigured',
    };
  }
}

/**
 * Universal helper to execute requests against the live ServiceNow REST API.
 * Uses Adaptive Dual-Mode Auth (Session + CSRF Token with Basic Auth fallback and auto-retry on 401).
 */
export async function fetchServiceNowAPI(
  endpointPath: string,
  init?: RequestInit,
  overrides?: Partial<ServiceNowConfig>
): Promise<Response> {
  const config = await getServiceNowConfig(overrides);
  const authHeaders = await getServiceNowAuthHeaders(config);

  const fullUrl = endpointPath.startsWith('http')
    ? endpointPath
    : `${config.instanceUrl}${endpointPath.startsWith('/') ? '' : '/'}${endpointPath}`;

  const requestHeaders = {
    ...authHeaders,
    Accept: 'application/json',
    'Content-Type': 'application/json',
    ...(init?.headers || {}),
  };

  let response = await fetch(fullUrl, {
    ...init,
    headers: requestHeaders,
    cache: 'no-store',
  });

  // If unauthorized and we used a cached session, refresh session and retry once
  if (response.status === 401 && cachedSession) {
    cachedSession = null;
    const refreshedHeaders = await getServiceNowAuthHeaders(config, true);
    response = await fetch(fullUrl, {
      ...init,
      headers: {
        ...refreshedHeaders,
        Accept: 'application/json',
        'Content-Type': 'application/json',
        ...(init?.headers || {}),
      },
      cache: 'no-store',
    });
  }

  return response;
}

/**
 * Tests live ServiceNow connectivity with deep diagnostic checks:
 * - Detects 401 Unauthorized (bad credentials)
 * - Detects 403 Forbidden (missing roles)
 * - Detects Hibernating instance (HTML redirect/title from developer.servicenow.com)
 * - Detects 200 OK with valid incident record
 */
export async function testServiceNowConnection(
  overrides?: Partial<ServiceNowConfig>
): Promise<ServiceNowTestResult> {
  const startTime = Date.now();
  try {
    const config = await getServiceNowConfig(overrides);
    const response = await fetchServiceNowAPI(
      '/api/now/table/incident?sysparm_limit=1&sysparm_fields=number',
      { method: 'GET' },
      overrides
    );

    const latency = Date.now() - startTime;
    const contentType = response.headers.get('content-type') || '';
    const rawText = await response.text();

    // Check if ServiceNow developer instance is in hibernation
    if (
      rawText.includes('Instance Hibernating') ||
      rawText.includes('instance_hibernating') ||
      rawText.includes('wu=true') ||
      (contentType.includes('text/html') && rawText.includes('<title>'))
    ) {
      return {
        success: false,
        instanceUrl: config.instanceUrl,
        statusCode: response.status,
        latencyMs: latency,
        isHibernating: true,
        message:
          `⚠️ ServiceNow Instance is Hibernating: The instance at ${config.instanceUrl} is currently asleep. ` +
          `Please log into developer.servicenow.com and click "Wake Up Instance" to reactivate it.`,
      };
    }

    if (response.status === 401) {
      return {
        success: false,
        instanceUrl: config.instanceUrl,
        statusCode: 401,
        latencyMs: latency,
        message:
          `❌ Authentication Failed (HTTP 401): The instance ${config.instanceUrl} was reached, but the username or password was rejected. ` +
          `Please verify your ServiceNow admin username and password.`,
      };
    }

    if (response.status === 403) {
      return {
        success: false,
        instanceUrl: config.instanceUrl,
        statusCode: 403,
        latencyMs: latency,
        message:
          `❌ Access Denied (HTTP 403): The account on ${config.instanceUrl} lacks permission to read table "incident". ` +
          `Ensure the user has the "itil" or "sn_incident_read" role.`,
      };
    }

    if (!response.ok) {
      return {
        success: false,
        instanceUrl: config.instanceUrl,
        statusCode: response.status,
        latencyMs: latency,
        message: `ServiceNow returned error status ${response.status} (${response.statusText}): ${rawText.slice(0, 150)}`,
      };
    }

    // Parse JSON
    let count = 0;
    try {
      const data = JSON.parse(rawText);
      count = data?.result ? data.result.length : 0;
    } catch {
      // not JSON
    }

    return {
      success: true,
      instanceUrl: config.instanceUrl,
      statusCode: 200,
      latencyMs: latency,
      recordCount: count,
      message: `✅ Successfully authenticated & connected to live ServiceNow instance (${config.instanceUrl}). Latency: ${latency}ms. Accessible Incidents: ${count}.`,
    };
  } catch (err: any) {
    return {
      success: false,
      instanceUrl: overrides?.instanceUrl || '',
      latencyMs: Date.now() - startTime,
      message: `Failed to connect to ServiceNow: ${err.message || 'Unknown network error'}. Verify the instance URL is correct and online.`,
    };
  }
}

/**
 * PLUG & PLAY MASTER SYNCHRONIZATION:
 * Whenever ServiceNow settings are saved in Admin panel, this function propagates the changes
 * globally across all subsystems:
 *   1. Database SystemSetting table (used by API routes, AI Copilot, AI Analysis)
 *   2. In-Memory process.env (immediate runtime availability)
 *   3. .env.local and .env files on disk (for local scripts & restarts)
 *   4. mcp_config.json on disk (for Claude Desktop, Antigravity IDE, Cursor MCP clients)
 */
export async function syncServiceNowGlobally(config: {
  instanceUrl: string;
  username: string;
  password: string;
}): Promise<{
  instanceUrl: string;
  username: string;
  envFileUpdated: boolean;
  mcpConfigUpdated: boolean;
}> {
  const instanceUrl = (config.instanceUrl || '').trim().replace(/\/$/, '');
  const username = (config.username || '').trim();
  const password = (config.password || '').trim();

  if (!instanceUrl) {
    throw new Error('Instance URL cannot be empty');
  }

  // Invalidate any old session cache
  cachedSession = null;

  // 1. In-memory process.env update
  process.env.SERVICENOW_INSTANCE_URL = instanceUrl;
  if (username) process.env.SERVICENOW_USERNAME = username;
  if (password) process.env.SERVICENOW_PASSWORD = password;

  // 2. Persist in Database SystemSetting table
  // An empty password means "unchanged" (the admin UI only ever sees it masked), so keep the stored one.
  await prisma.$transaction([
    prisma.systemSetting.upsert({
      where: { key: 'SERVICENOW_INSTANCE_URL' },
      update: { value: instanceUrl },
      create: { key: 'SERVICENOW_INSTANCE_URL', value: instanceUrl },
    }),
    prisma.systemSetting.upsert({
      where: { key: 'SERVICENOW_USERNAME' },
      update: { value: username },
      create: { key: 'SERVICENOW_USERNAME', value: username },
    }),
    ...(password
      ? [
          prisma.systemSetting.upsert({
            where: { key: 'SERVICENOW_PASSWORD' },
            update: { value: password },
            create: { key: 'SERVICENOW_PASSWORD', value: password },
          }),
        ]
      : []),
  ]);

  // 3. Update .env.local and .env files on disk
  let envFileUpdated = false;
  try {
    const cwd = process.cwd();
    const envTargets = ['.env.local', '.env'];

    for (const rel of envTargets) {
      const fullPath = path.resolve(cwd, rel);
      if (fs.existsSync(fullPath)) {
        let content = fs.readFileSync(fullPath, 'utf8');

        // Replace or append SERVICENOW_INSTANCE_URL
        if (/^SERVICENOW_INSTANCE_URL=.*$/m.test(content)) {
          content = content.replace(/^SERVICENOW_INSTANCE_URL=.*$/m, `SERVICENOW_INSTANCE_URL="${instanceUrl}"`);
        } else {
          content += `\nSERVICENOW_INSTANCE_URL="${instanceUrl}"`;
        }

        // Replace or append SERVICENOW_USERNAME
        if (/^SERVICENOW_USERNAME=.*$/m.test(content)) {
          content = content.replace(/^SERVICENOW_USERNAME=.*$/m, `SERVICENOW_USERNAME="${username}"`);
        } else {
          content += `\nSERVICENOW_USERNAME="${username}"`;
        }

        // Replace or append SERVICENOW_PASSWORD
        if (!password) {
          // Unchanged: leave the existing line alone
        } else if (/^SERVICENOW_PASSWORD=.*$/m.test(content)) {
          content = content.replace(/^SERVICENOW_PASSWORD=.*$/m, `SERVICENOW_PASSWORD="${password}"`);
        } else {
          content += `\nSERVICENOW_PASSWORD="${password}"`;
        }

        fs.writeFileSync(fullPath, content, 'utf8');
        envFileUpdated = true;
      }
    }
  } catch (envErr) {
    console.warn('[ServiceNow Global Sync] Non-fatal error updating .env files:', envErr);
  }

  // 4. Update mcp_config.json on disk
  let mcpConfigUpdated = false;
  try {
    const cwd = process.cwd();
    const mcpPath = path.resolve(cwd, 'mcp_config.json');

    if (fs.existsSync(mcpPath)) {
      const raw = fs.readFileSync(mcpPath, 'utf8');
      const mcpJson = JSON.parse(raw);

      if (mcpJson && mcpJson.mcpServers && mcpJson.mcpServers.servicenow) {
        if (!mcpJson.mcpServers.servicenow.env) {
          mcpJson.mcpServers.servicenow.env = {};
        }
        mcpJson.mcpServers.servicenow.env.SERVICENOW_INSTANCE_URL = instanceUrl;
        mcpJson.mcpServers.servicenow.env.SERVICENOW_USERNAME = username;
        // mcp_config.json is committed to git, so never store the password there;
        // the MCP script reads it from .env.local or the database instead.
        delete mcpJson.mcpServers.servicenow.env.SERVICENOW_PASSWORD;

        fs.writeFileSync(mcpPath, JSON.stringify(mcpJson, null, 2), 'utf8');
        mcpConfigUpdated = true;
      }
    }
  } catch (mcpErr) {
    console.warn('[ServiceNow Global Sync] Non-fatal error updating mcp_config.json:', mcpErr);
  }

  return {
    instanceUrl,
    username,
    envFileUpdated,
    mcpConfigUpdated,
  };
}
