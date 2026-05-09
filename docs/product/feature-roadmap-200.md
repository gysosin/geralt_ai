# Feature-First Product Roadmap

This roadmap defines 220 visible, user-facing features for Geralt AI before broad cleanup work. It is informed by current product patterns in Linear display options and command workflows, n8n workflow templates and executions, Retool workflow debugging and approvals, Stripe reporting and request logs, OpenAI project roles and audit logs, GitHub agent workflows, and Supabase branching/logging dashboards.

Roadmap rule: every shipped feature must be reachable in the UI, locally deployable with Docker, and verified through browser, API, or both.

## Dashboard

| # | Feature name | User benefit | UI location | Backend/API changes needed | Acceptance criteria | Verification method |
|---:|---|---|---|---|---|---|
| 1 | Global command palette | Navigate and act without hunting through menus. | Header search, Cmd/Ctrl+K modal | None for first version; route metadata only | Palette opens by click and shortcut, filters commands, navigates routes | Browser keyboard and click smoke test |
| 2 | Workspace health summary | See system readiness at a glance. | Dashboard top band | Health/readiness endpoint aggregation | Shows API, Redis, Mongo, MinIO, search, vector status | API health curl plus dashboard check |
| 3 | Usage analytics cards | Track chats, tokens, files, and cost trend. | Dashboard KPI grid | Dashboard analytics endpoint enrichment | Cards load real totals with loading and empty states | API response plus browser KPI check |
| 4 | Recent activity feed | Understand what changed recently. | Dashboard right panel | Activity event collection and endpoint | Feed shows uploads, chats, bot changes, failures | Seed event and browser check |
| 5 | Quick-start checklist | Help new users complete setup. | Dashboard onboarding panel | User preference persistence | Checklist persists completed items | Toggle item, refresh, verify state |
| 6 | Saved dashboard layout | Let users customize cards. | Dashboard view menu | User layout preferences endpoint | Layout choice persists by user | Change layout, refresh, verify |
| 7 | Workspace scorecard | Summarize adoption and data quality. | Dashboard score section | Score calculation service | Displays score, drivers, and next actions | Unit test scoring plus browser check |
| 8 | Cost forecast card | Warn about monthly spend trajectory. | Dashboard usage panel | Forecast endpoint from token usage | Forecast appears when usage exists | API test with usage fixtures |
| 9 | SLA risk widget | Show operational risk before users notice. | Dashboard ops panel | Readiness history endpoint | Widget shows degraded dependencies and age | Mock dependency failure in test |
| 10 | Dashboard export | Share dashboard snapshot. | Dashboard action menu | CSV/PDF export endpoint | Export downloads current KPI snapshot | Browser download and API check |

## Auth and User Settings

| # | Feature name | User benefit | UI location | Backend/API changes needed | Acceptance criteria | Verification method |
|---:|---|---|---|---|---|---|
| 11 | Profile editor | Update name and avatar details. | Settings profile tab | User update endpoint validation | Form saves and reloads user profile | API update plus browser refresh |
| 12 | Password change | Improve account security. | Settings security tab | Password change endpoint with current password | Rejects wrong password, accepts valid change | Backend auth test |
| 13 | Session list | See and revoke active sessions. | Settings security tab | Session store and revoke endpoint | Active sessions list and revoke works | API/session browser test |
| 14 | API key manager | Use Geralt AI from external tools. | Settings API keys tab | Scoped key CRUD with hashed storage | Keys can be created, copied once, revoked | API test and UI smoke |
| 15 | Notification preferences | Control email/in-app alerts. | Settings notifications tab | Preference persistence endpoint | Toggles persist by user | Toggle, refresh, verify |
| 16 | Theme preference | Choose dark, light, or system. | Settings appearance tab | User preference persistence | Theme applies and persists | Browser visual check |
| 17 | Locale and timezone | Show dates in user context. | Settings preferences tab | User timezone field | Dates use selected timezone | Unit date format test |
| 18 | OAuth connections | Link Google/Microsoft accounts. | Settings connections tab | OAuth connection list endpoint | Connection cards show status | API fixture plus browser check |
| 19 | Data export request | Let users download their data. | Settings privacy tab | Async export job endpoint | Request creates job and status row | API job test |
| 20 | Account deletion request | Provide controlled offboarding. | Settings privacy tab | Soft-delete request workflow | Confirmation validation and request record | Form validation test |

## Teams and Roles

