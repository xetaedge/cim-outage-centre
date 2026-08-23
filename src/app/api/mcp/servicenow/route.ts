import { NextResponse } from 'next/server';
import { getServiceNowConfig, fetchServiceNowAPI } from '@/lib/servicenow';

export const dynamic = 'force-dynamic';

const MCP_TOOLS = [
  {
    name: 'servicenow_get_incident',
    description: 'Look up full details of a specific ServiceNow incident by Incident Number (e.g. INC0010001, INC0000060) or sys_id.',
    inputSchema: {
      type: 'object',
      properties: {
        incident_number: {
          type: 'string',
          description: 'The incident record number (e.g. "INC0010001") or 32-character sys_id.',
        },
      },
      required: ['incident_number'],
    },
  },
  {
    name: 'servicenow_list_incidents',
    description: 'List and filter recent incidents from ServiceNow with flexible query parameters.',
    inputSchema: {
      type: 'object',
      properties: {
        limit: { type: 'number', description: 'Max records (default 10, max 50).', default: 10 },
        priority: { type: 'string', description: 'Priority: "1" (P1), "2" (P2), "3" (P3), "4" (P4).' },
        state: { type: 'string', description: 'State: "1" (New), "2" (In Progress), "3" (On Hold), "6" (Resolved), "7" (Closed).' },
        assignment_group: { type: 'string', description: 'Filter by Assignment Group name.' },
        active: { type: 'boolean', description: 'Active incidents (default true).', default: true },
        query: { type: 'string', description: 'Custom ServiceNow encoded query.' },
      },
    },
  },
  {
    name: 'servicenow_create_incident',
    description: 'Create a new Incident ticket directly in ServiceNow.',
    inputSchema: {
      type: 'object',
      properties: {
        short_description: { type: 'string', description: 'Concise summary of the incident.' },
        description: { type: 'string', description: 'Detailed description of the issue.' },
        urgency: { type: 'string', description: 'Urgency ("1", "2", "3").', default: '2' },
        impact: { type: 'string', description: 'Impact ("1", "2", "3").', default: '2' },
        priority: { type: 'string', description: 'Priority level ("1", "2", "3", "4").' },
        category: { type: 'string', description: 'Category (e.g. Network, Hardware, Software).' },
        subcategory: { type: 'string', description: 'Subcategory.' },
        assignment_group: { type: 'string', description: 'Assignment Group name or sys_id.' },
        cmdb_ci: { type: 'string', description: 'Configuration Item (CI).' },
        caller_id: { type: 'string', description: 'Caller name/email.' },
      },
      required: ['short_description'],
    },
  },
  {
    name: 'servicenow_update_incident',
    description: 'Update an existing ServiceNow Incident: append work notes, post comments, adjust state/priority, or resolve.',
    inputSchema: {
      type: 'object',
      properties: {
        incident_number: { type: 'string', description: 'Incident number or sys_id to update.' },
        work_notes: { type: 'string', description: 'Internal technical work notes to append.' },
        comments: { type: 'string', description: 'Customer-visible comments to post.' },
        state: { type: 'string', description: 'New state ("1", "2", "3", "6", "7").' },
        priority: { type: 'string', description: 'New priority level.' },
        assignment_group: { type: 'string', description: 'Reassign to a new group.' },
        close_notes: { type: 'string', description: 'Resolution / close notes.' },
        close_code: { type: 'string', description: 'Close code.' },
      },
      required: ['incident_number'],
    },
  },
  {
    name: 'servicenow_search_kb',
    description: 'Search ServiceNow Knowledge Base articles (kb_knowledge) for playbooks and SOPs.',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Search keywords.' },
        limit: { type: 'number', description: 'Max articles (default 5).', default: 5 },
        topic: { type: 'string', description: 'Topic/category filter.' },
      },
      required: ['query'],
    },
  },
  {
    name: 'servicenow_get_change_requests',
    description: 'Retrieve recent Change Requests (change_request) to correlate incidents with deployments.',
    inputSchema: {
      type: 'object',
      properties: {
        limit: { type: 'number', description: 'Max records (default 10).', default: 10 },
        state: { type: 'string', description: 'State filter.' },
        risk: { type: 'string', description: 'Risk filter ("High", "Moderate", "Low").' },
      },
    },
  },
  {
    name: 'servicenow_fetch_table_records',
    description: 'Generic query tool to fetch records from any ServiceNow table.',
    inputSchema: {
      type: 'object',
      properties: {
        table_name: { type: 'string', description: 'Table name (e.g. "sys_user_group", "cmdb_ci").' },
        query: { type: 'string', description: 'Encoded query string.' },
        limit: { type: 'number', description: 'Max records (default 10).', default: 10 },
        fields: { type: 'string', description: 'Comma-separated fields.' },
      },
      required: ['table_name'],
    },
  },
  {
    name: 'servicenow_test_connection',
    description: 'Test live connection to ServiceNow instance and verify REST API access & credentials.',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
];

