# CRM Client Contract Generator

_2026-06-22 | CRM Module_

## Problem

TD Games cần tạo hợp đồng outsourcing với khách hàng. Hiện tại soạn thủ công trên Word. Cần tích hợp vào CRM để tạo nhanh từ dữ liệu client có sẵn.

## Solution

Replicate pattern ContractGenerator.tsx từ HR module. Fullscreen modal với sidebar form + live A4 preview + print/PDF export.

## Architecture

### Files

| File | Vai trò |
|------|---------|
| `apps/crm/components/ClientContractGenerator.tsx` | Fullscreen modal component |
| `apps/crm/services/clientContractService.ts` | HTML template generator + scope template helpers |

### Reuse from HR

- `COMPANY_OPTIONS` from `apps/hr/services/contractService.ts` — TD Games / TD Consulting info
- `printContract()` from same file — browser print via hidden iframe
- A4 print CSS pattern — Times New Roman, margins, page breaks

### Storage

Save generated contracts to existing `crm_documents` table with `doc_type: 'contract'`.

## Component: ClientContractGenerator

### Props

```typescript
interface Props {
  client: CrmClient;
  contacts: CrmContact[];
  projects: CrmProject[];
  onClose: () => void;
  onSaved?: () => void;
}
```

### UI Layout

Same as HR ContractGenerator:
- Portal-based fullscreen (z-index 99999, dark overlay + blur)
- Header bar: title, client name, export button, close button
- Left sidebar (320px): form inputs
- Right area (flex-1): iframe A4 live preview

### Sidebar Form Fields

**Contract info:**
- Contract number (auto-generated: `UASA/TDG-YYMM`)
- Signing date (default today)
- Company selector: TD Games | TD Consulting

**Party A (Client) — auto-fill from CrmClient:**
- Company name
- Address
- Tax ID
- Representative name (from contacts or manual input)
- Representative position

**Project:**
- Project selector (dropdown from CrmProject[])
- Project name (manual if no project selected)

**Scope of work:**
- Dropdown "Choose from template" (localStorage)
- Textarea for scope content
- Button "Save as template"

**Timeline:**
- Start date
- Estimated duration
- Estimated completion date

**Payment:**
- Total value (number)
- Currency (USD / VND)
- Number of payment phases (2-4)
- Auto-generate phase breakdown (equal split, editable %)

### Preview

Live-updating A4 iframe. Template is bilingual (EN/VN) with 7 articles matching the sample contract structure.

### Save Flow

1. User clicks "Print / Export PDF" → browser print dialog
2. After print → prompt "Save contract?"
3. If yes → insert into `crm_documents`:
   - `client_id`: from props
   - `project_id`: selected project or null
   - `doc_type`: 'contract'
   - `title`: `UASA/TDG-YYMM — {project_name}`
   - `file_url`: '' (manual upload later if needed)
   - `notes`: metadata JSON

## Service: clientContractService.ts

### Functions

```typescript
// Generate full contract HTML
generateClientContract(data: ClientContractData): string

// Scope template CRUD (localStorage)
getScopeTemplates(): ScopeTemplate[]
saveScopeTemplate(name: string, content: string): void
deleteScopeTemplate(name: string): void

// Auto-generate contract number
generateContractNumber(prefix?: string): string

// Generate payment schedule HTML table
generatePaymentSchedule(total: number, currency: string, phases: PaymentPhase[]): string
```

### Template Structure (7 Articles)

| Article | Content | Source |
|---------|---------|--------|
| Header | National emblem + contract title + number + date | Auto |
| I | Parties info (A = client, B = TD Games) | Form + COMPANY_OPTIONS |
| II | Scope of work | Textarea |
| III | Timeline table | Form fields |
| IV | Payment (total + schedule table + bank info) | Form + fixed bank |
| V | Rights & obligations + IP | Fixed boilerplate |
| VI | General provisions (acceptance, revisions, confidentiality, disputes, termination) | Fixed boilerplate |
| VII | Final provisions | Fixed boilerplate |
| Signature | Two-column signature block | Representative names |

## Scope Templates (localStorage)

```typescript
interface ScopeTemplate {
  name: string;      // e.g. "Animation Package", "Game Art Full"
  content: string;   // HTML or plain text
  createdAt: string;
}
```

Stored in `localStorage['crm_scope_templates']` as JSON array.
Future: migrate to Supabase table if multi-user sharing needed.

## Trigger Location

Button in CRM → client detail → Documents tab or Project detail.