| # | Feature name | User benefit | UI location | Backend/API changes needed | Acceptance criteria | Verification method |
|---:|---|---|---|---|---|---|
| 21 | Team directory | See workspace members. | Teams page | Team member list endpoint | Members table loads with empty/error states | API and browser check |
| 22 | Invite member | Add colleagues safely. | Teams invite modal | Invite endpoint with role validation | Invite creates pending member | Backend test |
| 23 | Role assignment | Control access by role. | Teams member drawer | Role update endpoint | Role changes persist and audit event records | API role test |
| 24 | Permission matrix | Understand role capabilities. | Teams roles tab | Role capability endpoint | Matrix renders all roles and permissions | Browser table check |
| 25 | Custom role builder | Fit enterprise permission models. | Teams roles tab | Custom role CRUD | Create, edit, delete custom role | API CRUD test |
| 26 | Access review queue | Review risky access periodically. | Teams access review tab | Review cycle model and endpoint | Reviewer can approve or revoke access | Workflow test |
| 27 | Guest user mode | Limit external collaborator access. | Teams invite modal | Guest role constraints | Guest cannot access restricted pages | Route guard test |
| 28 | Department groups | Organize members by business unit. | Teams groups tab | Group CRUD and membership endpoint | Groups show members and counts | API and browser check |
| 29 | Ownership transfer | Transfer bots, collections, workflows. | Teams member drawer | Ownership transfer endpoint | Transfer updates resources atomically | Backend transaction test |
| 30 | SCIM readiness panel | Prepare enterprise identity sync. | Teams provisioning tab | SCIM config metadata endpoint | Panel shows config state and docs links | Browser check |

## Admin Console

| # | Feature name | User benefit | UI location | Backend/API changes needed | Acceptance criteria | Verification method |
|---:|---|---|---|---|---|---|
| 31 | Admin overview | Centralize workspace controls. | Admin console home | Admin summary endpoint | Shows users, storage, jobs, risk counts | API and browser check |
| 32 | Tenant settings | Manage workspace name, logo, domain. | Admin settings tab | Tenant settings endpoint | Changes persist and reflect in UI | API test |
| 33 | Feature flags UI | Roll out features safely. | Admin flags tab | Feature flag CRUD endpoint | Flags can be toggled and audited | Backend test |
| 34 | Model policy manager | Set allowed LLM providers. | Admin AI policy tab | Provider policy endpoint | Disallowed provider hidden/blocked | API and UI test |
| 35 | Storage policy manager | Control file size/type limits. | Admin storage tab | Upload policy endpoint | UI shows limits and upload rejects violations | Upload validation test |
| 36 | Retention policy editor | Configure data retention. | Admin compliance tab | Retention policy endpoint | Policy saves with validation | API test |
| 37 | Admin impersonation guard | Support debugging without abuse. | Admin user drawer | Time-limited impersonation with audit | Requires reason and shows banner | Security test |
| 38 | System maintenance banner | Warn users about maintenance. | Admin announcements tab | Announcement CRUD endpoint | Banner appears across app | Browser check |
| 39 | Tenant usage limits | Prevent runaway usage. | Admin limits tab | Limits endpoint and enforcement hooks | Limits save and show warnings | API enforcement test |
| 40 | Admin task center | Track admin actions requiring attention. | Admin task tab | Admin tasks endpoint | Tasks can be assigned and completed | API/browser check |

## Notifications

| # | Feature name | User benefit | UI location | Backend/API changes needed | Acceptance criteria | Verification method |
|---:|---|---|---|---|---|---|
| 41 | Notification center filters | Find relevant alerts quickly. | Notification drawer | Filter params on notifications endpoint | Filter by unread, type, severity | API query test |
| 42 | Mark all as read | Clear alert noise. | Notification drawer | Bulk update endpoint | All unread alerts become read | API/browser check |
| 43 | Notification detail drawer | Understand alert context. | Notification item click | Notification detail endpoint | Detail includes resource links and timestamps | Browser check |
| 44 | Digest preview | Preview scheduled email digest. | Settings notifications | Digest preview endpoint | Preview lists included events | API test |
| 45 | Alert severity rules | Escalate critical events. | Admin notifications | Rule CRUD endpoint | Rule creates notifications by severity | Backend test |
| 46 | Watch resource | Subscribe to bot, collection, workflow changes. | Resource action menu | Watch subscription endpoint | Watched resource changes notify user | API test |
| 47 | Quiet hours | Pause noncritical notifications. | Settings notifications | Quiet hour preference | Noncritical alerts delayed in quiet hours | Unit test |
| 48 | Delivery status | Show email/webhook delivery result. | Notification detail | Delivery status endpoint | Status visible with retry option | API fixture check |
| 49 | Notification templates | Customize alert copy. | Admin templates | Template CRUD endpoint | Template preview and save works | Browser form test |
| 50 | In-app toast history | Recover dismissed toasts. | Notification drawer | Store toast events | Recent toasts listed | UI smoke |

## Search

