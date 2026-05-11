export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      account_deletions: {
        Row: {
          account_created_at: string
          deleted_at: string
          deletion_reason: string
          email: string
          id: string
          user_id: string
        }
        Insert: {
          account_created_at: string
          deleted_at?: string
          deletion_reason: string
          email: string
          id?: string
          user_id: string
        }
        Update: {
          account_created_at?: string
          deleted_at?: string
          deletion_reason?: string
          email?: string
          id?: string
          user_id?: string
        }
        Relationships: []
      }
      approval_decisions: {
        Row: {
          comment: string | null
          created_at: string
          decided_by: string
          decision: Database["public"]["Enums"]["leave_request_status"]
          id: string
          leave_request_id: string
          workspace_id: string
        }
        Insert: {
          comment?: string | null
          created_at?: string
          decided_by: string
          decision: Database["public"]["Enums"]["leave_request_status"]
          id?: string
          leave_request_id: string
          workspace_id: string
        }
        Update: {
          comment?: string | null
          created_at?: string
          decided_by?: string
          decision?: Database["public"]["Enums"]["leave_request_status"]
          id?: string
          leave_request_id?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "approval_decisions_leave_request_id_fkey"
            columns: ["leave_request_id"]
            isOneToOne: false
            referencedRelation: "leave_requests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "approval_decisions_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "enterprise_org_pulse_membership"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "approval_decisions_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "enterprise_workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      email_send_log: {
        Row: {
          created_at: string
          error_message: string | null
          id: string
          message_id: string | null
          metadata: Json | null
          recipient_email: string
          status: string
          template_name: string
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          id?: string
          message_id?: string | null
          metadata?: Json | null
          recipient_email: string
          status: string
          template_name: string
        }
        Update: {
          created_at?: string
          error_message?: string | null
          id?: string
          message_id?: string | null
          metadata?: Json | null
          recipient_email?: string
          status?: string
          template_name?: string
        }
        Relationships: []
      }
      email_send_state: {
        Row: {
          auth_email_ttl_minutes: number
          batch_size: number
          id: number
          retry_after_until: string | null
          send_delay_ms: number
          transactional_email_ttl_minutes: number
          updated_at: string
        }
        Insert: {
          auth_email_ttl_minutes?: number
          batch_size?: number
          id?: number
          retry_after_until?: string | null
          send_delay_ms?: number
          transactional_email_ttl_minutes?: number
          updated_at?: string
        }
        Update: {
          auth_email_ttl_minutes?: number
          batch_size?: number
          id?: number
          retry_after_until?: string | null
          send_delay_ms?: number
          transactional_email_ttl_minutes?: number
          updated_at?: string
        }
        Relationships: []
      }
      email_unsubscribe_tokens: {
        Row: {
          created_at: string
          email: string
          id: string
          token: string
          used_at: string | null
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          token: string
          used_at?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          token?: string
          used_at?: string | null
        }
        Relationships: []
      }
      enterprise_access_decisions: {
        Row: {
          action: string
          actor_id: string | null
          at: string
          expected_outcome: string | null
          id: string
          observed_outcome: string | null
          rationale: string | null
          request_id: string
        }
        Insert: {
          action: string
          actor_id?: string | null
          at?: string
          expected_outcome?: string | null
          id?: string
          observed_outcome?: string | null
          rationale?: string | null
          request_id: string
        }
        Update: {
          action?: string
          actor_id?: string | null
          at?: string
          expected_outcome?: string | null
          id?: string
          observed_outcome?: string | null
          rationale?: string | null
          request_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "enterprise_access_decisions_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "enterprise_access_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      enterprise_access_requests: {
        Row: {
          approver_id: string | null
          created_at: string
          decided_at: string | null
          decided_by: string | null
          id: string
          member_id: string
          owner_id: string | null
          reason: string | null
          requested_at: string
          requested_by: string | null
          status: string
          system_id: string
          template_id: string | null
          updated_at: string
          workspace_id: string
        }
        Insert: {
          approver_id?: string | null
          created_at?: string
          decided_at?: string | null
          decided_by?: string | null
          id?: string
          member_id: string
          owner_id?: string | null
          reason?: string | null
          requested_at?: string
          requested_by?: string | null
          status?: string
          system_id: string
          template_id?: string | null
          updated_at?: string
          workspace_id: string
        }
        Update: {
          approver_id?: string | null
          created_at?: string
          decided_at?: string | null
          decided_by?: string | null
          id?: string
          member_id?: string
          owner_id?: string | null
          reason?: string | null
          requested_at?: string
          requested_by?: string | null
          status?: string
          system_id?: string
          template_id?: string | null
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "enterprise_access_requests_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "enterprise_memberships"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "enterprise_access_requests_system_id_fkey"
            columns: ["system_id"]
            isOneToOne: false
            referencedRelation: "enterprise_access_systems"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "enterprise_access_requests_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "enterprise_access_templates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "enterprise_access_requests_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "enterprise_org_pulse_membership"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "enterprise_access_requests_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "enterprise_workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      enterprise_access_systems: {
        Row: {
          archived_at: string | null
          created_at: string
          default_approver_role: string | null
          default_owner_role: string | null
          description: string | null
          id: string
          kind: string
          name: string
          updated_at: string
          workspace_id: string
        }
        Insert: {
          archived_at?: string | null
          created_at?: string
          default_approver_role?: string | null
          default_owner_role?: string | null
          description?: string | null
          id?: string
          kind?: string
          name: string
          updated_at?: string
          workspace_id: string
        }
        Update: {
          archived_at?: string | null
          created_at?: string
          default_approver_role?: string | null
          default_owner_role?: string | null
          description?: string | null
          id?: string
          kind?: string
          name?: string
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "enterprise_access_systems_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "enterprise_org_pulse_membership"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "enterprise_access_systems_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "enterprise_workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      enterprise_access_template_systems: {
        Row: {
          created_at: string
          id: string
          mandatory: boolean
          optional: boolean
          sort_order: number
          system_id: string
          template_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          mandatory?: boolean
          optional?: boolean
          sort_order?: number
          system_id: string
          template_id: string
        }
        Update: {
          created_at?: string
          id?: string
          mandatory?: boolean
          optional?: boolean
          sort_order?: number
          system_id?: string
          template_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "enterprise_access_template_systems_system_id_fkey"
            columns: ["system_id"]
            isOneToOne: false
            referencedRelation: "enterprise_access_systems"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "enterprise_access_template_systems_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "enterprise_access_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      enterprise_access_templates: {
        Row: {
          archived_at: string | null
          created_at: string
          id: string
          name: string
          scope_org_unit_id: string | null
          scope_position_id: string | null
          updated_at: string
          workspace_id: string
        }
        Insert: {
          archived_at?: string | null
          created_at?: string
          id?: string
          name: string
          scope_org_unit_id?: string | null
          scope_position_id?: string | null
          updated_at?: string
          workspace_id: string
        }
        Update: {
          archived_at?: string | null
          created_at?: string
          id?: string
          name?: string
          scope_org_unit_id?: string | null
          scope_position_id?: string | null
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "enterprise_access_templates_scope_org_unit_id_fkey"
            columns: ["scope_org_unit_id"]
            isOneToOne: false
            referencedRelation: "enterprise_org_units"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "enterprise_access_templates_scope_position_id_fkey"
            columns: ["scope_position_id"]
            isOneToOne: false
            referencedRelation: "enterprise_workspace_roles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "enterprise_access_templates_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "enterprise_org_pulse_membership"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "enterprise_access_templates_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "enterprise_workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      enterprise_agile_capacity_events: {
        Row: {
          auto_action_taken: string | null
          created_at: string
          created_by: string | null
          details: Json
          event_type: string
          id: string
          impact_summary: string
          integration_id: string
          issue_key: string | null
          risk_level: string
          workspace_id: string
        }
        Insert: {
          auto_action_taken?: string | null
          created_at?: string
          created_by?: string | null
          details?: Json
          event_type: string
          id?: string
          impact_summary: string
          integration_id: string
          issue_key?: string | null
          risk_level?: string
          workspace_id: string
        }
        Update: {
          auto_action_taken?: string | null
          created_at?: string
          created_by?: string | null
          details?: Json
          event_type?: string
          id?: string
          impact_summary?: string
          integration_id?: string
          issue_key?: string | null
          risk_level?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "enterprise_agile_capacity_events_integration_id_fkey"
            columns: ["integration_id"]
            isOneToOne: false
            referencedRelation: "enterprise_workspace_integrations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "enterprise_agile_capacity_events_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "enterprise_org_pulse_membership"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "enterprise_agile_capacity_events_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "enterprise_workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      enterprise_agile_external_field_mappings: {
        Row: {
          created_at: string
          created_by: string | null
          external_field_id: string
          id: string
          integration_id: string
          is_required: boolean
          is_safe_writeback: boolean
          normalized_field: string
          provider: string
          sync_direction: string
          updated_at: string
          workspace_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          external_field_id: string
          id?: string
          integration_id: string
          is_required?: boolean
          is_safe_writeback?: boolean
          normalized_field: string
          provider: string
          sync_direction?: string
          updated_at?: string
          workspace_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          external_field_id?: string
          id?: string
          integration_id?: string
          is_required?: boolean
          is_safe_writeback?: boolean
          normalized_field?: string
          provider?: string
          sync_direction?: string
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "enterprise_agile_external_field_mappings_integration_id_fkey"
            columns: ["integration_id"]
            isOneToOne: false
            referencedRelation: "enterprise_workspace_integrations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "enterprise_agile_external_field_mappings_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "enterprise_org_pulse_membership"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "enterprise_agile_external_field_mappings_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "enterprise_workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      enterprise_agile_field_metadata: {
        Row: {
          discovered_at: string
          field_id: string
          field_name: string
          field_type: string | null
          id: string
          integration_id: string
          is_custom: boolean
          project_key: string | null
          provider: string
          schema: Json | null
          workspace_id: string
        }
        Insert: {
          discovered_at?: string
          field_id: string
          field_name: string
          field_type?: string | null
          id?: string
          integration_id: string
          is_custom?: boolean
          project_key?: string | null
          provider: string
          schema?: Json | null
          workspace_id: string
        }
        Update: {
          discovered_at?: string
          field_id?: string
          field_name?: string
          field_type?: string | null
          id?: string
          integration_id?: string
          is_custom?: boolean
          project_key?: string | null
          provider?: string
          schema?: Json | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "enterprise_agile_field_metadata_integration_id_fkey"
            columns: ["integration_id"]
            isOneToOne: false
            referencedRelation: "enterprise_workspace_integrations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "enterprise_agile_field_metadata_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "enterprise_org_pulse_membership"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "enterprise_agile_field_metadata_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "enterprise_workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      enterprise_agile_issues: {
        Row: {
          assignee_email: string | null
          assignee_name: string | null
          capacity_risk: string | null
          completed_hours: number | null
          components: string[] | null
          created_at: string
          critical_path: boolean
          custom_fields: Json | null
          dependency_keys: string[] | null
          description: string | null
          due_date: string | null
          external_id: string | null
          external_key: string
          external_type: string | null
          external_updated_at: string | null
          fit_score: number | null
          gantt_color: string | null
          gantt_row_order: number | null
          id: string
          integration_id: string
          is_milestone: boolean
          issue_type: string | null
          iteration_path: string | null
          labels: string[] | null
          last_synced_at: string
          original_estimate_hours: number | null
          parent_key: string | null
          plan_impact_reason: string | null
          priority: string | null
          progress_pct: number | null
          project_key: string | null
          provider: string
          raw: Json | null
          remaining_hours: number | null
          reporter_email: string | null
          sprint_name: string | null
          start_date: string | null
          status: string | null
          story_points: number | null
          suggested_role: string | null
          summary: string | null
          target_sprint: string | null
          team_name: string | null
          updated_at: string
          url: string | null
          workspace_id: string
        }
        Insert: {
          assignee_email?: string | null
          assignee_name?: string | null
          capacity_risk?: string | null
          completed_hours?: number | null
          components?: string[] | null
          created_at?: string
          critical_path?: boolean
          custom_fields?: Json | null
          dependency_keys?: string[] | null
          description?: string | null
          due_date?: string | null
          external_id?: string | null
          external_key: string
          external_type?: string | null
          external_updated_at?: string | null
          fit_score?: number | null
          gantt_color?: string | null
          gantt_row_order?: number | null
          id?: string
          integration_id: string
          is_milestone?: boolean
          issue_type?: string | null
          iteration_path?: string | null
          labels?: string[] | null
          last_synced_at?: string
          original_estimate_hours?: number | null
          parent_key?: string | null
          plan_impact_reason?: string | null
          priority?: string | null
          progress_pct?: number | null
          project_key?: string | null
          provider: string
          raw?: Json | null
          remaining_hours?: number | null
          reporter_email?: string | null
          sprint_name?: string | null
          start_date?: string | null
          status?: string | null
          story_points?: number | null
          suggested_role?: string | null
          summary?: string | null
          target_sprint?: string | null
          team_name?: string | null
          updated_at?: string
          url?: string | null
          workspace_id: string
        }
        Update: {
          assignee_email?: string | null
          assignee_name?: string | null
          capacity_risk?: string | null
          completed_hours?: number | null
          components?: string[] | null
          created_at?: string
          critical_path?: boolean
          custom_fields?: Json | null
          dependency_keys?: string[] | null
          description?: string | null
          due_date?: string | null
          external_id?: string | null
          external_key?: string
          external_type?: string | null
          external_updated_at?: string | null
          fit_score?: number | null
          gantt_color?: string | null
          gantt_row_order?: number | null
          id?: string
          integration_id?: string
          is_milestone?: boolean
          issue_type?: string | null
          iteration_path?: string | null
          labels?: string[] | null
          last_synced_at?: string
          original_estimate_hours?: number | null
          parent_key?: string | null
          plan_impact_reason?: string | null
          priority?: string | null
          progress_pct?: number | null
          project_key?: string | null
          provider?: string
          raw?: Json | null
          remaining_hours?: number | null
          reporter_email?: string | null
          sprint_name?: string | null
          start_date?: string | null
          status?: string | null
          story_points?: number | null
          suggested_role?: string | null
          summary?: string | null
          target_sprint?: string | null
          team_name?: string | null
          updated_at?: string
          url?: string | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "enterprise_agile_issues_integration_id_fkey"
            columns: ["integration_id"]
            isOneToOne: false
            referencedRelation: "enterprise_workspace_integrations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "enterprise_agile_issues_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "enterprise_org_pulse_membership"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "enterprise_agile_issues_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "enterprise_workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      enterprise_agile_sync_log: {
        Row: {
          created_at: string
          details: Json | null
          error_message: string | null
          event: string
          id: string
          integration_id: string
          status: string
          triggered_by: string | null
          workspace_id: string
        }
        Insert: {
          created_at?: string
          details?: Json | null
          error_message?: string | null
          event: string
          id?: string
          integration_id: string
          status: string
          triggered_by?: string | null
          workspace_id: string
        }
        Update: {
          created_at?: string
          details?: Json | null
          error_message?: string | null
          event?: string
          id?: string
          integration_id?: string
          status?: string
          triggered_by?: string | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "enterprise_agile_sync_log_integration_id_fkey"
            columns: ["integration_id"]
            isOneToOne: false
            referencedRelation: "enterprise_workspace_integrations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "enterprise_agile_sync_log_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "enterprise_org_pulse_membership"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "enterprise_agile_sync_log_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "enterprise_workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      enterprise_allowances: {
        Row: {
          created_at: string
          id: string
          ignore_limit: boolean
          is_archived: boolean
          name: string
          sort_order: number
          unit: string
          updated_at: string
          workspace_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          ignore_limit?: boolean
          is_archived?: boolean
          name: string
          sort_order?: number
          unit?: string
          updated_at?: string
          workspace_id: string
        }
        Update: {
          created_at?: string
          id?: string
          ignore_limit?: boolean
          is_archived?: boolean
          name?: string
          sort_order?: number
          unit?: string
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "enterprise_allowances_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "enterprise_org_pulse_membership"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "enterprise_allowances_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "enterprise_workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      enterprise_approval_chains: {
        Row: {
          approver_role: Database["public"]["Enums"]["enterprise_role"]
          created_at: string
          id: string
          is_active: boolean
          step_order: number
          substitute_user_id: string | null
          updated_at: string
          workspace_id: string
        }
        Insert: {
          approver_role?: Database["public"]["Enums"]["enterprise_role"]
          created_at?: string
          id?: string
          is_active?: boolean
          step_order?: number
          substitute_user_id?: string | null
          updated_at?: string
          workspace_id: string
        }
        Update: {
          approver_role?: Database["public"]["Enums"]["enterprise_role"]
          created_at?: string
          id?: string
          is_active?: boolean
          step_order?: number
          substitute_user_id?: string | null
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "enterprise_approval_chains_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "enterprise_org_pulse_membership"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "enterprise_approval_chains_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "enterprise_workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      enterprise_attendance_audit: {
        Row: {
          action: string
          actor_id: string | null
          after: Json | null
          before: Json | null
          created_at: string
          id: string
          period_id: string | null
          reason: string | null
          target_id: string | null
          target_kind: string | null
          workspace_id: string
        }
        Insert: {
          action: string
          actor_id?: string | null
          after?: Json | null
          before?: Json | null
          created_at?: string
          id?: string
          period_id?: string | null
          reason?: string | null
          target_id?: string | null
          target_kind?: string | null
          workspace_id: string
        }
        Update: {
          action?: string
          actor_id?: string | null
          after?: Json | null
          before?: Json | null
          created_at?: string
          id?: string
          period_id?: string | null
          reason?: string | null
          target_id?: string | null
          target_kind?: string | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "enterprise_attendance_audit_period_id_fkey"
            columns: ["period_id"]
            isOneToOne: false
            referencedRelation: "enterprise_attendance_periods"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "enterprise_attendance_audit_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "enterprise_org_pulse_membership"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "enterprise_attendance_audit_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "enterprise_workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      enterprise_attendance_oncall_windows: {
        Row: {
          created_at: string
          ends_at: string
          id: string
          is_night: boolean
          is_weekend: boolean
          note: string | null
          period_id: string
          standby_multiplier: number
          starts_at: string
          updated_at: string
          workspace_id: string
        }
        Insert: {
          created_at?: string
          ends_at: string
          id?: string
          is_night?: boolean
          is_weekend?: boolean
          note?: string | null
          period_id: string
          standby_multiplier?: number
          starts_at: string
          updated_at?: string
          workspace_id: string
        }
        Update: {
          created_at?: string
          ends_at?: string
          id?: string
          is_night?: boolean
          is_weekend?: boolean
          note?: string | null
          period_id?: string
          standby_multiplier?: number
          starts_at?: string
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "enterprise_attendance_oncall_windows_period_id_fkey"
            columns: ["period_id"]
            isOneToOne: false
            referencedRelation: "enterprise_attendance_periods"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "enterprise_attendance_oncall_windows_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "enterprise_org_pulse_membership"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "enterprise_attendance_oncall_windows_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "enterprise_workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      enterprise_attendance_payroll_exports: {
        Row: {
          exported_at: string
          exported_by: string
          format: string
          id: string
          member_count: number
          month: number
          notes: string | null
          payload: Json | null
          total_periods: number
          variant: string
          workspace_id: string
          year: number
        }
        Insert: {
          exported_at?: string
          exported_by: string
          format?: string
          id?: string
          member_count?: number
          month: number
          notes?: string | null
          payload?: Json | null
          total_periods?: number
          variant?: string
          workspace_id: string
          year: number
        }
        Update: {
          exported_at?: string
          exported_by?: string
          format?: string
          id?: string
          member_count?: number
          month?: number
          notes?: string | null
          payload?: Json | null
          total_periods?: number
          variant?: string
          workspace_id?: string
          year?: number
        }
        Relationships: [
          {
            foreignKeyName: "enterprise_attendance_payroll_exports_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "enterprise_org_pulse_membership"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "enterprise_attendance_payroll_exports_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "enterprise_workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      enterprise_attendance_periods: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          created_at: string
          exported_at: string | null
          id: string
          locked_at: string | null
          membership_id: string
          month: number
          return_reason: string | null
          schedule_template_id: string | null
          status: Database["public"]["Enums"]["enterprise_attendance_period_status"]
          submitted_at: string | null
          submitted_by: string | null
          totals: Json
          totals_recomputed_at: string | null
          updated_at: string
          workspace_id: string
          year: number
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          exported_at?: string | null
          id?: string
          locked_at?: string | null
          membership_id: string
          month: number
          return_reason?: string | null
          schedule_template_id?: string | null
          status?: Database["public"]["Enums"]["enterprise_attendance_period_status"]
          submitted_at?: string | null
          submitted_by?: string | null
          totals?: Json
          totals_recomputed_at?: string | null
          updated_at?: string
          workspace_id: string
          year: number
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          exported_at?: string | null
          id?: string
          locked_at?: string | null
          membership_id?: string
          month?: number
          return_reason?: string | null
          schedule_template_id?: string | null
          status?: Database["public"]["Enums"]["enterprise_attendance_period_status"]
          submitted_at?: string | null
          submitted_by?: string | null
          totals?: Json
          totals_recomputed_at?: string | null
          updated_at?: string
          workspace_id?: string
          year?: number
        }
        Relationships: [
          {
            foreignKeyName: "enterprise_attendance_periods_membership_id_fkey"
            columns: ["membership_id"]
            isOneToOne: false
            referencedRelation: "enterprise_memberships"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "enterprise_attendance_periods_schedule_template_id_fkey"
            columns: ["schedule_template_id"]
            isOneToOne: false
            referencedRelation: "enterprise_attendance_schedule_templates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "enterprise_attendance_periods_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "enterprise_org_pulse_membership"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "enterprise_attendance_periods_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "enterprise_workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      enterprise_attendance_schedule_templates: {
        Row: {
          archived_at: string | null
          break_minutes: number
          created_at: string
          effective_from: string | null
          effective_to: string | null
          end_time: string
          expected_daily_hours: number
          id: string
          is_default: boolean
          membership_id: string | null
          name: string
          start_time: string
          updated_at: string
          weekday_mask: number
          workspace_id: string
        }
        Insert: {
          archived_at?: string | null
          break_minutes?: number
          created_at?: string
          effective_from?: string | null
          effective_to?: string | null
          end_time?: string
          expected_daily_hours?: number
          id?: string
          is_default?: boolean
          membership_id?: string | null
          name: string
          start_time?: string
          updated_at?: string
          weekday_mask?: number
          workspace_id: string
        }
        Update: {
          archived_at?: string | null
          break_minutes?: number
          created_at?: string
          effective_from?: string | null
          effective_to?: string | null
          end_time?: string
          expected_daily_hours?: number
          id?: string
          is_default?: boolean
          membership_id?: string | null
          name?: string
          start_time?: string
          updated_at?: string
          weekday_mask?: number
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "enterprise_attendance_schedule_templates_membership_id_fkey"
            columns: ["membership_id"]
            isOneToOne: false
            referencedRelation: "enterprise_memberships"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "enterprise_attendance_schedule_templates_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "enterprise_org_pulse_membership"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "enterprise_attendance_schedule_templates_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "enterprise_workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      enterprise_attendance_segments: {
        Row: {
          created_at: string
          device_event_id: string | null
          ends_at: string
          id: string
          is_night: boolean
          is_weekend: boolean
          note: string | null
          oncall_window_id: string | null
          period_id: string
          segment_type: Database["public"]["Enums"]["enterprise_attendance_segment_type"]
          source: string
          starts_at: string
          updated_at: string
          work_date: string
          workspace_id: string
        }
        Insert: {
          created_at?: string
          device_event_id?: string | null
          ends_at: string
          id?: string
          is_night?: boolean
          is_weekend?: boolean
          note?: string | null
          oncall_window_id?: string | null
          period_id: string
          segment_type?: Database["public"]["Enums"]["enterprise_attendance_segment_type"]
          source?: string
          starts_at: string
          updated_at?: string
          work_date: string
          workspace_id: string
        }
        Update: {
          created_at?: string
          device_event_id?: string | null
          ends_at?: string
          id?: string
          is_night?: boolean
          is_weekend?: boolean
          note?: string | null
          oncall_window_id?: string | null
          period_id?: string
          segment_type?: Database["public"]["Enums"]["enterprise_attendance_segment_type"]
          source?: string
          starts_at?: string
          updated_at?: string
          work_date?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "enterprise_attendance_segments_oncall_window_id_fkey"
            columns: ["oncall_window_id"]
            isOneToOne: false
            referencedRelation: "enterprise_attendance_oncall_windows"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "enterprise_attendance_segments_period_id_fkey"
            columns: ["period_id"]
            isOneToOne: false
            referencedRelation: "enterprise_attendance_periods"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "enterprise_attendance_segments_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "enterprise_org_pulse_membership"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "enterprise_attendance_segments_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "enterprise_workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      enterprise_audit_events: {
        Row: {
          action: string
          actor_id: string
          affected_user_id: string | null
          created_at: string
          id: string
          metadata: Json | null
          new_state: Json | null
          prev_state: Json | null
          target_id: string | null
          target_type: string | null
          workspace_id: string
        }
        Insert: {
          action: string
          actor_id: string
          affected_user_id?: string | null
          created_at?: string
          id?: string
          metadata?: Json | null
          new_state?: Json | null
          prev_state?: Json | null
          target_id?: string | null
          target_type?: string | null
          workspace_id: string
        }
        Update: {
          action?: string
          actor_id?: string
          affected_user_id?: string | null
          created_at?: string
          id?: string
          metadata?: Json | null
          new_state?: Json | null
          prev_state?: Json | null
          target_id?: string | null
          target_type?: string | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "enterprise_audit_events_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "enterprise_org_pulse_membership"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "enterprise_audit_events_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "enterprise_workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      enterprise_blocked_dates: {
        Row: {
          blocked_date: string
          created_at: string
          created_by: string
          id: string
          reason: string | null
          workspace_id: string
        }
        Insert: {
          blocked_date: string
          created_at?: string
          created_by: string
          id?: string
          reason?: string | null
          workspace_id: string
        }
        Update: {
          blocked_date?: string
          created_at?: string
          created_by?: string
          id?: string
          reason?: string | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "enterprise_blocked_dates_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "enterprise_org_pulse_membership"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "enterprise_blocked_dates_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "enterprise_workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      enterprise_calendar_sync_log: {
        Row: {
          action: string
          created_at: string
          details: Json | null
          direction: string
          error_message: string | null
          events_processed: number | null
          id: string
          integration_id: string | null
          provider: string
          status: string
          user_id: string | null
          workspace_id: string
        }
        Insert: {
          action: string
          created_at?: string
          details?: Json | null
          direction: string
          error_message?: string | null
          events_processed?: number | null
          id?: string
          integration_id?: string | null
          provider: string
          status: string
          user_id?: string | null
          workspace_id: string
        }
        Update: {
          action?: string
          created_at?: string
          details?: Json | null
          direction?: string
          error_message?: string | null
          events_processed?: number | null
          id?: string
          integration_id?: string | null
          provider?: string
          status?: string
          user_id?: string | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "enterprise_calendar_sync_log_integration_id_fkey"
            columns: ["integration_id"]
            isOneToOne: false
            referencedRelation: "enterprise_user_calendar_integrations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "enterprise_calendar_sync_log_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "enterprise_org_pulse_membership"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "enterprise_calendar_sync_log_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "enterprise_workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      enterprise_capacity_snapshots: {
        Row: {
          available_fte: number | null
          baseline_fte: number | null
          committed_fte: number | null
          effective_fte: number | null
          generated_at: string
          id: string
          overload_score: number | null
          payload: Json | null
          shortage_score: number | null
          snapshot_date: string
          workspace_id: string
        }
        Insert: {
          available_fte?: number | null
          baseline_fte?: number | null
          committed_fte?: number | null
          effective_fte?: number | null
          generated_at?: string
          id?: string
          overload_score?: number | null
          payload?: Json | null
          shortage_score?: number | null
          snapshot_date: string
          workspace_id: string
        }
        Update: {
          available_fte?: number | null
          baseline_fte?: number | null
          committed_fte?: number | null
          effective_fte?: number | null
          generated_at?: string
          id?: string
          overload_score?: number | null
          payload?: Json | null
          shortage_score?: number | null
          snapshot_date?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "enterprise_capacity_snapshots_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "enterprise_org_pulse_membership"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "enterprise_capacity_snapshots_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "enterprise_workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      enterprise_catalog_categories: {
        Row: {
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      enterprise_catalog_role_skills: {
        Row: {
          created_at: string
          id: string
          min_experience_level:
            | Database["public"]["Enums"]["enterprise_experience_level"]
            | null
          required: boolean
          role_id: string
          skill_id: string
          sort_order: number
        }
        Insert: {
          created_at?: string
          id?: string
          min_experience_level?:
            | Database["public"]["Enums"]["enterprise_experience_level"]
            | null
          required?: boolean
          role_id: string
          skill_id: string
          sort_order?: number
        }
        Update: {
          created_at?: string
          id?: string
          min_experience_level?:
            | Database["public"]["Enums"]["enterprise_experience_level"]
            | null
          required?: boolean
          role_id?: string
          skill_id?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "enterprise_catalog_role_skills_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "enterprise_catalog_roles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "enterprise_catalog_role_skills_skill_id_fkey"
            columns: ["skill_id"]
            isOneToOne: false
            referencedRelation: "enterprise_catalog_skills"
            referencedColumns: ["id"]
          },
        ]
      }
      enterprise_catalog_roles: {
        Row: {
          category_id: string
          created_at: string
          id: string
          is_active: boolean
          name: string
          normalized_name: string | null
          updated_at: string
        }
        Insert: {
          category_id: string
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          normalized_name?: string | null
          updated_at?: string
        }
        Update: {
          category_id?: string
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          normalized_name?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "enterprise_catalog_roles_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "enterprise_catalog_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      enterprise_catalog_skills: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          name: string
          normalized_name: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          normalized_name?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          normalized_name?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      enterprise_company_leave_days: {
        Row: {
          created_at: string
          created_by: string
          id: string
          is_recurring: boolean
          leave_date: string
          name: string
          workspace_id: string
        }
        Insert: {
          created_at?: string
          created_by: string
          id?: string
          is_recurring?: boolean
          leave_date: string
          name: string
          workspace_id: string
        }
        Update: {
          created_at?: string
          created_by?: string
          id?: string
          is_recurring?: boolean
          leave_date?: string
          name?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "enterprise_company_leave_days_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "enterprise_org_pulse_membership"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "enterprise_company_leave_days_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "enterprise_workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      enterprise_contract_types: {
        Row: {
          archived_at: string | null
          code: string
          created_at: string
          id: string
          is_default: boolean
          label: string
          updated_at: string
          workspace_id: string
        }
        Insert: {
          archived_at?: string | null
          code: string
          created_at?: string
          id?: string
          is_default?: boolean
          label: string
          updated_at?: string
          workspace_id: string
        }
        Update: {
          archived_at?: string | null
          code?: string
          created_at?: string
          id?: string
          is_default?: boolean
          label?: string
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "enterprise_contract_types_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "enterprise_org_pulse_membership"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "enterprise_contract_types_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "enterprise_workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      enterprise_daily_rules: {
        Row: {
          created_at: string
          created_by: string
          day_of_week: number | null
          days_of_week: number[] | null
          id: string
          max_off: number | null
          min_coverage: number | null
          role_filter: string | null
          role_filters: string[] | null
          rule_date: string | null
          team_filter: string | null
          updated_at: string
          valid_from: string | null
          valid_until: string | null
          workspace_id: string
        }
        Insert: {
          created_at?: string
          created_by: string
          day_of_week?: number | null
          days_of_week?: number[] | null
          id?: string
          max_off?: number | null
          min_coverage?: number | null
          role_filter?: string | null
          role_filters?: string[] | null
          rule_date?: string | null
          team_filter?: string | null
          updated_at?: string
          valid_from?: string | null
          valid_until?: string | null
          workspace_id: string
        }
        Update: {
          created_at?: string
          created_by?: string
          day_of_week?: number | null
          days_of_week?: number[] | null
          id?: string
          max_off?: number | null
          min_coverage?: number | null
          role_filter?: string | null
          role_filters?: string[] | null
          rule_date?: string | null
          team_filter?: string | null
          updated_at?: string
          valid_from?: string | null
          valid_until?: string | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "enterprise_daily_rules_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "enterprise_org_pulse_membership"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "enterprise_daily_rules_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "enterprise_workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      enterprise_decision_memory: {
        Row: {
          authored_at: string
          authored_by: string | null
          expected_outcome: string | null
          id: string
          observation_due_at: string | null
          observed_at: string | null
          observed_outcome: string | null
          rationale: string | null
          subject_id: string
          subject_type: string
          workspace_id: string
        }
        Insert: {
          authored_at?: string
          authored_by?: string | null
          expected_outcome?: string | null
          id?: string
          observation_due_at?: string | null
          observed_at?: string | null
          observed_outcome?: string | null
          rationale?: string | null
          subject_id: string
          subject_type: string
          workspace_id: string
        }
        Update: {
          authored_at?: string
          authored_by?: string | null
          expected_outcome?: string | null
          id?: string
          observation_due_at?: string | null
          observed_at?: string | null
          observed_outcome?: string | null
          rationale?: string | null
          subject_id?: string
          subject_type?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "enterprise_decision_memory_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "enterprise_org_pulse_membership"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "enterprise_decision_memory_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "enterprise_workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      enterprise_escalation_rules: {
        Row: {
          created_at: string
          escalate_after_hours: number
          escalate_to_role: Database["public"]["Enums"]["enterprise_role"]
          id: string
          is_active: boolean
          notify_owner: boolean
          updated_at: string
          workspace_id: string
        }
        Insert: {
          created_at?: string
          escalate_after_hours?: number
          escalate_to_role?: Database["public"]["Enums"]["enterprise_role"]
          id?: string
          is_active?: boolean
          notify_owner?: boolean
          updated_at?: string
          workspace_id: string
        }
        Update: {
          created_at?: string
          escalate_after_hours?: number
          escalate_to_role?: Database["public"]["Enums"]["enterprise_role"]
          id?: string
          is_active?: boolean
          notify_owner?: boolean
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "enterprise_escalation_rules_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "enterprise_org_pulse_membership"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "enterprise_escalation_rules_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "enterprise_workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      enterprise_export_jobs: {
        Row: {
          completed_at: string | null
          created_at: string
          created_by: string
          export_format: string
          file_url: string | null
          filters: Json | null
          id: string
          status: string
          workspace_id: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          created_by: string
          export_format?: string
          file_url?: string | null
          filters?: Json | null
          id?: string
          status?: string
          workspace_id: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          created_by?: string
          export_format?: string
          file_url?: string | null
          filters?: Json | null
          id?: string
          status?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "enterprise_export_jobs_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "enterprise_org_pulse_membership"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "enterprise_export_jobs_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "enterprise_workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      enterprise_feature_catalog: {
        Row: {
          created_at: string
          description: string | null
          display_name: string
          feature_key: string
          id: string
          parent_key: string | null
          sort_order: number
        }
        Insert: {
          created_at?: string
          description?: string | null
          display_name: string
          feature_key: string
          id?: string
          parent_key?: string | null
          sort_order?: number
        }
        Update: {
          created_at?: string
          description?: string | null
          display_name?: string
          feature_key?: string
          id?: string
          parent_key?: string | null
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "enterprise_feature_catalog_parent_key_fkey"
            columns: ["parent_key"]
            isOneToOne: false
            referencedRelation: "enterprise_feature_catalog"
            referencedColumns: ["feature_key"]
          },
        ]
      }
      enterprise_ganttic_dependencies: {
        Row: {
          created_at: string
          created_by: string | null
          dep_type: string
          id: string
          integration_id: string
          is_auto: boolean
          lag_days: number
          predecessor_key: string
          successor_key: string
          updated_at: string
          workspace_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          dep_type?: string
          id?: string
          integration_id: string
          is_auto?: boolean
          lag_days?: number
          predecessor_key: string
          successor_key: string
          updated_at?: string
          workspace_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          dep_type?: string
          id?: string
          integration_id?: string
          is_auto?: boolean
          lag_days?: number
          predecessor_key?: string
          successor_key?: string
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "enterprise_ganttic_dependencies_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "enterprise_ganttic_dependencies_integration_id_fkey"
            columns: ["integration_id"]
            isOneToOne: false
            referencedRelation: "enterprise_workspace_integrations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "enterprise_ganttic_dependencies_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "enterprise_org_pulse_membership"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "enterprise_ganttic_dependencies_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "enterprise_workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      enterprise_holidays: {
        Row: {
          created_at: string
          holiday_date: string
          id: string
          is_recurring: boolean
          name: string
          workspace_id: string
        }
        Insert: {
          created_at?: string
          holiday_date: string
          id?: string
          is_recurring?: boolean
          name: string
          workspace_id: string
        }
        Update: {
          created_at?: string
          holiday_date?: string
          id?: string
          is_recurring?: boolean
          name?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "enterprise_holidays_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "enterprise_org_pulse_membership"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "enterprise_holidays_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "enterprise_workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      enterprise_hr_workflow_instances: {
        Row: {
          category: string
          completed_at: string | null
          created_at: string
          created_by: string | null
          due_date: string | null
          id: string
          membership_id: string | null
          notes: string | null
          priority: string
          started_at: string
          status: string
          template_id: string | null
          title: string
          updated_at: string
          workspace_id: string
        }
        Insert: {
          category?: string
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          due_date?: string | null
          id?: string
          membership_id?: string | null
          notes?: string | null
          priority?: string
          started_at?: string
          status?: string
          template_id?: string | null
          title: string
          updated_at?: string
          workspace_id: string
        }
        Update: {
          category?: string
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          due_date?: string | null
          id?: string
          membership_id?: string | null
          notes?: string | null
          priority?: string
          started_at?: string
          status?: string
          template_id?: string | null
          title?: string
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "enterprise_hr_workflow_instances_membership_id_fkey"
            columns: ["membership_id"]
            isOneToOne: false
            referencedRelation: "enterprise_memberships"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "enterprise_hr_workflow_instances_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "enterprise_hr_workflow_templates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "enterprise_hr_workflow_instances_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "enterprise_org_pulse_membership"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "enterprise_hr_workflow_instances_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "enterprise_workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      enterprise_hr_workflow_tasks: {
        Row: {
          assignee_membership_id: string | null
          completed_at: string | null
          completed_by: string | null
          created_at: string
          description: string | null
          due_date: string | null
          id: string
          instance_id: string
          sort_order: number
          status: string
          title: string
          updated_at: string
          workspace_id: string
        }
        Insert: {
          assignee_membership_id?: string | null
          completed_at?: string | null
          completed_by?: string | null
          created_at?: string
          description?: string | null
          due_date?: string | null
          id?: string
          instance_id: string
          sort_order?: number
          status?: string
          title: string
          updated_at?: string
          workspace_id: string
        }
        Update: {
          assignee_membership_id?: string | null
          completed_at?: string | null
          completed_by?: string | null
          created_at?: string
          description?: string | null
          due_date?: string | null
          id?: string
          instance_id?: string
          sort_order?: number
          status?: string
          title?: string
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "enterprise_hr_workflow_tasks_assignee_membership_id_fkey"
            columns: ["assignee_membership_id"]
            isOneToOne: false
            referencedRelation: "enterprise_memberships"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "enterprise_hr_workflow_tasks_instance_id_fkey"
            columns: ["instance_id"]
            isOneToOne: false
            referencedRelation: "enterprise_hr_workflow_instances"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "enterprise_hr_workflow_tasks_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "enterprise_org_pulse_membership"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "enterprise_hr_workflow_tasks_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "enterprise_workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      enterprise_hr_workflow_templates: {
        Row: {
          category: string
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          is_active: boolean
          name: string
          recurrence_months: number | null
          steps: Json
          updated_at: string
          workspace_id: string
        }
        Insert: {
          category?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_active?: boolean
          name: string
          recurrence_months?: number | null
          steps?: Json
          updated_at?: string
          workspace_id: string
        }
        Update: {
          category?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
          recurrence_months?: number | null
          steps?: Json
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "enterprise_hr_workflow_templates_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "enterprise_org_pulse_membership"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "enterprise_hr_workflow_templates_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "enterprise_workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      enterprise_ical_tokens: {
        Row: {
          created_at: string
          id: string
          last_used_at: string | null
          scope: string
          token: string
          user_id: string
          workspace_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          last_used_at?: string | null
          scope?: string
          token?: string
          user_id: string
          workspace_id: string
        }
        Update: {
          created_at?: string
          id?: string
          last_used_at?: string | null
          scope?: string
          token?: string
          user_id?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "enterprise_ical_tokens_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "enterprise_org_pulse_membership"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "enterprise_ical_tokens_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "enterprise_workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      enterprise_industries: {
        Row: {
          archived_at: string | null
          code: string
          created_at: string
          id: string
          is_default: boolean
          label: string
          updated_at: string
          workspace_id: string
        }
        Insert: {
          archived_at?: string | null
          code: string
          created_at?: string
          id?: string
          is_default?: boolean
          label: string
          updated_at?: string
          workspace_id: string
        }
        Update: {
          archived_at?: string | null
          code?: string
          created_at?: string
          id?: string
          is_default?: boolean
          label?: string
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "enterprise_industries_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "enterprise_org_pulse_membership"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "enterprise_industries_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "enterprise_workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      enterprise_integration_sync_log: {
        Row: {
          created_at: string
          error_message: string | null
          external_ref: string | null
          id: string
          integration_id: string
          leave_request_id: string | null
          payload: Json | null
          status: string
          workspace_id: string
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          external_ref?: string | null
          id?: string
          integration_id: string
          leave_request_id?: string | null
          payload?: Json | null
          status: string
          workspace_id: string
        }
        Update: {
          created_at?: string
          error_message?: string | null
          external_ref?: string | null
          id?: string
          integration_id?: string
          leave_request_id?: string | null
          payload?: Json | null
          status?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "enterprise_integration_sync_log_integration_id_fkey"
            columns: ["integration_id"]
            isOneToOne: false
            referencedRelation: "enterprise_workspace_integrations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "enterprise_integration_sync_log_leave_request_id_fkey"
            columns: ["leave_request_id"]
            isOneToOne: false
            referencedRelation: "leave_requests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "enterprise_integration_sync_log_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "enterprise_org_pulse_membership"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "enterprise_integration_sync_log_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "enterprise_workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      enterprise_invitations: {
        Row: {
          accepted_at: string | null
          created_at: string
          email: string
          expires_at: string | null
          id: string
          invited_by: string
          metadata: Json
          role: Database["public"]["Enums"]["enterprise_role"]
          token: string
          workspace_id: string
        }
        Insert: {
          accepted_at?: string | null
          created_at?: string
          email: string
          expires_at?: string | null
          id?: string
          invited_by: string
          metadata?: Json
          role?: Database["public"]["Enums"]["enterprise_role"]
          token?: string
          workspace_id: string
        }
        Update: {
          accepted_at?: string | null
          created_at?: string
          email?: string
          expires_at?: string | null
          id?: string
          invited_by?: string
          metadata?: Json
          role?: Database["public"]["Enums"]["enterprise_role"]
          token?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "enterprise_invitations_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "enterprise_org_pulse_membership"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "enterprise_invitations_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "enterprise_workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      enterprise_job_families: {
        Row: {
          archived_at: string | null
          code: string
          created_at: string
          id: string
          label: string
          updated_at: string
          workspace_id: string
        }
        Insert: {
          archived_at?: string | null
          code: string
          created_at?: string
          id?: string
          label: string
          updated_at?: string
          workspace_id: string
        }
        Update: {
          archived_at?: string | null
          code?: string
          created_at?: string
          id?: string
          label?: string
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "enterprise_job_families_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "enterprise_org_pulse_membership"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "enterprise_job_families_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "enterprise_workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      enterprise_leadership_levels: {
        Row: {
          archived_at: string | null
          code: string
          created_at: string
          id: string
          label: string
          sort_order: number
          updated_at: string
          workspace_id: string
        }
        Insert: {
          archived_at?: string | null
          code: string
          created_at?: string
          id?: string
          label: string
          sort_order?: number
          updated_at?: string
          workspace_id: string
        }
        Update: {
          archived_at?: string | null
          code?: string
          created_at?: string
          id?: string
          label?: string
          sort_order?: number
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "enterprise_leadership_levels_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "enterprise_org_pulse_membership"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "enterprise_leadership_levels_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "enterprise_workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      enterprise_leave_quotas: {
        Row: {
          carryover_days: number
          carryover_expires_at: string | null
          created_at: string
          id: string
          initial_days: number
          leave_type: Database["public"]["Enums"]["leave_type"]
          manual_adjustment_days: number
          membership_id: string
          notes: string | null
          updated_at: string
          workspace_id: string
          year: number
        }
        Insert: {
          carryover_days?: number
          carryover_expires_at?: string | null
          created_at?: string
          id?: string
          initial_days?: number
          leave_type: Database["public"]["Enums"]["leave_type"]
          manual_adjustment_days?: number
          membership_id: string
          notes?: string | null
          updated_at?: string
          workspace_id: string
          year: number
        }
        Update: {
          carryover_days?: number
          carryover_expires_at?: string | null
          created_at?: string
          id?: string
          initial_days?: number
          leave_type?: Database["public"]["Enums"]["leave_type"]
          manual_adjustment_days?: number
          membership_id?: string
          notes?: string | null
          updated_at?: string
          workspace_id?: string
          year?: number
        }
        Relationships: [
          {
            foreignKeyName: "enterprise_leave_quotas_membership_id_fkey"
            columns: ["membership_id"]
            isOneToOne: false
            referencedRelation: "enterprise_memberships"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "enterprise_leave_quotas_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "enterprise_org_pulse_membership"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "enterprise_leave_quotas_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "enterprise_workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      enterprise_leave_types: {
        Row: {
          allowance_id: string | null
          color: string
          created_at: string
          icon: string | null
          id: string
          is_active: boolean
          is_paid: boolean
          is_private: boolean
          name: string
          requires_approval: boolean
          sort_order: number
          updated_at: string
          workspace_id: string
        }
        Insert: {
          allowance_id?: string | null
          color?: string
          created_at?: string
          icon?: string | null
          id?: string
          is_active?: boolean
          is_paid?: boolean
          is_private?: boolean
          name: string
          requires_approval?: boolean
          sort_order?: number
          updated_at?: string
          workspace_id: string
        }
        Update: {
          allowance_id?: string | null
          color?: string
          created_at?: string
          icon?: string | null
          id?: string
          is_active?: boolean
          is_paid?: boolean
          is_private?: boolean
          name?: string
          requires_approval?: boolean
          sort_order?: number
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "enterprise_leave_types_allowance_id_fkey"
            columns: ["allowance_id"]
            isOneToOne: false
            referencedRelation: "enterprise_allowances"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "enterprise_leave_types_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "enterprise_org_pulse_membership"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "enterprise_leave_types_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "enterprise_workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      enterprise_member_goals: {
        Row: {
          achieved_at: string | null
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          member_id: string
          status: string
          target_date: string | null
          title: string
          updated_at: string
          workspace_id: string
        }
        Insert: {
          achieved_at?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          member_id: string
          status?: string
          target_date?: string | null
          title: string
          updated_at?: string
          workspace_id: string
        }
        Update: {
          achieved_at?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          member_id?: string
          status?: string
          target_date?: string | null
          title?: string
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "enterprise_member_goals_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "enterprise_memberships"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "enterprise_member_goals_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "enterprise_org_pulse_membership"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "enterprise_member_goals_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "enterprise_workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      enterprise_member_rates: {
        Row: {
          cost_rate: number
          created_at: string
          currency: string
          effective_from: string
          effective_to: string | null
          id: string
          membership_id: string
          workspace_id: string
        }
        Insert: {
          cost_rate?: number
          created_at?: string
          currency?: string
          effective_from?: string
          effective_to?: string | null
          id?: string
          membership_id: string
          workspace_id: string
        }
        Update: {
          cost_rate?: number
          created_at?: string
          currency?: string
          effective_from?: string
          effective_to?: string | null
          id?: string
          membership_id?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "enterprise_member_rates_membership_id_fkey"
            columns: ["membership_id"]
            isOneToOne: false
            referencedRelation: "enterprise_memberships"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "enterprise_member_rates_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "enterprise_org_pulse_membership"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "enterprise_member_rates_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "enterprise_workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      enterprise_member_role_allocations: {
        Row: {
          business_role: string
          created_at: string
          id: string
          is_priority: boolean
          membership_id: string
          percentage: number
          updated_at: string
          workspace_id: string
        }
        Insert: {
          business_role: string
          created_at?: string
          id?: string
          is_priority?: boolean
          membership_id: string
          percentage?: number
          updated_at?: string
          workspace_id: string
        }
        Update: {
          business_role?: string
          created_at?: string
          id?: string
          is_priority?: boolean
          membership_id?: string
          percentage?: number
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "enterprise_member_role_allocations_membership_id_fkey"
            columns: ["membership_id"]
            isOneToOne: false
            referencedRelation: "enterprise_memberships"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "enterprise_member_role_allocations_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "enterprise_org_pulse_membership"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "enterprise_member_role_allocations_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "enterprise_workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      enterprise_member_site_priorities: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          membership_id: string
          notes: string | null
          office_id: string
          priority: number
          updated_at: string
          workspace_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          membership_id: string
          notes?: string | null
          office_id: string
          priority?: number
          updated_at?: string
          workspace_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          membership_id?: string
          notes?: string | null
          office_id?: string
          priority?: number
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "enterprise_member_site_priorities_membership_id_fkey"
            columns: ["membership_id"]
            isOneToOne: false
            referencedRelation: "enterprise_memberships"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "enterprise_member_site_priorities_office_id_fkey"
            columns: ["office_id"]
            isOneToOne: false
            referencedRelation: "enterprise_offices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "enterprise_member_site_priorities_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "enterprise_org_pulse_membership"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "enterprise_member_site_priorities_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "enterprise_workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      enterprise_member_skills: {
        Row: {
          created_at: string
          id: string
          level: number
          membership_id: string
          skill_id: string
          workspace_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          level?: number
          membership_id: string
          skill_id: string
          workspace_id: string
        }
        Update: {
          created_at?: string
          id?: string
          level?: number
          membership_id?: string
          skill_id?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "enterprise_member_skills_membership_id_fkey"
            columns: ["membership_id"]
            isOneToOne: false
            referencedRelation: "enterprise_memberships"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "enterprise_member_skills_skill_id_fkey"
            columns: ["skill_id"]
            isOneToOne: false
            referencedRelation: "enterprise_skills"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "enterprise_member_skills_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "enterprise_org_pulse_membership"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "enterprise_member_skills_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "enterprise_workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      enterprise_member_templates: {
        Row: {
          created_at: string
          created_by: string
          default_business_role: string | null
          default_city: string | null
          default_location: string | null
          default_office_id: string | null
          default_role: string
          default_team: string | null
          id: string
          template_name: string
          updated_at: string
          workspace_id: string
        }
        Insert: {
          created_at?: string
          created_by: string
          default_business_role?: string | null
          default_city?: string | null
          default_location?: string | null
          default_office_id?: string | null
          default_role?: string
          default_team?: string | null
          id?: string
          template_name: string
          updated_at?: string
          workspace_id: string
        }
        Update: {
          created_at?: string
          created_by?: string
          default_business_role?: string | null
          default_city?: string | null
          default_location?: string | null
          default_office_id?: string | null
          default_role?: string
          default_team?: string | null
          id?: string
          template_name?: string
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "enterprise_member_templates_default_office_id_fkey"
            columns: ["default_office_id"]
            isOneToOne: false
            referencedRelation: "enterprise_offices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "enterprise_member_templates_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "enterprise_org_pulse_membership"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "enterprise_member_templates_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "enterprise_workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      enterprise_memberships: {
        Row: {
          base_working_hours: number
          business_role: string | null
          business_role_id: string | null
          city: string | null
          contract_type_id: string | null
          created_at: string
          employer_rights: boolean
          id: string
          joined_at: string | null
          leadership_category: string | null
          leadership_level_id: string | null
          location: string | null
          manager_id: string | null
          office_id: string | null
          org_unit_id: string | null
          position_catalog_id: string | null
          role: Database["public"]["Enums"]["enterprise_role"]
          seniority:
            | Database["public"]["Enums"]["enterprise_experience_level"]
            | null
          status: Database["public"]["Enums"]["enterprise_membership_status"]
          team: string | null
          updated_at: string
          user_id: string
          weekly_capacity_hours: number
          working_pattern: Json | null
          workspace_id: string
        }
        Insert: {
          base_working_hours?: number
          business_role?: string | null
          business_role_id?: string | null
          city?: string | null
          contract_type_id?: string | null
          created_at?: string
          employer_rights?: boolean
          id?: string
          joined_at?: string | null
          leadership_category?: string | null
          leadership_level_id?: string | null
          location?: string | null
          manager_id?: string | null
          office_id?: string | null
          org_unit_id?: string | null
          position_catalog_id?: string | null
          role?: Database["public"]["Enums"]["enterprise_role"]
          seniority?:
            | Database["public"]["Enums"]["enterprise_experience_level"]
            | null
          status?: Database["public"]["Enums"]["enterprise_membership_status"]
          team?: string | null
          updated_at?: string
          user_id: string
          weekly_capacity_hours?: number
          working_pattern?: Json | null
          workspace_id: string
        }
        Update: {
          base_working_hours?: number
          business_role?: string | null
          business_role_id?: string | null
          city?: string | null
          contract_type_id?: string | null
          created_at?: string
          employer_rights?: boolean
          id?: string
          joined_at?: string | null
          leadership_category?: string | null
          leadership_level_id?: string | null
          location?: string | null
          manager_id?: string | null
          office_id?: string | null
          org_unit_id?: string | null
          position_catalog_id?: string | null
          role?: Database["public"]["Enums"]["enterprise_role"]
          seniority?:
            | Database["public"]["Enums"]["enterprise_experience_level"]
            | null
          status?: Database["public"]["Enums"]["enterprise_membership_status"]
          team?: string | null
          updated_at?: string
          user_id?: string
          weekly_capacity_hours?: number
          working_pattern?: Json | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "enterprise_memberships_business_role_id_fkey"
            columns: ["business_role_id"]
            isOneToOne: false
            referencedRelation: "enterprise_workspace_roles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "enterprise_memberships_contract_type_id_fkey"
            columns: ["contract_type_id"]
            isOneToOne: false
            referencedRelation: "enterprise_contract_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "enterprise_memberships_leadership_level_id_fkey"
            columns: ["leadership_level_id"]
            isOneToOne: false
            referencedRelation: "enterprise_leadership_levels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "enterprise_memberships_manager_id_fkey"
            columns: ["manager_id"]
            isOneToOne: false
            referencedRelation: "enterprise_memberships"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "enterprise_memberships_office_id_fkey"
            columns: ["office_id"]
            isOneToOne: false
            referencedRelation: "enterprise_offices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "enterprise_memberships_org_unit_id_fkey"
            columns: ["org_unit_id"]
            isOneToOne: false
            referencedRelation: "enterprise_org_units"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "enterprise_memberships_position_catalog_id_fkey"
            columns: ["position_catalog_id"]
            isOneToOne: false
            referencedRelation: "enterprise_workspace_roles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "enterprise_memberships_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "enterprise_org_pulse_membership"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "enterprise_memberships_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "enterprise_workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      enterprise_notification_preferences: {
        Row: {
          channel_email: boolean
          channel_push: boolean
          created_at: string
          event_type: string
          id: string
          updated_at: string
          user_id: string
          workspace_id: string
        }
        Insert: {
          channel_email?: boolean
          channel_push?: boolean
          created_at?: string
          event_type: string
          id?: string
          updated_at?: string
          user_id: string
          workspace_id: string
        }
        Update: {
          channel_email?: boolean
          channel_push?: boolean
          created_at?: string
          event_type?: string
          id?: string
          updated_at?: string
          user_id?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "enterprise_notification_preferences_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "enterprise_org_pulse_membership"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "enterprise_notification_preferences_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "enterprise_workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      enterprise_notifications: {
        Row: {
          created_at: string
          event_type: string
          id: string
          is_read: boolean
          message: string | null
          related_id: string | null
          related_type: string | null
          title: string
          user_id: string
          workspace_id: string
        }
        Insert: {
          created_at?: string
          event_type: string
          id?: string
          is_read?: boolean
          message?: string | null
          related_id?: string | null
          related_type?: string | null
          title: string
          user_id: string
          workspace_id: string
        }
        Update: {
          created_at?: string
          event_type?: string
          id?: string
          is_read?: boolean
          message?: string | null
          related_id?: string | null
          related_type?: string | null
          title?: string
          user_id?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "enterprise_notifications_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "enterprise_org_pulse_membership"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "enterprise_notifications_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "enterprise_workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      enterprise_office_coverage_rules: {
        Row: {
          archived_at: string | null
          business_role: string | null
          business_roles: string[] | null
          created_at: string
          created_by: string
          days_of_week: number[] | null
          id: string
          min_headcount: number
          min_skill_level: number | null
          name: string | null
          notes: string | null
          office_id: string
          rule_date: string | null
          skill_id: string | null
          skill_ids: string[] | null
          status: string
          updated_at: string
          valid_from: string | null
          valid_until: string | null
          workspace_id: string
        }
        Insert: {
          archived_at?: string | null
          business_role?: string | null
          business_roles?: string[] | null
          created_at?: string
          created_by: string
          days_of_week?: number[] | null
          id?: string
          min_headcount?: number
          min_skill_level?: number | null
          name?: string | null
          notes?: string | null
          office_id: string
          rule_date?: string | null
          skill_id?: string | null
          skill_ids?: string[] | null
          status?: string
          updated_at?: string
          valid_from?: string | null
          valid_until?: string | null
          workspace_id: string
        }
        Update: {
          archived_at?: string | null
          business_role?: string | null
          business_roles?: string[] | null
          created_at?: string
          created_by?: string
          days_of_week?: number[] | null
          id?: string
          min_headcount?: number
          min_skill_level?: number | null
          name?: string | null
          notes?: string | null
          office_id?: string
          rule_date?: string | null
          skill_id?: string | null
          skill_ids?: string[] | null
          status?: string
          updated_at?: string
          valid_from?: string | null
          valid_until?: string | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "enterprise_office_coverage_rules_office_id_fkey"
            columns: ["office_id"]
            isOneToOne: false
            referencedRelation: "enterprise_offices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "enterprise_office_coverage_rules_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "enterprise_org_pulse_membership"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "enterprise_office_coverage_rules_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "enterprise_workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      enterprise_offices: {
        Row: {
          address: string | null
          city: string | null
          created_at: string
          id: string
          name: string
          updated_at: string
          workspace_id: string
        }
        Insert: {
          address?: string | null
          city?: string | null
          created_at?: string
          id?: string
          name: string
          updated_at?: string
          workspace_id: string
        }
        Update: {
          address?: string | null
          city?: string | null
          created_at?: string
          id?: string
          name?: string
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "enterprise_offices_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "enterprise_org_pulse_membership"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "enterprise_offices_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "enterprise_workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      enterprise_onboarding_instances: {
        Row: {
          completed_at: string | null
          created_at: string
          due_at: string | null
          id: string
          member_id: string
          started_at: string
          status: string
          template_id: string | null
          template_version: number | null
          updated_at: string
          workspace_id: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          due_at?: string | null
          id?: string
          member_id: string
          started_at?: string
          status?: string
          template_id?: string | null
          template_version?: number | null
          updated_at?: string
          workspace_id: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          due_at?: string | null
          id?: string
          member_id?: string
          started_at?: string
          status?: string
          template_id?: string | null
          template_version?: number | null
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "enterprise_onboarding_instances_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "enterprise_memberships"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "enterprise_onboarding_instances_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "enterprise_onboarding_templates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "enterprise_onboarding_instances_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "enterprise_org_pulse_membership"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "enterprise_onboarding_instances_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "enterprise_workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      enterprise_onboarding_step_completions: {
        Row: {
          completed_at: string | null
          completed_by: string | null
          created_at: string
          evidence_ref: string | null
          id: string
          instance_id: string
          notes: string | null
          status: string
          step_id: string
          updated_at: string
        }
        Insert: {
          completed_at?: string | null
          completed_by?: string | null
          created_at?: string
          evidence_ref?: string | null
          id?: string
          instance_id: string
          notes?: string | null
          status?: string
          step_id: string
          updated_at?: string
        }
        Update: {
          completed_at?: string | null
          completed_by?: string | null
          created_at?: string
          evidence_ref?: string | null
          id?: string
          instance_id?: string
          notes?: string | null
          status?: string
          step_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "enterprise_onboarding_step_completions_instance_id_fkey"
            columns: ["instance_id"]
            isOneToOne: false
            referencedRelation: "enterprise_onboarding_instances"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "enterprise_onboarding_step_completions_step_id_fkey"
            columns: ["step_id"]
            isOneToOne: false
            referencedRelation: "enterprise_onboarding_template_steps"
            referencedColumns: ["id"]
          },
        ]
      }
      enterprise_onboarding_template_steps: {
        Row: {
          access_system_id: string | null
          content_ref: string | null
          created_at: string
          description: string | null
          due_offset_days: number
          escalate_after_days: number | null
          id: string
          mandatory: boolean
          owner_role: string | null
          sort_order: number
          step_type: string
          template_id: string
          title: string
          updated_at: string
        }
        Insert: {
          access_system_id?: string | null
          content_ref?: string | null
          created_at?: string
          description?: string | null
          due_offset_days?: number
          escalate_after_days?: number | null
          id?: string
          mandatory?: boolean
          owner_role?: string | null
          sort_order?: number
          step_type?: string
          template_id: string
          title: string
          updated_at?: string
        }
        Update: {
          access_system_id?: string | null
          content_ref?: string | null
          created_at?: string
          description?: string | null
          due_offset_days?: number
          escalate_after_days?: number | null
          id?: string
          mandatory?: boolean
          owner_role?: string | null
          sort_order?: number
          step_type?: string
          template_id?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "enterprise_onboarding_template_steps_access_system_fk"
            columns: ["access_system_id"]
            isOneToOne: false
            referencedRelation: "enterprise_access_systems"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "enterprise_onboarding_template_steps_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "enterprise_onboarding_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      enterprise_onboarding_templates: {
        Row: {
          archived_at: string | null
          created_at: string
          description: string | null
          id: string
          name: string
          scope_org_unit_id: string | null
          scope_position_id: string | null
          status: string
          updated_at: string
          version: number
          workspace_id: string
        }
        Insert: {
          archived_at?: string | null
          created_at?: string
          description?: string | null
          id?: string
          name: string
          scope_org_unit_id?: string | null
          scope_position_id?: string | null
          status?: string
          updated_at?: string
          version?: number
          workspace_id: string
        }
        Update: {
          archived_at?: string | null
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          scope_org_unit_id?: string | null
          scope_position_id?: string | null
          status?: string
          updated_at?: string
          version?: number
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "enterprise_onboarding_templates_scope_org_unit_id_fkey"
            columns: ["scope_org_unit_id"]
            isOneToOne: false
            referencedRelation: "enterprise_org_units"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "enterprise_onboarding_templates_scope_position_id_fkey"
            columns: ["scope_position_id"]
            isOneToOne: false
            referencedRelation: "enterprise_workspace_roles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "enterprise_onboarding_templates_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "enterprise_org_pulse_membership"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "enterprise_onboarding_templates_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "enterprise_workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      enterprise_org_chart_snapshots: {
        Row: {
          created_at: string
          generated_at: string
          id: string
          payload: Json
          workspace_id: string
        }
        Insert: {
          created_at?: string
          generated_at?: string
          id?: string
          payload: Json
          workspace_id: string
        }
        Update: {
          created_at?: string
          generated_at?: string
          id?: string
          payload?: Json
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "enterprise_org_chart_snapshots_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "enterprise_org_pulse_membership"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "enterprise_org_chart_snapshots_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "enterprise_workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      enterprise_org_units: {
        Row: {
          archived_at: string | null
          created_at: string
          id: string
          name: string
          parent_id: string | null
          sort_order: number
          unit_type: string | null
          updated_at: string
          workspace_id: string
        }
        Insert: {
          archived_at?: string | null
          created_at?: string
          id?: string
          name: string
          parent_id?: string | null
          sort_order?: number
          unit_type?: string | null
          updated_at?: string
          workspace_id: string
        }
        Update: {
          archived_at?: string | null
          created_at?: string
          id?: string
          name?: string
          parent_id?: string | null
          sort_order?: number
          unit_type?: string | null
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "enterprise_org_units_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "enterprise_org_units"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "enterprise_org_units_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "enterprise_org_pulse_membership"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "enterprise_org_units_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "enterprise_workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      enterprise_project_assignments: {
        Row: {
          allocated_percentage: number
          billable: boolean
          business_role: string
          created_at: string
          end_date: string | null
          id: string
          is_tentative: boolean
          membership_id: string
          notes: string | null
          project_id: string
          start_date: string
          updated_at: string
          workspace_id: string
        }
        Insert: {
          allocated_percentage?: number
          billable?: boolean
          business_role: string
          created_at?: string
          end_date?: string | null
          id?: string
          is_tentative?: boolean
          membership_id: string
          notes?: string | null
          project_id: string
          start_date: string
          updated_at?: string
          workspace_id: string
        }
        Update: {
          allocated_percentage?: number
          billable?: boolean
          business_role?: string
          created_at?: string
          end_date?: string | null
          id?: string
          is_tentative?: boolean
          membership_id?: string
          notes?: string | null
          project_id?: string
          start_date?: string
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "enterprise_project_assignments_membership_id_fkey"
            columns: ["membership_id"]
            isOneToOne: false
            referencedRelation: "enterprise_memberships"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "enterprise_project_assignments_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "enterprise_projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "enterprise_project_assignments_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "enterprise_org_pulse_membership"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "enterprise_project_assignments_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "enterprise_workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      enterprise_project_rates: {
        Row: {
          bill_rate: number
          business_role: string
          created_at: string
          currency: string
          id: string
          project_id: string
          updated_at: string
          workspace_id: string
        }
        Insert: {
          bill_rate?: number
          business_role: string
          created_at?: string
          currency?: string
          id?: string
          project_id: string
          updated_at?: string
          workspace_id: string
        }
        Update: {
          bill_rate?: number
          business_role?: string
          created_at?: string
          currency?: string
          id?: string
          project_id?: string
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "enterprise_project_rates_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "enterprise_projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "enterprise_project_rates_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "enterprise_org_pulse_membership"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "enterprise_project_rates_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "enterprise_workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      enterprise_project_resource_requirements: {
        Row: {
          business_role: string
          created_at: string
          id: string
          project_id: string
          required_percentage: number
          updated_at: string
          workspace_id: string
        }
        Insert: {
          business_role: string
          created_at?: string
          id?: string
          project_id: string
          required_percentage?: number
          updated_at?: string
          workspace_id: string
        }
        Update: {
          business_role?: string
          created_at?: string
          id?: string
          project_id?: string
          required_percentage?: number
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "enterprise_project_resource_requirements_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "enterprise_projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "enterprise_project_resource_requirements_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "enterprise_org_pulse_membership"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "enterprise_project_resource_requirements_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "enterprise_workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      enterprise_project_skill_requirements: {
        Row: {
          created_at: string
          id: string
          min_level: number
          project_id: string
          skill_id: string
          workspace_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          min_level?: number
          project_id: string
          skill_id: string
          workspace_id: string
        }
        Update: {
          created_at?: string
          id?: string
          min_level?: number
          project_id?: string
          skill_id?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "enterprise_project_skill_requirements_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "enterprise_projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "enterprise_project_skill_requirements_skill_id_fkey"
            columns: ["skill_id"]
            isOneToOne: false
            referencedRelation: "enterprise_skills"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "enterprise_project_skill_requirements_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "enterprise_org_pulse_membership"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "enterprise_project_skill_requirements_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "enterprise_workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      enterprise_projects: {
        Row: {
          color: string
          created_at: string
          created_by: string
          description: string | null
          end_date: string | null
          id: string
          is_open_ended: boolean
          name: string
          start_date: string
          status: string
          updated_at: string
          workspace_id: string
        }
        Insert: {
          color?: string
          created_at?: string
          created_by: string
          description?: string | null
          end_date?: string | null
          id?: string
          is_open_ended?: boolean
          name: string
          start_date: string
          status?: string
          updated_at?: string
          workspace_id: string
        }
        Update: {
          color?: string
          created_at?: string
          created_by?: string
          description?: string | null
          end_date?: string | null
          id?: string
          is_open_ended?: boolean
          name?: string
          start_date?: string
          status?: string
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "enterprise_projects_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "enterprise_org_pulse_membership"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "enterprise_projects_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "enterprise_workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      enterprise_quota_transactions: {
        Row: {
          amount_days: number
          created_at: string
          created_by: string
          id: string
          leave_request_id: string | null
          membership_id: string
          quota_id: string
          reason: string | null
          transaction_type: Database["public"]["Enums"]["quota_transaction_type"]
          workspace_id: string
        }
        Insert: {
          amount_days: number
          created_at?: string
          created_by: string
          id?: string
          leave_request_id?: string | null
          membership_id: string
          quota_id: string
          reason?: string | null
          transaction_type: Database["public"]["Enums"]["quota_transaction_type"]
          workspace_id: string
        }
        Update: {
          amount_days?: number
          created_at?: string
          created_by?: string
          id?: string
          leave_request_id?: string | null
          membership_id?: string
          quota_id?: string
          reason?: string | null
          transaction_type?: Database["public"]["Enums"]["quota_transaction_type"]
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "enterprise_quota_transactions_leave_request_id_fkey"
            columns: ["leave_request_id"]
            isOneToOne: false
            referencedRelation: "leave_requests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "enterprise_quota_transactions_membership_id_fkey"
            columns: ["membership_id"]
            isOneToOne: false
            referencedRelation: "enterprise_memberships"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "enterprise_quota_transactions_quota_id_fkey"
            columns: ["quota_id"]
            isOneToOne: false
            referencedRelation: "enterprise_leave_quota_balances"
            referencedColumns: ["quota_id"]
          },
          {
            foreignKeyName: "enterprise_quota_transactions_quota_id_fkey"
            columns: ["quota_id"]
            isOneToOne: false
            referencedRelation: "enterprise_leave_quotas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "enterprise_quota_transactions_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "enterprise_org_pulse_membership"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "enterprise_quota_transactions_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "enterprise_workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      enterprise_report_schedules: {
        Row: {
          created_at: string
          created_by: string
          day_of_month: number | null
          day_of_week: number | null
          frequency: string
          hour_of_day: number
          id: string
          is_active: boolean
          last_run_at: string | null
          last_run_error: string | null
          last_run_status: string | null
          recipients: string[]
          report_id: string
          updated_at: string
          workspace_id: string
        }
        Insert: {
          created_at?: string
          created_by: string
          day_of_month?: number | null
          day_of_week?: number | null
          frequency?: string
          hour_of_day?: number
          id?: string
          is_active?: boolean
          last_run_at?: string | null
          last_run_error?: string | null
          last_run_status?: string | null
          recipients?: string[]
          report_id: string
          updated_at?: string
          workspace_id: string
        }
        Update: {
          created_at?: string
          created_by?: string
          day_of_month?: number | null
          day_of_week?: number | null
          frequency?: string
          hour_of_day?: number
          id?: string
          is_active?: boolean
          last_run_at?: string | null
          last_run_error?: string | null
          last_run_status?: string | null
          recipients?: string[]
          report_id?: string
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "enterprise_report_schedules_report_id_fkey"
            columns: ["report_id"]
            isOneToOne: false
            referencedRelation: "enterprise_reports"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "enterprise_report_schedules_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "enterprise_org_pulse_membership"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "enterprise_report_schedules_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "enterprise_workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      enterprise_reports: {
        Row: {
          chart_type: string
          config: Json
          created_at: string
          created_by: string
          dashboard_slot: number | null
          data_source: string
          dataset_key: string | null
          description: string | null
          id: string
          is_pinned: boolean
          is_shared: boolean
          is_template: boolean
          name: string
          updated_at: string
          widget_size: string | null
          workspace_id: string
        }
        Insert: {
          chart_type?: string
          config?: Json
          created_at?: string
          created_by: string
          dashboard_slot?: number | null
          data_source: string
          dataset_key?: string | null
          description?: string | null
          id?: string
          is_pinned?: boolean
          is_shared?: boolean
          is_template?: boolean
          name: string
          updated_at?: string
          widget_size?: string | null
          workspace_id: string
        }
        Update: {
          chart_type?: string
          config?: Json
          created_at?: string
          created_by?: string
          dashboard_slot?: number | null
          data_source?: string
          dataset_key?: string | null
          description?: string | null
          id?: string
          is_pinned?: boolean
          is_shared?: boolean
          is_template?: boolean
          name?: string
          updated_at?: string
          widget_size?: string | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "enterprise_reports_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "enterprise_org_pulse_membership"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "enterprise_reports_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "enterprise_workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      enterprise_role_definitions: {
        Row: {
          created_at: string
          description: string | null
          display_name: string
          id: string
          is_system: boolean
          role_key: string
          sort_order: number
          updated_at: string
          workspace_id: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          display_name: string
          id?: string
          is_system?: boolean
          role_key: string
          sort_order?: number
          updated_at?: string
          workspace_id: string
        }
        Update: {
          created_at?: string
          description?: string | null
          display_name?: string
          id?: string
          is_system?: boolean
          role_key?: string
          sort_order?: number
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "enterprise_role_definitions_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "enterprise_org_pulse_membership"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "enterprise_role_definitions_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "enterprise_workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      enterprise_role_permissions: {
        Row: {
          access_level: string
          created_at: string
          feature_key: string
          id: string
          role_key: string
          updated_at: string
          workspace_id: string
        }
        Insert: {
          access_level?: string
          created_at?: string
          feature_key: string
          id?: string
          role_key: string
          updated_at?: string
          workspace_id: string
        }
        Update: {
          access_level?: string
          created_at?: string
          feature_key?: string
          id?: string
          role_key?: string
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "enterprise_role_permissions_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "enterprise_org_pulse_membership"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "enterprise_role_permissions_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "enterprise_workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      enterprise_rule_templates: {
        Row: {
          created_at: string
          created_by: string
          description: string | null
          id: string
          is_archived: boolean
          name: string
          template_data: Json
          updated_at: string
          version: number
          workspace_id: string
        }
        Insert: {
          created_at?: string
          created_by: string
          description?: string | null
          id?: string
          is_archived?: boolean
          name: string
          template_data?: Json
          updated_at?: string
          version?: number
          workspace_id: string
        }
        Update: {
          created_at?: string
          created_by?: string
          description?: string | null
          id?: string
          is_archived?: boolean
          name?: string
          template_data?: Json
          updated_at?: string
          version?: number
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "enterprise_rule_templates_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "enterprise_org_pulse_membership"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "enterprise_rule_templates_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "enterprise_workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      enterprise_scenario_assignments: {
        Row: {
          allocated_percentage: number
          business_role: string
          created_at: string
          end_date: string | null
          id: string
          membership_id: string
          notes: string | null
          project_id: string
          scenario_id: string
          start_date: string
          workspace_id: string
        }
        Insert: {
          allocated_percentage?: number
          business_role: string
          created_at?: string
          end_date?: string | null
          id?: string
          membership_id: string
          notes?: string | null
          project_id: string
          scenario_id: string
          start_date: string
          workspace_id: string
        }
        Update: {
          allocated_percentage?: number
          business_role?: string
          created_at?: string
          end_date?: string | null
          id?: string
          membership_id?: string
          notes?: string | null
          project_id?: string
          scenario_id?: string
          start_date?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "enterprise_scenario_assignments_membership_id_fkey"
            columns: ["membership_id"]
            isOneToOne: false
            referencedRelation: "enterprise_memberships"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "enterprise_scenario_assignments_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "enterprise_projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "enterprise_scenario_assignments_scenario_id_fkey"
            columns: ["scenario_id"]
            isOneToOne: false
            referencedRelation: "enterprise_scenarios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "enterprise_scenario_assignments_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "enterprise_org_pulse_membership"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "enterprise_scenario_assignments_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "enterprise_workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      enterprise_scenarios: {
        Row: {
          created_at: string
          created_by: string
          description: string | null
          id: string
          is_baseline: boolean
          name: string
          updated_at: string
          workspace_id: string
        }
        Insert: {
          created_at?: string
          created_by: string
          description?: string | null
          id?: string
          is_baseline?: boolean
          name: string
          updated_at?: string
          workspace_id: string
        }
        Update: {
          created_at?: string
          created_by?: string
          description?: string | null
          id?: string
          is_baseline?: boolean
          name?: string
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "enterprise_scenarios_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "enterprise_org_pulse_membership"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "enterprise_scenarios_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "enterprise_workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      enterprise_seed_config: {
        Row: {
          config: Json
          created_at: string
          id: string
          owner_id: string
          updated_at: string
        }
        Insert: {
          config?: Json
          created_at?: string
          id?: string
          owner_id: string
          updated_at?: string
        }
        Update: {
          config?: Json
          created_at?: string
          id?: string
          owner_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      enterprise_shift_assignments: {
        Row: {
          business_role: string | null
          created_at: string
          created_by: string
          id: string
          is_tentative: boolean
          membership_id: string
          notes: string | null
          office_id: string
          shift_date: string
          skill_id: string | null
          updated_at: string
          user_id: string
          workspace_id: string
        }
        Insert: {
          business_role?: string | null
          created_at?: string
          created_by: string
          id?: string
          is_tentative?: boolean
          membership_id: string
          notes?: string | null
          office_id: string
          shift_date: string
          skill_id?: string | null
          updated_at?: string
          user_id: string
          workspace_id: string
        }
        Update: {
          business_role?: string | null
          created_at?: string
          created_by?: string
          id?: string
          is_tentative?: boolean
          membership_id?: string
          notes?: string | null
          office_id?: string
          shift_date?: string
          skill_id?: string | null
          updated_at?: string
          user_id?: string
          workspace_id?: string
        }
        Relationships: []
      }
      enterprise_skills: {
        Row: {
          category: string | null
          color: string
          created_at: string
          id: string
          name: string
          updated_at: string
          workspace_id: string
        }
        Insert: {
          category?: string | null
          color?: string
          created_at?: string
          id?: string
          name: string
          updated_at?: string
          workspace_id: string
        }
        Update: {
          category?: string | null
          color?: string
          created_at?: string
          id?: string
          name?: string
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "enterprise_skills_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "enterprise_org_pulse_membership"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "enterprise_skills_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "enterprise_workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      enterprise_team_roles: {
        Row: {
          business_role: string
          created_at: string
          id: string
          team_id: string
          workspace_id: string
        }
        Insert: {
          business_role: string
          created_at?: string
          id?: string
          team_id: string
          workspace_id: string
        }
        Update: {
          business_role?: string
          created_at?: string
          id?: string
          team_id?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "enterprise_team_roles_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "enterprise_teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "enterprise_team_roles_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "enterprise_org_pulse_membership"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "enterprise_team_roles_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "enterprise_workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      enterprise_teams: {
        Row: {
          approval_mode: string
          created_at: string
          created_by: string
          description: string | null
          id: string
          max_absent: number | null
          name: string
          updated_at: string
          workspace_id: string
        }
        Insert: {
          approval_mode?: string
          created_at?: string
          created_by: string
          description?: string | null
          id?: string
          max_absent?: number | null
          name: string
          updated_at?: string
          workspace_id: string
        }
        Update: {
          approval_mode?: string
          created_at?: string
          created_by?: string
          description?: string | null
          id?: string
          max_absent?: number | null
          name?: string
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "enterprise_teams_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "enterprise_org_pulse_membership"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "enterprise_teams_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "enterprise_workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      enterprise_translation_overrides: {
        Row: {
          authored_by: string | null
          created_at: string
          id: string
          key: string
          locale: string
          source: string
          updated_at: string
          value: string
          workspace_id: string
        }
        Insert: {
          authored_by?: string | null
          created_at?: string
          id?: string
          key: string
          locale: string
          source?: string
          updated_at?: string
          value: string
          workspace_id: string
        }
        Update: {
          authored_by?: string | null
          created_at?: string
          id?: string
          key?: string
          locale?: string
          source?: string
          updated_at?: string
          value?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "enterprise_translation_overrides_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "enterprise_org_pulse_membership"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "enterprise_translation_overrides_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "enterprise_workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      enterprise_ui_section_states: {
        Row: {
          created_at: string
          id: string
          section_key: string
          state: string
          updated_at: string
          updated_by: string | null
          workspace_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          section_key: string
          state?: string
          updated_at?: string
          updated_by?: string | null
          workspace_id: string
        }
        Update: {
          created_at?: string
          id?: string
          section_key?: string
          state?: string
          updated_at?: string
          updated_by?: string | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "enterprise_ui_section_states_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "enterprise_org_pulse_membership"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "enterprise_ui_section_states_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "enterprise_workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      enterprise_user_calendar_integrations: {
        Row: {
          access_token: string | null
          created_at: string
          id: string
          is_active: boolean
          last_sync_at: string | null
          last_sync_error: string | null
          last_sync_status: string | null
          provider: string
          provider_user_email: string | null
          provider_user_id: string | null
          refresh_token: string | null
          scopes: string | null
          sync_events_in: boolean
          sync_events_out: boolean
          tenant_id: string | null
          token_expires_at: string | null
          updated_at: string
          user_id: string
          workspace_id: string
        }
        Insert: {
          access_token?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          last_sync_at?: string | null
          last_sync_error?: string | null
          last_sync_status?: string | null
          provider: string
          provider_user_email?: string | null
          provider_user_id?: string | null
          refresh_token?: string | null
          scopes?: string | null
          sync_events_in?: boolean
          sync_events_out?: boolean
          tenant_id?: string | null
          token_expires_at?: string | null
          updated_at?: string
          user_id: string
          workspace_id: string
        }
        Update: {
          access_token?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          last_sync_at?: string | null
          last_sync_error?: string | null
          last_sync_status?: string | null
          provider?: string
          provider_user_email?: string | null
          provider_user_id?: string | null
          refresh_token?: string | null
          scopes?: string | null
          sync_events_in?: boolean
          sync_events_out?: boolean
          tenant_id?: string | null
          token_expires_at?: string | null
          updated_at?: string
          user_id?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "enterprise_user_calendar_integrations_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "enterprise_org_pulse_membership"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "enterprise_user_calendar_integrations_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "enterprise_workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      enterprise_work_categories: {
        Row: {
          archived_at: string | null
          code: string
          created_at: string
          id: string
          label: string
          parent_id: string | null
          updated_at: string
          workspace_id: string
        }
        Insert: {
          archived_at?: string | null
          code: string
          created_at?: string
          id?: string
          label: string
          parent_id?: string | null
          updated_at?: string
          workspace_id: string
        }
        Update: {
          archived_at?: string | null
          code?: string
          created_at?: string
          id?: string
          label?: string
          parent_id?: string | null
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "enterprise_work_categories_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "enterprise_work_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "enterprise_work_categories_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "enterprise_org_pulse_membership"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "enterprise_work_categories_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "enterprise_workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      enterprise_workspace_integrations: {
        Row: {
          account_email: string | null
          api_token: string
          auto_create_on_approval: boolean
          base_url: string
          created_at: string
          created_by: string
          default_issue_type: string | null
          id: string
          is_active: boolean
          project_key: string | null
          provider: Database["public"]["Enums"]["integration_provider"]
          updated_at: string
          workspace_id: string
        }
        Insert: {
          account_email?: string | null
          api_token: string
          auto_create_on_approval?: boolean
          base_url: string
          created_at?: string
          created_by: string
          default_issue_type?: string | null
          id?: string
          is_active?: boolean
          project_key?: string | null
          provider: Database["public"]["Enums"]["integration_provider"]
          updated_at?: string
          workspace_id: string
        }
        Update: {
          account_email?: string | null
          api_token?: string
          auto_create_on_approval?: boolean
          base_url?: string
          created_at?: string
          created_by?: string
          default_issue_type?: string | null
          id?: string
          is_active?: boolean
          project_key?: string | null
          provider?: Database["public"]["Enums"]["integration_provider"]
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "enterprise_workspace_integrations_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "enterprise_org_pulse_membership"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "enterprise_workspace_integrations_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "enterprise_workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      enterprise_workspace_role_categories: {
        Row: {
          catalog_category_id: string | null
          created_at: string
          id: string
          is_active: boolean
          name: string
          updated_at: string
          workspace_id: string
        }
        Insert: {
          catalog_category_id?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          updated_at?: string
          workspace_id: string
        }
        Update: {
          catalog_category_id?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "enterprise_workspace_role_categories_catalog_category_id_fkey"
            columns: ["catalog_category_id"]
            isOneToOne: false
            referencedRelation: "enterprise_catalog_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "enterprise_workspace_role_categories_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "enterprise_org_pulse_membership"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "enterprise_workspace_role_categories_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "enterprise_workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      enterprise_workspace_role_skills: {
        Row: {
          approved: boolean
          created_at: string
          id: string
          min_experience_level:
            | Database["public"]["Enums"]["enterprise_experience_level"]
            | null
          required: boolean
          role_id: string
          updated_at: string
          workspace_id: string
          workspace_skill_id: string
        }
        Insert: {
          approved?: boolean
          created_at?: string
          id?: string
          min_experience_level?:
            | Database["public"]["Enums"]["enterprise_experience_level"]
            | null
          required?: boolean
          role_id: string
          updated_at?: string
          workspace_id: string
          workspace_skill_id: string
        }
        Update: {
          approved?: boolean
          created_at?: string
          id?: string
          min_experience_level?:
            | Database["public"]["Enums"]["enterprise_experience_level"]
            | null
          required?: boolean
          role_id?: string
          updated_at?: string
          workspace_id?: string
          workspace_skill_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "enterprise_workspace_role_skills_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "enterprise_workspace_roles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "enterprise_workspace_role_skills_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "enterprise_org_pulse_membership"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "enterprise_workspace_role_skills_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "enterprise_workspaces"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "enterprise_workspace_role_skills_workspace_skill_id_fkey"
            columns: ["workspace_skill_id"]
            isOneToOne: false
            referencedRelation: "enterprise_workspace_skills"
            referencedColumns: ["id"]
          },
        ]
      }
      enterprise_workspace_roles: {
        Row: {
          catalog_role_id: string | null
          category_id: string
          created_at: string
          id: string
          is_active: boolean
          name: string
          updated_at: string
          workspace_id: string
        }
        Insert: {
          catalog_role_id?: string | null
          category_id: string
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          updated_at?: string
          workspace_id: string
        }
        Update: {
          catalog_role_id?: string | null
          category_id?: string
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "enterprise_workspace_roles_catalog_role_id_fkey"
            columns: ["catalog_role_id"]
            isOneToOne: false
            referencedRelation: "enterprise_catalog_roles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "enterprise_workspace_roles_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "enterprise_workspace_role_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "enterprise_workspace_roles_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "enterprise_org_pulse_membership"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "enterprise_workspace_roles_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "enterprise_workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      enterprise_workspace_skills: {
        Row: {
          catalog_skill_id: string | null
          created_at: string
          id: string
          is_active: boolean
          name: string
          skill_id: string | null
          updated_at: string
          workspace_id: string
        }
        Insert: {
          catalog_skill_id?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          skill_id?: string | null
          updated_at?: string
          workspace_id: string
        }
        Update: {
          catalog_skill_id?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          skill_id?: string | null
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "enterprise_workspace_skills_catalog_skill_id_fkey"
            columns: ["catalog_skill_id"]
            isOneToOne: false
            referencedRelation: "enterprise_catalog_skills"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "enterprise_workspace_skills_skill_id_fkey"
            columns: ["skill_id"]
            isOneToOne: false
            referencedRelation: "enterprise_skills"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "enterprise_workspace_skills_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "enterprise_org_pulse_membership"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "enterprise_workspace_skills_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "enterprise_workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      enterprise_workspaces: {
        Row: {
          allow_manager_retroactive: boolean
          allow_other_dept_view: boolean
          brand_color: string | null
          brand_logo_dark_url: string | null
          brand_logo_light_url: string | null
          created_at: string
          created_by: string
          date_format: string
          default_locale: string | null
          description: string | null
          favicon_url: string | null
          fiscal_year_start_month: number
          help_ai_enabled: boolean
          help_last_regenerated_at: string | null
          holidays_auto_sync: boolean
          holidays_last_sync_at: string | null
          id: string
          is_archived: boolean
          locale: string
          name: string
          name_format: string
          recovery_mode: boolean
          recovery_mode_activated_at: string | null
          recovery_mode_activated_by: string | null
          recovery_mode_reason: string | null
          settings: Json
          show_past_absences: boolean
          timezone: string
          updated_at: string
          weekday_start: number
          white_label: boolean
        }
        Insert: {
          allow_manager_retroactive?: boolean
          allow_other_dept_view?: boolean
          brand_color?: string | null
          brand_logo_dark_url?: string | null
          brand_logo_light_url?: string | null
          created_at?: string
          created_by: string
          date_format?: string
          default_locale?: string | null
          description?: string | null
          favicon_url?: string | null
          fiscal_year_start_month?: number
          help_ai_enabled?: boolean
          help_last_regenerated_at?: string | null
          holidays_auto_sync?: boolean
          holidays_last_sync_at?: string | null
          id?: string
          is_archived?: boolean
          locale?: string
          name: string
          name_format?: string
          recovery_mode?: boolean
          recovery_mode_activated_at?: string | null
          recovery_mode_activated_by?: string | null
          recovery_mode_reason?: string | null
          settings?: Json
          show_past_absences?: boolean
          timezone?: string
          updated_at?: string
          weekday_start?: number
          white_label?: boolean
        }
        Update: {
          allow_manager_retroactive?: boolean
          allow_other_dept_view?: boolean
          brand_color?: string | null
          brand_logo_dark_url?: string | null
          brand_logo_light_url?: string | null
          created_at?: string
          created_by?: string
          date_format?: string
          default_locale?: string | null
          description?: string | null
          favicon_url?: string | null
          fiscal_year_start_month?: number
          help_ai_enabled?: boolean
          help_last_regenerated_at?: string | null
          holidays_auto_sync?: boolean
          holidays_last_sync_at?: string | null
          id?: string
          is_archived?: boolean
          locale?: string
          name?: string
          name_format?: string
          recovery_mode?: boolean
          recovery_mode_activated_at?: string | null
          recovery_mode_activated_by?: string | null
          recovery_mode_reason?: string | null
          settings?: Json
          show_past_absences?: boolean
          timezone?: string
          updated_at?: string
          weekday_start?: number
          white_label?: boolean
        }
        Relationships: []
      }
      event_participants: {
        Row: {
          event_id: string
          id: string
          invited_at: string
          user_id: string
        }
        Insert: {
          event_id: string
          id?: string
          invited_at?: string
          user_id: string
        }
        Update: {
          event_id?: string
          id?: string
          invited_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_participants_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      event_share_tokens: {
        Row: {
          allow_anonymous: boolean
          created_at: string
          created_by: string
          email: string | null
          event_id: string
          expires_at: string | null
          id: string
          max_uses: number | null
          token: string
          use_count: number
        }
        Insert: {
          allow_anonymous?: boolean
          created_at?: string
          created_by: string
          email?: string | null
          event_id: string
          expires_at?: string | null
          id?: string
          max_uses?: number | null
          token?: string
          use_count?: number
        }
        Update: {
          allow_anonymous?: boolean
          created_at?: string
          created_by?: string
          email?: string | null
          event_id?: string
          expires_at?: string | null
          id?: string
          max_uses?: number | null
          token?: string
          use_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "event_share_tokens_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      events: {
        Row: {
          allow_participant_sharing: boolean
          category: string | null
          created_at: string
          created_by: string
          deadline: string | null
          decided_date: string | null
          default_vote: string | null
          description: string | null
          end_date: string
          id: string
          is_active: boolean | null
          month: number
          options: Json | null
          start_date: string
          title: string
          updated_at: string
          year: number
        }
        Insert: {
          allow_participant_sharing?: boolean
          category?: string | null
          created_at?: string
          created_by: string
          deadline?: string | null
          decided_date?: string | null
          default_vote?: string | null
          description?: string | null
          end_date: string
          id?: string
          is_active?: boolean | null
          month: number
          options?: Json | null
          start_date: string
          title: string
          updated_at?: string
          year: number
        }
        Update: {
          allow_participant_sharing?: boolean
          category?: string | null
          created_at?: string
          created_by?: string
          deadline?: string | null
          decided_date?: string | null
          default_vote?: string | null
          description?: string | null
          end_date?: string
          id?: string
          is_active?: boolean | null
          month?: number
          options?: Json | null
          start_date?: string
          title?: string
          updated_at?: string
          year?: number
        }
        Relationships: []
      }
      favorites: {
        Row: {
          created_at: string
          favorite_user_id: string
          id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          favorite_user_id: string
          id?: string
          user_id: string
        }
        Update: {
          created_at?: string
          favorite_user_id?: string
          id?: string
          user_id?: string
        }
        Relationships: []
      }
      friendships: {
        Row: {
          addressee_id: string
          created_at: string
          id: string
          requester_id: string
          status: string
          updated_at: string
        }
        Insert: {
          addressee_id: string
          created_at?: string
          id?: string
          requester_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          addressee_id?: string
          created_at?: string
          id?: string
          requester_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      help_articles: {
        Row: {
          anchor_id: string | null
          archived_at: string | null
          body_md: string
          content_hash: string | null
          created_at: string
          id: string
          is_active: boolean
          is_system_generated: boolean
          last_generated_at: string
          locale: string
          related_topics: string[]
          release_id: string | null
          route: string | null
          search_tokens: unknown
          source_release_tag: string | null
          summary: string | null
          synonyms: string[]
          tags: string[]
          taxonomy: string
          title: string
          topic_key: string
          updated_at: string
        }
        Insert: {
          anchor_id?: string | null
          archived_at?: string | null
          body_md: string
          content_hash?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          is_system_generated?: boolean
          last_generated_at?: string
          locale: string
          related_topics?: string[]
          release_id?: string | null
          route?: string | null
          search_tokens?: unknown
          source_release_tag?: string | null
          summary?: string | null
          synonyms?: string[]
          tags?: string[]
          taxonomy?: string
          title: string
          topic_key: string
          updated_at?: string
        }
        Update: {
          anchor_id?: string | null
          archived_at?: string | null
          body_md?: string
          content_hash?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          is_system_generated?: boolean
          last_generated_at?: string
          locale?: string
          related_topics?: string[]
          release_id?: string | null
          route?: string | null
          search_tokens?: unknown
          source_release_tag?: string | null
          summary?: string | null
          synonyms?: string[]
          tags?: string[]
          taxonomy?: string
          title?: string
          topic_key?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "help_articles_release_id_fkey"
            columns: ["release_id"]
            isOneToOne: false
            referencedRelation: "help_releases"
            referencedColumns: ["id"]
          },
        ]
      }
      help_releases: {
        Row: {
          changed_files: Json | null
          commit_sha: string | null
          completed_at: string | null
          created_at: string
          error: string | null
          id: string
          started_at: string
          status: string
          summary: string | null
          triggered_by: string | null
          version_tag: string
        }
        Insert: {
          changed_files?: Json | null
          commit_sha?: string | null
          completed_at?: string | null
          created_at?: string
          error?: string | null
          id?: string
          started_at?: string
          status?: string
          summary?: string | null
          triggered_by?: string | null
          version_tag: string
        }
        Update: {
          changed_files?: Json | null
          commit_sha?: string | null
          completed_at?: string | null
          created_at?: string
          error?: string | null
          id?: string
          started_at?: string
          status?: string
          summary?: string | null
          triggered_by?: string | null
          version_tag?: string
        }
        Relationships: []
      }
      leave_request_attachments: {
        Row: {
          created_at: string
          filename: string
          id: string
          leave_request_id: string
          mime_type: string | null
          size_bytes: number | null
          storage_path: string
          uploaded_by: string
          workspace_id: string
        }
        Insert: {
          created_at?: string
          filename: string
          id?: string
          leave_request_id: string
          mime_type?: string | null
          size_bytes?: number | null
          storage_path: string
          uploaded_by: string
          workspace_id: string
        }
        Update: {
          created_at?: string
          filename?: string
          id?: string
          leave_request_id?: string
          mime_type?: string | null
          size_bytes?: number | null
          storage_path?: string
          uploaded_by?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "leave_request_attachments_leave_request_id_fkey"
            columns: ["leave_request_id"]
            isOneToOne: false
            referencedRelation: "leave_requests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leave_request_attachments_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "enterprise_org_pulse_membership"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "leave_request_attachments_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "enterprise_workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      leave_request_substitutes: {
        Row: {
          created_at: string
          decline_reason: string | null
          id: string
          leave_request_id: string
          order_index: number
          responded_at: string | null
          status: Database["public"]["Enums"]["substitute_status"]
          substitute_user_id: string
          workspace_id: string
        }
        Insert: {
          created_at?: string
          decline_reason?: string | null
          id?: string
          leave_request_id: string
          order_index?: number
          responded_at?: string | null
          status?: Database["public"]["Enums"]["substitute_status"]
          substitute_user_id: string
          workspace_id: string
        }
        Update: {
          created_at?: string
          decline_reason?: string | null
          id?: string
          leave_request_id?: string
          order_index?: number
          responded_at?: string | null
          status?: Database["public"]["Enums"]["substitute_status"]
          substitute_user_id?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "leave_request_substitutes_leave_request_id_fkey"
            columns: ["leave_request_id"]
            isOneToOne: false
            referencedRelation: "leave_requests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leave_request_substitutes_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "enterprise_org_pulse_membership"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "leave_request_substitutes_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "enterprise_workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      leave_requests: {
        Row: {
          cancellation_reason: string | null
          comment: string | null
          created_at: string
          end_date: string
          half_day_period: string | null
          id: string
          is_half_day: boolean
          is_private: boolean
          leave_type: Database["public"]["Enums"]["leave_type"]
          parent_request_id: string | null
          recurrence_pattern: Json | null
          review_comment: string | null
          reviewed_at: string | null
          reviewer_id: string | null
          start_date: string
          status: Database["public"]["Enums"]["leave_request_status"]
          updated_at: string
          user_id: string
          workspace_id: string
        }
        Insert: {
          cancellation_reason?: string | null
          comment?: string | null
          created_at?: string
          end_date: string
          half_day_period?: string | null
          id?: string
          is_half_day?: boolean
          is_private?: boolean
          leave_type?: Database["public"]["Enums"]["leave_type"]
          parent_request_id?: string | null
          recurrence_pattern?: Json | null
          review_comment?: string | null
          reviewed_at?: string | null
          reviewer_id?: string | null
          start_date: string
          status?: Database["public"]["Enums"]["leave_request_status"]
          updated_at?: string
          user_id: string
          workspace_id: string
        }
        Update: {
          cancellation_reason?: string | null
          comment?: string | null
          created_at?: string
          end_date?: string
          half_day_period?: string | null
          id?: string
          is_half_day?: boolean
          is_private?: boolean
          leave_type?: Database["public"]["Enums"]["leave_type"]
          parent_request_id?: string | null
          recurrence_pattern?: Json | null
          review_comment?: string | null
          reviewed_at?: string | null
          reviewer_id?: string | null
          start_date?: string
          status?: Database["public"]["Enums"]["leave_request_status"]
          updated_at?: string
          user_id?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "leave_requests_parent_request_id_fkey"
            columns: ["parent_request_id"]
            isOneToOne: false
            referencedRelation: "leave_requests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leave_requests_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "enterprise_org_pulse_membership"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "leave_requests_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "enterprise_workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      personal_availability: {
        Row: {
          availability_date: string
          created_at: string
          id: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          availability_date: string
          created_at?: string
          id?: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          availability_date?: string
          created_at?: string
          id?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          display_name: string | null
          id: string
          is_temporary: boolean
          linked_event_id: string | null
          preferences: Json | null
          preferred_locale: string | null
          temp_access_token: string | null
          temp_verification_code: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          id?: string
          is_temporary?: boolean
          linked_event_id?: string | null
          preferences?: Json | null
          preferred_locale?: string | null
          temp_access_token?: string | null
          temp_verification_code?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          id?: string
          is_temporary?: boolean
          linked_event_id?: string | null
          preferences?: Json | null
          preferred_locale?: string | null
          temp_access_token?: string | null
          temp_verification_code?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_linked_event_id_fkey"
            columns: ["linked_event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      suppressed_emails: {
        Row: {
          created_at: string
          email: string
          id: string
          metadata: Json | null
          reason: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          metadata?: Json | null
          reason: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          metadata?: Json | null
          reason?: string
        }
        Relationships: []
      }
      tenant_calendar_settings: {
        Row: {
          created_at: string
          filters_config: Json
          id: string
          updated_at: string
          updated_by: string | null
          workspace_id: string
        }
        Insert: {
          created_at?: string
          filters_config?: Json
          id?: string
          updated_at?: string
          updated_by?: string | null
          workspace_id: string
        }
        Update: {
          created_at?: string
          filters_config?: Json
          id?: string
          updated_at?: string
          updated_by?: string | null
          workspace_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      votes: {
        Row: {
          created_at: string
          event_id: string
          id: string
          updated_at: string
          user_id: string
          vote_date: string
          vote_value: string
        }
        Insert: {
          created_at?: string
          event_id: string
          id?: string
          updated_at?: string
          user_id: string
          vote_date: string
          vote_value?: string
        }
        Update: {
          created_at?: string
          event_id?: string
          id?: string
          updated_at?: string
          user_id?: string
          vote_date?: string
          vote_value?: string
        }
        Relationships: [
          {
            foreignKeyName: "votes_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      enterprise_leave_quota_balances: {
        Row: {
          available_days: number | null
          carryover_days: number | null
          carryover_expires_at: string | null
          consumed_days: number | null
          initial_days: number | null
          leave_type: Database["public"]["Enums"]["leave_type"] | null
          manual_adjustment_days: number | null
          membership_id: string | null
          quota_id: string | null
          refunded_days: number | null
          workspace_id: string | null
          year: number | null
        }
        Relationships: [
          {
            foreignKeyName: "enterprise_leave_quotas_membership_id_fkey"
            columns: ["membership_id"]
            isOneToOne: false
            referencedRelation: "enterprise_memberships"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "enterprise_leave_quotas_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "enterprise_org_pulse_membership"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "enterprise_leave_quotas_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "enterprise_workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      enterprise_org_pulse_membership: {
        Row: {
          active_count: number | null
          employer_rights_count: number | null
          missing_contract: number | null
          missing_leadership: number | null
          missing_manager: number | null
          missing_org_unit: number | null
          workspace_id: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      attendance_caller_membership: {
        Args: { p_workspace_id: string }
        Returns: string
      }
      attendance_can_edit_period: {
        Args: { p_period_id: string }
        Returns: boolean
      }
      attendance_delete_oncall_window: {
        Args: { p_window_id: string }
        Returns: undefined
      }
      attendance_delete_segment: {
        Args: { p_segment_id: string }
        Returns: undefined
      }
      attendance_expected_hours_for_period: {
        Args: {
          p_membership_id: string
          p_month: number
          p_template_id: string
          p_workspace_id: string
          p_year: number
        }
        Returns: number
      }
      attendance_get_or_create_period: {
        Args: {
          p_membership_id?: string
          p_month: number
          p_workspace_id: string
          p_year: number
        }
        Returns: string
      }
      attendance_list_workspace_periods: {
        Args: { p_month: number; p_workspace_id: string; p_year: number }
        Returns: {
          approved_at: string
          display_name: string
          email: string
          exported_at: string
          locked_at: string
          membership_id: string
          period_id: string
          status: Database["public"]["Enums"]["enterprise_attendance_period_status"]
          submitted_at: string
          totals: Json
          user_id: string
        }[]
      }
      attendance_payroll_export: {
        Args: {
          p_month: number
          p_only_locked?: boolean
          p_workspace_id: string
          p_year: number
        }
        Returns: {
          approved_at: string
          business_role: string
          display_name: string
          email: string
          expected_after_leave: number
          expected_hours: number
          leave_days: number
          leave_hours: number
          locked_at: string
          membership_id: string
          night_hours: number
          office_name: string
          oncall_intervention_hours: number
          oncall_standby_compensated_hours: number
          oncall_standby_hours: number
          overtime_hours: number
          payroll_total_hours: number
          period_label: string
          regular_hours: number
          status: string
          submitted_at: string
          team: string
          user_id: string
          weekend_overtime_hours: number
          worked_hours: number
        }[]
      }
      attendance_recompute_totals: {
        Args: { p_period_id: string }
        Returns: Json
      }
      attendance_record_export: {
        Args: {
          p_format: string
          p_member_count: number
          p_month: number
          p_payload: Json
          p_total_periods: number
          p_variant: string
          p_workspace_id: string
          p_year: number
        }
        Returns: string
      }
      attendance_remove_site_assignment: {
        Args: {
          p_membership_id: string
          p_shift_date: string
          p_workspace_id: string
        }
        Returns: undefined
      }
      attendance_transition_period: {
        Args: {
          p_period_id: string
          p_reason?: string
          p_target_status: Database["public"]["Enums"]["enterprise_attendance_period_status"]
        }
        Returns: undefined
      }
      attendance_upsert_oncall_window: {
        Args: {
          p_ends_at: string
          p_is_night: boolean
          p_is_weekend: boolean
          p_multiplier?: number
          p_note?: string
          p_period_id: string
          p_starts_at: string
          p_window_id: string
        }
        Returns: string
      }
      attendance_upsert_segment: {
        Args: {
          p_ends_at: string
          p_is_night: boolean
          p_is_weekend: boolean
          p_note?: string
          p_oncall_window_id?: string
          p_period_id: string
          p_segment_id: string
          p_segment_type: Database["public"]["Enums"]["enterprise_attendance_segment_type"]
          p_starts_at: string
        }
        Returns: string
      }
      attendance_upsert_site_assignment: {
        Args: {
          p_membership_id: string
          p_office_id: string
          p_shift_date: string
          p_workspace_id: string
        }
        Returns: undefined
      }
      auto_archive_expired_coverage_rules: { Args: never; Returns: number }
      calc_leave_days: {
        Args: { _end: string; _half: boolean; _start: string }
        Returns: number
      }
      can_access_event: {
        Args: { _event_id: string; _user_id: string }
        Returns: boolean
      }
      create_workspace_with_owner: {
        Args: { _description?: string; _name: string }
        Returns: string
      }
      delete_email: {
        Args: { message_id: number; queue_name: string }
        Returns: boolean
      }
      enqueue_email: {
        Args: { payload: Json; queue_name: string }
        Returns: number
      }
      ganttic_has_dependency_cycle: {
        Args: {
          p_integration_id: string
          p_predecessor: string
          p_successor: string
          p_workspace_id: string
        }
        Returns: boolean
      }
      get_user_ids_by_emails: {
        Args: { p_emails: string[] }
        Returns: {
          email: string
          user_id: string
        }[]
      }
      get_workspace_leave_for_export: {
        Args: {
          p_end_date?: string
          p_start_date?: string
          p_status?: string
          p_workspace_id: string
        }
        Returns: {
          comment: string
          display_name: string
          email: string
          end_date: string
          half_day_period: string
          is_half_day: boolean
          leave_type: string
          start_date: string
          status: string
          team: string
        }[]
      }
      get_workspace_members_for_export: {
        Args: { p_workspace_id: string }
        Returns: {
          base_working_hours: number
          business_role: string
          city: string
          contract_type: string
          display_name: string
          email: string
          employer_rights: boolean
          joined_at: string
          leadership_category: string
          leadership_level: string
          location: string
          manager_email: string
          membership_id: string
          office_name: string
          org_unit_name: string
          role: string
          seniority: string
          skills: string
          status: string
          subordinate_emails: string
          team: string
          user_id: string
          weekly_capacity_hours: number
        }[]
      }
      has_enterprise_role: {
        Args: {
          _roles: Database["public"]["Enums"]["enterprise_role"][]
          _user_id: string
          _workspace_id: string
        }
        Returns: boolean
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      hr_workflow_close_instance: {
        Args: { p_instance_id: string; p_status?: string }
        Returns: undefined
      }
      hr_workflow_create_instance: {
        Args: {
          p_category?: string
          p_due_date?: string
          p_membership_id?: string
          p_notes?: string
          p_priority?: string
          p_template_id?: string
          p_title?: string
          p_workspace_id: string
        }
        Returns: string
      }
      hr_workflow_list_instances: {
        Args: { p_category?: string; p_status?: string; p_workspace_id: string }
        Returns: {
          category: string
          completed_at: string
          done_tasks: number
          due_date: string
          id: string
          member_name: string
          membership_id: string
          notes: string
          priority: string
          started_at: string
          status: string
          template_id: string
          title: string
          total_tasks: number
        }[]
      }
      hr_workflow_update_task: {
        Args: { p_status: string; p_task_id: string }
        Returns: undefined
      }
      import_enterprise_catalog_to_workspace: {
        Args: { p_approved?: boolean; p_workspace_id: string }
        Returns: {
          categories_imported: number
          role_skill_links_imported: number
          roles_imported: number
          skills_imported: number
        }[]
      }
      is_enterprise_member: {
        Args: { _user_id: string; _workspace_id: string }
        Returns: boolean
      }
      move_to_dlq: {
        Args: {
          dlq_name: string
          message_id: number
          payload: Json
          source_queue: string
        }
        Returns: number
      }
      read_email_batch: {
        Args: { batch_size: number; queue_name: string; vt: number }
        Returns: {
          message: Json
          msg_id: number
          read_ct: number
        }[]
      }
      seed_default_access_systems: {
        Args: { p_workspace_id: string }
        Returns: undefined
      }
      seed_default_contract_types: {
        Args: { p_workspace_id: string }
        Returns: undefined
      }
      seed_default_leadership_levels: {
        Args: { p_workspace_id: string }
        Returns: undefined
      }
    }
    Enums: {
      app_role: "admin" | "user"
      enterprise_attendance_period_status:
        | "draft"
        | "submitted"
        | "returned"
        | "approved"
        | "locked"
        | "exported"
      enterprise_attendance_segment_type:
        | "regular"
        | "overtime"
        | "break"
        | "oncall_intervention"
      enterprise_experience_level:
        | "junior"
        | "medior"
        | "senior"
        | "lead"
        | "principal"
      enterprise_membership_status:
        | "active"
        | "invited"
        | "suspended"
        | "removed"
      enterprise_role: "owner" | "resourceAssistant" | "member"
      integration_provider: "jira" | "azure_devops"
      leave_request_status:
        | "draft"
        | "pending"
        | "approved"
        | "rejected"
        | "cancelled"
        | "expired"
      leave_type: "vacation" | "sick_leave" | "unpaid_leave" | "other"
      quota_transaction_type:
        | "consume"
        | "refund"
        | "adjustment"
        | "carryover"
        | "grant"
      substitute_status: "pending" | "confirmed" | "declined"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "user"],
      enterprise_attendance_period_status: [
        "draft",
        "submitted",
        "returned",
        "approved",
        "locked",
        "exported",
      ],
      enterprise_attendance_segment_type: [
        "regular",
        "overtime",
        "break",
        "oncall_intervention",
      ],
      enterprise_experience_level: [
        "junior",
        "medior",
        "senior",
        "lead",
        "principal",
      ],
      enterprise_membership_status: [
        "active",
        "invited",
        "suspended",
        "removed",
      ],
      enterprise_role: ["owner", "resourceAssistant", "member"],
      integration_provider: ["jira", "azure_devops"],
      leave_request_status: [
        "draft",
        "pending",
        "approved",
        "rejected",
        "cancelled",
        "expired",
      ],
      leave_type: ["vacation", "sick_leave", "unpaid_leave", "other"],
      quota_transaction_type: [
        "consume",
        "refund",
        "adjustment",
        "carryover",
        "grant",
      ],
      substitute_status: ["pending", "confirmed", "declined"],
    },
  },
} as const
