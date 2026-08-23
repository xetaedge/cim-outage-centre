#!/usr/bin/env node

/**
 * ServiceNow Model Context Protocol (MCP) Server
 * Standard JSON-RPC 2.0 Stdio Transport for Antigravity, Claude Desktop, Cursor, and MCP clients.
 * 
 * Exposes 8 enterprise ServiceNow tools:
 * 1. servicenow_get_incident
 * 2. servicenow_list_incidents
 * 3. servicenow_create_incident
 * 4. servicenow_update_incident
 * 5. servicenow_search_kb
 * 6. servicenow_get_change_requests
 * 7. servicenow_fetch_table_records
 * 8. servicenow_test_connection
 */

const readline = require('readline');
const https = require('https');
const http = require('http');
const { URL } = require('url');

// Server configuration from environment or defaults
const CONFIG = {
  instanceUrl: (process.env.SERVICENOW_INSTANCE_URL || 'https://dev403781.service-now.com').replace(/\/$/, ''),
  username: process.env.SERVICENOW_USERNAME || 'admin',
  password: process.env.SERVICENOW_PASSWORD || 'VK0oo6l+YbZ=',
};

/**
 * Universal ServiceNow REST API fetch helper
 */
function fetchServiceNow(endpointPath, options = {}) {
  return new Promise((resolve, reject) => {
    try {
      const fullUrlStr = endpointPath.startsWith('http')
        ? endpointPath
        : `${CONFIG.instanceUrl}${endpointPath.startsWith('/') ? '' : '/'}${endpointPath}`;

      const targetUrl = new URL(fullUrlStr);
      const isHttps = targetUrl.protocol === 'https:';
      const lib = isHttps ? https : http;

      const auth = Buffer.from(`${CONFIG.username}:${CONFIG.password}`).toString('base64');

      const headers = {
        'Authorization': `Basic ${auth}`,
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'User-Agent': 'ServiceNow-MCP-Server/1.0',
        ...(options.headers || {}),
      };

      const reqOptions = {
        hostname: targetUrl.hostname,
        port: targetUrl.port || (isHttps ? 443 : 80),
        path: targetUrl.pathname + targetUrl.search,
        method: options.method || 'GET',
        headers: headers,
        timeout: 15000,
      };

      const req = lib.request(reqOptions, (res) => {
        let body = '';
        res.setEncoding('utf8');
        res.on('data', (chunk) => { body += chunk; });
        res.on('end', () => {
          try {
            const parsed = body ? JSON.parse(body) : null;
            if (res.statusCode >= 200 && res.statusCode < 300) {
              resolve({ status: res.statusCode, data: parsed });
            } else {
              const errMsg = parsed?.error?.message || parsed?.error?.detail || body || `HTTP ${res.statusCode}`;
              resolve({
                status: res.statusCode,
                error: errMsg,
                data: parsed,
              });
            }
          } catch (e) {
            resolve({
              status: res.statusCode,
              error: `Invalid JSON response: ${body.slice(0, 200)}`,
              data: null,
            });
          }
        });
      });

      req.on('error', (err) => {
        reject(new Error(`ServiceNow request failed: ${err.message}`));
      });

      req.on('timeout', () => {
        req.destroy();
        reject(new Error('ServiceNow request timed out (15s)'));
      });

      if (options.body) {
        req.write(typeof options.body === 'string' ? options.body : JSON.stringify(options.body));
      }

      req.end();
    } catch (err) {
      reject(err);
    }
  });
}

/**
 * MCP Tools Schema Definition
 */
