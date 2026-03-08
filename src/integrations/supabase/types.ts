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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      account_audit_log: {
        Row: {
          account_id: string
          action: string
          amount: number | null
          balance_after: number | null
          balance_before: number | null
          created_at: string
          field_changed: string | null
          id: string
          new_value: string | null
          notes: string | null
          old_value: string | null
          user_id: string
        }
        Insert: {
          account_id: string
          action: string
          amount?: number | null
          balance_after?: number | null
          balance_before?: number | null
          created_at?: string
          field_changed?: string | null
          id?: string
          new_value?: string | null
          notes?: string | null
          old_value?: string | null
          user_id: string
        }
        Update: {
          account_id?: string
          action?: string
          amount?: number | null
          balance_after?: number | null
          balance_before?: number | null
          created_at?: string
          field_changed?: string | null
          id?: string
          new_value?: string | null
          notes?: string | null
          old_value?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "account_audit_log_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      accounts: {
        Row: {
          account_number: string | null
          balance: number
          classification: string
          color: string | null
          created_at: string
          currency: Database["public"]["Enums"]["currency_code"]
          icon: string | null
          id: string
          institution_name: string | null
          is_active: boolean | null
          is_archived: boolean
          min_balance_alert: number | null
          name: string
          notes: string | null
          opening_balance: number
          type: Database["public"]["Enums"]["account_type"]
          updated_at: string
          user_id: string
        }
        Insert: {
          account_number?: string | null
          balance?: number
          classification?: string
          color?: string | null
          created_at?: string
          currency?: Database["public"]["Enums"]["currency_code"]
          icon?: string | null
          id?: string
          institution_name?: string | null
          is_active?: boolean | null
          is_archived?: boolean
          min_balance_alert?: number | null
          name: string
          notes?: string | null
          opening_balance?: number
          type?: Database["public"]["Enums"]["account_type"]
          updated_at?: string
          user_id: string
        }
        Update: {
          account_number?: string | null
          balance?: number
          classification?: string
          color?: string | null
          created_at?: string
          currency?: Database["public"]["Enums"]["currency_code"]
          icon?: string | null
          id?: string
          institution_name?: string | null
          is_active?: boolean | null
          is_archived?: boolean
          min_balance_alert?: number | null
          name?: string
          notes?: string | null
          opening_balance?: number
          type?: Database["public"]["Enums"]["account_type"]
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      activity_logs: {
        Row: {
          action: string
          created_at: string
          details: Json | null
          id: string
          ip_address: string | null
          module: string
          user_id: string
        }
        Insert: {
          action: string
          created_at?: string
          details?: Json | null
          id?: string
          ip_address?: string | null
          module?: string
          user_id: string
        }
        Update: {
          action?: string
          created_at?: string
          details?: Json | null
          id?: string
          ip_address?: string | null
          module?: string
          user_id?: string
        }
        Relationships: []
      }
      badges: {
        Row: {
          category: string
          created_at: string
          description: string
          icon: string
          id: string
          name: string
          requirement_type: string
          requirement_value: number
        }
        Insert: {
          category: string
          created_at?: string
          description: string
          icon: string
          id?: string
          name: string
          requirement_type: string
          requirement_value: number
        }
        Update: {
          category?: string
          created_at?: string
          description?: string
          icon?: string
          id?: string
          name?: string
          requirement_type?: string
          requirement_value?: number
        }
        Relationships: []
      }
      bills_subscriptions: {
        Row: {
          amount: number
          auto_pay: boolean
          category: string
          color: string | null
          created_at: string
          currency: Database["public"]["Enums"]["currency_code"]
          due_date: string | null
          frequency: string
          icon: string | null
          id: string
          is_active: boolean
          last_paid_date: string | null
          name: string
          next_due_date: string | null
          notes: string | null
          provider: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          amount: number
          auto_pay?: boolean
          category?: string
          color?: string | null
          created_at?: string
          currency?: Database["public"]["Enums"]["currency_code"]
          due_date?: string | null
          frequency?: string
          icon?: string | null
          id?: string
          is_active?: boolean
          last_paid_date?: string | null
          name: string
          next_due_date?: string | null
          notes?: string | null
          provider?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          amount?: number
          auto_pay?: boolean
          category?: string
          color?: string | null
          created_at?: string
          currency?: Database["public"]["Enums"]["currency_code"]
          due_date?: string | null
          frequency?: string
          icon?: string | null
          id?: string
          is_active?: boolean
          last_paid_date?: string | null
          name?: string
          next_due_date?: string | null
          notes?: string | null
          provider?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      budgets: {
        Row: {
          amount: number
          category_id: string | null
          created_at: string
          currency: Database["public"]["Enums"]["currency_code"]
          end_date: string | null
          id: string
          name: string
          period: Database["public"]["Enums"]["budget_period"]
          start_date: string
          updated_at: string
          user_id: string
        }
        Insert: {
          amount: number
          category_id?: string | null
          created_at?: string
          currency?: Database["public"]["Enums"]["currency_code"]
          end_date?: string | null
          id?: string
          name: string
          period?: Database["public"]["Enums"]["budget_period"]
          start_date: string
          updated_at?: string
          user_id: string
        }
        Update: {
          amount?: number
          category_id?: string | null
          created_at?: string
          currency?: Database["public"]["Enums"]["currency_code"]
          end_date?: string | null
          id?: string
          name?: string
          period?: Database["public"]["Enums"]["budget_period"]
          start_date?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "budgets_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
      categories: {
        Row: {
          color: string | null
          created_at: string
          icon: string | null
          id: string
          is_default: boolean | null
          name: string
          type: Database["public"]["Enums"]["transaction_type"]
          user_id: string
        }
        Insert: {
          color?: string | null
          created_at?: string
          icon?: string | null
          id?: string
          is_default?: boolean | null
          name: string
          type: Database["public"]["Enums"]["transaction_type"]
          user_id: string
        }
        Update: {
          color?: string | null
          created_at?: string
          icon?: string | null
          id?: string
          is_default?: boolean | null
          name?: string
          type?: Database["public"]["Enums"]["transaction_type"]
          user_id?: string
        }
        Relationships: []
      }
      exchange_rates: {
        Row: {
          created_at: string
          effective_date: string
          from_currency: string
          id: string
          rate: number
          source: string
          to_currency: string
        }
        Insert: {
          created_at?: string
          effective_date?: string
          from_currency: string
          id?: string
          rate: number
          source?: string
          to_currency: string
        }
        Update: {
          created_at?: string
          effective_date?: string
          from_currency?: string
          id?: string
          rate?: number
          source?: string
          to_currency?: string
        }
        Relationships: []
      }
      financial_lessons: {
        Row: {
          category: string
          content: string
          created_at: string
          difficulty: string
          duration_minutes: number | null
          id: string
          order_index: number | null
          title: string
        }
        Insert: {
          category: string
          content: string
          created_at?: string
          difficulty?: string
          duration_minutes?: number | null
          id?: string
          order_index?: number | null
          title: string
        }
        Update: {
          category?: string
          content?: string
          created_at?: string
          difficulty?: string
          duration_minutes?: number | null
          id?: string
          order_index?: number | null
          title?: string
        }
        Relationships: []
      }
      financial_tips: {
        Row: {
          category: string | null
          created_at: string
          id: string
          is_read: boolean | null
          tip: string
          user_id: string
        }
        Insert: {
          category?: string | null
          created_at?: string
          id?: string
          is_read?: boolean | null
          tip: string
          user_id: string
        }
        Update: {
          category?: string | null
          created_at?: string
          id?: string
          is_read?: boolean | null
          tip?: string
          user_id?: string
        }
        Relationships: []
      }
      investments: {
        Row: {
          created_at: string
          currency: Database["public"]["Enums"]["currency_code"]
          current_price: number
          id: string
          is_active: boolean
          name: string
          notes: string | null
          platform: string | null
          purchase_date: string | null
          purchase_price: number
          quantity: number
          symbol: string | null
          type: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          currency?: Database["public"]["Enums"]["currency_code"]
          current_price?: number
          id?: string
          is_active?: boolean
          name: string
          notes?: string | null
          platform?: string | null
          purchase_date?: string | null
          purchase_price?: number
          quantity?: number
          symbol?: string | null
          type?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          currency?: Database["public"]["Enums"]["currency_code"]
          current_price?: number
          id?: string
          is_active?: boolean
          name?: string
          notes?: string | null
          platform?: string | null
          purchase_date?: string | null
          purchase_price?: number
          quantity?: number
          symbol?: string | null
          type?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      notifications: {
        Row: {
          created_at: string
          id: string
          is_read: boolean
          message: string
          module: string
          related_id: string | null
          title: string
          type: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_read?: boolean
          message: string
          module?: string
          related_id?: string | null
          title: string
          type?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_read?: boolean
          message?: string
          module?: string
          related_id?: string | null
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          default_currency: Database["public"]["Enums"]["currency_code"] | null
          dob: string | null
          full_name: string | null
          gender: string | null
          id: string
          phone: string | null
          updated_at: string
          user_id: string
          username: string | null
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          default_currency?: Database["public"]["Enums"]["currency_code"] | null
          dob?: string | null
          full_name?: string | null
          gender?: string | null
          id?: string
          phone?: string | null
          updated_at?: string
          user_id: string
          username?: string | null
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          default_currency?: Database["public"]["Enums"]["currency_code"] | null
          dob?: string | null
          full_name?: string | null
          gender?: string | null
          id?: string
          phone?: string | null
          updated_at?: string
          user_id?: string
          username?: string | null
        }
        Relationships: []
      }
      recurring_schedules: {
        Row: {
          created_at: string
          description: string | null
          frequency: string
          id: string
          is_active: boolean
          last_run_date: string | null
          max_runs: number | null
          next_run_date: string
          template_data: Json
          total_runs: number
          type: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          frequency?: string
          id?: string
          is_active?: boolean
          last_run_date?: string | null
          max_runs?: number | null
          next_run_date: string
          template_data?: Json
          total_runs?: number
          type?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          description?: string | null
          frequency?: string
          id?: string
          is_active?: boolean
          last_run_date?: string | null
          max_runs?: number | null
          next_run_date?: string
          template_data?: Json
          total_runs?: number
          type?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      savings_allocations: {
        Row: {
          account_id: string
          allocated_at: string
          amount: number
          created_at: string
          currency: Database["public"]["Enums"]["currency_code"]
          id: string
          notes: string | null
          savings_goal_id: string
          user_id: string
        }
        Insert: {
          account_id: string
          allocated_at?: string
          amount: number
          created_at?: string
          currency?: Database["public"]["Enums"]["currency_code"]
          id?: string
          notes?: string | null
          savings_goal_id: string
          user_id: string
        }
        Update: {
          account_id?: string
          allocated_at?: string
          amount?: number
          created_at?: string
          currency?: Database["public"]["Enums"]["currency_code"]
          id?: string
          notes?: string | null
          savings_goal_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "savings_allocations_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "savings_allocations_savings_goal_id_fkey"
            columns: ["savings_goal_id"]
            isOneToOne: false
            referencedRelation: "savings_goals"
            referencedColumns: ["id"]
          },
        ]
      }
      savings_goals: {
        Row: {
          color: string | null
          created_at: string
          currency: Database["public"]["Enums"]["currency_code"]
          current_amount: number
          goal_type: string
          icon: string | null
          id: string
          is_completed: boolean | null
          name: string
          priority: string
          target_amount: number
          target_date: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          color?: string | null
          created_at?: string
          currency?: Database["public"]["Enums"]["currency_code"]
          current_amount?: number
          goal_type?: string
          icon?: string | null
          id?: string
          is_completed?: boolean | null
          name: string
          priority?: string
          target_amount: number
          target_date?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          color?: string | null
          created_at?: string
          currency?: Database["public"]["Enums"]["currency_code"]
          current_amount?: number
          goal_type?: string
          icon?: string | null
          id?: string
          is_completed?: boolean | null
          name?: string
          priority?: string
          target_amount?: number
          target_date?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      transaction_rules: {
        Row: {
          category_id: string | null
          created_at: string
          description_pattern: string
          id: string
          is_active: boolean | null
          name: string
          tags: string[] | null
          user_id: string
        }
        Insert: {
          category_id?: string | null
          created_at?: string
          description_pattern: string
          id?: string
          is_active?: boolean | null
          name: string
          tags?: string[] | null
          user_id: string
        }
        Update: {
          category_id?: string | null
          created_at?: string
          description_pattern?: string
          id?: string
          is_active?: boolean | null
          name?: string
          tags?: string[] | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "transaction_rules_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
      transactions: {
        Row: {
          account_id: string
          amount: number
          category_id: string | null
          created_at: string
          currency: Database["public"]["Enums"]["currency_code"]
          date: string
          description: string | null
          id: string
          is_recurring: boolean | null
          merchant: string | null
          notes: string | null
          payment_method: string | null
          receipt_url: string | null
          recurring_interval: string | null
          status: string | null
          tags: string[] | null
          type: Database["public"]["Enums"]["transaction_type"]
          updated_at: string
          user_id: string
        }
        Insert: {
          account_id: string
          amount: number
          category_id?: string | null
          created_at?: string
          currency?: Database["public"]["Enums"]["currency_code"]
          date?: string
          description?: string | null
          id?: string
          is_recurring?: boolean | null
          merchant?: string | null
          notes?: string | null
          payment_method?: string | null
          receipt_url?: string | null
          recurring_interval?: string | null
          status?: string | null
          tags?: string[] | null
          type: Database["public"]["Enums"]["transaction_type"]
          updated_at?: string
          user_id: string
        }
        Update: {
          account_id?: string
          amount?: number
          category_id?: string | null
          created_at?: string
          currency?: Database["public"]["Enums"]["currency_code"]
          date?: string
          description?: string | null
          id?: string
          is_recurring?: boolean | null
          merchant?: string | null
          notes?: string | null
          payment_method?: string | null
          receipt_url?: string | null
          recurring_interval?: string | null
          status?: string | null
          tags?: string[] | null
          type?: Database["public"]["Enums"]["transaction_type"]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "transactions_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
      transfers: {
        Row: {
          amount: number
          converted_amount: number
          created_at: string
          description: string | null
          exchange_rate: number
          from_account_id: string
          from_currency: string
          from_transaction_id: string | null
          id: string
          to_account_id: string
          to_currency: string
          to_transaction_id: string | null
          transfer_type: string
          user_id: string
        }
        Insert: {
          amount: number
          converted_amount: number
          created_at?: string
          description?: string | null
          exchange_rate?: number
          from_account_id: string
          from_currency?: string
          from_transaction_id?: string | null
          id?: string
          to_account_id: string
          to_currency?: string
          to_transaction_id?: string | null
          transfer_type?: string
          user_id: string
        }
        Update: {
          amount?: number
          converted_amount?: number
          created_at?: string
          description?: string | null
          exchange_rate?: number
          from_account_id?: string
          from_currency?: string
          from_transaction_id?: string | null
          id?: string
          to_account_id?: string
          to_currency?: string
          to_transaction_id?: string | null
          transfer_type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "transfers_from_account_id_fkey"
            columns: ["from_account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transfers_from_transaction_id_fkey"
            columns: ["from_transaction_id"]
            isOneToOne: false
            referencedRelation: "transactions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transfers_to_account_id_fkey"
            columns: ["to_account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transfers_to_transaction_id_fkey"
            columns: ["to_transaction_id"]
            isOneToOne: false
            referencedRelation: "transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      user_badges: {
        Row: {
          badge_id: string
          earned_at: string
          id: string
          user_id: string
        }
        Insert: {
          badge_id: string
          earned_at?: string
          id?: string
          user_id: string
        }
        Update: {
          badge_id?: string
          earned_at?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_badges_badge_id_fkey"
            columns: ["badge_id"]
            isOneToOne: false
            referencedRelation: "badges"
            referencedColumns: ["id"]
          },
        ]
      }
      user_lesson_progress: {
        Row: {
          completed_at: string
          id: string
          lesson_id: string
          user_id: string
        }
        Insert: {
          completed_at?: string
          id?: string
          lesson_id: string
          user_id: string
        }
        Update: {
          completed_at?: string
          id?: string
          lesson_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_lesson_progress_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "financial_lessons"
            referencedColumns: ["id"]
          },
        ]
      }
      user_settings: {
        Row: {
          ai_advice_mode: string
          ai_enabled: boolean
          ai_risk_tolerance: string
          budget_mode: string
          budget_rollover: boolean
          chart_preference: string
          created_at: string
          dashboard_density: string
          data_cache_days: number
          date_format: string
          debt_strategy: string
          default_landing_tab: string
          financial_year_start: string
          health_weight_cashflow: number
          health_weight_debt: number
          health_weight_investments: number
          health_weight_savings: number
          id: string
          insight_frequency: string
          language: string
          low_balance_threshold: number
          notify_budget_exceeded: boolean
          notify_debt_reminder: boolean
          notify_goal_progress: boolean
          notify_low_balance: boolean
          notify_monthly_report: boolean
          notify_risk_alerts: boolean
          notify_weekly_summary: boolean
          performance_mode: boolean
          realtime_recalculation: boolean
          savings_auto_percentage: number | null
          savings_round_up: boolean
          theme: string
          timezone: string
          updated_at: string
          user_id: string
        }
        Insert: {
          ai_advice_mode?: string
          ai_enabled?: boolean
          ai_risk_tolerance?: string
          budget_mode?: string
          budget_rollover?: boolean
          chart_preference?: string
          created_at?: string
          dashboard_density?: string
          data_cache_days?: number
          date_format?: string
          debt_strategy?: string
          default_landing_tab?: string
          financial_year_start?: string
          health_weight_cashflow?: number
          health_weight_debt?: number
          health_weight_investments?: number
          health_weight_savings?: number
          id?: string
          insight_frequency?: string
          language?: string
          low_balance_threshold?: number
          notify_budget_exceeded?: boolean
          notify_debt_reminder?: boolean
          notify_goal_progress?: boolean
          notify_low_balance?: boolean
          notify_monthly_report?: boolean
          notify_risk_alerts?: boolean
          notify_weekly_summary?: boolean
          performance_mode?: boolean
          realtime_recalculation?: boolean
          savings_auto_percentage?: number | null
          savings_round_up?: boolean
          theme?: string
          timezone?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          ai_advice_mode?: string
          ai_enabled?: boolean
          ai_risk_tolerance?: string
          budget_mode?: string
          budget_rollover?: boolean
          chart_preference?: string
          created_at?: string
          dashboard_density?: string
          data_cache_days?: number
          date_format?: string
          debt_strategy?: string
          default_landing_tab?: string
          financial_year_start?: string
          health_weight_cashflow?: number
          health_weight_debt?: number
          health_weight_investments?: number
          health_weight_savings?: number
          id?: string
          insight_frequency?: string
          language?: string
          low_balance_threshold?: number
          notify_budget_exceeded?: boolean
          notify_debt_reminder?: boolean
          notify_goal_progress?: boolean
          notify_low_balance?: boolean
          notify_monthly_report?: boolean
          notify_risk_alerts?: boolean
          notify_weekly_summary?: boolean
          performance_mode?: boolean
          realtime_recalculation?: boolean
          savings_auto_percentage?: number | null
          savings_round_up?: boolean
          theme?: string
          timezone?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_streaks: {
        Row: {
          created_at: string
          current_streak: number | null
          id: string
          last_activity_date: string | null
          longest_streak: number | null
          total_savings_added: number | null
          total_transactions: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          current_streak?: number | null
          id?: string
          last_activity_date?: string | null
          longest_streak?: number | null
          total_savings_added?: number | null
          total_transactions?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          current_streak?: number | null
          id?: string
          last_activity_date?: string | null
          longest_streak?: number | null
          total_savings_added?: number | null
          total_transactions?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      recalculate_savings_goal_amount: {
        Args: { _goal_id: string }
        Returns: undefined
      }
    }
    Enums: {
      account_type:
        | "bank"
        | "mobile_money"
        | "cash"
        | "investment"
        | "crypto"
        | "other"
      budget_period: "daily" | "weekly" | "monthly" | "yearly"
      currency_code:
        | "KES"
        | "TZS"
        | "UGX"
        | "RWF"
        | "BIF"
        | "ETB"
        | "USD"
        | "EUR"
        | "GBP"
      transaction_type: "income" | "expense" | "transfer"
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
      account_type: [
        "bank",
        "mobile_money",
        "cash",
        "investment",
        "crypto",
        "other",
      ],
      budget_period: ["daily", "weekly", "monthly", "yearly"],
      currency_code: [
        "KES",
        "TZS",
        "UGX",
        "RWF",
        "BIF",
        "ETB",
        "USD",
        "EUR",
        "GBP",
      ],
      transaction_type: ["income", "expense", "transfer"],
    },
  },
} as const