async function handleToolExecution(name: string, args: any = {}) {
  const { instanceUrl } = await getServiceNowConfig();

  switch (name) {
    case 'servicenow_get_incident': {
      const incNum = String(args.incident_number || '').trim().toUpperCase();
      if (!incNum) throw new Error('incident_number parameter is required');

      const isSysId = /^[0-9a-f]{32}$/i.test(incNum);
      const queryParam = isSysId ? `sys_id=${incNum}` : `number=${incNum}`;
      const res = await fetchServiceNowAPI(`/api/now/table/incident?sysparm_query=${queryParam}&sysparm_display_value=true&sysparm_limit=1`);

      if (!res.ok) {
        return {
          content: [{ type: 'text', text: `❌ Failed to fetch incident ${incNum}: HTTP ${res.status}` }],
          isError: true,
        };
      }

      const json = await res.json();
      if (!json.result?.length) {
        return {
          content: [{ type: 'text', text: `❌ Incident "${incNum}" not found in ServiceNow instance (${instanceUrl}).` }],
          isError: true,
        };
      }

      const item = json.result[0];
      const markdown = [
        `### 🎫 ServiceNow Incident: ${item.number?.display_value || item.number || incNum}`,
        `- **Short Description**: ${item.short_description?.display_value || item.short_description || 'N/A'}`,
        `- **State**: ${item.state?.display_value || item.state || 'N/A'}`,
        `- **Priority**: ${item.priority?.display_value || item.priority || 'N/A'}`,
        `- **Assignment Group**: ${item.assignment_group?.display_value || item.assignment_group || 'Unassigned'}`,
        `- **Assigned To**: ${item.assigned_to?.display_value || item.assigned_to || 'Unassigned'}`,
        `- **Configuration Item**: ${item.cmdb_ci?.display_value || item.cmdb_ci || 'None'}`,
        `- **Opened At**: ${item.opened_at?.display_value || item.opened_at || 'N/A'}`,
        `\n**Description:**\n${item.description?.display_value || item.description || '(No description)'}`,
      ].join('\n');

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
      if (args.active !== undefined) queryParts.push(`active=${args.active ? 'true' : 'false'}`);
      else queryParts.push('active=true');
      if (args.priority) queryParts.push(`priority=${args.priority}`);
      if (args.state) queryParts.push(`state=${args.state}`);
      if (args.assignment_group) queryParts.push(`assignment_group.nameLIKE${encodeURIComponent(args.assignment_group)}`);
      if (args.query) queryParts.push(args.query);
      queryParts.push('ORDERBYDESCopened_at');

      const fullQuery = queryParts.join('^');
      const res = await fetchServiceNowAPI(`/api/now/table/incident?sysparm_query=${encodeURIComponent(fullQuery)}&sysparm_display_value=true&sysparm_limit=${limit}`);

      if (!res.ok) {
        return { content: [{ type: 'text', text: `❌ Failed to list incidents: HTTP ${res.status}` }], isError: true };
      }

      const json = await res.json();
      const results = json.result || [];
      const lines = [`### 📋 ServiceNow Incidents (${results.length} found)`];
      results.forEach((inc: any, idx: number) => {
        lines.push(`${idx + 1}. **${inc.number?.display_value || inc.number}** [${inc.priority?.display_value || inc.priority}] - ${inc.short_description?.display_value || inc.short_description} (${inc.state?.display_value || inc.state})`);
      });

      return {
        content: [
          { type: 'text', text: lines.join('\n') },
          { type: 'text', text: `\n\`\`\`json\n${JSON.stringify(results, null, 2)}\n\`\`\`` },
        ],
      };
    }

    case 'servicenow_create_incident': {
      if (!args.short_description) throw new Error('short_description is required');
      const res = await fetchServiceNowAPI('/api/now/table/incident?sysparm_display_value=true', {
        method: 'POST',
        body: JSON.stringify(args),
      });

      const json = await res.json();
      if (res.ok) {
        const item = json.result || {};
        return {
          content: [{
            type: 'text',
            text: `✅ **Created ServiceNow Incident: ${item.number?.display_value || item.number}**\n- sys_id: \`${item.sys_id?.display_value || item.sys_id}\`\n- Summary: ${item.short_description?.display_value || item.short_description}`,
          }],
        };
      } else {
        return { content: [{ type: 'text', text: `❌ Failed to create incident: ${JSON.stringify(json.error || json)}` }], isError: true };
      }
    }

    case 'servicenow_update_incident': {
      const incTarget = String(args.incident_number || '').trim();
      if (!incTarget) throw new Error('incident_number is required');

      let sysId = incTarget;
      if (!/^[0-9a-f]{32}$/i.test(incTarget)) {
        const lookup = await fetchServiceNowAPI(`/api/now/table/incident?sysparm_query=number=${incTarget}&sysparm_limit=1`);
        const lookupJson = await lookup.json();
        if (!lookupJson.result?.length) {
          return { content: [{ type: 'text', text: `❌ Incident "${incTarget}" not found.` }], isError: true };
        }
        sysId = lookupJson.result[0].sys_id;
      }

      const res = await fetchServiceNowAPI(`/api/now/table/incident/${sysId}?sysparm_display_value=true`, {
        method: 'PATCH',
        body: JSON.stringify(args),
      });

      const json = await res.json();
      if (res.ok) {
        return {
          content: [{ type: 'text', text: `✅ **Updated Incident ${args.incident_number} successfully.**` }],
        };
      } else {
        return { content: [{ type: 'text', text: `❌ Update failed: ${JSON.stringify(json.error || json)}` }], isError: true };
      }
    }

    case 'servicenow_search_kb': {
      const q = encodeURIComponent(args.query || '');
      const limit = Math.min(Math.max(Number(args.limit) || 5, 1), 20);
      const res = await fetchServiceNowAPI(`/api/now/table/kb_knowledge?sysparm_query=workflow_state=published^short_descriptionLIKE${q}^ORtextLIKE${q}&sysparm_limit=${limit}&sysparm_display_value=true`);

      if (!res.ok) {
        return { content: [{ type: 'text', text: `❌ KB search failed: HTTP ${res.status}` }], isError: true };
      }

      const json = await res.json();
      const articles = json.result || [];
      const lines = [`### 📚 ServiceNow Knowledge Base Results (${articles.length})`];
      articles.forEach((art: any, i: number) => {
        lines.push(`\n**${i + 1}. ${art.number?.display_value || art.number} — ${art.short_description?.display_value || art.short_description}**`);
      });

      return { content: [{ type: 'text', text: lines.join('\n') }] };
    }

    case 'servicenow_get_change_requests': {
      const limit = Math.min(Math.max(Number(args.limit) || 10, 1), 30);
      const res = await fetchServiceNowAPI(`/api/now/table/change_request?sysparm_query=ORDERBYDESCsys_created_on&sysparm_limit=${limit}&sysparm_display_value=true`);
      const json = await res.json();
      const changes = json.result || [];
      const lines = [`### 🔄 Recent ServiceNow Change Requests (${changes.length})`];
      changes.forEach((chg: any, i: number) => {
        lines.push(`${i + 1}. **${chg.number?.display_value || chg.number}** - ${chg.short_description?.display_value || chg.short_description} (Risk: ${chg.risk?.display_value || chg.risk}, State: ${chg.state?.display_value || chg.state})`);
      });

      return { content: [{ type: 'text', text: lines.join('\n') }] };
    }

    case 'servicenow_fetch_table_records': {
      if (!args.table_name) throw new Error('table_name is required');
      const limit = Math.min(Math.max(Number(args.limit) || 10, 1), 50);
      const queryParam = args.query ? `sysparm_query=${encodeURIComponent(args.query)}&` : '';
      const res = await fetchServiceNowAPI(`/api/now/table/${args.table_name}?${queryParam}sysparm_limit=${limit}&sysparm_display_value=true`);
      const json = await res.json();

      return {
        content: [{
          type: 'text',
          text: `### 📊 Table: \`${args.table_name}\` (${json.result?.length || 0} records)\n\`\`\`json\n${JSON.stringify(json.result || [], null, 2)}\n\`\`\``,
        }],
      };
    }

    case 'servicenow_test_connection': {
      const start = Date.now();
      const res = await fetchServiceNowAPI('/api/now/table/incident?sysparm_limit=1&sysparm_fields=sys_id,number');
      const latencyMs = Date.now() - start;

      if (res.ok) {
        return {
          content: [{
            type: 'text',
            text: `✅ **ServiceNow MCP Server Connected Successfully!**\n\n- **Instance URL**: \`${instanceUrl}\`\n- **Latency**: \`${latencyMs}ms\`\n- **Status**: Live & Ready for Incident, Change, and KB Automation`,
          }],
        };
      } else {
        return {
          content: [{
            type: 'text',
            text: `❌ **ServiceNow Connection Failed (HTTP ${res.status})**`,
          }],
          isError: true,
        };
      }
    }

    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}

export async function GET() {
  return NextResponse.json({
    name: 'servicenow-mcp-server',
    version: '1.0.0',
    protocolVersion: '2024-11-05',
    toolsCount: MCP_TOOLS.length,
    tools: MCP_TOOLS,
  });
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { id = 1, method, params } = body;

    if (method === 'initialize') {
      return NextResponse.json({
        jsonrpc: '2.0',
        id,
        result: {
          protocolVersion: '2024-11-05',
          capabilities: { tools: {} },
          serverInfo: { name: 'servicenow-mcp-server', version: '1.0.0' },
        },
      });
    }

    if (method === 'tools/list' || method === 'list_tools') {
      return NextResponse.json({
        jsonrpc: '2.0',
        id,
        result: { tools: MCP_TOOLS },
      });
    }

    if (method === 'tools/call' || method === 'call_tool') {
      const toolName = params?.name || body.name;
      const toolArgs = params?.arguments || body.arguments || {};

      const result = await handleToolExecution(toolName, toolArgs);
      return NextResponse.json({
        jsonrpc: '2.0',
        id,
        result,
      });
    }

    if (method === 'ping') {
      return NextResponse.json({ jsonrpc: '2.0', id, result: {} });
    }

    return NextResponse.json(
      { jsonrpc: '2.0', id, error: { code: -32601, message: `Method not found: ${method}` } },
      { status: 404 }
    );
  } catch (err: any) {
    return NextResponse.json(
      { jsonrpc: '2.0', error: { code: -32603, message: err.message || 'Internal error' } },
      { status: 500 }
    );
  }
}