| # | Feature name | User benefit | UI location | Backend/API changes needed | Acceptance criteria | Verification method |
|---:|---|---|---|---|---|---|
| 51 | Unified search page | Search across files, chats, bots, workflows. | Search route | Unified search endpoint | Results grouped by type | API and browser search |
| 52 | Search result preview | Inspect hits before opening. | Search result drawer | Snippet/highlight fields | Preview opens with context | Browser check |
| 53 | Saved searches | Reuse common queries. | Search sidebar | Saved search CRUD endpoint | Save, run, delete search | API test |
| 54 | Search filters | Narrow by type, date, owner, collection. | Search toolbar | Filter params | Filters update results and URL | Browser test |
| 55 | Recent searches | Resume previous work. | Search empty state | Local/user preference persistence | Recent queries show and rerun | Browser refresh test |
| 56 | Search suggestions | Guide query formulation. | Search input | Suggestion endpoint or local metadata | Suggestions appear as user types | UI test |
| 57 | Semantic search toggle | Compare keyword vs meaning search. | Search toolbar | Search mode param | Toggle changes endpoint query mode | API spy test |
| 58 | Search export | Share selected results. | Search action menu | Export endpoint | CSV downloads selected results | Browser download check |
| 59 | Pinned results | Keep important answers visible. | Search result actions | Pinned result endpoint | Pinned items appear on top | API/browser check |
| 60 | Search quality feedback | Improve relevance over time. | Search result footer | Feedback endpoint | Thumbs feedback records query/result | API test |

## Documents

| # | Feature name | User benefit | UI location | Backend/API changes needed | Acceptance criteria | Verification method |
|---:|---|---|---|---|---|---|
| 61 | Document inbox | Review uploads needing action. | Documents page | Document status list endpoint | Inbox groups processing, failed, ready docs | API/browser check |
| 62 | Bulk upload queue | Track multiple uploads. | Collections upload drawer | Upload job status endpoint | Queue shows per-file progress | Browser upload test |
| 63 | File detail page | Inspect metadata, chunks, extraction. | Document route | Document detail endpoint | Metadata and extracted text visible | API and browser check |
| 64 | Document tags | Organize files by custom labels. | File detail and list | Tag CRUD endpoint | Tags add/remove and filter | API test |
| 65 | Duplicate detection | Avoid indexing duplicate docs. | Upload flow | File hash check endpoint | Duplicate warning appears | Upload test |
| 66 | Document version history | Track file revisions. | File detail versions tab | Version model and endpoint | Versions list with current marker | API test |
| 67 | Reprocess document action | Recover failed extraction. | File detail action menu | Reprocess task endpoint | Reprocess moves doc to processing | API task test |
| 68 | Extraction confidence view | Show reliability of parsed content. | File detail extraction tab | Confidence fields from extraction | Low confidence sections highlighted | Browser check |
| 69 | Document comments | Discuss file-specific issues. | File detail comments tab | Comment CRUD endpoint | Comments persist and notify watchers | API/browser check |
| 70 | Secure document share link | Share read-only file view. | File detail share modal | Signed share endpoint | Link expires and enforces scope | Security test |

## RAG and Chat

| # | Feature name | User benefit | UI location | Backend/API changes needed | Acceptance criteria | Verification method |
|---:|---|---|---|---|---|---|
| 71 | Source citation drawer | See exactly where answers came from. | Chat answer citations | Source detail endpoint | Citation opens document page location | Browser chat check |
| 72 | Answer confidence meter | Spot weak answers. | Chat message footer | Confidence score in chat response | Meter appears with explanation | API fixture test |
| 73 | Regenerate answer | Retry with same context. | Chat message actions | Regenerate endpoint | New answer replaces or appends version | API/chat test |
| 74 | Prompt templates | Start common RAG tasks quickly. | Chat composer menu | Template list endpoint | Template inserts prompt text | Browser check |
| 75 | Chat collection switcher | Choose active knowledge sources. | Chat sidebar/composer | Conversation collection update endpoint | Selected collections persist per chat | API/browser check |
| 76 | Conversation summary | Read long chats quickly. | Chat sidebar detail | Summary generation endpoint | Summary available after chat threshold | API test |
| 77 | Conversation pinning | Keep important chats accessible. | Chat sidebar | Pin endpoint | Pinned conversations stay on top | Browser check |
| 78 | Answer feedback loop | Improve bot quality. | Chat message footer | Feedback endpoint with reason | Feedback saved with answer id | API test |
| 79 | Chat handoff task | Turn an answer into a task. | Chat message actions | Task creation endpoint | Task opens with answer context | API/browser check |
| 80 | Retrieval debug view | Explain RAG context selection. | Chat developer drawer | Retrieval trace endpoint | Shows query expansion, rerank, selected chunks | API test |

