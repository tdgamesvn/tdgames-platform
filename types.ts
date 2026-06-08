
export interface ServiceItem {
  id: string;
  description: string;
  quantity: number;
  unitPrice: number;
}

export interface BankingInfo {
  alias?: string; // Tên nhận biết (Vd: "Tài khoản chính", "MB Bank Toàn")
  accountName: string;
  accountNumber: string;
  bankName: string;
  branchName: string;
  bankAddress: string;
  citadCode: string;
  swiftCode: string;
}

export interface ClientInfo {
  clientType?: 'individual' | 'company';
  name: string;
  address: string;
  contactPerson: string;
  email: string;
  taxCode?: string;
  defaultPoNumber?: string;
  defaultServiceLocation?: string;
}

/** A client saved in NocoDB */
export interface ClientRecord extends ClientInfo {
  id: string;
}

export interface StudioInfo {
  name: string;
  address: string;
  email: string;
  taxCode: string;
}

/** A studio profile saved in NocoDB */
export interface StudioRecord extends StudioInfo {
  id: string;
  isDefault: boolean;
}

export interface InvoiceData {
  id?: string;
  invoiceNumber: string;
  issueDate: string;
  dueDate: string;
  currency: 'USD' | 'VND';
  taxRate: number;
  discountType: 'percentage' | 'amount';
  discountValue: number;
  theme: 'dark' | 'light';
  status: 'pending' | 'paid' | 'cancelled';
  paidDate?: string;
  studioInfo: StudioInfo;
  clientInfo: ClientInfo;
  bankingInfo: BankingInfo;
  items: ServiceItem[];
  createdAt?: any;
  payment_method?: 'TM' | 'CK' | 'TM/CK' | 'KHAC';
  einvoice_status?: 'none' | 'draft' | 'issued' | 'failed';
  einvoice_reference_code?: string;
  einvoice_tracking_code?: string;
  einvoice_pdf_url?: string;
  einvoice_invoice_number?: string;
  amount_received?: number;
  transfer_fee?: number;
  crm_project_id?: string | null;
  billing_entity?: 'TD GAMES' | 'TD CONSULTING' | 'Cá nhân';
  receiving_account_id?: string | null;
  poNumber?: string;
  serviceLocation?: string;
}

export interface AccountUser {
  id: string;
  username: string;
  role: 'admin' | 'ke_toan' | 'hr' | 'member' | 'freelancer';
  employee_id?: string; // Links to hr_employees.id for Employee Portal
  worker_id?: string;   // Links to wf_workers.id for Freelancer Portal
}

// ── Expense Module Types ──────────────────────────────────────
export interface ExpenseCategory {
  id: string;
  name: string;
  color: string;
  icon: string;
}

export interface ExpenseRecord {
  id?: string;
  title: string;
  amount: number;
  currency: 'USD' | 'VND';
  expense_date: string;
  category_id: string | null;
  category?: ExpenseCategory;
  project: string;
  client_name: string;
  vendor: string;
  payment_method: string;
  status: 'pending' | 'approved' | 'paid';
  type?: 'expense' | 'revenue';
  source_type?: 'payroll' | 'settlement' | 'invoice' | 'manual' | 'savings' | 'loan' | null;
  source_id?: string | null;
  notes: string;
  receipt_url: string;
  created_by: string;
  account_type?: 'company' | 'personal';
  approver_id?: string | null;
  approved_at?: string | null;
  approval_note?: string;
  created_at?: string;
  updated_at?: string;
}

export interface RecurringExpense {
  id?: string;
  title: string;
  amount: number;
  currency: 'USD' | 'VND';
  category_id: string | null;
  category?: ExpenseCategory;
  project: string;
  vendor: string;
  frequency: 'monthly' | 'quarterly' | 'yearly';
  next_run: string;
  is_active: boolean;
  created_at?: string;
}

// ── Workforce Module Types ────────────────────────────────────
export interface Worker {
  id?: string;
  full_name: string;
  email: string;
  phone: string;
  type: 'freelancer' | 'inhouse';
  bank_name: string;
  bank_account: string;
  tax_code: string;
  notes: string;
  is_active: boolean;
  created_at?: string;
}