const TOOLS = [
  {
    name: 'servicenow_get_incident',
    description: 'Look up full details of a specific ServiceNow incident by Incident Number (e.g. INC0010001, INC0000060) or sys_id.',
    inputSchema: {
      type: 'object',
      properties: {
        incident_number: {
          type: 'string',
          description: 'The incident record number (e.g., "INC0010001", "INC0000060") or the 32-character sys_id.',
        },
      },
      required: ['incident_number'],
    },
  },
  {
    name: 'servicenow_list_incidents',
    description: 'List and filter recent incidents from ServiceNow with flexible query parameters (priority, state, assignment group, active status, limit).',
    inputSchema: {
      type: 'object',
      properties: {
        limit: {
          type: 'number',
          description: 'Maximum number of records to return (default 10, max 50).',
          default: 10,
        },
        priority: {
          type: 'string',
          description: 'Priority filter: "1" (Critical/P1), "2" (High/P2), "3" (Moderate/P3), "4" (Low/P4).',
        },
        state: {
          type: 'string',
          description: 'State filter: "1" (New), "2" (In Progress), "3" (On Hold), "6" (Resolved), "7" (Closed).',
        },
        assignment_group: {
          type: 'string',
          description: 'Filter by Assignment Group name (e.g. "Network", "Database", "Service Desk").',
        },
        active: {
          type: 'boolean',
          description: 'Filter for active incidents (true) or inactive/closed (false). Defaults to true.',
          default: true,
        },
        query: {
          type: 'string',
          description: 'Custom ServiceNow encoded query string (e.g. "priority=1^active=true^ORDERBYDESCopened_at").',
        },
      },
    },
  },
  {
    name: 'servicenow_create_incident',
    description: 'Create a new Incident ticket directly in ServiceNow with full operational context.',
    inputSchema: {
      type: 'object',
      properties: {
        short_description: {
          type: 'string',
          description: 'Concise summary of the incident (required).',
        },
        description: {
          type: 'string',
          description: 'Detailed description of the issue, affected services, and initial symptoms.',
        },
        urgency: {
          type: 'string',
          description: 'Urgency: "1" (High), "2" (Medium), "3" (Low).',
          default: '2',
        },
        impact: {
          type: 'string',
          description: 'Impact: "1" (High), "2" (Medium), "3" (Low).',
          default: '2',
        },
        priority: {
          type: 'string',
          description: 'Priority: "1" (P1 Critical), "2" (P2 High), "3" (P3 Moderate), "4" (P4 Low).',
        },
        category: {
          type: 'string',
          description: 'Incident category (e.g. "Network", "Hardware", "Software", "Inquiry / Help").',
        },
        subcategory: {
          type: 'string',
          description: 'Incident subcategory (e.g. "Wireless", "Email", "Database").',
        },
        assignment_group: {
          type: 'string',
          description: 'Assignment Group name or sys_id to route the incident to.',
        },
        cmdb_ci: {
          type: 'string',
          description: 'Configuration Item (CI) name or sys_id associated with the outage.',
        },
        caller_id: {
          type: 'string',
          description: 'Caller name, email, or sys_id.',
        },
      },
      required: ['short_description'],
    },
  },
  {
    name: 'servicenow_update_incident',
    description: 'Update an existing ServiceNow Incident: append work notes, post customer comments, adjust state/priority, or resolve ticket.',
    inputSchema: {
      type: 'object',
      properties: {
        incident_number: {
          type: 'string',
          description: 'Incident number (e.g. "INC0010001") or sys_id to update (required).',
        },
        work_notes: {
          type: 'string',
          description: 'Internal technical work notes to append to the activity stream.',
        },
        comments: {
          type: 'string',
          description: 'Customer-visible comments to post.',
        },
        state: {
          type: 'string',
          description: 'New state: "1" (New), "2" (In Progress), "3" (On Hold), "6" (Resolved), "7" (Closed).',
        },
        priority: {
          type: 'string',
          description: 'New priority level ("1", "2", "3", "4").',
        },
        assignment_group: {
          type: 'string',
          description: 'Reassign to a new assignment group name or sys_id.',
        },
        close_notes: {
          type: 'string',
          description: 'Resolution / close notes (required if state is set to "6" or "7").',
        },
        close_code: {
          type: 'string',
          description: 'Close code (e.g. "Solved (Permanently)", "Solved (Work Around)", "Not Solved").',
        },
      },
      required: ['incident_number'],
    },
  },
  {
    name: 'servicenow_search_kb',
    description: 'Search ServiceNow Knowledge Base (kb_knowledge) articles for SOPs, resolution playbooks, and troubleshooting guides.',
    inputSchema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'Search keywords or phrases (e.g., "vpn disconnection", "database high cpu", "gateway timeout").',
        },
        limit: {
          type: 'number',
          description: 'Max articles to retrieve (default 5).',
          default: 5,
        },
        topic: {
          type: 'string',
          description: 'Optional topic/category filter (e.g., "Network", "General").',
        },
      },
      required: ['query'],
    },
  },
  {
    name: 'servicenow_get_change_requests',
    description: 'Retrieve recent ServiceNow Change Requests (change_request) to correlate incidents with recent deployments, patch updates, or maintenance windows.',
    inputSchema: {
      type: 'object',
      properties: {
        limit: {
          type: 'number',
          description: 'Number of change requests to retrieve (default 10).',
          default: 10,
        },
        state: {
          type: 'string',
          description: 'Filter by state (e.g. "Implement", "Review", "Closed").',
        },
        risk: {
          type: 'string',
          description: 'Risk filter ("High", "Moderate", "Low").',
        },
      },
    },
  },
  {
    name: 'servicenow_fetch_table_records',
    description: 'Generic query tool to fetch records from any standard or custom ServiceNow table (e.g., sys_user_group, cmdb_ci, problem, sys_user).',
    inputSchema: {
      type: 'object',
      properties: {
        table_name: {
          type: 'string',
          description: 'ServiceNow table name (e.g. "sys_user_group", "cmdb_ci_server", "problem").',
        },
        query: {
          type: 'string',
          description: 'Encoded query string (e.g. "active=true^nameSTARTSWITHDatabase").',
        },
        limit: {
          type: 'number',
          description: 'Max records to return (default 10, max 50).',
          default: 10,
        },
        fields: {
          type: 'string',
          description: 'Comma-separated list of field names to retrieve (e.g. "sys_id,name,email").',
        },
      },
      required: ['table_name'],
    },
  },
  {
    name: 'servicenow_test_connection',
    description: 'Test the live connection to the configured ServiceNow instance and verify REST API access & credentials.',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
];

