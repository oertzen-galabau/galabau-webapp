import type { SupabaseClient } from '@supabase/supabase-js';
import type { LeaveRequest } from '@/lib/types/database';

/** PostgREST: zwei FKs auf profiles — Embed nur über Antragsteller-FK. */
export const LEAVE_REQUEST_PROFILE_EMBED =
  'profiles!leave_requests_user_id_fkey(first_name, last_name)' as const;

export type LeaveRequestWithProfile = LeaveRequest & {
  profiles: { first_name: string; last_name: string } | null;
};

export type LeaveListResult<T> = {
  data: T[];
  error: string | null;
};

export async function listMyLeaveRequests(
  supabase: SupabaseClient,
  tenantId: string,
  userId: string,
): Promise<LeaveListResult<LeaveRequest>> {
  const { data, error } = await supabase
    .from('leave_requests')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('[leave] listMyLeaveRequests failed', error.message);
    return { data: [], error: error.message };
  }
  return { data: (data ?? []) as LeaveRequest[], error: null };
}

export async function listMyLeaveRequestsPreview(
  supabase: SupabaseClient,
  tenantId: string,
  userId: string,
  limit: number,
): Promise<LeaveListResult<Pick<LeaveRequest, 'id' | 'leave_type' | 'start_date' | 'end_date' | 'status' | 'notes'>>> {
  const { data, error } = await supabase
    .from('leave_requests')
    .select('id, leave_type, start_date, end_date, status, notes')
    .eq('tenant_id', tenantId)
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('[leave] listMyLeaveRequestsPreview failed', error.message);
    return { data: [], error: error.message };
  }
  return { data: data ?? [], error: null };
}

export async function listMyLeaveRequestsForInfoboard(
  supabase: SupabaseClient,
  tenantId: string,
  userId: string,
  limit: number,
): Promise<
  LeaveListResult<
    Pick<LeaveRequest, 'id' | 'leave_type' | 'start_date' | 'end_date' | 'status' | 'notes'> & {
      reviewed_at: string | null;
      created_at: string;
    }
  >
> {
  const { data, error } = await supabase
    .from('leave_requests')
    .select('id, leave_type, start_date, end_date, notes, status, reviewed_at, created_at')
    .eq('tenant_id', tenantId)
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('[leave] listMyLeaveRequestsForInfoboard failed', error.message);
    return { data: [], error: error.message };
  }
  return { data: data ?? [], error: null };
}

export async function listPendingLeaveForApproval(
  supabase: SupabaseClient,
  tenantId: string,
): Promise<LeaveListResult<LeaveRequestWithProfile>> {
  const { data, error } = await supabase
    .from('leave_requests')
    .select(`*, ${LEAVE_REQUEST_PROFILE_EMBED}`)
    .eq('tenant_id', tenantId)
    .eq('status', 'pending')
    .order('created_at', { ascending: true });

  if (error) {
    console.error('[leave] listPendingLeaveForApproval failed', error.message);
    return { data: [], error: error.message };
  }
  return { data: (data ?? []) as LeaveRequestWithProfile[], error: null };
}

export async function listPendingLeavePreview(
  supabase: SupabaseClient,
  tenantId: string,
  limit: number,
): Promise<
  LeaveListResult<
    Pick<LeaveRequest, 'id' | 'leave_type' | 'start_date' | 'end_date' | 'notes'> & {
      profiles: { first_name: string; last_name: string } | null;
    }
  >
> {
  const { data, error } = await supabase
    .from('leave_requests')
    .select(`id, leave_type, start_date, end_date, notes, ${LEAVE_REQUEST_PROFILE_EMBED}`)
    .eq('tenant_id', tenantId)
    .eq('status', 'pending')
    .order('created_at', { ascending: true })
    .limit(limit);

  if (error) {
    console.error('[leave] listPendingLeavePreview failed', error.message);
    return { data: [], error: error.message };
  }
  return {
    data: (data ?? []) as unknown as LeaveListResult<
      Pick<LeaveRequest, 'id' | 'leave_type' | 'start_date' | 'end_date' | 'notes'> & {
        profiles: { first_name: string; last_name: string } | null;
      }
    >['data'],
    error: null,
  };
}