## Workflow Builder

| # | Feature name | User benefit | UI location | Backend/API changes needed | Acceptance criteria | Verification method |
|---:|---|---|---|---|---|---|
| 81 | Workflow template gallery | Start automations faster. | Workflow page gallery | Template list endpoint | Templates searchable and installable | Browser/API check |
| 82 | Visual run timeline | Debug workflow execution. | Workflow run detail | Execution event endpoint | Timeline shows node status and duration | API/browser check |
| 83 | Manual trigger form | Run workflows with inputs. | Workflow detail trigger panel | Input schema and run endpoint | Valid inputs start run, invalid inputs rejected | Form/API test |
| 84 | Retry failed workflow step | Recover without rerunning all steps. | Run detail actions | Step retry endpoint | Failed step retries and records result | Backend test |
| 85 | Workflow version history | Compare and restore changes. | Workflow detail versions tab | Version storage endpoint | Diff and restore available | API test |
| 86 | Workflow schedule editor | Automate recurring runs. | Workflow detail schedule tab | Schedule CRUD endpoint | Cron schedule saves and displays next run | Unit/API test |
| 87 | Workflow approval step | Add human checkpoint. | Workflow builder node palette | Approval node model and runtime | Run pauses until approval decision | Workflow test |
| 88 | Workflow comments | Annotate automations for teams. | Workflow canvas comments | Comment CRUD endpoint | Comments anchor to nodes | Browser test |
| 89 | Workflow secrets binding | Use credentials without exposing values. | Workflow settings secrets tab | Secret reference endpoint | Secrets selectable, never printed | Security test |
| 90 | Workflow import/export | Move workflows between environments. | Workflow action menu | Import/export endpoint | JSON export/import round trip works | API test |

## OCR

| # | Feature name | User benefit | UI location | Backend/API changes needed | Acceptance criteria | Verification method |
|---:|---|---|---|---|---|---|
| 91 | OCR profile builder | Tune extraction per document type. | OCR settings page | OCR profile CRUD endpoint | Profile saves language, DPI, preprocessing | API/browser check |
| 92 | OCR batch monitor | Track batch extraction jobs. | OCR queue page | OCR batch endpoint | Batch progress and failures visible | API test |
| 93 | Page review grid | Inspect OCR page output. | OCR run detail | Page result endpoint | Pages show text, confidence, status | Browser check |
| 94 | Low-confidence queue | Prioritize manual review. | OCR review queue | Low confidence query endpoint | Queue filters by threshold | API/browser check |
| 95 | OCR correction editor | Fix extracted text. | OCR page detail | Correction endpoint | Corrected text persists and reindexes | API test |
| 96 | OCR language selector | Improve multi-language documents. | Upload/OCR profile | Language config endpoint | Selected language used by OCR job | Task test |
| 97 | Table extraction view | Review tabular OCR output. | OCR run tables tab | Table extraction endpoint | Tables render and export CSV | Browser/download test |
| 98 | OCR side-by-side viewer | Compare image and extracted text. | OCR page review | Document page image endpoint | Image and text scroll together | Browser visual check |
| 99 | OCR redaction marks | Hide sensitive text before sharing. | OCR review actions | Redaction persistence endpoint | Redacted text excluded from share/export | Security test |
| 100 | OCR quality report | Summarize extraction accuracy. | OCR run report tab | Quality metrics endpoint | Report shows confidence distribution | API/browser check |

## Procurement

| # | Feature name | User benefit | UI location | Backend/API changes needed | Acceptance criteria | Verification method |
|---:|---|---|---|---|---|---|
| 101 | Procurement dashboard | Track sourcing work. | Procurement page | Procurement summary endpoint | Shows open requests, spend, approvals | API/browser check |
| 102 | Purchase request form | Capture structured requests. | Procurement create modal | Purchase request CRUD | Form validates required fields and saves | Form/API test |
| 103 | Budget check panel | Prevent overspend. | Request detail | Budget lookup endpoint | Shows remaining budget and warnings | API fixture test |
| 104 | Request status timeline | Understand procurement progress. | Request detail | Status event endpoint | Timeline updates on status change | API/browser check |
| 105 | Line item editor | Manage requested items. | Request detail items tab | Line item CRUD endpoint | Add/edit/delete items with totals | API/form test |
| 106 | Procurement intake triage | Prioritize incoming requests. | Procurement triage tab | Triage endpoint | Requests can be accepted, assigned, rejected | Browser/API check |
| 107 | Contract attachment review | Link contracts to requests. | Request attachments tab | Attachment relation endpoint | Attachments show scan status | API/browser check |
| 108 | Procurement comment thread | Collaborate on requests. | Request detail comments | Comment endpoint | Comments persist with mentions | API/browser check |
| 109 | Spend category taxonomy | Standardize reporting. | Admin procurement settings | Category CRUD endpoint | Categories apply to requests | API test |
| 110 | Procurement export | Share sourcing pipeline. | Procurement action menu | Export endpoint | CSV downloads filtered requests | Browser download check |