/**
 * Tool Execution Handlers
 */
async function executeTool(name, args = {}) {
  switch (name) {
    case 'servicenow_get_incident': {
      const incNum = String(args.incident_number || '').trim().toUpperCase();
      if (!incNum) throw new Error('incident_number parameter is required');

      const isSysId = /^[0-9a-f]{32}$/i.test(incNum);
      const queryParam = isSysId ? `sys_id=${incNum}` : `number=${incNum}`;
      const endpoint = `/api/now/table/incident?sysparm_query=${queryParam}&sysparm_display_value=true&sysparm_limit=1`;

      const res = await fetchServiceNow(endpoint);
      if (res.status !== 200 || !res.data?.result?.length) {
        return {
          content: [
            {
              type: 'text',
              text: `❌ Incident "${incNum}" not found in ServiceNow instance (${CONFIG.instanceUrl}).`,
            },
          ],
          isError: true,
        };
      }

      const item = res.data.result[0];
      const markdown = [
        `### 🎫 ServiceNow Incident: ${item.number?.display_value || item.number || incNum}`,
        `- **Short Description**: ${item.short_description?.display_value || item.short_description || 'N/A'}`,
        `- **State**: ${item.state?.display_value || item.state || 'N/A'}`,
        `- **Priority**: ${item.priority?.display_value || item.priority || 'N/A'} (Urgency: ${item.urgency?.display_value || item.urgency}, Impact: ${item.impact?.display_value || item.impact})`,
        `- **Assignment Group**: ${item.assignment_group?.display_value || item.assignment_group || 'Unassigned'}`,
        `- **Assigned To**: ${item.assigned_to?.display_value || item.assigned_to || 'Unassigned'}`,
        `- **Caller**: ${item.caller_id?.display_value || item.caller_id || 'N/A'}`,
        `- **Category**: ${item.category?.display_value || item.category || 'N/A'} / ${item.subcategory?.display_value || item.subcategory || 'N/A'}`,
        `- **Configuration Item (CI)**: ${item.cmdb_ci?.display_value || item.cmdb_ci || 'None'}`,
        `- **Opened At**: ${item.opened_at?.display_value || item.opened_at || 'N/A'}`,
        `- **Resolved / Closed At**: ${item.resolved_at?.display_value || item.closed_at?.display_value || 'Active'}`,
        `\n**Description:**\n${item.description?.display_value || item.description || '(No description provided)'}`,
        item.close_notes?.display_value || item.close_notes ? `\n**Resolution Notes:**\n${item.close_notes?.display_value || item.close_notes}` : '',
      ].filter(Boolean).join('\n');

      return {
        content: [
          { type: 'text', text: markdown },
          { type: 'text', text: `\n\`\`\`json\n${JSON.stringify(item, null, 2)}\n\`\`\`` },
        ],
      };
    }

    case 'servicenow_list_incidents': {
      const limit = Math.min(Math.max(Number(args.limit) || 10, 1), 50);
      const queryParts = [];

      if (args.active !== undefined) {
        queryParts.push(`active=${args.active ? 'true' : 'false'}`);
      } else {
        queryParts.push('active=true');
      }

      if (args.priority) queryParts.push(`priority=${args.priority}`);
      if (args.state) queryParts.push(`state=${args.state}`);
      if (args.assignment_group) queryParts.push(`assignment_group.nameLIKE${encodeURIComponent(args.assignment_group)}`);
      if (args.query) queryParts.push(args.query);

      queryParts.push('ORDERBYDESCopened_at');
      const fullQuery = queryParts.join('^');

      const endpoint = `/api/now/table/incident?sysparm_query=${encodeURIComponent(fullQuery)}&sysparm_display_value=true&sysparm_limit=${limit}`;
      const res = await fetchServiceNow(endpoint);

      if (res.status !== 200) {
        return {
          content: [{ type: 'text', text: `❌ Failed to list incidents: ${res.error}` }],
          isError: true,
        };
      }

      const results = res.data?.result || [];
      if (results.length === 0) {
        return {
          content: [{ type: 'text', text: `No incidents found matching query: \`${fullQuery}\`` }],
        };
      }

      const lines = [
        `### 📋 ServiceNow Incidents (${results.length} found)`,
        `*Instance: ${CONFIG.instanceUrl} | Query: ${fullQuery}*\n`,
      ];

      results.forEach((inc, idx) => {
        const num = inc.number?.display_value || inc.number;
        const title = inc.short_description?.display_value || inc.short_description;
        const prio = inc.priority?.display_value || inc.priority;
        const state = inc.state?.display_value || inc.state;
        const group = inc.assignment_group?.display_value || inc.assignment_group || 'Unassigned';
        lines.push(`${idx + 1}. **${num}** [${prio}] - ${title}`);
        lines.push(`   - *State*: **${state}** | *Group*: **${group}** | *Opened*: ${inc.opened_at?.display_value || inc.opened_at}`);
      });

      return {
        content: [
          { type: 'text', text: lines.join('\n') },
          { type: 'text', text: `\n\`\`\`json\n${JSON.stringify(results.map(r => ({
            number: r.number?.display_value || r.number,
            short_description: r.short_description?.display_value || r.short_description,
            priority: r.priority?.display_value || r.priority,
            state: r.state?.display_value || r.state,
            assignment_group: r.assignment_group?.display_value || r.assignment_group,
            opened_at: r.opened_at?.display_value || r.opened_at,
          })), null, 2)}\n\`\`\`` },
        ],
      };
    }

    case 'servicenow_create_incident': {
      if (!args.short_description) throw new Error('short_description is required');

      const payload = {
        short_description: args.short_description,
        description: args.description || args.short_description,
        urgency: args.urgency || '2',
        impact: args.impact || '2',
        ...(args.priority ? { priority: args.priority } : {}),
        ...(args.category ? { category: args.category } : {}),
        ...(args.subcategory ? { subcategory: args.subcategory } : {}),
        ...(args.assignment_group ? { assignment_group: args.assignment_group } : {}),
        ...(args.cmdb_ci ? { cmdb_ci: args.cmdb_ci } : {}),
        ...(args.caller_id ? { caller_id: args.caller_id } : {}),
      };

      const endpoint = `/api/now/table/incident?sysparm_display_value=true`;
      const res = await fetchServiceNow(endpoint, {
        method: 'POST',
        body: payload,
      });

      if (res.status >= 200 && res.status < 300) {
        const item = res.data?.result || {};
        const num = item.number?.display_value || item.number;
        const sysId = item.sys_id?.display_value || item.sys_id;

        return {
          content: [
            {
              type: 'text',
              text: `✅ **Successfully Created ServiceNow Incident: ${num}**\n\n- **sys_id**: \`${sysId}\`\n- **Short Description**: ${item.short_description?.display_value || item.short_description}\n- **Priority**: ${item.priority?.display_value || item.priority}\n- **State**: ${item.state?.display_value || item.state}\n- **Assignment Group**: ${item.assignment_group?.display_value || item.assignment_group || 'None'}`,
            },
          ],
        };
      } else {
        return {
          content: [{ type: 'text', text: `❌ Failed to create incident: ${res.error}` }],
          isError: true,
        };
      }
    }

    case 'servicenow_update_incident': {
      const incTarget = String(args.incident_number || '').trim();
      if (!incTarget) throw new Error('incident_number is required');

      let sysId = incTarget;
      if (!/^[0-9a-f]{32}$/i.test(incTarget)) {
        const lookup = await fetchServiceNow(`/api/now/table/incident?sysparm_query=number=${incTarget}&sysparm_limit=1`);
        if (!lookup.data?.result?.length) {
          return {
            content: [{ type: 'text', text: `❌ Could not find incident "${incTarget}" to update.` }],
            isError: true,
          };
        }
        sysId = lookup.data.result[0].sys_id;
      }

      const updatePayload = {};
      if (args.work_notes) updatePayload.work_notes = args.work_notes;
      if (args.comments) updatePayload.comments = args.comments;
      if (args.state) updatePayload.state = args.state;
      if (args.priority) updatePayload.priority = args.priority;
      if (args.assignment_group) updatePayload.assignment_group = args.assignment_group;
      if (args.close_notes) updatePayload.close_notes = args.close_notes;
      if (args.close_code) updatePayload.close_code = args.close_code;

      const endpoint = `/api/now/table/incident/${sysId}?sysparm_display_value=true`;
      const res = await fetchServiceNow(endpoint, {
        method: 'PATCH',
        body: updatePayload,
      });

      if (res.status >= 200 && res.status < 300) {
        const item = res.data?.result || {};
        return {
          content: [
            {
              type: 'text',
              text: `✅ **Successfully Updated Incident: ${item.number?.display_value || incTarget}**\n\n- **State**: ${item.state?.display_value || item.state}\n- **Updated By**: ${item.sys_updated_by?.display_value || item.sys_updated_by}\n- **Work Notes / Comments Appended**: ${args.work_notes || args.comments ? 'Yes' : 'No'}`,
            },
          ],
        };
      } else {
        return {
          content: [{ type: 'text', text: `❌ Failed to update incident: ${res.error}` }],
          isError: true,
        };
      }
    }

    case 'servicenow_search_kb': {
      const q = encodeURIComponent(args.query || '');
      const limit = Math.min(Math.max(Number(args.limit) || 5, 1), 20);
      let queryStr = `workflow_state=published^short_descriptionLIKE${q}^ORtextLIKE${q}`;
      if (args.topic) queryStr += `^topic=${encodeURIComponent(args.topic)}`;

      const endpoint = `/api/now/table/kb_knowledge?sysparm_query=${queryStr}&sysparm_limit=${limit}&sysparm_display_value=true`;
      const res = await fetchServiceNow(endpoint);

      if (res.status !== 200) {
        return {
          content: [{ type: 'text', text: `❌ KB search failed: ${res.error}` }],
          isError: true,
        };
      }

      const articles = res.data?.result || [];
      if (articles.length === 0) {
        return {
          content: [{ type: 'text', text: `No knowledge articles found matching "${args.query}".` }],
        };
      }

      const lines = [`### 📚 ServiceNow Knowledge Base Results (${articles.length})`];
      articles.forEach((art, i) => {
        const num = art.number?.display_value || art.number;
        const title = art.short_description?.display_value || art.short_description;
        const topic = art.topic?.display_value || art.topic || 'General';
        lines.push(`\n**${i + 1}. ${num} — ${title}** (Topic: ${topic})`);
        const textSnippet = (art.text?.display_value || art.text || '').replace(/<[^>]+>/g, '').slice(0, 300);
        if (textSnippet) lines.push(`> ${textSnippet}...`);
      });

      return { content: [{ type: 'text', text: lines.join('\n') }] };
    }

    case 'servicenow_get_change_requests': {
      const limit = Math.min(Math.max(Number(args.limit) || 10, 1), 30);
      const queryParts = ['ORDERBYDESCsys_created_on'];
      if (args.state) queryParts.unshift(`state=${encodeURIComponent(args.state)}`);
      if (args.risk) queryParts.unshift(`risk=${encodeURIComponent(args.risk)}`);

      const endpoint = `/api/now/table/change_request?sysparm_query=${encodeURIComponent(queryParts.join('^'))}&sysparm_limit=${limit}&sysparm_display_value=true`;
      const res = await fetchServiceNow(endpoint);

      if (res.status !== 200) {
        return {
          content: [{ type: 'text', text: `❌ Failed to fetch Change Requests: ${res.error}` }],
          isError: true,
        };
      }

      const changes = res.data?.result || [];
      if (changes.length === 0) {
        return {
          content: [{ type: 'text', text: 'No recent change requests found.' }],
        };
      }

      const lines = [`### 🔄 Recent ServiceNow Change Requests (${changes.length})`];
      changes.forEach((chg, i) => {
        lines.push(`${i + 1}. **${chg.number?.display_value || chg.number}** - ${chg.short_description?.display_value || chg.short_description}`);
        lines.push(`   - *Type*: ${chg.type?.display_value || chg.type} | *Risk*: **${chg.risk?.display_value || chg.risk}** | *State*: **${chg.state?.display_value || chg.state}**`);
      });

      return { content: [{ type: 'text', text: lines.join('\n') }] };
    }

    case 'servicenow_fetch_table_records': {
      if (!args.table_name) throw new Error('table_name is required');
      const limit = Math.min(Math.max(Number(args.limit) || 10, 1), 50);
      let queryParam = args.query ? `sysparm_query=${encodeURIComponent(args.query)}&` : '';
      let fieldsParam = args.fields ? `sysparm_fields=${encodeURIComponent(args.fields)}&` : '';

      const endpoint = `/api/now/table/${args.table_name}?${queryParam}${fieldsParam}sysparm_limit=${limit}&sysparm_display_value=true`;
      const res = await fetchServiceNow(endpoint);

      if (res.status !== 200) {
        return {
          content: [{ type: 'text', text: `❌ Table query on "${args.table_name}" failed: ${res.error}` }],
          isError: true,
        };
      }

      return {
        content: [
          {
            type: 'text',
            text: `### 📊 Table: \`${args.table_name}\` (${res.data?.result?.length || 0} records)\n\`\`\`json\n${JSON.stringify(res.data?.result || [], null, 2)}\n\`\`\``,
          },
        ],
      };
    }

    case 'servicenow_test_connection': {
      const startTime = Date.now();
      const endpoint = `/api/now/table/incident?sysparm_limit=1&sysparm_fields=sys_id,number`;
      const res = await fetchServiceNow(endpoint);
      const latencyMs = Date.now() - startTime;

      if (res.status >= 200 && res.status < 300) {
        return {
          content: [
            {
              type: 'text',
              text: `✅ **ServiceNow MCP Server Connected Successfully!**\n\n- **Instance URL**: \`${CONFIG.instanceUrl}\`\n- **Authenticated User**: \`${CONFIG.username}\`\n- **Latency**: \`${latencyMs}ms\`\n- **Status**: Live & Ready for Incident, Change, and KB Automation`,
            },
          ],
        };
      } else {
        return {
          content: [
            {
              type: 'text',
              text: `❌ **ServiceNow Connection Failed**\n\n- **Instance URL**: \`${CONFIG.instanceUrl}\`\n- **Status Code**: \`${res.status}\`\n- **Error**: ${res.error}`,
            },
          ],
          isError: true,
        };
      }
    }

    default:
      throw new Error(`Unknown tool name: ${name}`);
  }
}

