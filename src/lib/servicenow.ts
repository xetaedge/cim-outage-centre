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

    const instanceUrl = (
      overrides?.instanceUrl ||
      urlSetting?.value ||
      process.env.SERVICENOW_INSTANCE_URL ||
      'https://dev403781.service-now.com'
    ).replace(/\/$/, '');

    const username = overrides?.username || userSetting?.value || process.env.SERVICENOW_USERNAME || 'admin';
    const password = overrides?.password || passSetting?.value || process.env.SERVICENOW_PASSWORD || 'VK0oo6l+YbZ=';

    const authHeader = 'Basic ' + Buffer.from(`${username}:${password}`).toString('base64');

    return {
      instanceUrl,
      username,
      password,
      authHeader,
    };
  } catch (err) {
    // Fallback if database query fails
    const instanceUrl = (overrides?.instanceUrl || process.env.SERVICENOW_INSTANCE_URL || 'https://dev403781.service-now.com').replace(/\/$/, '');
    const username = overrides?.username || process.env.SERVICENOW_USERNAME || 'admin';
    const password = overrides?.password || process.env.SERVICENOW_PASSWORD || 'VK0oo6l+YbZ=';
    const authHeader = 'Basic ' + Buffer.from(`${username}:${password}`).toString('base64');

    return {
      instanceUrl,
      username,
      password,
      authHeader,
    };
  }
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
