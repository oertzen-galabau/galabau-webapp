export type UserRole = 'superadmin' | 'verwaltung' | 'administrator' | 'vorarbeiter' | 'mitarbeiter';
export type TenantStatus = 'active' | 'suspended' | 'trial';
export type LeaveType = 'urlaub' | 'krankheit' | 'arzt' | 'amt' | 'sonstige' | 'schule';
export type PayrollBookingUnit = 'hours' | 'eur';
export type PayrollBookingSource = 'auto' | 'manual';
export type LeaveStatus = 'pending' | 'approved' | 'rejected';
export type ReportStatus = 'draft' | 'final' | 'sent';
export type ClothingStatus = 'pending' | 'ordered' | 'delivered';
export type TimeEntryApprovalStatus = 'pending' | 'approved' | 'rejected';

export type Tenant = {
  id: string;
  slug: string;
  name: string;
  logo_url: string | null;
  brand_color: string;
  accent_color: string;
  sidebar_color: string;
  sidebar_text_color: string;
  surface_color: string;
  default_start_password: string | null;
  default_clothing_order_budget_eur: number | null;
  status: TenantStatus;
  plan: string;
  created_at: string;
  updated_at: string;
};

export type Profile = {
  id: string;
  tenant_id: string | null;
  tenant_role_id: string | null;
  role: UserRole;
  first_name: string;
  last_name: string;
  email: string;
  phone: string | null;
  personnel_number: string | null;
  payroll_flags: Record<string, unknown>;
  salutation: string | null;
  address: string | null;
  zip_code: string | null;
  city: string | null;
  birthday: string | null;
  entry_date: string | null;
  exit_date: string | null;
  job_title: string | null;
  is_active: boolean;
  must_change_password: boolean;
  dashboard_layout: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
};

export type EmployeeInvitation = {
  id: string;
  tenant_id: string;
  user_id: string;
  token_hash: string;
  expires_at: string;
  created_by: string | null;
  revoked_at: string | null;
  used_at: string | null;
  created_at: string;
};

export type EmployeeNote = {
  id: string;
  tenant_id: string;
  user_id: string;
  content: string;
  created_by: string | null;
  created_at: string;
};

export type TenantRole = {
  id: string;
  tenant_id: string;
  name: string;
  slug: string;
  is_system: boolean;
  sort_order: number;
  created_at: string;
};

export type TenantRolePermission = {
  tenant_role_id: string;
  permission_key: string;
  granted: boolean;
};