export interface WorkerContract {
  id?: string;
  worker_id: string;
  title: string;
  start_date: string;
  end_date: string | null;
  rate_type: 'per_task' | 'monthly' | 'hourly';
  rate_amount: number;
  currency: string;
  status: 'active' | 'completed' | 'terminated';
  notes: string;
  created_at?: string;
}

export interface WorkforceTask {
  id?: string;
  worker_id: string | null;
  worker?: Worker;
  project: string;
  client_name: string;
  title: string;
  clickup_task_id: string | null;
  clickup_list_id: string | null;
  clickup_status: string | null;
  clickup_space_name: string | null;
  clickup_folder_name: string | null;
  clickup_list_name: string | null;
  status: 'in_progress' | 'completed' | 'approved' | 'rejected';
  price: number;
  currency: string;
  exchange_rate: number;
  bonus: number;
  bonus_note: string;
  start_date: string | null;
  closed_date: string | null;
  completed_at: string | null;
  approved_at: string | null;
  payment_status: 'unpaid' | 'paid';
  notes: string;
  synced_at: string | null;
  client_price: number;
  client_currency: string;
  exclude_from_acceptance?: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface Settlement {
  id?: string;
  worker_id: string;
  worker?: Worker;
  period: string;
  total_tasks: number;
  total_amount: number;
  currency: string;
  status: 'draft' | 'sent' | 'accepted' | 'paid';
  expense_id: string | null;
  // Bonus trên tổng hoá đơn
  bonus_type: 'percent' | 'amount';
  bonus_value: number;
  bonus_amount: number;
  // Thuế TNCN
  tax_rate: number;
  tax_amount: number;
  net_amount: number;
  notes: string;
  account_type?: 'company' | 'personal';
  created_at?: string;
  tasks?: WorkforceTask[];
}

export interface SettlementTask {
  id?: string;
  settlement_id: string;
  task_id: string;
}

// ── Project-Based Acceptance (Nghiệm thu theo dự án) ─────────
export interface ProjectAcceptance {
  id?: string;
  project_name: string;
  client_name: string;
  period: string;
  total_tasks: number;
  total_amount: number;
  currency: string;
  status: 'draft' | 'sent' | 'accepted';
  notes: string;
  discount_type: 'amount' | 'percent';
  discount_value: number;
  account_type?: 'company' | 'personal';
  created_at?: string;
}

export interface ProjectAcceptanceTask {
  id?: string;
  acceptance_id: string;
  task_id: string;
}

// ── CRM ──────────────────────────────────────────────────────
export interface CrmContact {
  id: string;
  client_id: string;
  name: string;
  role: string;
  email: string;
  phone: string;
  is_primary: boolean;
  notes: string;
  created_at: string;
}

export interface CrmClient {
  id: string;
  name: string;
  client_type: 'company' | 'individual';
  contact_person: string;
  email: string;
  phone: string;
  address: string;
  country: string;
  tax_code: string;
  website: string;
  industry: string;
  status: 'lead' | 'contacted' | 'no_response' | 'responding' | 'negotiating' | 'contracting' | 'active' | 'paused' | 'completed' | 'lost';
  lead_source: string;
  lead_direction: string;
  lead_source_detail: string;
  notes: string;
  tags: string[];
  created_at: string;
  updated_at: string;
  contacts?: CrmContact[];
}

export interface CrmDocument {
  id: string;
  client_id: string;
  project_id?: string | null;
  doc_type: 'contract' | 'nda' | 'invoice' | 'proposal' | 'other';
  title: string;
  file_url: string;
  file_name: string;
  file_size: number;
  notes: string;
  created_at: string;
}

export interface CrmProject {
  id: string;
  client_id: string;
  name: string;
  description: string;
  status: 'active' | 'completed' | 'paused' | 'cancelled';
  start_date: string;
  end_date: string;
  budget: number;
  currency: string;
  notes: string;
  created_at: string;
  updated_at: string;
  files?: CrmProjectFile[];
}

export interface CrmProjectFile {
  id: string;
  project_id: string;
  title: string;
  file_url: string;
  file_type: 'document' | 'image' | 'link' | 'other';
  file_name: string;
  file_size: number;
  notes: string;
  created_at: string;
}

export interface CrmActivity {
  id: string;
  client_id: string;
  activity_type: 'call' | 'email' | 'meeting' | 'note' | 'status_change';
  title: string;
  description: string;
  outcome: 'positive' | 'neutral' | 'negative' | '';
  activity_date: string;
  actor: string;
  created_at: string;
}

// ── CRM Outreach (Lead-centric) ───────────────────────────────
export interface CrmOutreachLead {
  id: string;
  client_id: string | null;
  studio_name: string;
  contact_name: string;
  first_name: string;
  email: string;
  job_title: string;
  linkedin_url: string;
  tier: number; // 1=Art Director, 2=Producer, 3=CEO
  outreach_status: 'pending' | 'initial_sent' | 'followup1_sent' | 'followup2_sent' | 'replied' | 'bounced' | 'invalid_email' | 'unsubscribed';
  initial_sent_at: string | null;
  followup1_sent_at: string | null;
  followup2_sent_at: string | null;
  replied_at: string | null;
  source: string;
  trigger_source: 'generic' | 'hiring_signal' | 'intent_signal' | 'funded' | 'csv_import' | 'crm_import' | 'discovery' | 'batch_discovery' | 'manual';
  lead_score: number; // 0–100: intent=90, hiring=85, generic T1=50/T2=40/T3=30
  open_count: number;  // tăng mỗi khi Resend webhook email.opened
  click_count: number; // tăng mỗi khi Resend webhook email.clicked
  tags: string[];
  notes: string;
  created_at: string;
  updated_at: string;
}

export interface CrmEmailLog {
  id: string;
  lead_id: string;
  template_name: string;
  to_email: string;
  subject: string;
  gmail_message_id: string;
  status: 'sent' | 'delivered' | 'bounced' | 'failed';
  error_message: string;
  sent_at: string;
}

export interface CrmEmailTemplate {
  id: string;
  name: string;
  subject_lines: string[];
  html_content: string;
  delay_days: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

// ── HR Module Types ───────────────────────────────────────────

export interface HrDepartment {
  id: string;
  name: string;
  code: string;
  description: string;
  manager_id: string | null;
  is_active: boolean;
  created_at: string;
}

export interface HrEmployee {
  id: string;
  employee_code: string;
  type: 'fulltime' | 'freelancer' | 'parttime';
  status: 'active' | 'inactive' | 'offboarded' | 'blacklist';
  full_name: string;
  avatar_url: string;
  email: string;
  work_email: string;
  phone: string;
  date_of_birth: string | null;
  gender: string;
  nationality: string;
  address: string;
  temp_address: string;

