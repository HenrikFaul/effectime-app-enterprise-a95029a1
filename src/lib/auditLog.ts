import { supabase } from '@/integrations/supabase/client';

interface AuditEntry {
  workspace_id: string;
  actor_id: string;
  action: string;
  affected_user_id?: string | null;
  target_id?: string | null;
  target_type?: string | null;
  metadata?: Record<string, unknown> | null;
  prev_state?: Record<string, unknown> | null;
  new_state?: Record<string, unknown> | null;
}

export async function logAuditEvent(entry: AuditEntry) {
  try {
    await supabase.from('enterprise_audit_events').insert([{
      workspace_id: entry.workspace_id,
      actor_id: entry.actor_id,
      action: entry.action,
      affected_user_id: entry.affected_user_id || null,
      target_id: entry.target_id || null,
      target_type: entry.target_type || null,
      metadata: (entry.metadata || null) as any,
      prev_state: (entry.prev_state || null) as any,
      new_state: (entry.new_state || null) as any,
    }]);
  } catch (err) {
    console.warn('Audit log insert failed:', err);
  }
}
