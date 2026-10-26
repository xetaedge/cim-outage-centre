import { prisma } from '@/lib/prisma';

export interface ServiceNowConfig {
  instanceUrl: string;
  username: string;
  password: string;
  authHeader: string;
}

/**
 * Centrally resolves ServiceNow credentials from SystemSetting table (as saved in Admin UI),
 * with fallbacks to environment variables and default developer instance.
 * This guarantees a true "plug n play" model across all endpoints.
 */
export async function getServiceNowConfig(overrides?: Partial<ServiceNowConfig>): Promise<ServiceNowConfig> {
  let stored: { url?: string; username?: string; password?: string } = {};
  try {
    const [urlSetting, userSetting, passSetting] = await Promise.all([
      prisma.systemSetting.findFirst({
        where: { key: { in: ['SERVICENOW_INSTANCE_URL', 'servicenow_url'] } },
      }),
      prisma.systemSetting.findFirst({
        where: { key: { in: ['SERVICENOW_USERNAME', 'servicenow_user'] } },
      }),
      prisma.systemSetting.findFirst({
        where: { key: { in: ['SERVICENOW_PASSWORD', 'servicenow_password'] } },
      }),
    ]);
    stored = { url: urlSetting?.value, username: userSetting?.value, password: passSetting?.value };
  } catch (err) {
    // Fall back to environment variables if the database query fails
  }

  const storedUrl = (stored.url || process.env.SERVICENOW_INSTANCE_URL || 'https://dev403781.service-now.com').replace(/\/$/, '');
  const instanceUrl = (overrides?.instanceUrl || storedUrl).replace(/\/$/, '');

  // Stored credentials are only ever sent to the stored instance; a different URL must bring its own.
  const useStored = instanceUrl === storedUrl;
  const username = overrides?.username || (useStored ? stored.username || process.env.SERVICENOW_USERNAME || 'admin' : '');
  const password = overrides?.password || (useStored ? stored.password || process.env.SERVICENOW_PASSWORD || '' : '');

  const authHeader = 'Basic ' + Buffer.from(`${username}:${password}`).toString('base64');

  return {
    instanceUrl,
    username,
    password,
    authHeader,
  };
}

/**
 * Universal helper to execute requests against the live ServiceNow REST API.
 */
export async function fetchServiceNowAPI(
  endpointPath: string,
  init?: RequestInit,
  overrides?: Partial<ServiceNowConfig>
): Promise<Response> {
  const { instanceUrl, authHeader } = await getServiceNowConfig(overrides);
  const fullUrl = endpointPath.startsWith('http') ? endpointPath : `${instanceUrl}${endpointPath.startsWith('/') ? '' : '/'}${endpointPath}`;

  return fetch(fullUrl, {
    ...init,
    headers: {
      Authorization: authHeader,
      Accept: 'application/json',
      ...(init?.headers || {}),
    },
    cache: 'no-store',
  });
}