## Vendors

| # | Feature name | User benefit | UI location | Backend/API changes needed | Acceptance criteria | Verification method |
|---:|---|---|---|---|---|---|
| 111 | Vendor directory | Track supplier records. | Vendors page | Vendor CRUD endpoint | Vendor list loads and supports empty state | API/browser check |
| 112 | Vendor profile | View contracts, risk, contacts. | Vendor detail | Vendor detail endpoint | Profile tabs show related data | API/browser check |
| 113 | Vendor comparison view | Compare bids side by side. | Vendor comparison route | Bid comparison endpoint | Comparison table calculates totals | Unit/API test |
| 114 | Vendor risk score | Surface compliance concerns. | Vendor profile risk tab | Risk scoring endpoint | Risk score and drivers visible | Scoring test |
| 115 | Vendor onboarding checklist | Ensure vendor readiness. | Vendor profile onboarding | Checklist endpoint | Checklist completion persists | Browser/API check |
| 116 | Vendor document vault | Store vendor docs securely. | Vendor profile documents | Vendor document endpoint | Upload/list/delete vendor docs | Upload test |
| 117 | Vendor contact manager | Keep supplier contacts current. | Vendor profile contacts | Contact CRUD endpoint | Contacts validate email and role | API/form test |
| 118 | Renewal calendar | Avoid missed renewals. | Vendors renewal tab | Renewal endpoint | Upcoming renewals sorted by date | API/browser check |
| 119 | Vendor performance notes | Capture delivery feedback. | Vendor profile performance | Performance note endpoint | Notes persist with author/date | API test |
| 120 | Vendor shortlist | Save candidates for evaluation. | Vendors list actions | Shortlist endpoint | Shortlisted vendors filterable | Browser check |

## Approvals

| # | Feature name | User benefit | UI location | Backend/API changes needed | Acceptance criteria | Verification method |
|---:|---|---|---|---|---|---|
| 121 | Approval inbox | See decisions requiring action. | Approvals page | Approval task endpoint | Inbox lists pending approvals | API/browser check |
| 122 | Approval detail view | Decide with full context. | Approval detail route | Approval detail endpoint | Context, requester, history visible | Browser check |
| 123 | Approve/reject with reason | Capture decision rationale. | Approval detail actions | Decision endpoint | Reason required on rejection | API/form test |
| 124 | Delegated approvals | Cover absences. | Settings approvals tab | Delegation CRUD endpoint | Delegate receives approval tasks | API test |
| 125 | Approval policy builder | Configure approval rules. | Admin approvals | Policy CRUD endpoint | Rule saves thresholds and approvers | API/browser check |
| 126 | Parallel approval groups | Support multi-stakeholder decisions. | Policy builder | Group approval model | All required groups must decide | Backend workflow test |
| 127 | Approval SLA timers | Prevent blocked work. | Approval inbox and detail | SLA fields and escalation job | Overdue approvals highlighted | API fixture/browser check |
| 128 | Approval audit trail | Prove who decided what. | Approval detail timeline | Audit event endpoint | Timeline records each decision | API test |
| 129 | Approval reminders | Nudge approvers. | Approval detail action | Reminder endpoint | Reminder creates notification | API test |
| 130 | Approval analytics | Improve bottleneck visibility. | Reports approvals | Approval metrics endpoint | Metrics show cycle time and overdue count | API/browser check |

## Reports

| # | Feature name | User benefit | UI location | Backend/API changes needed | Acceptance criteria | Verification method |
|---:|---|---|---|---|---|---|
| 131 | Reports library | Find standard reports. | Reports page | Report catalog endpoint | Library shows grouped report cards | Browser/API check |
| 132 | Usage report | Analyze token and chat usage. | Reports usage | Usage report endpoint | Filters by date, user, bot | API/browser check |
| 133 | Document processing report | Track extraction throughput. | Reports documents | Processing metrics endpoint | Report shows success/failure rates | API test |
| 134 | Procurement spend report | Review spend by vendor/category. | Reports procurement | Spend aggregation endpoint | Charts and CSV export work | API/browser check |
| 135 | Compliance report | Prove audit readiness. | Reports compliance | Compliance metrics endpoint | Report includes access, retention, audit events | API test |
| 136 | Scheduled reports | Send reports automatically. | Reports schedule modal | Schedule CRUD endpoint | Schedule saves and next run displays | API/form test |
| 137 | Report builder | Build custom tabular reports. | Reports builder route | Report definition CRUD | Columns/filters save and preview runs | Browser/API check |
| 138 | Report annotations | Add context to metrics. | Report detail comments | Annotation endpoint | Notes persist on report/time range | API/browser check |
| 139 | Report export center | Track generated exports. | Reports exports tab | Export job endpoint | Export history and download links visible | API/browser check |
| 140 | Report comparison | Compare periods side by side. | Report detail compare mode | Compare query params | Delta values render for selected periods | API test |