  // Fulltime
  id_number: string;
  id_issue_date: string | null;
  id_issue_place: string;
  id_card_front_url: string;
  id_card_back_url: string;
  tax_code: string;
  insurance_number: string;
  department_id: string | null;
  department?: HrDepartment;
  position: string;
  level: string;
  salary: number;
  salary_currency: string;
  start_date: string | null;
  probation_end: string | null;
  official_date: string | null;

  // Freelancer
  portfolio_url: string;
  specializations: string[];
  timezone: string;
  rate_type: string;
  rate_amount: number;
  rate_currency: string;
  payment_method: string;
  payment_details: Record<string, any>;

  // Banking
  bank_name: string;
  bank_account: string;
  bank_branch: string;

  // Meta
  notes: string;
  tags: string[];
  worker_id: string | null;
  created_at: string;
  updated_at: string;
  /** Không tính vào bảng lương tự động (vd: chủ/giám đốc không nhận lương) */
  exclude_from_payroll?: boolean;
}

export interface HrContract {
  id: string;
  employee_id: string;
  contract_type: 'labor' | 'service' | 'nda' | 'appendix';
  title: string;
  contract_number: string;
  start_date: string;
  end_date: string | null;
  salary: number;
  currency: string;
  rate_type: string;
  rate_amount: number;
  file_url: string;
  status: 'active' | 'expired' | 'terminated';
  notes: string;
  created_at: string;
}

/** Biên bản bàn giao tài sản / dụng cụ làm việc (in & ký). */
export interface HrEquipmentHandover {
  id: string;
  employee_id: string;
  handover_number: string;
  handover_date: string;
  status: 'draft' | 'signed' | 'returned';
  location: string;
  giver_name: string;
  receiver_ack: string;
  notes: string;
  /** PDF biên bản đã ký (upload sau khi in/ký) */
  file_url: string;
  created_at: string;
  updated_at: string | null;
  items?: HrEquipmentHandoverItem[];
}

export interface HrEquipmentHandoverItem {
  id: string;
  handover_id: string;
  name: string;
  description: string;
  quantity: number;
  unit: string;
  serial_number: string;
  condition_notes: string;
  sort_order: number;
}

export type HrParkingVehicleType = 'motorcycle' | 'car' | 'bicycle' | 'electric_bike' | 'other';
export type HrParkingStatus = 'pending' | 'active' | 'expired' | 'cancelled';

/** Đăng ký gửi xe / làm thẻ. */
export interface HrParkingRegistration {
  id: string;
  employee_id: string;
  vehicle_type: HrParkingVehicleType;
  license_plate: string;
  vehicle_brand: string;
  vehicle_model: string;
  color: string;
  card_number: string;
  parking_area: string;
  registered_at: string | null;
  effective_from: string | null;
  effective_to: string | null;
  status: HrParkingStatus;
  notes: string;
  created_at: string;
  updated_at: string | null;
}

export interface HrPositionHistory {
  id: string;
  employee_id: string;
  change_type: 'position' | 'department' | 'salary' | 'level';
  old_value: string;
  new_value: string;
  effective_date: string;
  reason: string;
  created_at: string;
}

export interface HrEvaluation {
  id: string;
  employee_id: string;
  period: string;
  evaluator: string;
  score: number;
  strengths: string;
  weaknesses: string;
  notes: string;
  next_evaluation_date: string | null;
  status: 'pending' | 'completed';
  created_at: string;
}

export interface HrProjectHistory {
  id: string;
  employee_id: string;
  project_name: string;
  role: string;
  start_date: string | null;
  end_date: string | null;
  performance_note: string;
  created_at: string;
}

export interface HrDocument {
  id: string;
  employee_id: string;
  doc_type: string;
  title: string;
  file_url: string;
  file_name: string;
  file_size: number;
  notes: string;
  created_at: string;
}

export interface HrReminder {
  id: string;
  employee_id: string | null;
  type: 'contract_expiry' | 'birthday' | 'evaluation' | 'work_permit' | 'freelancer_payment' | 'probation_end' | 'anniversary' | 'performance_review';
  title: string;
  due_date: string;
  status: 'pending' | 'notified' | 'dismissed';
  notes: string;
  created_at: string;
}

// ── Accounting Phase 1 ────────────────────────────────────

export type AssetType = 'equipment' | 'furniture' | 'vehicle' | 'software' | 'other';
export type AssetStatus = 'active' | 'disposed' | 'written_off';

export interface FixedAsset {
  id: string;
  name: string;
  asset_type: AssetType;
  purchase_date: string;
  cost: number;
  useful_life_months: number;
  residual_value: number;
  description?: string;
  serial_number?: string;
  location?: string;
  assigned_to?: string;
  status: AssetStatus;
  disposal_date?: string;
  disposal_amount?: number;
  notes?: string;
  created_by?: string;
  created_at: string;
  updated_at: string;
}

export type AdvanceStatus = 'open' | 'settled' | 'cancelled';

export interface Advance {
  id: string;
  recipient_name: string;
  recipient_user_id?: string;
  amount: number;
  purpose: string;
  advance_date: string;
  expected_settlement_date?: string;
  status: AdvanceStatus;
  settled_amount?: number;
  returned_amount?: number;
  settlement_date?: string;
  settlement_notes?: string;
  approved_by?: string;
  notes?: string;
  created_by?: string;
  created_at: string;
  updated_at: string;
}

// ── Accounting — Bank Reconciliation Types ────────────────────
export type BankName = 'techcombank' | 'bidv';
export type BankMatchType = 'invoice' | 'expense' | 'advance';

export interface BankStatement {
  id: string;
  bank_name: BankName;
  account_number?: string;
  transaction_date: string;       // YYYY-MM-DD
  description: string;
  amount: number;                 // always positive
  transaction_type: 'debit' | 'credit';
  reference_code?: string;
  matched_type?: BankMatchType | null;
  matched_id?: string | null;
  created_at: string;
}

export interface BankStatementRow {
  transaction_date: string;
  description: string;
  amount: number;
  transaction_type: 'debit' | 'credit';
  reference_code?: string;
}

// ── Salary Components ─────────────────────────────────────

export interface HrSalaryComponent {
  id: string;
  name: string;
  code: string;
  category: 'fixed' | 'variable';
  is_bhxh: boolean;
  is_taxable: boolean;
  is_tax_exempt: boolean;
  tax_cap_yearly: number;
  description: string;
  sort_order: number;
  is_active: boolean;
  created_at: string;
}

export interface HrEmployeeSalary {
  id: string;
  employee_id: string;
  component_id: string;
  amount: number;
  note: string;
  effective_from: string;
  effective_to: string | null;
  created_at: string;
  // joined
  component?: HrSalaryComponent;
}

// ── Employee Timeline (lịch sử công tác) ──────────────────

export interface HrEmployeeTimelineEvent {
  employee_id: string;
  source: 'position_history' | 'salary' | 'contract' | 'evaluation';
  event_type: string;
  event_date: string;
  old_value: string | null;
  new_value: string | null;
  notes: string | null;
  amount: number | null;
  currency: string | null;
  created_at: string;
}

// ── Dependents (Người phụ thuộc) ──────────────────────────

export interface HrDependent {
  id: string;
  employee_id: string;
  full_name: string;
  relationship: 'parent' | 'child' | 'spouse' | 'other';
  date_of_birth: string | null;
  id_number: string;
  tax_code: string;
  deduction_from: string | null;
  deduction_to: string | null;
  status: 'active' | 'inactive';
  notes: string;
  created_at: string;
  // joined
  documents?: HrDependentDocument[];
}

export interface HrDependentDocument {
  id: string;
  dependent_id: string;
  doc_type: string;
  file_url: string;
  file_name: string;
  notes: string;
  created_at: string;
}

// ══════════════════════════════════════════════════════════
// ── Attendance (Chấm công) ────────────────────────────────
// ══════════════════════════════════════════════════════════

export interface AttShift {
  id: string;
  name: string;
  shift_type: 'fixed' | 'rotating' | 'project';
  start_time: string;          // HH:mm
  end_time: string;
  break_minutes: number;
  late_threshold_minutes: number;
  early_threshold_minutes: number;
  overtime_after_minutes: number;
  applicable_days: string[];   // ['mon','tue',...]
  is_active: boolean;
  created_at: string;
}

export interface AttEmployeeShift {
  id: string;
  employee_id: string;
  shift_id: string;
  effective_from: string;
  effective_to: string | null;
  created_at: string;
  // joined
  shift?: AttShift;
  employee?: HrEmployee;
}

export interface AttRecord {
  id: string;
  employee_id: string;
  date: string;
  check_in: string | null;
  check_out: string | null;
  method: 'manual' | 'qr' | 'wifi';
  shift_id: string | null;
  status: 'present' | 'late' | 'early_leave' | 'absent' | 'half_day';
  late_minutes: number;
  early_minutes: number;
  overtime_minutes: number;
  note: string;
  approved_by: string | null;
  created_at: string;
  // joined
  employee?: HrEmployee;
  shift?: AttShift;
}

export interface AttRequest {
  id: string;
  employee_id: string;
  request_type: 'leave' | 'late' | 'early' | 'forgot' | 'overtime';
  date_from: string;
  date_to: string;
  reason: string;
  status: 'pending' | 'approved' | 'rejected';
  approved_by: string | null;
  approved_at: string | null;
  reviewer_note: string;
  leave_type: 'annual' | 'unpaid' | 'birthday' | 'remote';
  leave_days: number;
  leave_hours?: number | null;
  time_from?: string | null;
  time_to?: string | null;
  created_at: string;
  // joined
  employee?: HrEmployee;
}

export interface AttQrSession {
  id: string;
  token: string;
  shift_id: string | null;
  valid_from: string;
  valid_to: string;
  wifi_ssid: string | null;
  created_by: string | null;
  created_at: string;
  // joined
  shift?: AttShift;
}

export interface AttMonthlySheet {
  id: string;
  month: number;
  year: number;
  title: string;
  status: 'draft' | 'finalized';
  notes: string;
  created_at: string;
}

export interface AttMonthlyRecord {
  id: string;
  sheet_id: string;
  employee_id: string;
  work_days: number;         // decimal e.g. 12.56
  ot_hours: number;
  late_count: number;
  absent_days: number;
  note: string;
  created_at: string;
  // joined
  employee?: HrEmployee;
}

// ══════════════════════════════════════════════════════════
// ── Payroll (Tính lương) ──────────────────────────────────
// ══════════════════════════════════════════════════════════

/** Một bậc thuế lũy tiến (limit = null nghĩa là bậc cuối, vô hạn). */
export interface PayrollTaxBracketRow {
  limit: number | null;
  rate: number;
  deduction: number;
}

/** Dòng DB: bộ thông số công thức (AMIS-style: nhiều bản theo effective_from). */
export interface PayPayrollFormulaSettings {
  id: string;
  name: string;
  effective_from: string;
  standard_work_days: number;
  hours_per_day: number;
  bh_employee_rate: number;
  bh_company_rate: number;
  personal_deduction: number;
  dependent_deduction: number;
  ot_rate_weekday: number;
  probation_pit_rate: number;
  tax_brackets: PayrollTaxBracketRow[];
  notes: string | null;
  created_at: string;
  updated_at: string | null;
}

/** Đã chuẩn hoá để đưa vào calculatePayroll (limit số, bậc cuối = Infinity). */
export interface PayrollFormulaConfig {
  standardWorkDays: number;
  hoursPerDay: number;
  bhEmployeeRate: number;
  bhCompanyRate: number;
  personalDeduction: number;
  dependentDeduction: number;
  otRateWeekday: number;
  probationPitRate: number;
  taxBrackets: { limit: number; rate: number; deduction: number }[];
}

export interface PayPayrollSheet {
  id: string;
  month: number;
  year: number;
  title: string;
  status: 'draft' | 'confirmed' | 'paid';
  created_at: string;
  updated_at?: string | null;
  confirmed_at?: string | null;
  paid_at?: string | null;
  confirmed_by?: string | null;
  paid_by?: string | null;
  formula_settings_id?: string | null;
  /** Số ngày T2-T6 trong tháng — tính động khi tạo bảng, lưu cố định để recalculate dùng lại. */
  standard_work_days?: number | null;
}

export interface PayPayrollRecord {
  id: string;
  sheet_id: string;
  employee_id: string;
  // INPUT
  work_days: number;
  base_salary: number;
  lunch_allowance: number;
  transport_allowance: number;
  phone_allowance: number;
  clothing_allowance: number;
  kpi_allowance: number;
  default_ot: number;
  extra_ot_hours: number;
  extra_ot: number;
  dependents_count: number;
  is_probation: boolean;
  /** Tỷ lệ ngày thử việc trong tháng (0 = full official, 1 = full probation, 0<x<1 = tháng chuyển giao) */
  probation_ratio: number;
  /** Thưởng KPI nhập tay — cộng thẳng vào net, không tính thuế/BH */
  bonus: number;
  /** Lý do thưởng — ví dụ: "Thưởng KPI Q2", "Thưởng dự án X" */
  bonus_reason?: string | null;
  // EMPLOYEE ACKNOWLEDGEMENT
  /** Trạng thái xác nhận của nhân viên: pending / confirmed / disputed / resolved */
  employee_status?: 'pending' | 'confirmed' | 'disputed' | 'resolved';
  /** Thời điểm nhân viên xác nhận */
  employee_confirmed_at?: string | null;
  /** Nội dung khiếu nại / ghi chú của nhân viên */
  employee_comment?: string | null;
  // OUTPUT
  gross_ref: number;
  gross_actual: number;
  employee_bhxh: number;
  taxable_income: number;
  assessable_income: number;
  pit: number;
  net_salary: number;
  company_bhxh: number;
  total_company_cost: number;
  note: string;
  created_at: string;
  // joined
  employee?: HrEmployee;
}

// ══════════════════════════════════════════════════════════
// ── Leave Balance (Ngày phép) ─────────────────────────────
// ══════════════════════════════════════════════════════════

// ══════════════════════════════════════════════════════════
// ── Accounting — Savings & Loans ──────────────────────────
// ══════════════════════════════════════════════════════════

export interface SavingsDeposit {
  id?: string;
  bank_name: string;
  account_number?: string;
  principal: number;
  currency: 'VND' | 'USD';
  interest_rate: number;
  term_months: number;
  start_date: string;
  maturity_date: string;
  status: 'active' | 'matured' | 'withdrawn' | 'renewed';
  interest_earned?: number | null;
  notes?: string;
  parent_id?: string | null;
  created_by: string;
  created_at?: string;
}

export interface LoanRecord {
  id?: string;
  lender_name: string;
  principal: number;
  currency: 'VND' | 'USD';
  interest_rate: number;
  term_months: number;
  start_date: string;
  due_date: string;
  outstanding: number;
  status: 'active' | 'paid_off' | 'overdue';
  notes?: string;
  created_by: string;
  created_at?: string;
}

export interface LeaveBalance {
  id: string;
  employee_id: string;
  year: number;
  quarter: number;
  accrued_days: number;
  used_days: number;
  expired_days: number;
  created_at: string;
}

// ══════════════════════════════════════════════════════════
// ── Employee Evaluation v2 ────────────────────────────────
// ══════════════════════════════════════════════════════════

export interface EvalGroup {
  name: string;
  weight: number;       // 35, 30, 20, 15 — sum = 100
  scores: number[];     // per-criterion scores 1–5
  group_avg: number;    // sum(scores)/scores.length
}

export type EvalPeriodType = 'probation' | 'semi_annual';

export type EvalStatus =
  | 'pending_self'    // waiting for employee self-assessment
  | 'pending_leader'  // waiting for leader evaluation
  | 'pending_1on1'    // gap > 1.0 → needs 1-on-1 session
  | 'completed';

export type EvalRating =
  | 'excellent'          // ≥ 4.0  → Vượt kỳ vọng
  | 'good'               // 3.0–3.9 → Đạt yêu cầu
  | 'meets'              // 2.0–2.9 → Cần cải thiện
  | 'needs_improvement'; // < 2.0   → Không đạt

export interface HrEvaluationCycle {
  id: string;
  employee_id: string;
  period_type: EvalPeriodType;
  period_label: string;           // e.g. "Thử việc T6/2026"
  status: EvalStatus;
  leader_user_id: string;
  deadline: string;               // ISO datetime — hạn nộp tự đánh giá
  self_submitted_at: string | null;
  leader_submitted_at: string | null;
  completed_at: string | null;
  requires_1on1: boolean;
  created_by: string;
  created_at: string;
  // joined
  employee?: HrEmployee;
}

export interface HrEvaluationSubmission {
  id: string;
  cycle_id: string;
  evaluator_role: 'self' | 'leader';
  evaluator_user_id: string;
  groups: EvalGroup[];
  total_score: number;
  rating: EvalRating;
  comments: string;
  recommended_action: string;
  submitted_at: string;
}
