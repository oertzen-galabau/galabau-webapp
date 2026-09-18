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
  created_at: string;
  updated_at: string;
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
  site_id: string;
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
};

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