## Integrations

| # | Feature name | User benefit | UI location | Backend/API changes needed | Acceptance criteria | Verification method |
|---:|---|---|---|---|---|---|
| 141 | Integrations catalog | Discover available connectors. | Integrations page | Integration catalog endpoint | Cards show status and setup actions | Browser/API check |
| 142 | Slack connector | Send alerts and approvals to Slack. | Integrations Slack detail | Slack config endpoint | Config saves without exposing token | API/security test |
| 143 | Microsoft Teams connector | Route notifications to Teams. | Integrations Teams detail | Teams webhook config endpoint | Test message sends or validates config | API test |
| 144 | Google Drive import | Bring documents from Drive. | Integrations Drive detail | OAuth import job endpoint | Import job created with folder id | API test |
| 145 | SharePoint import | Connect enterprise documents. | Integrations SharePoint detail | OAuth import endpoint | Site/folder selection persists | API/browser check |
| 146 | Webhook subscriptions | Send events to external systems. | Integrations webhooks | Webhook CRUD endpoint | Webhook receives signed event | Backend test |
| 147 | Integration health checks | Detect broken connectors. | Integrations status panel | Health check endpoint | Broken connectors marked degraded | API/browser check |
| 148 | Credential rotation reminders | Avoid expired credentials. | Integrations credential tab | Credential metadata endpoint | Upcoming expiry warnings visible | API test |
| 149 | Integration event logs | Debug connector failures. | Integration detail logs | Integration log endpoint | Logs filter by severity and date | Browser/API check |
| 150 | Connector request form | Let users ask for new integrations. | Integrations request modal | Request endpoint | Request saves with use case | API/form test |

## Audit Logs

| # | Feature name | User benefit | UI location | Backend/API changes needed | Acceptance criteria | Verification method |
|---:|---|---|---|---|---|---|
| 151 | Audit log explorer | Search security-sensitive events. | Audit logs page | Audit query endpoint | Logs filter by actor, action, resource, date | API/browser check |
| 152 | Audit event detail | Inspect exact change context. | Audit event drawer | Audit detail endpoint | Before/after fields shown safely | API/browser check |
| 153 | Audit export | Share compliance evidence. | Audit action menu | Audit export endpoint | CSV export respects filters | Browser download check |
| 154 | Audit saved filters | Reuse compliance views. | Audit sidebar | Saved filter CRUD endpoint | Saved filter restores query | API/browser check |
| 155 | High-risk event alerts | Catch dangerous actions quickly. | Admin audit settings | Risk rule endpoint | Matching event creates notification | Backend test |
| 156 | Immutable log status | Show retention and tamper status. | Audit overview card | Integrity status endpoint | Status and retention window visible | API/browser check |
| 157 | Actor profile link | Investigate users faster. | Audit table row | None | Actor click opens user profile | Browser check |
| 158 | Resource timeline | See all events for a resource. | Resource detail audit tab | Resource audit query | Timeline lists relevant events | API/browser check |
| 159 | API request log view | Debug API consumers. | Audit API tab | Request log endpoint | Requests show method, path, status, latency | API/browser check |
| 160 | Audit anomaly view | Spot unusual behavior. | Audit anomalies tab | Anomaly detection endpoint | Anomalies list with severity | Unit/API test |

## Monitoring

| # | Feature name | User benefit | UI location | Backend/API changes needed | Acceptance criteria | Verification method |
|---:|---|---|---|---|---|---|
| 161 | System status page | Know if core services are healthy. | Monitoring page | Status endpoint | Service cards show healthy/degraded/down | API/browser check |
| 162 | Container status panel | Diagnose local Docker issues. | Monitoring Docker tab | Optional Docker status endpoint for local mode | Shows frontend/backend container state | Docker/browser check |
| 163 | Job queue monitor | Track ingestion and workflow jobs. | Monitoring jobs tab | Queue metrics endpoint | Queue depth and failed jobs visible | API/browser check |
| 164 | Error log explorer | Debug app errors. | Monitoring errors tab | Error log endpoint | Errors searchable by level/source | API/browser check |
| 165 | Latency charts | Identify slow endpoints. | Monitoring performance tab | Latency metrics endpoint | p50/p95 charts render | API/browser check |
| 166 | Uptime timeline | Understand incidents over time. | Monitoring status detail | Uptime history endpoint | Timeline shows incidents and recovery | API test |
| 167 | Dependency map | See system architecture live. | Monitoring dependencies tab | Dependency metadata endpoint | Map renders dependencies and health | Browser check |
| 168 | Incident notes | Document outages. | Monitoring incidents | Incident CRUD endpoint | Incident notes persist with status | API/form test |
| 169 | Alert rule builder | Configure operational alerts. | Monitoring alerts tab | Alert rule CRUD | Rule validates metric and threshold | API/form test |
| 170 | Log download bundle | Package logs for support. | Monitoring actions | Log bundle endpoint | Bundle downloads sanitized logs | API/security test |

