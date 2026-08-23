---
name: servicenow-mcp
description: >-
  Enterprise ServiceNow Model Context Protocol (MCP) tool integration for incident lookup,
  live ticketing, change correlation, and knowledge base lookups in the CIM Outage Centre.
---

# ServiceNow Model Context Protocol (MCP) Tools

This skill equips AI agents and Copilots with 8 specialized ServiceNow tools via MCP:

## Available Tools

### 1. `servicenow_get_incident`
- **Purpose**: Fetch full details for a single incident by Number (e.g. `INC0010001`, `INC0000060`) or `sys_id`.
- **Inputs**: `{ "incident_number": "INC0010001" }`
- **Output**: Formatted markdown summary and raw JSON with state, priority, assignment group, CI, caller, and resolution notes.

### 2. `servicenow_list_incidents`
- **Purpose**: Query active or historical incidents with flexible filtering.
- **Inputs**: `{ "limit": 10, "priority": "1", "state": "1", "assignment_group": "Network", "active": true }`
- **Output**: Formatted list of matching incidents.

### 3. `servicenow_create_incident`
- **Purpose**: Create a new incident directly in ServiceNow.
- **Inputs**: `{ "short_description": "Database cluster failover error", "description": "Node 2 unresponsive...", "priority": "1", "assignment_group": "Database Admin" }`

### 4. `servicenow_update_incident`
- **Purpose**: Append work notes, post customer comments, update state/priority, or resolve/close an incident.
- **Inputs**: `{ "incident_number": "INC0010001", "work_notes": "Engineers restarted the primary service.", "state": "2" }`

### 5. `servicenow_search_kb`
- **Purpose**: Search ServiceNow Knowledge Base articles for SOPs, playbooks, and troubleshooting procedures.
- **Inputs**: `{ "query": "database connection timeout", "limit": 5 }`

### 6. `servicenow_get_change_requests`
- **Purpose**: Inspect recent change requests (`change_request`) to correlate outages with recent deployments or patches.
- **Inputs**: `{ "limit": 10, "risk": "High" }`

### 7. `servicenow_fetch_table_records`
- **Purpose**: Generic table query tool for querying any ServiceNow table (`sys_user_group`, `cmdb_ci`, `problem`).
- **Inputs**: `{ "table_name": "sys_user_group", "query": "active=true" }`

### 8. `servicenow_test_connection`
- **Purpose**: Verify live ServiceNow connectivity and credentials.

## Execution via MCP Stdio
Run directly using:
```bash
node scripts/servicenow-mcp-server.js
```
Or interact via the HTTP/JSON-RPC API:
```bash
POST /api/mcp/servicenow
```