export type Site = {
  id: string;
  tenant_id: string;
  name: string;
  street: string | null;
  zip_code: string | null;
  city: string | null;
  address: string | null;
  directions: string | null;
  default_travel_minutes: number;
  latitude: number | null;
  longitude: number | null;
  geocoded_at: string | null;
  client_name: string | null;
  start_date: string | null;
  end_date: string | null;
  notes: string | null;
  responsible_user_id: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type TimeEntry = {
  id: string;
  tenant_id: string;
  user_id: string;
  site_id: string | null;
  work_date: string;
  start_time: string | null;
  end_time: string | null;
  breakfast_start: string | null;
  breakfast_end: string | null;
  lunch_start: string | null;
  lunch_end: string | null;
  travel_minutes: number;
  work_minutes: number;
  is_driver: boolean | null;
  bad_weather_claimed: boolean;
  bad_weather_confirmed: boolean | null;
  notes: string | null;
  approval_status: TimeEntryApprovalStatus | null;
  rejection_reason: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  submitted_at: string | null;
  missing_breakfast_reason: string | null;
  missing_lunch_reason: string | null;
};

export type TimeBlockType = 'site_work' | 'travel' | 'breakfast' | 'lunch' | 'other_work';

export type TenantTimeTrackingRules = {
  tenant_id: string;
  breakfast_enabled: boolean;
  breakfast_min_work_minutes: number;
  breakfast_expected_minutes: number;
  breakfast_window_start: string;
  breakfast_window_end: string;
  lunch_enabled: boolean;
  lunch_min_work_minutes: number;
  lunch_expected_minutes: number;
  lunch_window_start: string;
  lunch_window_end: string;
  updated_at: string;
};

export type LeaveRequest = {
  id: string;
  tenant_id: string;
  user_id: string;
  leave_type: LeaveType;
  start_date: string;
  end_date: string;
  status: LeaveStatus;
  notes: string | null;
};

export type PayrollBookingCode = {
  id: string;
  tenant_id: string;
  code: string;
  label: string;
  unit: PayrollBookingUnit;
  is_tax_free: boolean;
  is_active: boolean;
  is_system: boolean;
  sort_order: number;
};

export type PayrollTenantRule = {
  id: string;
  tenant_id: string;
  rule_key: string;
  enabled: boolean;
  config: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

export type PayrollBooking = {
  id: string;
  tenant_id: string;
  user_id: string;
  booking_code: string;
  quantity: number;
  unit: PayrollBookingUnit;
  source: PayrollBookingSource;
  time_entry_id: string | null;
  leave_request_id: string | null;
  work_date: string;
  notes: string | null;
  is_locked: boolean;
  created_at: string;
  updated_at: string;
};

export type TimeEntrySegment = {
  id: string;
  tenant_id: string;
  time_entry_id: string;
  site_id: string | null;
  block_type: TimeBlockType;
  travel_minutes: number;
  start_time: string | null;
  end_time: string | null;
  sort_order: number;
};

export type BadWeatherDay = {
  id: string;
  tenant_id: string;
  work_date: string;
  site_id: string | null;
  marked_by: string;
  notes: string | null;
};

export type PayrollSeasonConfig = {
  id: string;
  tenant_id: string;
  month: number;
  weekday: number;
  max_hours: number;
};

export type PayrollFlags = {
  lkw_hours?: boolean;
};

export type BookingPreviewLine = {
  booking_code: string;
  label: string;
  quantity: number;
  unit: PayrollBookingUnit;
  notes?: string;
};

export type DailyLog = {
  id: string;
  tenant_id: string;
  site_id: string;
  log_date: string;
  weather: string | null;
  notes: string | null;
  created_by: string | null;
  dictation_transcript: string | null;
  dictation_extraction: Record<string, unknown> | null;
};

export type DailyLogWork = {
  id: string;
  tenant_id: string;
  daily_log_id: string;
  description: string;
  worker_hours: number;
  quantity: number | null;
  unit: string | null;
  created_at: string;
};

export type EquipmentHours = {
  id: string;
  tenant_id: string;
  daily_log_id: string;
  equipment_name: string;
  hours: number;
  quantity: number | null;
  unit: string | null;
  created_at: string;
};

export type DailyLogWorkerHours = {
  id: string;
  tenant_id: string;
  daily_log_id: string;
  user_id: string | null;
  worker_name: string;
  job_title: string | null;
  hours: number;
  created_at: string;
};

export type DailyLogSignatureRole = 'contractor' | 'client';

export type DailyLogSignature = {
  id: string;
  tenant_id: string;
  daily_log_id: string;
  role: DailyLogSignatureRole;
  signer_name: string | null;
  file_url: string;
  signed_at: string;
  created_at: string;
};

export const REPORT_UNIT_OPTIONS = ['Std.', 'm', 'm²', 'm³', 'kg', 't'] as const;
export type ReportUnit = (typeof REPORT_UNIT_OPTIONS)[number];

export const MIN_REPORT_PHOTOS = 3;
export const MAX_REPORT_PHOTOS = 10;

export type DeliveryNoteExtractionStatus = 'pending' | 'success' | 'failed' | 'manual';

export type DeliveryNote = {
  id: string;
  tenant_id: string;
  daily_log_id: string;
  supplier_name: string | null;
  description: string | null;
  file_url: string | null;
  delivery_note_number: string | null;
  delivery_date: string | null;
  extraction_status: DeliveryNoteExtractionStatus;
  raw_extraction: Record<string, unknown> | null;
  deleted_at: string | null;
  deleted_by: string | null;
  created_at: string;
};

export type DailyLogPhoto = {
  id: string;
  tenant_id: string;
  daily_log_id: string;
  file_url: string;
  caption: string | null;
  uploaded_by: string | null;
  deleted_at: string | null;
  deleted_by: string | null;
  created_at: string;
};

export type SubcontractorEntry = {
  id: string;
  tenant_id: string;
  daily_log_id: string;
  company_name: string;
  work_description: string | null;
  hours: number | null;
  deleted_at: string | null;
  deleted_by: string | null;
  created_at: string;
};

export type DeleterProfile = {
  first_name: string;
  last_name: string;
};

export type DeliveryNoteItem = {
  id: string;
  tenant_id: string;
  delivery_note_id: string;
  position: number;
  description: string;
  quantity: number | null;
  unit: string | null;
  created_at: string;
};

export type Report = {
  id: string;
  tenant_id: string;
  site_id: string;
  daily_log_id: string | null;
  report_date: string;
  status: ReportStatus;
  pdf_url: string | null;
  sent_to: string | null;
  sent_at: string | null;
};

export type Message = {
  id: string;
  tenant_id: string;
  sender_id: string;
  recipient_id: string;
  body: string;
  delivered_at: string | null;
  read_at: string | null;
  created_at: string;
};

export type ClothingOrder = {
  id: string;
  tenant_id: string;
  user_id: string;
  item_type: string;
  size: string;
  quantity: number;
  status: ClothingStatus;
  notes: string | null;
  created_at: string;
};

export type OrderCatalogSizeKind = 'clothing' | 'shoes';

export type OrderCatalogCategorySizeKind = OrderCatalogSizeKind | 'custom';

export type OrderCatalogSizeOption = {
  id: string;
  tenant_id: string;
  kind: OrderCatalogSizeKind;
  value: string;
  sort_order: number;
  created_at: string;
};

export type OrderCatalogCategory = {
  id: string;
  tenant_id: string;
  name: string;
  sort_order: number;
  size_kind: OrderCatalogCategorySizeKind;
  created_at: string;
};

export type OrderCatalogItem = {
  id: string;
  tenant_id: string;
  category_id: string;
  article_number: string | null;
  clothing_style: string;
  series: string | null;
  price: number | null;
  shop_url: string | null;
  sizes: string[];
  is_active: boolean;
  shop_imported_at: string | null;
  created_at: string;
  updated_at: string;
};

export type ClothingOrderBudget = {
  tenant_id: string;
  user_id: string;
  year: number;
  budget_eur: number;
  created_at: string;
  updated_at: string;
};

export type CatalogOrder = {
  id: string;
  tenant_id: string;
  user_id: string;
  status: ClothingStatus;
  total_eur: number;
  budget_covered_eur: number;
  own_share_eur: number;
  budget_year: number;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type CatalogOrderItem = {
  id: string;
  order_id: string;
  tenant_id: string;
  catalog_item_id: string;
  category_name: string;
  article_number: string | null;
  clothing_style: string;
  series: string | null;
  unit_price_eur: number | null;
  size: string;
  quantity: number;
  name_print: string | null;
  line_total_eur: number;
  sort_order: number;
};

export type InfoboardPost = {
  id: string;
  tenant_id: string;
  title: string;
  content: string;
  post_type: string;
  published_at: string;
};

export type TenantTheme = {
  name: string;
  logoUrl: string | null;
  brandColor: string;
  accentColor: string;
  sidebarColor: string;
  sidebarTextColor: string;
  surfaceColor: string;
};

export type PasswordResetCode = {
  id: string;
  user_id: string;
  email: string;
  code_hash: string;
  expires_at: string;
  attempts: number;
  used_at: string | null;
  created_at: string;
};