## Billing and Usage

| # | Feature name | User benefit | UI location | Backend/API changes needed | Acceptance criteria | Verification method |
|---:|---|---|---|---|---|---|
| 171 | Usage dashboard | Understand cost drivers. | Billing usage page | Usage aggregation endpoint | Usage by user, bot, model visible | API/browser check |
| 172 | Budget alerts | Prevent unexpected spend. | Billing budgets tab | Budget CRUD and alert endpoint | Alert fires near threshold | Backend test |
| 173 | Model cost breakdown | Compare provider/model cost. | Billing usage chart | Cost attribution endpoint | Chart groups by provider/model | API/browser check |
| 174 | Invoice history | Access billing records. | Billing invoices tab | Invoice metadata endpoint | Invoices list with download action | API/browser check |
| 175 | Usage export | Share usage data with finance. | Billing actions | Export endpoint | CSV downloads filtered usage | Browser download check |
| 176 | Project quotas | Cap usage per project/team. | Billing quotas tab | Quota CRUD and enforcement | Quota saves and warnings show | API test |
| 177 | Cost anomaly alerts | Detect unusual spikes. | Billing anomalies tab | Anomaly endpoint | Spike appears with explanation | Unit/API test |
| 178 | Chargeback report | Allocate spend internally. | Billing chargeback | Chargeback report endpoint | Costs grouped by department/team | API/browser check |
| 179 | Trial/plan status card | Know subscription state. | Billing overview | Plan endpoint | Plan status and limits visible | API/browser check |
| 180 | Usage retention setting | Control usage data storage. | Billing settings | Retention endpoint | Retention period saves and validates | API/form test |

## Onboarding

| # | Feature name | User benefit | UI location | Backend/API changes needed | Acceptance criteria | Verification method |
|---:|---|---|---|---|---|---|
| 181 | First-run workspace wizard | Guide setup. | Post-login onboarding route | Onboarding state endpoint | Wizard tracks completed setup steps | Browser/API check |
| 182 | Sample collection installer | Let users test RAG quickly. | Onboarding wizard | Sample data install endpoint | Sample collection appears after install | API/browser check |
| 183 | Invite teammate step | Accelerate collaboration. | Onboarding wizard | Invite endpoint reuse | Step sends invite and marks complete | API/form test |
| 184 | Connect data source step | Push toward real data. | Onboarding wizard | Integration status endpoint | Step links to integrations and detects connection | Browser check |
| 185 | Create first bot step | Make first agent obvious. | Onboarding wizard | Bot create endpoint reuse | Bot created and linked to collection | API/browser check |
| 186 | Onboarding progress sidebar | Show setup state throughout app. | Dashboard/sidebar | Onboarding progress endpoint | Progress visible until dismissed | Browser refresh test |
| 187 | Guided empty states | Convert empty pages into action. | Empty states across app | None or metadata endpoint | Empty states include primary action | Browser check |
| 188 | Product tour overlays | Teach key UI areas. | Dashboard tour | Tour state persistence | Tour can advance, skip, resume | Browser test |
| 189 | Help checklist reset | Let admins rerun onboarding. | Settings help | Onboarding reset endpoint | Reset restarts checklist | API/browser check |
| 190 | Getting-started report | Show setup completion to admins. | Admin onboarding tab | Onboarding analytics endpoint | Admin sees team completion | API/browser check |

## Mobile and Responsive UX