/**
 * Standard JSON-RPC 2.0 Server Loop (stdio transport)
 */
function startServer() {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    terminal: false,
  });

  rl.on('line', async (line) => {
    if (!line.trim()) return;

    let request;
    try {
      request = JSON.parse(line);
    } catch (e) {
      console.error('Invalid JSON-RPC line:', line);
      return;
    }

    const { id, method, params } = request;

    try {
      if (method === 'initialize') {
        const response = {
          jsonrpc: '2.0',
          id,
          result: {
            protocolVersion: '2024-11-05',
            capabilities: {
              tools: {},
            },
            serverInfo: {
              name: 'servicenow-mcp-server',
              version: '1.0.0',
            },
          },
        };
        process.stdout.write(JSON.stringify(response) + '\n');
      } else if (method === 'notifications/initialized') {
        // No response needed
      } else if (method === 'tools/list') {
        const response = {
          jsonrpc: '2.0',
          id,
          result: {
            tools: TOOLS,
          },
        };
        process.stdout.write(JSON.stringify(response) + '\n');
      } else if (method === 'tools/call') {
        const toolName = params?.name;
        const toolArgs = params?.arguments || {};

        const result = await executeTool(toolName, toolArgs);
        const response = {
          jsonrpc: '2.0',
          id,
          result,
        };
        process.stdout.write(JSON.stringify(response) + '\n');
      } else if (method === 'ping') {
        process.stdout.write(JSON.stringify({ jsonrpc: '2.0', id, result: {} }) + '\n');
      } else {
        const response = {
          jsonrpc: '2.0',
          id,
          error: {
            code: -32601,
            message: `Method not found: ${method}`,
          },
        };
        process.stdout.write(JSON.stringify(response) + '\n');
      }
    } catch (err) {
      const response = {
        jsonrpc: '2.0',
        id,
        error: {
          code: -32603,
          message: err.message || 'Internal error executing MCP command',
        },
      };
      process.stdout.write(JSON.stringify(response) + '\n');
    }
  });

  process.on('SIGINT', () => process.exit(0));
  process.on('SIGTERM', () => process.exit(0));
}

if (require.main === module) {
  startServer();
}

module.exports = {
  TOOLS,
  executeTool,
  fetchServiceNow,
  CONFIG,
};
