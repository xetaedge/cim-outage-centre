#!/usr/bin/env python3
"""
Generate a professional, executive-ready Word Document (.docx) detailing
all deployment prerequisites, infrastructure, APIs, AI models, environment
variables, and cost estimates for the CIM Outage Centre.
"""

import os
import zipfile
import io
import xml.sax.saxutils as saxutils

def escape(s):
    if s is None:
        return ""
    return saxutils.escape(str(s))

class DocxBuilder:
    def __init__(self):
        self.body_elements = []

    def add_p(self, text, style="Normal", bold=False, italic=False, color=None, size_pt=None, space_before=100, space_after=100, align="left"):
        pPr = f'<w:pPr><w:pStyle w:val="{style}"/><w:jc w:val="{align}"/><w:spacing w:before="{space_before}" w:after="{space_after}"/></w:pPr>'
        rPr_items = []
        if bold:
            rPr_items.append('<w:b/>')
        if italic:
            rPr_items.append('<w:i/>')
        if color:
            rPr_items.append(f'<w:color w:val="{color}"/>')
        if size_pt:
            rPr_items.append(f'<w:sz w:val="{int(size_pt * 2)}"/>')
        rPr = f'<w:rPr>{"".join(rPr_items)}</w:rPr>' if rPr_items else ''
        p_xml = f'<w:p>{pPr}<w:r>{rPr}<w:t xml:space="preserve">{escape(text)}</w:t></w:r></w:p>'
        self.body_elements.append(p_xml)

    def add_runs_p(self, runs, style="Normal", space_before=80, space_after=80, align="left"):
        pPr = f'<w:pPr><w:pStyle w:val="{style}"/><w:jc w:val="{align}"/><w:spacing w:before="{space_before}" w:after="{space_after}"/></w:pPr>'
        r_xmls = []
        for r in runs:
            text = r.get("text", "")
            bold = r.get("bold", False)
            italic = r.get("italic", False)
            color = r.get("color", None)
            size_pt = r.get("size_pt", None)
            font = r.get("font", None)
            
            rPr_items = []
            if bold:
                rPr_items.append('<w:b/>')
            if italic:
                rPr_items.append('<w:i/>')
            if color:
                rPr_items.append(f'<w:color w:val="{color}"/>')
            if size_pt:
                rPr_items.append(f'<w:sz w:val="{int(size_pt * 2)}"/>')
            if font:
                rPr_items.append(f'<w:rFonts w:ascii="{font}" w:hAnsi="{font}"/>')
            rPr = f'<w:rPr>{"".join(rPr_items)}</w:rPr>' if rPr_items else ''
            r_xmls.append(f'<w:r>{rPr}<w:t xml:space="preserve">{escape(text)}</w:t></w:r>')
        
        p_xml = f'<w:p>{pPr}{"".join(r_xmls)}</w:p>'
        self.body_elements.append(p_xml)

    def add_heading_1(self, text):
        self.add_p(text, style="Heading1", bold=True, color="0f172a", size_pt=18, space_before=360, space_after=120)

    def add_heading_2(self, text):
        self.add_p(text, style="Heading2", bold=True, color="0284c7", size_pt=14, space_before=240, space_after=80)

    def add_heading_3(self, text):
        self.add_p(text, style="Heading3", bold=True, color="1e293b", size_pt=12, space_before=160, space_after=60)

    def add_bullet(self, bold_prefix, text):
        runs = [
            {"text": "•  ", "bold": True, "color": "0284c7"},
            {"text": bold_prefix + " ", "bold": True, "color": "1e293b"},
            {"text": text, "color": "334155"}
        ]
        self.add_runs_p(runs, space_before=40, space_after=40)

    def add_callout(self, title, text, box_type="info"):
        border_color = "0284c7" if box_type == "info" else ("f59e0b" if box_type == "warning" else "10b981")
        bg_color = "f0f9ff" if box_type == "info" else ("fffbeb" if box_type == "warning" else "f0fdf4")
        icon = "ℹ️ " if box_type == "info" else ("⚠️ " if box_type == "warning" else "✅ ")
        
        tbl_xml = f'''<w:tbl>
  <w:tblPr>
    <w:tblW w:w="9600" w:type="dxa"/>
    <w:tblBorders>
      <w:top w:val="none"/>
      <w:left w:val="single" w:sz="36" w:space="0" w:color="{border_color}"/>
      <w:bottom w:val="none"/>
      <w:right w:val="none"/>
    </w:tblBorders>
    <w:tblCellMar>
      <w:top w:w="140" w:type="dxa"/>
      <w:left w:w="220" w:type="dxa"/>
      <w:bottom w:w="140" w:type="dxa"/>
      <w:right w:w="200" w:type="dxa"/>
    </w:tblCellMar>
  </w:tblPr>
  <w:tr>
    <w:tc>
      <w:tcPr>
        <w:tcW w:w="9600" w:type="dxa"/>
        <w:shd w:val="clear" w:color="auto" w:fill="{bg_color}"/>
      </w:tcPr>
      <w:p>
        <w:pPr><w:spacing w:before="60" w:after="40"/></w:pPr>
        <w:r><w:rPr><w:b/><w:color w:val="{border_color}"/><w:sz w:val="22"/></w:rPr><w:t xml:space="preserve">{icon}{escape(title)}</w:t></w:r>
      </w:p>
      <w:p>
        <w:pPr><w:spacing w:before="40" w:after="60"/></w:pPr>
        <w:r><w:rPr><w:color w:val="334155"/><w:sz w:val="21"/></w:rPr><w:t xml:space="preserve">{escape(text)}</w:t></w:r>
      </w:p>
    </w:tc>
  </w:tr>
</w:tbl>'''
        self.body_elements.append(tbl_xml)
        self.add_p("", space_before=60, space_after=60)

    def add_table(self, headers, rows, col_widths=None):
        total_width = 9600
        if not col_widths:
            col_widths = [int(total_width / len(headers))] * len(headers)
        
        tr_elements = []
        # Header Row
        tc_headers = []
        for i, h in enumerate(headers):
            w = col_widths[i]
            tc = f'''<w:tc>
  <w:tcPr>
    <w:tcW w:w="{w}" w:type="dxa"/>
    <w:shd w:val="clear" w:color="auto" w:fill="1e293b"/>
  </w:tcPr>
  <w:p>
    <w:pPr><w:spacing w:before="120" w:after="120"/><w:jc w:val="left"/></w:pPr>
    <w:r><w:rPr><w:b/><w:color w:val="ffffff"/><w:sz w:val="20"/></w:rPr><w:t xml:space="preserve">{escape(h)}</w:t></w:r>
  </w:p>
</w:tc>'''
            tc_headers.append(tc)
        
        tr_headers = f'<w:tr><w:trPr><w:tblHeader/></w:trPr>{"".join(tc_headers)}</w:tr>'
        tr_elements.append(tr_headers)

        # Body Rows
        for row_idx, row in enumerate(rows):
            bg = "f8fafc" if row_idx % 2 == 1 else "ffffff"
            tc_rows = []
            for col_idx, cell in enumerate(row):
                w = col_widths[col_idx]
                is_code = cell.startswith("`") and cell.endswith("`")
                clean_text = cell.strip("`") if is_code else cell
                font_tag = '<w:rFonts w:ascii="Consolas" w:hAnsi="Consolas"/>' if is_code else ''
                sz_tag = '<w:sz w:val="19"/>' if is_code else '<w:sz w:val="20"/>'
                color_tag = '<w:color w:val="0369a1"/>' if is_code else '<w:color w:val="334155"/>'
                
                tc = f'''<w:tc>
  <w:tcPr>
    <w:tcW w:w="{w}" w:type="dxa"/>
    <w:shd w:val="clear" w:color="auto" w:fill="{bg}"/>
  </w:tcPr>
  <w:p>
    <w:pPr><w:spacing w:before="90" w:after="90"/><w:jc w:val="left"/></w:pPr>
    <w:r><w:rPr>{font_tag}{sz_tag}{color_tag}</w:rPr><w:t xml:space="preserve">{escape(clean_text)}</w:t></w:r>
  </w:p>
</w:tc>'''
                tc_rows.append(tc)
            tr_elements.append(f'<w:tr>{"".join(tc_rows)}</w:tr>')

        tbl_xml = f'''<w:tbl>
  <w:tblPr>
    <w:tblW w:w="{total_width}" w:type="dxa"/>
    <w:tblBorders>
      <w:top w:val="single" w:sz="6" w:space="0" w:color="cbd5e1"/>
      <w:left w:val="none"/>
      <w:bottom w:val="single" w:sz="12" w:space="0" w:color="94a3b8"/>
      <w:right w:val="none"/>
      <w:insideH w:val="single" w:sz="4" w:space="0" w:color="e2e8f0"/>
      <w:insideV w:val="none"/>
    </w:tblBorders>
    <w:tblCellMar>
      <w:top w:w="100" w:type="dxa"/>
      <w:left w:w="140" w:type="dxa"/>
      <w:bottom w:w="100" w:type="dxa"/>
      <w:right w:w="140" w:type="dxa"/>
    </w:tblCellMar>
  </w:tblPr>
  {"".join(tr_elements)}
</w:tbl>'''
        self.body_elements.append(tbl_xml)
        self.add_p("", space_before=80, space_after=80)

    def render_docx_bytes(self):
        content_types = '''<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
  <Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>
</Types>'''

        rels = '''<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>'''

        doc_rels = '''<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>'''

        styles_xml = '''<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:docDefaults>
    <w:rPrDefault>
      <w:rPr>
        <w:rFonts w:ascii="Calibri" w:hAnsi="Calibri" w:cs="Calibri"/>
        <w:sz w:val="22"/>
        <w:color w:val="334155"/>
      </w:rPr>
    </w:rPrDefault>
    <w:pPrDefault>
      <w:pPr>
        <w:spacing w:before="80" w:after="80" w:line="276" w:lineRule="auto"/>
      </w:pPr>
    </w:pPrDefault>
  </w:docDefaults>
  
  <w:style w:type="paragraph" w:default="1" w:styleId="Normal">
    <w:name w:val="Normal"/>
  </w:style>

  <w:style w:type="paragraph" w:styleId="Heading1">
    <w:name w:val="heading 1"/>
    <w:rPr>
      <w:rFonts w:ascii="Calibri" w:hAnsi="Calibri"/>
      <w:b/>
      <w:color w:val="0f172a"/>
      <w:sz w:val="36"/>
    </w:rPr>
  </w:style>

  <w:style w:type="paragraph" w:styleId="Heading2">
    <w:name w:val="heading 2"/>
    <w:rPr>
      <w:rFonts w:ascii="Calibri" w:hAnsi="Calibri"/>
      <w:b/>
      <w:color w:val="0284c7"/>
      <w:sz w:val="28"/>
    </w:rPr>
  </w:style>

  <w:style w:type="paragraph" w:styleId="Heading3">
    <w:name w:val="heading 3"/>
    <w:rPr>
      <w:rFonts w:ascii="Calibri" w:hAnsi="Calibri"/>
      <w:b/>
      <w:color w:val="1e293b"/>
      <w:sz w:val="24"/>
    </w:rPr>
  </w:style>
</w:styles>'''

        body_xml = "".join(self.body_elements)
        doc_xml = f'''<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"
            xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <w:body>
    {body_xml}
    <w:sectPr>
      <w:pgSz w:w="12240" w:h="15840"/>
      <w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440" w:header="720" w:footer="720" w:gutter="0"/>
    </w:sectPr>
  </w:body>
</w:document>'''

        buf = io.BytesIO()
        with zipfile.ZipFile(buf, 'w', zipfile.ZIP_DEFLATED) as z:
            z.writestr('[Content_Types].xml', content_types)
            z.writestr('_rels/.rels', rels)
            z.writestr('word/_rels/document.xml.rels', doc_rels)
            z.writestr('word/document.xml', doc_xml)
            z.writestr('word/styles.xml', styles_xml)
        return buf.getvalue()