| # | Feature name | User benefit | UI location | Backend/API changes needed | Acceptance criteria | Verification method |
|---:|---|---|---|---|---|---|
| 191 | Mobile bottom navigation | Make core pages reachable on phones. | Mobile layout | None | Bottom nav appears under mobile breakpoint | Responsive browser check |
| 192 | Mobile command sheet | Use search/actions on phones. | Mobile header | None | Sheet opens and filters commands | Mobile browser check |
| 193 | Responsive table cards | Make data tables readable on phones. | Tables across app | None | Tables collapse into cards | Responsive screenshot check |
| 194 | Swipeable document preview | Review docs on mobile. | Document detail | None | Preview tabs usable by touch | Mobile browser check |
| 195 | Mobile chat composer | Improve chat ergonomics. | Chat route | None | Composer remains accessible and not overlapping | Mobile browser check |
| 196 | Offline retry banner | Explain network loss. | Global layout | Network status client state | Banner appears offline and hides online | Browser network test |
| 197 | Touch-friendly action menus | Avoid tiny controls. | Resource action menus | None | Menus have accessible touch targets | Browser/a11y check |
| 198 | Mobile filter drawer | Replace cramped filter bars. | Search/reports pages | None | Drawer opens and applies filters | Mobile browser check |
| 199 | Mobile upload progress | Keep uploads visible. | Upload flows | Existing upload progress endpoint | Progress remains visible while navigating | Browser upload test |
| 200 | Responsive admin console | Make admin views usable on tablets. | Admin console | None | Admin panels reflow without overlap | Responsive screenshot check |

## Developer and Ops Tools

| # | Feature name | User benefit | UI location | Backend/API changes needed | Acceptance criteria | Verification method |
|---:|---|---|---|---|---|---|
| 201 | API explorer | Test backend endpoints from UI. | Dev tools page | OpenAPI metadata endpoint reuse | Explorer lists endpoints and executes safe GETs | Browser/API check |
| 202 | Webhook tester | Validate outbound integrations. | Dev tools webhooks | Test webhook endpoint | Test event sends and logs result | API/browser check |
| 203 | Environment diff viewer | Compare dev/staging/prod settings. | Dev tools environments | Environment metadata endpoint | Diff hides secrets and shows drift | API/security test |
| 204 | Feature flag simulator | Preview UI for flag states. | Dev tools flags | Flag preview endpoint | User can simulate flag state locally | Browser check |
| 205 | Background job replay | Re-run failed jobs safely. | Dev tools jobs | Job replay endpoint | Replay requires confirmation and logs result | Backend test |
| 206 | Cache inspector | Debug stale data. | Dev tools cache | Cache metadata endpoint | Cache keys listed with invalidate action | API test |
| 207 | Schema status panel | Detect migration drift. | Dev tools database | Schema status endpoint | Panel shows current migration/version | API/browser check |
| 208 | Prompt registry | Track prompts used by AI features. | Dev tools prompts | Prompt registry endpoint | Prompts list versions and owners | API/browser check |
| 209 | Local deployment panel | Show Docker URLs and commands. | Dev tools deployment | Local deployment metadata endpoint or static config | Panel shows frontend/API URLs and status | Docker/browser check |
| 210 | Diagnostic bundle | Collect safe debugging data. | Dev tools diagnostics | Diagnostic endpoint | Bundle excludes secrets | Security test |

## AI Automation

| # | Feature name | User benefit | UI location | Backend/API changes needed | Acceptance criteria | Verification method |
|---:|---|---|---|---|---|---|
| 211 | Agent template marketplace | Start from proven AI agents. | Agent platform templates | Template catalog endpoint | Templates install into workspace | API/browser check |
| 212 | Tool registry UI | Manage tools agents can call. | Agent platform tools | Tool registry endpoint | Tools list schema, auth, status | API/browser check |
| 213 | MCP connector manager | Connect external tool servers. | Agent platform MCP tab | MCP server CRUD/status endpoint | Server status and tools visible | API test |
| 214 | Agent run console | Watch agent steps live. | Agent run detail | Run event stream endpoint | Tool calls/results stream visibly | Browser/SSE test |
| 215 | Agent memory browser | Inspect reusable memory. | Agent platform memory | Memory query endpoint | Memories list with source and delete action | API/browser check |
| 216 | Automation recipe builder | Convert intent into workflow draft. | Agent platform recipes | Recipe generation endpoint | Draft workflow produced and editable | API/browser check |
| 217 | Human approval gate for agents | Control risky actions. | Agent policy settings | Agent action approval endpoint | Risky tool waits for approval | Workflow test |
| 218 | Agent evaluation harness | Compare prompts and models. | Agent platform evals | Eval run endpoint | Eval table shows scores and failures | API/browser check |
| 219 | Context budget inspector | Control token usage. | Agent run detail | Context accounting endpoint | Shows token allocation by source | API test |
| 220 | AI automation audit trail | Prove agent actions safely. | Agent run audit tab | Agent audit endpoint | Every tool call has actor, input summary, result | API/browser check |

## Feature 1 Implementation Contract

- Build a global command palette from the existing header search affordance.
- Include keyboard shortcut support, click support, route navigation, filtering, empty state, and accessible dialog semantics.
- Keep it frontend-only for the first version because the commands operate on existing routes and actions.
- Validate with frontend build/test and local Docker browser/API smoke.
