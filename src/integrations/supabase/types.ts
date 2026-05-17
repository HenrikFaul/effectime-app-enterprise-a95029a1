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
      addon_features: {
        Row: {
          addon_id: string
          feature_id: string
          id: string
          limit_value: Json | null
        }
        Insert: {
          addon_id: string
          feature_id: string
          id?: string
          limit_value?: Json | null
        }
        Update: {
          addon_id?: string
          feature_id?: string
          id?: string
          limit_value?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "addon_features_addon_id_fkey"
            columns: ["addon_id"]
            isOneToOne: false
            referencedRelation: "addons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "addon_features_feature_id_fkey"
            columns: ["feature_id"]
            isOneToOne: false
            referencedRelation: "features"
            referencedColumns: ["id"]
          },
        ]
      }
      addons: {
        Row: {
          addon_key: string
          created_at: string
          currency: string
          description: string | null
          id: string
          metadata: Json
          monthly_flat: number
          name: string
          price_per_seat: number
          updated_at: string
        }
        Insert: {
          addon_key: string
          created_at?: string
          currency?: string
          description?: string | null
          id?: string
          metadata?: Json
          monthly_flat?: number
          name: string
          price_per_seat?: number
          updated_at?: string
        }
        Update: {
          addon_key?: string
          created_at?: string
          currency?: string
          description?: string | null
          id?: string
          metadata?: Json
          monthly_flat?: number
          name?: string
          price_per_seat?: number
          updated_at?: string
        }
        Relationships: []
      }
      ai_copilot_conversations: {
        Row: {
          created_at: string
          id: string
          title: string | null
          updated_at: string
          user_id: string
          workspace_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          title?: string | null
          updated_at?: string
          user_id: string
          workspace_id: string
        }
        Update: {
          created_at?: string
          id?: string
          title?: string | null
          updated_at?: string
          user_id?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_copilot_conversations_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "enterprise_org_pulse_membership"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "ai_copilot_conversations_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "enterprise_workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_copilot_messages: {
        Row: {
          content: string
          conversation_id: string
          created_at: string
          id: string
          input_tokens: number | null
          model: string | null
          output_tokens: number | null
          role: string
          structured_plan: Json | null
        }
        Insert: {
          content: string
          conversation_id: string
          created_at?: string
          id?: string
          input_tokens?: number | null
          model?: string | null
          output_tokens?: number | null
          role: string
          structured_plan?: Json | null
        }
        Update: {
          content?: string
          conversation_id?: string
          created_at?: string
          id?: string
          input_tokens?: number | null
          model?: string | null
          output_tokens?: number | null
          role?: string
          structured_plan?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "ai_copilot_messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "ai_copilot_conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_copilot_rate_limits: {
        Row: {
          hit_at: string
          id: string
          user_id: string
          workspace_id: string
        }
        Insert: {
          hit_at?: string
          id?: string
          user_id: string
          workspace_id: string
        }
        Update: {
          hit_at?: string
          id?: string
          user_id?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_copilot_rate_limits_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "enterprise_org_pulse_membership"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "ai_copilot_rate_limits_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "enterprise_workspaces"
            referencedColumns: ["id"]
          },
        ]
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
      ats_integrations: {
        Row: {
          config_json: Json
          created_at: string
          id: string
          is_active: boolean
          last_sync_at: string | null
          provider: string
          updated_at: string
          workspace_id: string
        }
        Insert: {
          config_json?: Json
          created_at?: string
          id?: string
          is_active?: boolean
          last_sync_at?: string | null
          provider: string
          updated_at?: string
          workspace_id: string
        }
        Update: {
          config_json?: Json
          created_at?: string
          id?: string
          is_active?: boolean
          last_sync_at?: string | null
          provider?: string
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ats_integrations_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "enterprise_org_pulse_membership"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "ats_integrations_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "enterprise_workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      candidates: {
        Row: {
          ats_candidate_id: string | null
          ats_provider: string | null
          created_at: string
          created_by: string | null
          email: string
          id: string
          metadata: Json
          name: string
          position_applied: string | null
          status: string
          updated_at: string
          workspace_id: string
        }
        Insert: {
          ats_candidate_id?: string | null
          ats_provider?: string | null
          created_at?: string
          created_by?: string | null
          email: string
          id?: string
          metadata?: Json
          name: string
          position_applied?: string | null
          status?: string
          updated_at?: string
          workspace_id: string
        }
        Update: {
          ats_candidate_id?: string | null
          ats_provider?: string | null
          created_at?: string
          created_by?: string | null
          email?: string
          id?: string
          metadata?: Json
          name?: string
          position_applied?: string | null
          status?: string
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "candidates_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "enterprise_org_pulse_membership"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "candidates_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "enterprise_workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      clock_events: {
        Row: {
          created_at: string
          distance_m: number | null
          event_type: string
          id: string
          latitude: number | null
          longitude: number | null
          membership_id: string
          method: string
          office_id: string | null
          raw_data: Json
          verified: boolean
          workspace_id: string
        }
        Insert: {
          created_at?: string
          distance_m?: number | null
          event_type: string
          id?: string
          latitude?: number | null
          longitude?: number | null
          membership_id: string
          method: string
          office_id?: string | null
          raw_data?: Json
          verified?: boolean
          workspace_id: string
        }
        Update: {
          created_at?: string
          distance_m?: number | null
          event_type?: string
          id?: string
          latitude?: number | null
          longitude?: number | null
          membership_id?: string
          method?: string
          office_id?: string | null
          raw_data?: Json
          verified?: boolean
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "clock_events_membership_id_fkey"
            columns: ["membership_id"]
            isOneToOne: false
            referencedRelation: "enterprise_memberships"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clock_events_office_id_fkey"
            columns: ["office_id"]
            isOneToOne: false
            referencedRelation: "enterprise_offices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clock_events_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "enterprise_org_pulse_membership"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "clock_events_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "enterprise_workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      compliance_rulesets: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          jurisdiction: string
          parameters: Json
          updated_at: string
          workspace_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          jurisdiction?: string
          parameters?: Json
          updated_at?: string
          workspace_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          jurisdiction?: string
          parameters?: Json
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "compliance_rulesets_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "enterprise_org_pulse_membership"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "compliance_rulesets_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "enterprise_workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      compliance_violations: {
        Row: {
          actual_value: number | null
          details: Json
          detected_at: string
          id: string
          jurisdiction: string
          limit_value: number | null
          membership_id: string | null
          period_end: string
          period_start: string
          resolved_at: string | null
          rule_key: string
          severity: string
          workspace_id: string
        }
        Insert: {
          actual_value?: number | null
          details?: Json
          detected_at?: string
          id?: string
          jurisdiction: string
          limit_value?: number | null
          membership_id?: string | null
          period_end: string
          period_start: string
          resolved_at?: string | null
          rule_key: string
          severity?: string
          workspace_id: string
        }
        Update: {
          actual_value?: number | null
          details?: Json
          detected_at?: string
          id?: string
          jurisdiction?: string
          limit_value?: number | null
          membership_id?: string | null
          period_end?: string
          period_start?: string
          resolved_at?: string | null
          rule_key?: string
          severity?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "compliance_violations_membership_id_fkey"
            columns: ["membership_id"]
            isOneToOne: false
            referencedRelation: "enterprise_memberships"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "compliance_violations_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "enterprise_org_pulse_membership"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "compliance_violations_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "enterprise_workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_success_health_scores: {
        Row: {
          calculated_at: string
          components: Json
          id: string
          score: number
          trend: string
          workspace_id: string
        }
        Insert: {
          calculated_at?: string
          components?: Json
          id?: string
          score: number
          trend?: string
          workspace_id: string
        }
        Update: {
          calculated_at?: string
          components?: Json
          id?: string
          score?: number
          trend?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "customer_success_health_scores_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "enterprise_org_pulse_membership"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "customer_success_health_scores_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "enterprise_workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_success_nps_surveys: {
        Row: {
          category: string
          feedback: string | null
          id: string
          responded_at: string | null
          score: number | null
          triggered_at: string
          user_id: string
          workspace_id: string
        }
        Insert: {
          category?: string
          feedback?: string | null
          id?: string
          responded_at?: string | null
          score?: number | null
          triggered_at?: string
          user_id: string
          workspace_id: string
        }
        Update: {
          category?: string
          feedback?: string | null
          id?: string
          responded_at?: string | null
          score?: number | null
          triggered_at?: string
          user_id?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "customer_success_nps_surveys_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "enterprise_org_pulse_membership"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "customer_success_nps_surveys_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "enterprise_workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_success_onboarding_progress: {
        Row: {
          completed_at: string
          completed_by: string | null
          id: string
          item_key: string
          workspace_id: string
        }
        Insert: {
          completed_at?: string
          completed_by?: string | null
          id?: string
          item_key: string
          workspace_id: string
        }
        Update: {
          completed_at?: string
          completed_by?: string | null
          id?: string
          item_key?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "customer_success_onboarding_progress_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "enterprise_org_pulse_membership"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "customer_success_onboarding_progress_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "enterprise_workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      data_retention_policies: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          is_active: boolean
          retention_days: number
          table_name: string
          updated_at: string
          workspace_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          retention_days: number
          table_name: string
          updated_at?: string
          workspace_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          retention_days?: number
          table_name?: string
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "data_retention_policies_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "enterprise_org_pulse_membership"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "data_retention_policies_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "enterprise_workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      document_templates: {
        Row: {
          body_html: string
          created_at: string
          doc_type: string
          id: string
          is_system: boolean
          language: string
          name: string
          updated_at: string
          variables: string[]
          workspace_id: string | null
        }
        Insert: {
          body_html: string
          created_at?: string
          doc_type: string
          id?: string
          is_system?: boolean
          language?: string
          name: string
          updated_at?: string
          variables?: string[]
          workspace_id?: string | null
        }
        Update: {
          body_html?: string
          created_at?: string
          doc_type?: string
          id?: string
          is_system?: boolean
          language?: string
          name?: string
          updated_at?: string
          variables?: string[]
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "document_templates_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "enterprise_org_pulse_membership"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "document_templates_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "enterprise_workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      email_queue: {
        Row: {
          body_html: string | null
          created_at: string
          error: string | null
          id: string
          recipient: string
          sent_at: string | null
          status: string
          subject: string | null
        }
        Insert: {
          body_html?: string | null
          created_at?: string
          error?: string | null
          id?: string
          recipient: string
          sent_at?: string | null
          status?: string
          subject?: string | null
        }
        Update: {
          body_html?: string | null
          created_at?: string
          error?: string | null
          id?: string
          recipient?: string
          sent_at?: string | null
          status?: string
          subject?: string | null
        }
        Relationships: []
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
      engagement_achievements: {
        Row: {
          category: string
          created_at: string
          icon: string
          id: string
          is_repeatable: boolean
          key: string
          sort_order: number
          threshold: number
          trigger_event: string
        }
        Insert: {
          category: string
          created_at?: string
          icon: string
          id?: string
          is_repeatable?: boolean
          key: string
          sort_order?: number
          threshold?: number
          trigger_event: string
        }
        Update: {
          category?: string
          created_at?: string
          icon?: string
          id?: string
          is_repeatable?: boolean
          key?: string
          sort_order?: number
          threshold?: number
          trigger_event?: string
        }
        Relationships: []
      }
      engagement_member_achievements: {
        Row: {
          achievement_id: string
          earned_at: string
          id: string
          membership_id: string
          streak_value: number | null
          workspace_id: string
        }
        Insert: {
          achievement_id: string
          earned_at?: string
          id?: string
          membership_id: string
          streak_value?: number | null
          workspace_id: string
        }
        Update: {
          achievement_id?: string
          earned_at?: string
          id?: string
          membership_id?: string
          streak_value?: number | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "engagement_member_achievements_achievement_id_fkey"
            columns: ["achievement_id"]
            isOneToOne: false
            referencedRelation: "engagement_achievements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "engagement_member_achievements_membership_id_fkey"
            columns: ["membership_id"]
            isOneToOne: false
            referencedRelation: "enterprise_memberships"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "engagement_member_achievements_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "enterprise_org_pulse_membership"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "engagement_member_achievements_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "enterprise_workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      engagement_streaks: {
        Row: {
          current_count: number
          id: string
          last_event_at: string | null
          longest_count: number
          membership_id: string
          streak_type: string
          updated_at: string
          workspace_id: string
        }
        Insert: {
          current_count?: number
          id?: string
          last_event_at?: string | null
          longest_count?: number
          membership_id: string
          streak_type: string
          updated_at?: string
          workspace_id: string
        }
        Update: {
          current_count?: number
          id?: string
          last_event_at?: string | null
          longest_count?: number
          membership_id?: string
          streak_type?: string
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "engagement_streaks_membership_id_fkey"
            columns: ["membership_id"]
            isOneToOne: false
            referencedRelation: "enterprise_memberships"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "engagement_streaks_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "enterprise_org_pulse_membership"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "engagement_streaks_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "enterprise_workspaces"
            referencedColumns: ["id"]
          },
        ]
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
      enterprise_api_keys: {
        Row: {
          created_at: string
          created_by: string
          expires_at: string | null
          id: string
          key_hash: string
          key_prefix: string
          last_used_at: string | null
          name: string
          revoked_at: string | null
          scopes: string[]
          workspace_id: string
        }
        Insert: {
          created_at?: string
          created_by: string
          expires_at?: string | null
          id?: string
          key_hash: string
          key_prefix: string
          last_used_at?: string | null
          name: string
          revoked_at?: string | null
          scopes?: string[]
          workspace_id: string
        }
        Update: {
          created_at?: string
          created_by?: string
          expires_at?: string | null
          id?: string
          key_hash?: string
          key_prefix?: string
          last_used_at?: string | null
          name?: string
          revoked_at?: string | null
          scopes?: string[]
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "enterprise_api_keys_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "enterprise_org_pulse_membership"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "enterprise_api_keys_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "enterprise_workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      enterprise_api_usage_logs: {
        Row: {
          api_key_id: string | null
          created_at: string
          duration_ms: number | null
          id: string
          method: string
          path: string
          status_code: number
          workspace_id: string
        }
        Insert: {
          api_key_id?: string | null
          created_at?: string
          duration_ms?: number | null
          id?: string
          method: string
          path: string
          status_code: number
          workspace_id: string
        }
        Update: {
          api_key_id?: string | null
          created_at?: string
          duration_ms?: number | null
          id?: string
          method?: string
          path?: string
          status_code?: number
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "enterprise_api_usage_logs_api_key_id_fkey"
            columns: ["api_key_id"]
            isOneToOne: false
            referencedRelation: "enterprise_api_keys"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "enterprise_api_usage_logs_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "enterprise_org_pulse_membership"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "enterprise_api_usage_logs_workspace_id_fkey"
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
          ip_address: string | null
          metadata: Json | null
          new_state: Json | null
          prev_state: Json | null
          target_id: string | null
          target_type: string | null
          user_agent: string | null
          workspace_id: string
        }
        Insert: {
          action: string
          actor_id: string
          affected_user_id?: string | null
          created_at?: string
          id?: string
          ip_address?: string | null
          metadata?: Json | null
          new_state?: Json | null
          prev_state?: Json | null
          target_id?: string | null
          target_type?: string | null
          user_agent?: string | null
          workspace_id: string
        }
        Update: {
          action?: string
          actor_id?: string
          affected_user_id?: string | null
          created_at?: string
          id?: string
          ip_address?: string | null
          metadata?: Json | null
          new_state?: Json | null
          prev_state?: Json | null
          target_id?: string | null
          target_type?: string | null
          user_agent?: string | null
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
          tier_feature_keys: string[]
        }
        Insert: {
          created_at?: string
          description?: string | null
          display_name: string
          feature_key: string
          id?: string
          parent_key?: string | null
          sort_order?: number
          tier_feature_keys?: string[]
        }
        Update: {
          created_at?: string
          description?: string | null
          display_name?: string
          feature_key?: string
          id?: string
          parent_key?: string | null
          sort_order?: number
          tier_feature_keys?: string[]
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
          gamification_opt_out: boolean
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
          gamification_opt_out?: boolean
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
          gamification_opt_out?: boolean
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
      enterprise_office_equipment: {
        Row: {
          created_at: string
          description: string | null
          id: string
          name: string
          office_id: string
          quantity: number
          required_skill_id: string | null
          updated_at: string
          workspace_id: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          name: string
          office_id: string
          quantity?: number
          required_skill_id?: string | null
          updated_at?: string
          workspace_id: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          office_id?: string
          quantity?: number
          required_skill_id?: string | null
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "enterprise_office_equipment_office_id_fkey"
            columns: ["office_id"]
            isOneToOne: false
            referencedRelation: "enterprise_offices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "enterprise_office_equipment_required_skill_id_fkey"
            columns: ["required_skill_id"]
            isOneToOne: false
            referencedRelation: "enterprise_skills"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "enterprise_office_equipment_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "enterprise_org_pulse_membership"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "enterprise_office_equipment_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "enterprise_workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      enterprise_office_min_staffing: {
        Row: {
          business_role: string | null
          created_at: string
          id: string
          min_headcount: number
          notes: string | null
          office_id: string
          skill_id: string | null
          updated_at: string
          workspace_id: string
        }
        Insert: {
          business_role?: string | null
          created_at?: string
          id?: string
          min_headcount?: number
          notes?: string | null
          office_id: string
          skill_id?: string | null
          updated_at?: string
          workspace_id: string
        }
        Update: {
          business_role?: string | null
          created_at?: string
          id?: string
          min_headcount?: number
          notes?: string | null
          office_id?: string
          skill_id?: string | null
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "enterprise_office_min_staffing_office_id_fkey"
            columns: ["office_id"]
            isOneToOne: false
            referencedRelation: "enterprise_offices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "enterprise_office_min_staffing_skill_id_fkey"
            columns: ["skill_id"]
            isOneToOne: false
            referencedRelation: "enterprise_skills"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "enterprise_office_min_staffing_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "enterprise_org_pulse_membership"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "enterprise_office_min_staffing_workspace_id_fkey"
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
          clock_in_nfc_tag: string | null
          created_at: string
          deputy_name: string | null
          email: string | null
          geofence_lat: number | null
          geofence_lng: number | null
          geofence_radius_m: number
          id: string
          manager_name: string | null
          name: string
          opening_hours: Json | null
          phone: string | null
          updated_at: string
          workspace_id: string
        }
        Insert: {
          address?: string | null
          city?: string | null
          clock_in_nfc_tag?: string | null
          created_at?: string
          deputy_name?: string | null
          email?: string | null
          geofence_lat?: number | null
          geofence_lng?: number | null
          geofence_radius_m?: number
          id?: string
          manager_name?: string | null
          name: string
          opening_hours?: Json | null
          phone?: string | null
          updated_at?: string
          workspace_id: string
        }
        Update: {
          address?: string | null
          city?: string | null
          clock_in_nfc_tag?: string | null
          created_at?: string
          deputy_name?: string | null
          email?: string | null
          geofence_lat?: number | null
          geofence_lng?: number | null
          geofence_radius_m?: number
          id?: string
          manager_name?: string | null
          name?: string
          opening_hours?: Json | null
          phone?: string | null
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
      enterprise_open_shift_claims: {
        Row: {
          claimed_at: string
          id: string
          membership_id: string
          request_id: string
          status: string
          user_id: string
        }
        Insert: {
          claimed_at?: string
          id?: string
          membership_id: string
          request_id: string
          status?: string
          user_id: string
        }
        Update: {
          claimed_at?: string
          id?: string
          membership_id?: string
          request_id?: string
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "enterprise_open_shift_claims_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "enterprise_open_shift_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      enterprise_open_shift_requests: {
        Row: {
          business_role: string | null
          created_at: string
          created_by: string
          escalation_level: number
          filled_at: string | null
          filled_by_user_id: string | null
          id: string
          notes: string | null
          notified_user_ids: string[]
          office_id: string
          respond_by_at: string | null
          role_id: string | null
          shift_date: string
          skill_id: string | null
          skill_ids: string[]
          status: string
          target_user_ids: string[]
          timeout_hours: number
          updated_at: string
          workspace_id: string
        }
        Insert: {
          business_role?: string | null
          created_at?: string
          created_by: string
          escalation_level?: number
          filled_at?: string | null
          filled_by_user_id?: string | null
          id?: string
          notes?: string | null
          notified_user_ids?: string[]
          office_id: string
          respond_by_at?: string | null
          role_id?: string | null
          shift_date: string
          skill_id?: string | null
          skill_ids?: string[]
          status?: string
          target_user_ids?: string[]
          timeout_hours?: number
          updated_at?: string
          workspace_id: string
        }
        Update: {
          business_role?: string | null
          created_at?: string
          created_by?: string
          escalation_level?: number
          filled_at?: string | null
          filled_by_user_id?: string | null
          id?: string
          notes?: string | null
          notified_user_ids?: string[]
          office_id?: string
          respond_by_at?: string | null
          role_id?: string | null
          shift_date?: string
          skill_id?: string | null
          skill_ids?: string[]
          status?: string
          target_user_ids?: string[]
          timeout_hours?: number
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "enterprise_open_shift_requests_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "enterprise_workspace_roles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "enterprise_open_shift_requests_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "enterprise_org_pulse_membership"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "enterprise_open_shift_requests_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "enterprise_workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      enterprise_open_shift_waitlist: {
        Row: {
          id: string
          joined_at: string
          membership_id: string
          position: number
          request_id: string
          status: string
          user_id: string
        }
        Insert: {
          id?: string
          joined_at?: string
          membership_id: string
          position: number
          request_id: string
          status?: string
          user_id: string
        }
        Update: {
          id?: string
          joined_at?: string
          membership_id?: string
          position?: number
          request_id?: string
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "enterprise_open_shift_waitlist_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "enterprise_open_shift_requests"
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
      enterprise_shift_cancellations: {
        Row: {
          assignment_id: string | null
          business_role: string | null
          cancelled_at: string
          id: string
          notified_managers: boolean
          office_id: string
          replacement_found: boolean
          replacement_user_id: string | null
          role_id: string | null
          shift_date: string
          skill_ids: string[]
          user_id: string
          workspace_id: string
        }
        Insert: {
          assignment_id?: string | null
          business_role?: string | null
          cancelled_at?: string
          id?: string
          notified_managers?: boolean
          office_id: string
          replacement_found?: boolean
          replacement_user_id?: string | null
          role_id?: string | null
          shift_date: string
          skill_ids?: string[]
          user_id: string
          workspace_id: string
        }
        Update: {
          assignment_id?: string | null
          business_role?: string | null
          cancelled_at?: string
          id?: string
          notified_managers?: boolean
          office_id?: string
          replacement_found?: boolean
          replacement_user_id?: string | null
          role_id?: string | null
          shift_date?: string
          skill_ids?: string[]
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
      enterprise_staff_availability: {
        Row: {
          availability_date: string
          created_at: string
          id: string
          membership_id: string
          notes: string | null
          status: string
          updated_at: string
          user_id: string
          workspace_id: string
        }
        Insert: {
          availability_date: string
          created_at?: string
          id?: string
          membership_id: string
          notes?: string | null
          status?: string
          updated_at?: string
          user_id: string
          workspace_id: string
        }
        Update: {
          availability_date?: string
          created_at?: string
          id?: string
          membership_id?: string
          notes?: string | null
          status?: string
          updated_at?: string
          user_id?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "enterprise_staff_availability_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "enterprise_org_pulse_membership"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "enterprise_staff_availability_workspace_id_fkey"
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
      enterprise_webhook_deliveries: {
        Row: {
          attempt_count: number
          created_at: string
          delivered_at: string | null
          event_type: string
          id: string
          last_error: string | null
          last_response_body: string | null
          last_response_code: number | null
          payload: Json
          status: string
          subscription_id: string
          workspace_id: string
        }
        Insert: {
          attempt_count?: number
          created_at?: string
          delivered_at?: string | null
          event_type: string
          id?: string
          last_error?: string | null
          last_response_body?: string | null
          last_response_code?: number | null
          payload: Json
          status?: string
          subscription_id: string
          workspace_id: string
        }
        Update: {
          attempt_count?: number
          created_at?: string
          delivered_at?: string | null
          event_type?: string
          id?: string
          last_error?: string | null
          last_response_body?: string | null
          last_response_code?: number | null
          payload?: Json
          status?: string
          subscription_id?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "enterprise_webhook_deliveries_subscription_id_fkey"
            columns: ["subscription_id"]
            isOneToOne: false
            referencedRelation: "enterprise_webhook_subscriptions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "enterprise_webhook_deliveries_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "enterprise_org_pulse_membership"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "enterprise_webhook_deliveries_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "enterprise_workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      enterprise_webhook_subscriptions: {
        Row: {
          created_at: string
          created_by: string
          events: string[]
          id: string
          is_active: boolean
          last_error: string | null
          last_fired_at: string | null
          secret: string
          updated_at: string
          url: string
          workspace_id: string
        }
        Insert: {
          created_at?: string
          created_by: string
          events: string[]
          id?: string
          is_active?: boolean
          last_error?: string | null
          last_fired_at?: string | null
          secret: string
          updated_at?: string
          url: string
          workspace_id: string
        }
        Update: {
          created_at?: string
          created_by?: string
          events?: string[]
          id?: string
          is_active?: boolean
          last_error?: string | null
          last_fired_at?: string | null
          secret?: string
          updated_at?: string
          url?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "enterprise_webhook_subscriptions_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "enterprise_org_pulse_membership"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "enterprise_webhook_subscriptions_workspace_id_fkey"
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
          selected_field_ids: string[]
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
          selected_field_ids?: string[]
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
          selected_field_ids?: string[]
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
          gamification_enabled: boolean
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
          reseller_id: string | null
          salary_band_config: Json | null
          settings: Json
          shift_trade_auto_approve: boolean
          show_past_absences: boolean
          timezone: string
          updated_at: string
          weekday_start: number
          wellbeing_weights: Json | null
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
          gamification_enabled?: boolean
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
          reseller_id?: string | null
          salary_band_config?: Json | null
          settings?: Json
          shift_trade_auto_approve?: boolean
          show_past_absences?: boolean
          timezone?: string
          updated_at?: string
          weekday_start?: number
          wellbeing_weights?: Json | null
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
          gamification_enabled?: boolean
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
          reseller_id?: string | null
          salary_band_config?: Json | null
          settings?: Json
          shift_trade_auto_approve?: boolean
          show_past_absences?: boolean
          timezone?: string
          updated_at?: string
          weekday_start?: number
          wellbeing_weights?: Json | null
          white_label?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "enterprise_workspaces_reseller_id_fkey"
            columns: ["reseller_id"]
            isOneToOne: false
            referencedRelation: "resellers"
            referencedColumns: ["id"]
          },
        ]
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
      features: {
        Row: {
          created_at: string
          dependencies: string[]
          description: string | null
          feature_key: string
          fiscal_weight: number
          id: string
          menu_path: string[] | null
          metadata: Json
          module: string
          name: string
          route_path: string | null
          sort_order: number
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          dependencies?: string[]
          description?: string | null
          feature_key: string
          fiscal_weight?: number
          id?: string
          menu_path?: string[] | null
          metadata?: Json
          module: string
          name: string
          route_path?: string | null
          sort_order?: number
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          dependencies?: string[]
          description?: string | null
          feature_key?: string
          fiscal_weight?: number
          id?: string
          menu_path?: string[] | null
          metadata?: Json
          module?: string
          name?: string
          route_path?: string | null
          sort_order?: number
          status?: string
          updated_at?: string
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
      gdpr_requests: {
        Row: {
          completed_at: string | null
          completed_by: string | null
          created_at: string
          id: string
          notes: string | null
          request_type: string
          requestor_id: string
          status: string
          target_user_id: string
          workspace_id: string
        }
        Insert: {
          completed_at?: string | null
          completed_by?: string | null
          created_at?: string
          id?: string
          notes?: string | null
          request_type: string
          requestor_id: string
          status?: string
          target_user_id: string
          workspace_id: string
        }
        Update: {
          completed_at?: string | null
          completed_by?: string | null
          created_at?: string
          id?: string
          notes?: string | null
          request_type?: string
          requestor_id?: string
          status?: string
          target_user_id?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "gdpr_requests_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "enterprise_org_pulse_membership"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "gdpr_requests_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "enterprise_workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      generated_documents: {
        Row: {
          content_html: string
          context: Json
          doc_type: string
          generated_at: string
          generated_by: string | null
          id: string
          language: string
          membership_id: string | null
          sent_at: string | null
          status: string
          subject: string | null
          template_id: string | null
          workspace_id: string
        }
        Insert: {
          content_html: string
          context?: Json
          doc_type: string
          generated_at?: string
          generated_by?: string | null
          id?: string
          language?: string
          membership_id?: string | null
          sent_at?: string | null
          status?: string
          subject?: string | null
          template_id?: string | null
          workspace_id: string
        }
        Update: {
          content_html?: string
          context?: Json
          doc_type?: string
          generated_at?: string
          generated_by?: string | null
          id?: string
          language?: string
          membership_id?: string | null
          sent_at?: string | null
          status?: string
          subject?: string | null
          template_id?: string | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "generated_documents_membership_id_fkey"
            columns: ["membership_id"]
            isOneToOne: false
            referencedRelation: "enterprise_memberships"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "generated_documents_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "document_templates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "generated_documents_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "enterprise_org_pulse_membership"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "generated_documents_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "enterprise_workspaces"
            referencedColumns: ["id"]
          },
        ]
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
      interview_slots: {
        Row: {
          booking_token: string | null
          candidate_id: string | null
          created_at: string
          created_by: string | null
          id: string
          interviewer_membership_ids: string[]
          notes: string | null
          outcome_rating: number | null
          outcome_recommendation: string | null
          slot_end: string
          slot_start: string
          status: string
          updated_at: string
          workspace_id: string
        }
        Insert: {
          booking_token?: string | null
          candidate_id?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          interviewer_membership_ids?: string[]
          notes?: string | null
          outcome_rating?: number | null
          outcome_recommendation?: string | null
          slot_end: string
          slot_start: string
          status?: string
          updated_at?: string
          workspace_id: string
        }
        Update: {
          booking_token?: string | null
          candidate_id?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          interviewer_membership_ids?: string[]
          notes?: string | null
          outcome_rating?: number | null
          outcome_recommendation?: string | null
          slot_end?: string
          slot_start?: string
          status?: string
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "interview_slots_candidate_id_fkey"
            columns: ["candidate_id"]
            isOneToOne: false
            referencedRelation: "candidates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "interview_slots_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "enterprise_org_pulse_membership"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "interview_slots_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "enterprise_workspaces"
            referencedColumns: ["id"]
          },
        ]
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
          external_calendar_event_id: string | null
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
          external_calendar_event_id?: string | null
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
          external_calendar_event_id?: string | null
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
      marketplace_plugins: {
        Row: {
          author_name: string | null
          author_user_id: string | null
          category: string
          created_at: string
          description: string | null
          icon_url: string | null
          id: string
          install_count: number
          manifest: Json
          name: string
          pricing_model: string
          slug: string
          status: string
          updated_at: string
          version: string
        }
        Insert: {
          author_name?: string | null
          author_user_id?: string | null
          category?: string
          created_at?: string
          description?: string | null
          icon_url?: string | null
          id?: string
          install_count?: number
          manifest?: Json
          name: string
          pricing_model?: string
          slug: string
          status?: string
          updated_at?: string
          version?: string
        }
        Update: {
          author_name?: string | null
          author_user_id?: string | null
          category?: string
          created_at?: string
          description?: string | null
          icon_url?: string | null
          id?: string
          install_count?: number
          manifest?: Json
          name?: string
          pricing_model?: string
          slug?: string
          status?: string
          updated_at?: string
          version?: string
        }
        Relationships: []
      }
      payroll_export_configs: {
        Row: {
          config: Json
          created_at: string
          created_by: string | null
          field_mappings: Json
          id: string
          is_active: boolean
          provider: string
          updated_at: string
          workspace_id: string
        }
        Insert: {
          config?: Json
          created_at?: string
          created_by?: string | null
          field_mappings?: Json
          id?: string
          is_active?: boolean
          provider: string
          updated_at?: string
          workspace_id: string
        }
        Update: {
          config?: Json
          created_at?: string
          created_by?: string | null
          field_mappings?: Json
          id?: string
          is_active?: boolean
          provider?: string
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "payroll_export_configs_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "enterprise_org_pulse_membership"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "payroll_export_configs_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "enterprise_workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      payroll_periods: {
        Row: {
          created_at: string
          created_by: string | null
          end_date: string
          exported_at: string | null
          exported_to: string | null
          id: string
          locked_at: string | null
          locked_by: string | null
          name: string
          start_date: string
          status: string
          workspace_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          end_date: string
          exported_at?: string | null
          exported_to?: string | null
          id?: string
          locked_at?: string | null
          locked_by?: string | null
          name: string
          start_date: string
          status?: string
          workspace_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          end_date?: string
          exported_at?: string | null
          exported_to?: string | null
          id?: string
          locked_at?: string | null
          locked_by?: string | null
          name?: string
          start_date?: string
          status?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "payroll_periods_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "enterprise_org_pulse_membership"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "payroll_periods_workspace_id_fkey"
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
      platform_audit_events: {
        Row: {
          action: string
          actor_id: string | null
          created_at: string
          id: string
          metadata: Json
          new_state: Json | null
          prev_state: Json | null
          target_id: string | null
          target_type: string | null
        }
        Insert: {
          action: string
          actor_id?: string | null
          created_at?: string
          id?: string
          metadata?: Json
          new_state?: Json | null
          prev_state?: Json | null
          target_id?: string | null
          target_type?: string | null
        }
        Update: {
          action?: string
          actor_id?: string | null
          created_at?: string
          id?: string
          metadata?: Json
          new_state?: Json | null
          prev_state?: Json | null
          target_id?: string | null
          target_type?: string | null
        }
        Relationships: []
      }
      platform_feature_flags: {
        Row: {
          category: string
          created_at: string
          description: string
          enabled: boolean
          id: string
          key: string
          notes: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          category?: string
          created_at?: string
          description?: string
          enabled?: boolean
          id?: string
          key: string
          notes?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          category?: string
          created_at?: string
          description?: string
          enabled?: boolean
          id?: string
          key?: string
          notes?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      plugin_webhook_events: {
        Row: {
          created_at: string
          delivered: boolean
          delivered_at: string | null
          delivery_attempts: number
          event_type: string
          id: string
          installed_plugin_id: string
          last_response_body: string | null
          last_response_status: number | null
          payload: Json
          workspace_id: string
        }
        Insert: {
          created_at?: string
          delivered?: boolean
          delivered_at?: string | null
          delivery_attempts?: number
          event_type: string
          id?: string
          installed_plugin_id: string
          last_response_body?: string | null
          last_response_status?: number | null
          payload?: Json
          workspace_id: string
        }
        Update: {
          created_at?: string
          delivered?: boolean
          delivered_at?: string | null
          delivery_attempts?: number
          event_type?: string
          id?: string
          installed_plugin_id?: string
          last_response_body?: string | null
          last_response_status?: number | null
          payload?: Json
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "plugin_webhook_events_installed_plugin_id_fkey"
            columns: ["installed_plugin_id"]
            isOneToOne: false
            referencedRelation: "workspace_installed_plugins"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "plugin_webhook_events_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "enterprise_org_pulse_membership"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "plugin_webhook_events_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "enterprise_workspaces"
            referencedColumns: ["id"]
          },
        ]
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
      qr_clock_sessions: {
        Row: {
          code: string
          created_at: string
          created_by: string | null
          expires_at: string
          id: string
          office_id: string
          workspace_id: string
        }
        Insert: {
          code: string
          created_at?: string
          created_by?: string | null
          expires_at: string
          id?: string
          office_id: string
          workspace_id: string
        }
        Update: {
          code?: string
          created_at?: string
          created_by?: string | null
          expires_at?: string
          id?: string
          office_id?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "qr_clock_sessions_office_id_fkey"
            columns: ["office_id"]
            isOneToOne: false
            referencedRelation: "enterprise_offices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "qr_clock_sessions_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "enterprise_org_pulse_membership"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "qr_clock_sessions_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "enterprise_workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      reseller_admins: {
        Row: {
          created_at: string
          id: string
          invited_by: string | null
          reseller_id: string
          role: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          invited_by?: string | null
          reseller_id: string
          role?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          invited_by?: string | null
          reseller_id?: string
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "reseller_admins_reseller_id_fkey"
            columns: ["reseller_id"]
            isOneToOne: false
            referencedRelation: "resellers"
            referencedColumns: ["id"]
          },
        ]
      }
      resellers: {
        Row: {
          created_at: string
          custom_domain: string | null
          id: string
          is_active: boolean
          name: string
          revenue_share_pct: number
          slug: string
          stripe_connect_account_id: string | null
          theme_config: Json
          updated_at: string
        }
        Insert: {
          created_at?: string
          custom_domain?: string | null
          id?: string
          is_active?: boolean
          name: string
          revenue_share_pct?: number
          slug: string
          stripe_connect_account_id?: string | null
          theme_config?: Json
          updated_at?: string
        }
        Update: {
          created_at?: string
          custom_domain?: string | null
          id?: string
          is_active?: boolean
          name?: string
          revenue_share_pct?: number
          slug?: string
          stripe_connect_account_id?: string | null
          theme_config?: Json
          updated_at?: string
        }
        Relationships: []
      }
      shift_trade_acceptances: {
        Row: {
          accepting_membership_id: string
          created_at: string
          decided_at: string | null
          decided_by: string | null
          id: string
          manager_notes: string | null
          offer_id: string
          status: string
        }
        Insert: {
          accepting_membership_id: string
          created_at?: string
          decided_at?: string | null
          decided_by?: string | null
          id?: string
          manager_notes?: string | null
          offer_id: string
          status?: string
        }
        Update: {
          accepting_membership_id?: string
          created_at?: string
          decided_at?: string | null
          decided_by?: string | null
          id?: string
          manager_notes?: string | null
          offer_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "shift_trade_acceptances_accepting_membership_id_fkey"
            columns: ["accepting_membership_id"]
            isOneToOne: false
            referencedRelation: "enterprise_memberships"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shift_trade_acceptances_offer_id_fkey"
            columns: ["offer_id"]
            isOneToOne: false
            referencedRelation: "shift_trade_offers"
            referencedColumns: ["id"]
          },
        ]
      }
      shift_trade_offers: {
        Row: {
          created_at: string
          expires_at: string | null
          id: string
          offering_membership_id: string
          reason: string | null
          shift_assignment_id: string
          status: string
          updated_at: string
          workspace_id: string
        }
        Insert: {
          created_at?: string
          expires_at?: string | null
          id?: string
          offering_membership_id: string
          reason?: string | null
          shift_assignment_id: string
          status?: string
          updated_at?: string
          workspace_id: string
        }
        Update: {
          created_at?: string
          expires_at?: string | null
          id?: string
          offering_membership_id?: string
          reason?: string | null
          shift_assignment_id?: string
          status?: string
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "shift_trade_offers_offering_membership_id_fkey"
            columns: ["offering_membership_id"]
            isOneToOne: false
            referencedRelation: "enterprise_memberships"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shift_trade_offers_shift_assignment_id_fkey"
            columns: ["shift_assignment_id"]
            isOneToOne: false
            referencedRelation: "enterprise_shift_assignments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shift_trade_offers_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "enterprise_org_pulse_membership"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "shift_trade_offers_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "enterprise_workspaces"
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
      tenant_addons: {
        Row: {
          addon_id: string
          created_at: string
          ends_at: string | null
          id: string
          metadata: Json
          seats: number
          started_at: string
          status: string
          tenant_id: string
        }
        Insert: {
          addon_id: string
          created_at?: string
          ends_at?: string | null
          id?: string
          metadata?: Json
          seats?: number
          started_at?: string
          status?: string
          tenant_id: string
        }
        Update: {
          addon_id?: string
          created_at?: string
          ends_at?: string | null
          id?: string
          metadata?: Json
          seats?: number
          started_at?: string
          status?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tenant_addons_addon_id_fkey"
            columns: ["addon_id"]
            isOneToOne: false
            referencedRelation: "addons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tenant_addons_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
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
      tenant_feature_overrides: {
        Row: {
          created_at: string
          created_by: string | null
          enabled: boolean
          expires_at: string | null
          feature_id: string
          id: string
          reason: string | null
          tenant_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          enabled?: boolean
          expires_at?: string | null
          feature_id: string
          id?: string
          reason?: string | null
          tenant_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          enabled?: boolean
          expires_at?: string | null
          feature_id?: string
          id?: string
          reason?: string | null
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tenant_feature_overrides_feature_id_fkey"
            columns: ["feature_id"]
            isOneToOne: false
            referencedRelation: "features"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tenant_feature_overrides_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      tenant_subscriptions: {
        Row: {
          created_at: string
          ends_at: string | null
          id: string
          metadata: Json
          seats: number
          started_at: string
          status: string
          tenant_id: string
          tier_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          ends_at?: string | null
          id?: string
          metadata?: Json
          seats?: number
          started_at?: string
          status?: string
          tenant_id: string
          tier_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          ends_at?: string | null
          id?: string
          metadata?: Json
          seats?: number
          started_at?: string
          status?: string
          tenant_id?: string
          tier_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tenant_subscriptions_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tenant_subscriptions_tier_id_fkey"
            columns: ["tier_id"]
            isOneToOne: false
            referencedRelation: "tiers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tenant_subscriptions_tier_id_fkey"
            columns: ["tier_id"]
            isOneToOne: false
            referencedRelation: "workspace_active_tier"
            referencedColumns: ["tier_id"]
          },
        ]
      }
      tenant_workspaces: {
        Row: {
          created_at: string
          id: string
          is_primary: boolean
          tenant_id: string
          workspace_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_primary?: boolean
          tenant_id: string
          workspace_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_primary?: boolean
          tenant_id?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tenant_workspaces_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tenant_workspaces_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: true
            referencedRelation: "enterprise_org_pulse_membership"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "tenant_workspaces_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: true
            referencedRelation: "enterprise_workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      tenants: {
        Row: {
          billing_email: string | null
          country: string | null
          created_at: string
          id: string
          metadata: Json
          name: string
          slug: string
          status: string
          updated_at: string
          vat_number: string | null
        }
        Insert: {
          billing_email?: string | null
          country?: string | null
          created_at?: string
          id?: string
          metadata?: Json
          name: string
          slug: string
          status?: string
          updated_at?: string
          vat_number?: string | null
        }
        Update: {
          billing_email?: string | null
          country?: string | null
          created_at?: string
          id?: string
          metadata?: Json
          name?: string
          slug?: string
          status?: string
          updated_at?: string
          vat_number?: string | null
        }
        Relationships: []
      }
      tier_features: {
        Row: {
          created_at: string
          feature_id: string
          id: string
          limit_value: Json | null
          tier_id: string
        }
        Insert: {
          created_at?: string
          feature_id: string
          id?: string
          limit_value?: Json | null
          tier_id: string
        }
        Update: {
          created_at?: string
          feature_id?: string
          id?: string
          limit_value?: Json | null
          tier_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tier_features_feature_id_fkey"
            columns: ["feature_id"]
            isOneToOne: false
            referencedRelation: "features"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tier_features_tier_id_fkey"
            columns: ["tier_id"]
            isOneToOne: false
            referencedRelation: "tiers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tier_features_tier_id_fkey"
            columns: ["tier_id"]
            isOneToOne: false
            referencedRelation: "workspace_active_tier"
            referencedColumns: ["tier_id"]
          },
        ]
      }
      tiers: {
        Row: {
          billing_period: string
          created_at: string
          currency: string
          description: string | null
          id: string
          max_seats: number | null
          metadata: Json
          name: string
          price_per_seat: number
          sort_order: number
          tier_key: string
          updated_at: string
        }
        Insert: {
          billing_period?: string
          created_at?: string
          currency?: string
          description?: string | null
          id?: string
          max_seats?: number | null
          metadata?: Json
          name: string
          price_per_seat?: number
          sort_order?: number
          tier_key: string
          updated_at?: string
        }
        Update: {
          billing_period?: string
          created_at?: string
          currency?: string
          description?: string | null
          id?: string
          max_seats?: number | null
          metadata?: Json
          name?: string
          price_per_seat?: number
          sort_order?: number
          tier_key?: string
          updated_at?: string
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
      wellbeing_alerts: {
        Row: {
          alert_type: string
          created_at: string
          id: string
          membership_id: string
          message: string | null
          resolved_at: string | null
          resolved_by: string | null
          severity: string
          triggered_at: string
          workspace_id: string
        }
        Insert: {
          alert_type: string
          created_at?: string
          id?: string
          membership_id: string
          message?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          severity?: string
          triggered_at?: string
          workspace_id: string
        }
        Update: {
          alert_type?: string
          created_at?: string
          id?: string
          membership_id?: string
          message?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          severity?: string
          triggered_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "wellbeing_alerts_membership_id_fkey"
            columns: ["membership_id"]
            isOneToOne: false
            referencedRelation: "enterprise_memberships"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wellbeing_alerts_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "enterprise_org_pulse_membership"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "wellbeing_alerts_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "enterprise_workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      wellbeing_scores: {
        Row: {
          calculated_at: string
          components: Json
          created_at: string
          id: string
          membership_id: string
          score: number
          workspace_id: string
        }
        Insert: {
          calculated_at?: string
          components?: Json
          created_at?: string
          id?: string
          membership_id: string
          score?: number
          workspace_id: string
        }
        Update: {
          calculated_at?: string
          components?: Json
          created_at?: string
          id?: string
          membership_id?: string
          score?: number
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "wellbeing_scores_membership_id_fkey"
            columns: ["membership_id"]
            isOneToOne: false
            referencedRelation: "enterprise_memberships"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wellbeing_scores_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "enterprise_org_pulse_membership"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "wellbeing_scores_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "enterprise_workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      workspace_installed_plugins: {
        Row: {
          config: Json
          enabled: boolean
          id: string
          installed_at: string
          installed_by: string | null
          plugin_id: string
          updated_at: string
          workspace_id: string
        }
        Insert: {
          config?: Json
          enabled?: boolean
          id?: string
          installed_at?: string
          installed_by?: string | null
          plugin_id: string
          updated_at?: string
          workspace_id: string
        }
        Update: {
          config?: Json
          enabled?: boolean
          id?: string
          installed_at?: string
          installed_by?: string | null
          plugin_id?: string
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workspace_installed_plugins_plugin_id_fkey"
            columns: ["plugin_id"]
            isOneToOne: false
            referencedRelation: "marketplace_plugins"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workspace_installed_plugins_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "enterprise_org_pulse_membership"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "workspace_installed_plugins_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "enterprise_workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      enterprise_coverage_rules: {
        Row: {
          applies_to: string | null
          business_role: string | null
          id: string | null
          min_headcount: number | null
          office_id: string | null
          skill_id: string | null
          workspace_id: string | null
        }
        Insert: {
          applies_to?: never
          business_role?: string | null
          id?: string | null
          min_headcount?: number | null
          office_id?: string | null
          skill_id?: string | null
          workspace_id?: string | null
        }
        Update: {
          applies_to?: never
          business_role?: string | null
          id?: string | null
          min_headcount?: number | null
          office_id?: string | null
          skill_id?: string | null
          workspace_id?: string | null
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
      workspace_active_tier: {
        Row: {
          ends_at: string | null
          seats: number | null
          started_at: string | null
          subscription_id: string | null
          tenant_id: string | null
          tier_id: string | null
          tier_key: string | null
          tier_name: string | null
          tier_sort_order: number | null
          workspace_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tenant_workspaces_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tenant_workspaces_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: true
            referencedRelation: "enterprise_org_pulse_membership"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "tenant_workspaces_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: true
            referencedRelation: "enterprise_workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      ai_copilot_start_conversation: {
        Args: { _title?: string; _workspace_id: string }
        Returns: string
      }
      analytics_absence_risk_scores: {
        Args: { _workspace_id: string }
        Returns: Json
      }
      analytics_coverage_risk_heatmap: {
        Args: { _days_ahead?: number; _workspace_id: string }
        Returns: Json
      }
      analytics_labor_cost_forecast: {
        Args: { _months_ahead?: number; _workspace_id: string }
        Returns: Json
      }
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
      cancel_open_shift_request: {
        Args: { _request_id: string }
        Returns: Json
      }
      cancel_shift_assignment: {
        Args: { _assignment_id: string }
        Returns: Json
      }
      candidate_create_slot: {
        Args: {
          _interviewer_ids: string[]
          _notes?: string
          _slot_end: string
          _slot_start: string
          _workspace_id: string
        }
        Returns: string
      }
      candidate_generate_onboarding: {
        Args: {
          _candidate_id: string
          _start_date: string
          _workspace_id: string
        }
        Returns: Json
      }
      candidate_interview_slot_eligible: {
        Args: {
          _interviewer_ids: string[]
          _slot_end: string
          _slot_start: string
        }
        Returns: boolean
      }
      candidate_self_book: {
        Args: {
          _booking_token: string
          _candidate_email: string
          _candidate_name: string
        }
        Returns: Json
      }
      claim_open_shift: { Args: { _request_id: string }; Returns: Json }
      clock_event: {
        Args: {
          _event_type: string
          _latitude?: number
          _longitude?: number
          _method: string
          _nfc_tag?: string
          _office_id?: string
          _qr_code?: string
          _workspace_id: string
        }
        Returns: Json
      }
      clock_generate_qr: {
        Args: { _office_id: string; _ttl_seconds?: number }
        Returns: Json
      }
      compliance_check_working_time: {
        Args: {
          _period_end: string
          _period_start: string
          _workspace_id: string
        }
        Returns: Json
      }
      create_open_shift_request: {
        Args: {
          _business_role?: string
          _notes?: string
          _office_id: string
          _role_id?: string
          _shift_date: string
          _skill_id?: string
          _skill_ids?: string[]
          _target_user_ids?: string[]
          _timeout_hours?: number
          _workspace_id: string
        }
        Returns: string
      }
      create_workspace_with_owner: {
        Args: {
          _description?: string
          _name: string
          _seats?: number
          _tier_key?: string
        }
        Returns: string
      }
      customer_success_calculate_health_score: {
        Args: { _workspace_id: string }
        Returns: Json
      }
      customer_success_record_onboarding_step: {
        Args: { _item_key: string; _workspace_id: string }
        Returns: Json
      }
      customer_success_submit_nps: {
        Args: { _feedback?: string; _score: number; _survey_id: string }
        Returns: Json
      }
      customer_success_trigger_nps: {
        Args: { _category?: string; _workspace_id: string }
        Returns: string
      }
      delete_email: {
        Args: { message_id: number; queue_name: string }
        Returns: boolean
      }
      document_generate: {
        Args: {
          _extra_vars?: Json
          _membership_id?: string
          _subject?: string
          _template_id: string
          _workspace_id: string
        }
        Returns: Json
      }
      document_substitute: {
        Args: { _body_html: string; _vars: Json }
        Returns: string
      }
      enforce_data_retention: { Args: never; Returns: undefined }
      engagement_record_event: {
        Args: {
          _event_type: string
          _membership_id: string
          _workspace_id: string
        }
        Returns: Json
      }
      enqueue_email: {
        Args: { payload: Json; queue_name: string }
        Returns: number
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
      haversine_km: {
        Args: { lat1: number; lat2: number; lon1: number; lon2: number }
        Returns: number
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
      is_reseller_admin: {
        Args: { _reseller_id: string; _user_id?: string }
        Returns: boolean
      }
      is_tenant_member: {
        Args: { _tenant_id: string; _user_id: string }
        Returns: boolean
      }
      join_open_shift_waitlist: { Args: { _request_id: string }; Returns: Json }
      marketplace_install_plugin: {
        Args: { _config?: Json; _plugin_id: string; _workspace_id: string }
        Returns: string
      }
      marketplace_set_plugin_status: {
        Args: { _plugin_id: string; _status: string }
        Returns: Json
      }
      marketplace_submit_plugin: {
        Args: {
          _category: string
          _description: string
          _icon_url?: string
          _manifest: Json
          _name: string
          _pricing?: string
          _slug: string
        }
        Returns: string
      }
      marketplace_uninstall_plugin: {
        Args: { _installed_id: string }
        Returns: Json
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
      process_open_shift_escalations: { Args: never; Returns: number }
      read_email_batch: {
        Args: { batch_size: number; queue_name: string; vt: number }
        Returns: {
          message: Json
          msg_id: number
          read_ct: number
        }[]
      }
      require_feature_id: { Args: { _feature_key: string }; Returns: string }
      reseller_get_usage: { Args: { _reseller_id: string }; Returns: Json }
      reseller_provision_workspace: {
        Args: {
          _description?: string
          _name: string
          _reseller_id: string
          _seats?: number
          _tier_key?: string
        }
        Returns: string
      }
      reseller_update_theme: {
        Args: { _reseller_id: string; _theme_config: Json }
        Returns: Json
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
      shift_trade_accept: { Args: { _offer_id: string }; Returns: Json }
      shift_trade_cancel: { Args: { _offer_id: string }; Returns: Json }
      shift_trade_decide: {
        Args: { _acceptance_id: string; _approved: boolean; _notes?: string }
        Returns: Json
      }
      shift_trade_is_eligible: {
        Args: { _membership_id: string; _shift_assignment_id: string }
        Returns: boolean
      }
      shift_trade_offer: {
        Args: {
          _expires_at?: string
          _reason?: string
          _shift_assignment_id: string
        }
        Returns: string
      }
      superadmin_change_workspace_tier: {
        Args: { _reason?: string; _tier_key: string; _workspace_id: string }
        Returns: Json
      }
      tenant_enabled_features: {
        Args: { _tenant_id: string }
        Returns: {
          feature_key: string
          source: string
        }[]
      }
      tenant_id_for_workspace: {
        Args: { _workspace_id: string }
        Returns: string
      }
      validate_password_policy: { Args: { _password: string }; Returns: Json }
      webhook_emit: {
        Args: { _event_type: string; _payload: Json; _workspace_id: string }
        Returns: Json
      }
      webhook_record_delivery: {
        Args: {
          _delivery_id: string
          _error?: string
          _response_body: string
          _status_code: number
        }
        Returns: Json
      }
      wellbeing_calculate_scores: {
        Args: { _workspace_id: string }
        Returns: Json
      }
      wellbeing_get_weights: { Args: { _workspace_id: string }; Returns: Json }
      workspace_permission_catalog: {
        Args: { _workspace_id: string }
        Returns: {
          display_name: string
          feature_key: string
          parent_key: string
          sort_order: number
          tier_feature_keys: string[]
          visible: boolean
        }[]
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