def build_deployment_prerequisites_doc():
    doc = DocxBuilder()

    # Document Header / Title
    doc.add_p("CIM OUTAGE CENTRE", style="Normal", bold=True, color="0284c7", size_pt=12, space_before=100, space_after=40)
    doc.add_p("Production Deployment Prerequisites & Technical Specifications", style="Heading1", bold=True, color="0f172a", size_pt=26, space_before=40, space_after=100)
    doc.add_p("Comprehensive guide covering hosting infrastructure, database sizing, enterprise APIs, AI models, environment configuration, and detailed cost estimates for deploying in any cloud, on-premises, or hybrid environment.", style="Normal", italic=True, color="475569", size_pt=12, space_before=0, space_after=200)

    # Document Metadata Table
    metadata_headers = ["Document Version", "Target Release", "Prepared For", "Classification", "Date"]
    metadata_rows = [
        ["1.0.0", "CIM Outage Centre Enterprise v1.4", "Architecture & Operations Teams", "Enterprise Confidential", "September 2026"]
    ]
    doc.add_table(metadata_headers, metadata_rows, [1800, 2400, 2200, 1800, 1400])

    # Section 1: Executive Overview
    doc.add_heading_1("1. Executive Overview & System Purpose")
    doc.add_p("The Critical Incident Management (CIM) Outage Centre is an enterprise-grade incident coordination, live triage, and stakeholder communication platform. It bridges ServiceNow ITSM, Microsoft 365 / Teams, Neon PostgreSQL, and Google Gemini AI into a unified operational command center for Major Incident Managers (MIM), SREs, and Field Engineers.")
    doc.add_p("This document outlines all technical, infrastructure, licensing, security, and financial prerequisites required to successfully deploy and operate the CIM Outage Centre in any enterprise environment.")

    doc.add_callout("Key Architectural Principles", 
                    "The application is stateless and container-ready. Core business state resides in PostgreSQL, while live incident sync, change correlation, and user authentication connect in real-time to external SaaS ecosystems (ServiceNow, Microsoft Entra ID, Google Gemini).",
                    "info")

    # Section 2: Hosting & Compute Infrastructure
    doc.add_heading_1("2. Hosting & Compute Infrastructure Prerequisites")
    doc.add_p("The CIM Outage Centre is built using Next.js 14 (App Router) and Node.js. It supports multiple deployment topologies depending on corporate infrastructure standards:")

    infra_headers = ["Deployment Model", "Recommended Platform", "Minimal Hardware / Specs", "Production Hardware / Specs"]
    infra_rows = [
        ["Cloud Serverless / PaaS", "Vercel / AWS Amplify / Cloudflare", "Serverless Functions (1 GB RAM)", "Vercel Pro (1024 MB Memory, 60s timeout)"],
        ["Container / Kubernetes", "Docker / AWS ECS / EKS / Azure AKS", "1 Container (1 vCPU, 2 GB RAM)", "2+ Containers (2 vCPU, 4 GB RAM each, HPA)"],
        ["Virtual Machine (Linux)", "Ubuntu 22.04 LTS / RHEL 8 or 9", "2 vCPU, 4 GB RAM, 20 GB SSD", "4 vCPU, 8 GB RAM, 50 GB NVMe SSD + PM2 + Nginx"],
        ["Hybrid On-Premises", "Enterprise VMware / OpenShift", "2 vCPU, 4 GB RAM", "High Availability Cluster + F5 / Traefik Ingress"]
    ]
    doc.add_table(infra_headers, infra_rows, [2200, 2400, 2500, 2500])

    doc.add_heading_2("2.1. Software Runtimes & Tooling")
    doc.add_bullet("Node.js Runtime:", "Version 18.18+ or 20.x LTS (Recommended: Node 20.x LTS for optimal memory efficiency and V8 garbage collection).")
    doc.add_bullet("Package Manager:", "npm v9+ (or pnpm v8+).")
    doc.add_bullet("Process Supervisor:", "PM2 or Docker/Systemd when deploying to standalone virtual machines.")
    doc.add_bullet("Reverse Proxy:", "Nginx, Cloudflare, AWS ALB, or Azure Application Gateway terminating TLS 1.3.")

    doc.add_heading_2("2.2. Network & Firewall Rules")
    doc.add_bullet("Inbound Traffic:", "Port 443 (HTTPS) for client web browsers and webhook ingest.")
    doc.add_bullet("Outbound Port 443:", "Must permit outbound HTTPS traffic to:")
    doc.add_p("   • ServiceNow Instance: https://<your-instance>.service-now.com\n   • Microsoft Graph API: https://graph.microsoft.com and https://login.microsoftonline.com\n   • Google Gemini AI: https://generativelanguage.googleapis.com\n   • Neon / PostgreSQL: TCP Port 5432 (or port 6543 for pooled connections with SSL).")

    # Section 3: Database & Persistence Layer
    doc.add_heading_1("3. Database & Persistence Layer (PostgreSQL + Prisma)")
    doc.add_p("All persistent records—including incidents, timeline updates, closure issue tags, site topologies, support directories, and audit logs—are managed via Prisma ORM on PostgreSQL.")

    db_headers = ["Component", "Requirement", "Production Recommendation"]
    db_rows = [
        ["Database Engine", "PostgreSQL 14, 15, or 16", "PostgreSQL 15 or 16 with SSL enabled (`sslmode=require`)"],
        ["Managed Cloud Provider", "Neon, AWS RDS, Azure Postgres, GCP Cloud SQL", "Neon Serverless Postgres or AWS Aurora Serverless v2"],
        ["Connection Pooling", "Recommended for serverless & high concurrency", "Neon built-in pooler or pgBouncer (connection pool size: 20-50)"],
        ["Storage Sizing", "Minimum 5 GB initial allocation", "10 GB - 50 GB SSD (scales at ~1.5 GB per 20,000 incident lifecycles)"],
        ["Database Privileges", "DDL + DML permissions", "User with CREATE, ALTER, INDEX, SELECT, INSERT, UPDATE, DELETE"]
    ]
    doc.add_table(db_headers, db_rows, [2200, 3400, 4000])

    doc.add_callout("Prisma Schema Synchronization",
                    "Database schema deployment requires executing `npx prisma db push` or `npx prisma migrate deploy` followed by `node scripts/seed.js` to initialize the 8 default closure issue tags and essential system settings.",
                    "tip")

    # Section 4: Enterprise External APIs & Credentials
    doc.add_heading_1("4. Enterprise External APIs & Integration Credentials")
    doc.add_p("The platform relies on four major enterprise integration pillars. Below are the exact credentials, permission scopes, and technical prerequisites needed for each:")

    doc.add_heading_2("4.1. ServiceNow Integration (ITSM, CMDB & KB)")
    doc.add_p("The CIM Outage Centre connects to ServiceNow via REST Table API and the embedded ServiceNow Model Context Protocol (MCP) server:")
    doc.add_bullet("Instance URL:", "Full HTTPS URL of your ServiceNow instance (e.g. `https://company.service-now.com`).")
    doc.add_bullet("Integration Service Account:", "A dedicated integration user (e.g. `svc_cim_centre`) or OAuth 2.0 Client credentials.")
    doc.add_bullet("Required ServiceNow ITIL Roles:", "")
    doc.add_p("   • `itil`: Standard operational access to read and update incident worknotes.\n   • `sn_incident_read` & `sn_incident_write`: Incident querying and automated timeline sync.\n   • `sn_change_read`: Querying `change_request` table within the strict 30-day production window.\n   • `knowledge` / `sn_kb_read`: Querying knowledge articles in `kb_knowledge` table.\n   • `sys_user_group` (Read): Querying authentic assignment groups for live AI verification.")
    doc.add_bullet("ServiceNow MCP Server:", "Can run locally via stdio (`scripts/servicenow-mcp-server.js`) or remotely via Server-Sent Events (SSE).")

    doc.add_heading_2("4.2. Microsoft 365 & Microsoft Entra ID (Azure AD)")
    doc.add_p("Enables single sign-on (SSO) for corporate users and automates email dispatches and Teams bridge meeting links:")
    doc.add_bullet("Azure App Registration:", "Registered in Microsoft Entra ID (portal.azure.com).")
    doc.add_bullet("Application (Client) ID:", "`AZURE_AD_CLIENT_ID` - UUID generated by Azure Portal.")
    doc.add_bullet("Client Secret:", "`AZURE_AD_CLIENT_SECRET` - Confidential key generated with 12 to 24 month expiration.")
    doc.add_bullet("Directory (Tenant) ID:", "`AZURE_AD_TENANT_ID` - Corporate tenant UUID.")
    doc.add_bullet("Redirect URI:", "`https://<your-domain>/api/auth/sso/callback` (Must be configured as a Web Redirect URI in Azure Portal).")
    doc.add_bullet("Microsoft Graph API Permissions (Delegated & Application):", "")
    doc.add_p("   • `User.Read` (Delegated): Authenticate users and retrieve name/email/ID during SSO sign-in.\n   • `Mail.Send` (Application or Delegated): Send CIM update notifications to bridge recipients, assignment groups, and site engineers.\n   • `OnlineMeetings.ReadWrite` (Delegated / App, Optional): Programmatically generate Microsoft Teams bridge meeting links.")

    doc.add_heading_2("4.3. Alternative SMTP Email Relay (If not using Microsoft Graph)")
    doc.add_p("If Microsoft Graph Mail is not enabled in your tenant, the application can dispatch emails via corporate SMTP:")
    doc.add_bullet("SMTP Server:", "`SMTP_HOST` (e.g., `smtp.office365.com`, `email-smtp.us-east-1.amazonaws.com`, SendGrid).")
    doc.add_bullet("SMTP Port:", "`SMTP_PORT` (Port 587 with STARTTLS or Port 465 with SSL).")
    doc.add_bullet("Credentials:", "`SMTP_USER` and `SMTP_PASS` (or API Key).")
    doc.add_bullet("Sender Identity:", "`SMTP_FROM` (e.g., `cim-outage-alerts@company.com`).")

    doc.add_heading_2("4.4. Artificial Intelligence & LLM Engine (Google Gemini)")
    doc.add_p("Powers the AI Analysis Panel, verified assignment group recommendations, 30-day change correlation, and step-by-step remediation plan synthesis:")
    doc.add_bullet("API Key:", "`GEMINI_API_KEY` (Generated via Google AI Studio or Google Cloud Vertex AI).")
    doc.add_bullet("Recommended Primary Model:", "`gemini-1.5-flash` — Ideal balance of sub-second inference speed, low latency, and extreme cost-efficiency.")
    doc.add_bullet("Advanced Reasoning Model:", "`gemini-1.5-pro` — For high-severity P1 incidents requiring deep multi-document synthesis across historical tickets and extensive KB articles.")
    doc.add_bullet("Enterprise Compliance:", "For strictly regulated environments, Google Vertex AI Private Endpoints within an enterprise GCP project VPC can be utilized.")

    doc.add_heading_2("4.5. Audio Bridge Telemetry & Whisper AI (Optional)")
    doc.add_p("For automated transcription of live Microsoft Teams bridge meetings into incident transcripts (`IncidentTranscript`):")
    doc.add_bullet("API Option:", "OpenAI Whisper API (`OPENAI_API_KEY`).")
    doc.add_bullet("Self-Hosted Option:", "Open-source `faster-whisper` container or `whisper.cpp` running on private infrastructure with CPU/GPU.")

    # Section 5: Environment Variables Reference Matrix
    doc.add_heading_1("5. Complete Environment Variables Configuration Matrix")
    doc.add_p("The table below details all environment variables required in `.env.production`:")

    env_headers = ["Variable Name", "Required?", "Purpose & Description", "Sample / Format"]
    env_rows = [
        ["DATABASE_URL", "Yes", "PostgreSQL connection string with SSL mode", "postgresql://user:pass@ep-host.neon.tech/neondb?sslmode=require"],
        ["JWT_SECRET", "Yes", "64+ character secret for signing user session JWT cookies", "openssl rand -hex 32 string"],
        ["NEXT_PUBLIC_APP_URL", "Yes", "Canonical public domain of the application", "https://outage.company.com"],
        ["SERVICENOW_INSTANCE_URL", "Yes", "Target ServiceNow instance base URL", "https://company.service-now.com"],
        ["SERVICENOW_USERNAME", "Yes", "ServiceNow integration user account", "svc_cim_centre"],
        ["SERVICENOW_PASSWORD", "Yes", "ServiceNow integration user password", "SecureVaultPassword123!"],
        ["AZURE_AD_CLIENT_ID", "Optional", "Entra ID App Registration Client ID for SSO", "00000000-0000-0000-0000-000000000000"],
        ["AZURE_AD_CLIENT_SECRET", "Optional", "Entra ID Client Secret value", "abc12~XYZ..."],
        ["AZURE_AD_TENANT_ID", "Optional", "Entra ID Directory Tenant ID", "11111111-1111-1111-1111-111111111111"],
        ["GEMINI_API_KEY", "Yes", "Google Gemini AI API Key for analysis & solutions", "AIzaSy..."],
        ["SMTP_HOST", "Conditional", "SMTP server if Microsoft Graph mail is not used", "smtp.office365.com"],
        ["SMTP_PORT", "Conditional", "SMTP port (587 or 465)", "587"],
        ["SMTP_USER", "Conditional", "SMTP authentication user/email", "cim-notifications@company.com"],
        ["SMTP_PASS", "Conditional", "SMTP password / application password", "AppPasswordHere"],
        ["SMTP_FROM", "Conditional", "Outbound email sender header", "CIM Outage Centre <no-reply@company.com>"],
        ["NODE_ENV", "Yes", "Set environment runtime mode", "production"]
    ]
    doc.add_table(env_headers, env_rows, [2400, 1200, 3600, 2400])

    # Section 6: Comprehensive Pricing & Cost Analysis
    doc.add_heading_1("6. Comprehensive Pricing & Cost Estimates")
    doc.add_p("The operational cost of the CIM Outage Centre is exceptionally low compared to proprietary commercial IT incident software (such as PagerDuty or BigPanda). Below are realistic monthly cost estimates across three deployment tiers:")

    cost_summary_headers = ["Deployment Tier", "Target Workload", "Estimated Monthly Cost", "Key Infrastructure Included"]
    cost_summary_rows = [
        ["Tier 1: Free / Evaluation", "PoC, Staging, Dev (Up to 50 incidents/mo)", "$0 / month", "Neon Free Postgres (0.5 GB) + Vercel Hobby + Google AI Studio Free Tier"],
        ["Tier 2: Small to Mid-Enterprise", "Production (100–500 incidents/mo, 20 users)", "$45 – $110 / month", "Vercel Pro / ECS Fargate + Neon Launch ($19) + Gemini Flash ($10) + Domain ($1)"],
        ["Tier 3: Large Enterprise HA", "High Volume (1,000–5,000 incidents/mo, 100+ users)", "$220 – $550 / month", "Multi-AZ AWS ECS / Azure App Service + Aurora Postgres + Gemini 1.5 Pro + Whisper AI"]
    ]
    doc.add_table(cost_summary_headers, cost_summary_rows, [2200, 2600, 2000, 2800])

    doc.add_heading_2("6.1. Itemized Cost Breakdown by Component")
    item_headers = ["Component", "Pricing Model", "Unit Cost", "Est. Monthly Spend (Mid Enterprise)"]
    item_rows = [
        ["Compute: Vercel Pro", "Per active team seat", "$20 / seat / month (typically 1-3 admin seats)", "$20 – $60 / month"],
        ["Compute: AWS ECS Fargate (Alt)", "vCPU & Memory per second", "$0.04048/vCPU-hr + $0.004445/GB-hr (2 vCPU, 4 GB)", "~$45 / month"],
        ["Database: Neon PostgreSQL", "Storage & Compute units", "Launch Tier: $19/mo (Includes 10 GB storage + pooler)", "$19 – $35 / month"],
        ["Database: AWS RDS Postgres (Alt)", "db.t4g.medium Multi-AZ", "~$0.068 / hour + $0.115/GB-mo GP3", "~$65 / month"],
        ["AI: Google Gemini 1.5 Flash", "Per 1M tokens", "Input: $0.075 / 1M tokens | Output: $0.30 / 1M tokens", "$5 – $15 / month (for ~1,000 incidents)"],
        ["AI: Google Gemini 1.5 Pro", "Per 1M tokens", "Input: $1.25 / 1M tokens | Output: $5.00 / 1M tokens", "$25 – $50 / month (if used for all tickets)"],
        ["ServiceNow Integration User", "ServiceNow licensing", "Typically covered under existing Web Service / Integration user entitlement", "$0 (existing corporate license)"],
        ["Microsoft 365 / Entra ID", "Enterprise M365 E3/E5", "Included in existing enterprise Microsoft 365 agreement", "$0 (existing corporate license)"],
        ["Whisper Audio Transcription", "Per minute of audio", "$0.006 / minute (OpenAI API) or free via local whisper.cpp", "$10 – $30 / month"],
        ["SSL & Domain Name", "Annual registration", "$12 – $25 / year (Let's Encrypt SSL is $0)", "~$1 – $2 / month"]
    ]
    doc.add_table(item_headers, item_rows, [2600, 2400, 2600, 2000])

    doc.add_callout("Total Cost Advantage",
                    "Unlike traditional incident management software that charges $35 to $99 per user per month, the CIM Outage Centre has ZERO per-user licensing fees. An entire enterprise with 200 incident responders can run the platform for under $100 per month total infrastructure spend.",
                    "tip")

    # Section 7: Step-by-Step Deployment Guide
    doc.add_heading_1("7. Step-by-Step Deployment Execution Guide")
    doc.add_p("Follow this structured deployment procedure to stand up the platform in any target environment:")

    doc.add_heading_2("Phase 1: Environment & Repository Setup")
    doc.add_bullet("1. Clone Codebase:", "`git clone <repository-url> && cd cim-outage-centre`")
    doc.add_bullet("2. Install Dependencies:", "`npm install` (Installs Next.js 14, Prisma, Recharts, Lucide, Nodemailer, etc.).")
    doc.add_bullet("3. Configure Environment:", "Create `.env.production` with database connection string, JWT secret, and API keys.")

    doc.add_heading_2("Phase 2: Database Initialization")
    doc.add_bullet("4. Generate Prisma Client:", "`npx prisma generate` (Generates type-safe database client).")
    doc.add_bullet("5. Push Schema to Database:", "`npx prisma db push` (Creates tables: User, Incident, ClosureTag, Site, AuditLog, etc.).")
    doc.add_bullet("6. Seed Initial Data:", "`node scripts/seed.js` (Seeds the 8 standard closure issue tags and default configurations).")

    doc.add_heading_2("Phase 3: Building & Process Launch")
    doc.add_bullet("7. Production Build:", "`npm run build` (Compiles all static and dynamic pages with zero errors).")
    doc.add_bullet("8. Start Application Server:", "`npm start` (Runs Next.js on port 3000) or deploy via `vercel --prod`.")
    doc.add_bullet("9. Launch ServiceNow MCP (Optional):", "`npm run mcp:servicenow` (Starts the stdio MCP bridge).")

    # Section 8: Post-Deployment Smoke Test Checklist
    doc.add_heading_1("8. Post-Deployment Verification & Smoke Test Checklist")
    doc.add_p("Verify that each major subsystem functions correctly prior to handing over to production operations:")

    test_headers = ["Subsystem / Feature", "Verification Procedure", "Expected Successful Outcome", "Status"]
    test_rows = [
        ["Authentication & SSO", "Log in via Microsoft Entra SSO and Local Login", "Redirects to dashboard, user session cookie set with timeZone", "[   ]"],
        ["Incident Creation", "Create test P1 incident with affected site", "Incident record created, appears in Live Active tab", "[   ]"],
        ["AI Analysis & Groups", "Open incident and trigger AI Analysis", "Verified ServiceNow groups returned, 30d changes ranked", "[   ]"],
        ["Timeline & Email", "Post a timeline update with review modal", "Timeline update recorded, email dispatched, worknotes synced", "[   ]"],
        ["Closure Tagging Modal", "Transition incident status to CLOSED", "CloseIncidentModal opens, allows multi-tag selection, archives ticket", "[   ]"],
        ["Admin Tag Management", "Navigate to `/admin` -> Closure Issue Tags", "Displays all 8 default tags, allows add/edit/color change", "[   ]"],
        ["Reports & Analytics", "Open `/reports` and filter by Closure Tag", "Donut chart displays distribution, Excel export downloads clean XLSX", "[   ]"]
    ]
    doc.add_table(test_headers, test_rows, [2200, 3200, 3200, 1000])

    # Section 9: Security, Governance & Compliance
    doc.add_heading_1("9. Security, Governance & Compliance Standards")
    doc.add_bullet("Encryption in Transit:", "All communications must be secured over TLS 1.3. HTTPS strictly enforced on all API endpoints.")
    doc.add_bullet("Encryption at Rest:", "PostgreSQL database storage encrypted using AES-256. Prisma stores user passwords hashed via `bcryptjs` with 10 salt rounds.")
    doc.add_bullet("JWT Token Sanitization:", "Authentication tokens strip out all conflicting internal claims (`exp`, `iat`, `nbf`) on session refresh to prevent JWT signature invalidation.")
    doc.add_bullet("Role-Based Access Control (RBAC):", "Strict enforcement of `ADMIN`, `INCIDENT_MANAGER`, and `GUEST` privileges across administrative routes and incident state transitions.")
    doc.add_bullet("Immutable Audit Logging:", "Every incident state transition, closure tag modification, and administrative configuration change is recorded in the `AuditLog` table.")

    return doc.render_docx_bytes()

if __name__ == "__main__":
    docx_bytes = build_deployment_prerequisites_doc()
    
    # Save to Workspace root
    workspace_path = "/Users/samcortez151/Library/CloudStorage/OneDrive-XetaInteractives/CIM Outage Centre/CIM_Outage_Centre_Deployment_Prerequisites.docx"
    with open(workspace_path, "wb") as f:
        f.write(docx_bytes)
    print(f"Generated workspace docx: {workspace_path} ({len(docx_bytes)} bytes)")
    
    # Save to Brain Artifact directory
    artifact_path = "/Users/samcortez151/.gemini/antigravity/brain/6289cf35-ec7f-44f3-94ec-5fe21842e57f/CIM_Outage_Centre_Deployment_Prerequisites.docx"
    with open(artifact_path, "wb") as f:
        f.write(docx_bytes)
    print(f"Generated artifact docx: {artifact_path} ({len(docx_bytes)} bytes)")
