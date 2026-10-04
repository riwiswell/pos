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
      daily_focus: {
        Row: {
          created_at: string
          focus_date: string
          habit_id: string | null
          id: string
          planner_item_id: string | null
          source: string
          text: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          focus_date: string
          habit_id?: string | null
          id?: string
          planner_item_id?: string | null
          source?: string
          text?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          focus_date?: string
          habit_id?: string | null
          id?: string
          planner_item_id?: string | null
          source?: string
          text?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "daily_focus_habit_id_fkey"
            columns: ["habit_id"]
            isOneToOne: false
            referencedRelation: "habits"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "daily_focus_planner_item_id_fkey"
            columns: ["planner_item_id"]
            isOneToOne: false
            referencedRelation: "planner_items"
            referencedColumns: ["id"]
          },
        ]
      }
      finance_accounts: {
        Row: {
          archived: boolean
          color: string
          created_at: string
          icon: string
          id: string
          include_in_total: boolean
          initial_balance: number
          name: string
          note: string | null
          position: number
          updated_at: string
          user_id: string
        }
        Insert: {
          archived?: boolean
          color?: string
          created_at?: string
          icon?: string
          id?: string
          include_in_total?: boolean
          initial_balance?: number
          name: string
          note?: string | null
          position?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          archived?: boolean
          color?: string
          created_at?: string
          icon?: string
          id?: string
          include_in_total?: boolean
          initial_balance?: number
          name?: string
          note?: string | null
          position?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      finance_categories: {
        Row: {
          active: boolean
          color: string
          created_at: string
          icon: string
          id: string
          kind: string
          name: string
          position: number
          updated_at: string
          user_id: string
        }
        Insert: {
          active?: boolean
          color?: string
          created_at?: string
          icon?: string
          id?: string
          kind?: string
          name: string
          position?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          active?: boolean
          color?: string
          created_at?: string
          icon?: string
          id?: string
          kind?: string
          name?: string
          position?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      finance_settings: {
        Row: {
          created_at: string
          show_money_in_dashboard: boolean
          tithe_basis: string
          tithe_custom_note: string | null
          tithe_percent: number
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          show_money_in_dashboard?: boolean
          tithe_basis?: string
          tithe_custom_note?: string | null
          tithe_percent?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          show_money_in_dashboard?: boolean
          tithe_basis?: string
          tithe_custom_note?: string | null
          tithe_percent?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      finance_transactions: {
        Row: {
          account_id: string | null
          amount: number
          category_id: string | null
          cost_amount: number
          counts_for_tithe: boolean
          created_at: string
          id: string
          is_tithe_payment: boolean
          note: string | null
          occurred_on: string
          occurred_time: string | null
          photos: string[]
          tags: string[]
          transfer_account_id: string | null
          type: string
          updated_at: string
          user_id: string
        }
        Insert: {
          account_id?: string | null
          amount: number
          category_id?: string | null
          cost_amount?: number
          counts_for_tithe?: boolean
          created_at?: string
          id?: string
          is_tithe_payment?: boolean
          note?: string | null
          occurred_on: string
          occurred_time?: string | null
          photos?: string[]
          tags?: string[]
          transfer_account_id?: string | null
          type: string
          updated_at?: string
          user_id: string
        }
        Update: {
          account_id?: string | null
          amount?: number
          category_id?: string | null
          cost_amount?: number
          counts_for_tithe?: boolean
          created_at?: string
          id?: string
          is_tithe_payment?: boolean
          note?: string | null
          occurred_on?: string
          occurred_time?: string | null
          photos?: string[]
          tags?: string[]
          transfer_account_id?: string | null
          type?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "finance_transactions_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "finance_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "finance_transactions_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "finance_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "finance_transactions_transfer_account_id_fkey"
            columns: ["transfer_account_id"]
            isOneToOne: false
            referencedRelation: "finance_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      habit_categories: {
        Row: {
          color: string
          created_at: string
          id: string
          name: string
          position: number
          updated_at: string
          user_id: string
        }
        Insert: {
          color?: string
          created_at?: string
          id?: string
          name: string
          position?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          color?: string
          created_at?: string
          id?: string
          name?: string
          position?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      habit_logs: {
        Row: {
          completed: boolean
          created_at: string
          date: string
          habit_id: string
          id: string
          note: string | null
          updated_at: string
          user_id: string
          value: number
        }
        Insert: {
          completed?: boolean
          created_at?: string
          date: string
          habit_id: string
          id?: string
          note?: string | null
          updated_at?: string
          user_id: string
          value?: number
        }
        Update: {
          completed?: boolean
          created_at?: string
          date?: string
          habit_id?: string
          id?: string
          note?: string | null
          updated_at?: string
          user_id?: string
          value?: number
        }
        Relationships: [
          {
            foreignKeyName: "habit_logs_habit_id_fkey"
            columns: ["habit_id"]
            isOneToOne: false
            referencedRelation: "habits"
            referencedColumns: ["id"]
          },
        ]
      }
      habits: {
        Row: {
          active: boolean
          category_id: string | null
          created_at: string
          id: string
          kind: string
          name: string
          position: number
          target: number | null
          type: string
          unit: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          active?: boolean
          category_id?: string | null
          created_at?: string
          id?: string
          kind?: string
          name: string
          position?: number
          target?: number | null
          type?: string
          unit?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          active?: boolean
          category_id?: string | null
          created_at?: string
          id?: string
          kind?: string
          name?: string
          position?: number
          target?: number | null
          type?: string
          unit?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "habits_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "habit_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      journal_entries: {
        Row: {
          content: string
          created_at: string
          entry_date: string
          entry_time: string | null
          id: string
          items: string[]
          mood: string | null
          notes: string | null
          photos: string[]
          title: string | null
          type: string
          updated_at: string
          user_id: string
        }
        Insert: {
          content?: string
          created_at?: string
          entry_date?: string
          entry_time?: string | null
          id?: string
          items?: string[]
          mood?: string | null
          notes?: string | null
          photos?: string[]
          title?: string | null
          type: string
          updated_at?: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          entry_date?: string
          entry_time?: string | null
          id?: string
          items?: string[]
          mood?: string | null
          notes?: string | null
          photos?: string[]
          title?: string | null
          type?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      medication_doses: {
        Row: {
          created_at: string
          dose_date: string
          id: string
          medication_id: string
          scheduled_at: string
          scheduled_time: string
          snoozed_until: string | null
          status: string
          taken_at: string | null
          updated_at: string
          user_id: string
          water_glasses: number | null
        }
        Insert: {
          created_at?: string
          dose_date: string
          id?: string
          medication_id: string
          scheduled_at: string
          scheduled_time: string
          snoozed_until?: string | null
          status?: string
          taken_at?: string | null
          updated_at?: string
          user_id: string
          water_glasses?: number | null
        }
        Update: {
          created_at?: string
          dose_date?: string
          id?: string
          medication_id?: string
          scheduled_at?: string
          scheduled_time?: string
          snoozed_until?: string | null
          status?: string
          taken_at?: string | null
          updated_at?: string
          user_id?: string
          water_glasses?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "medication_doses_medication_id_fkey"
            columns: ["medication_id"]
            isOneToOne: false
            referencedRelation: "medications"
            referencedColumns: ["id"]
          },
        ]
      }
      medications: {
        Row: {
          active: boolean
          created_at: string
          dose: number | null
          end_date: string | null
          frequency: string
          id: string
          name: string
          notes: string | null
          remind_offset_min: number
          start_date: string
          times: string[]
          total_quantity: number | null
          unit: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          dose?: number | null
          end_date?: string | null
          frequency?: string
          id?: string
          name: string
          notes?: string | null
          remind_offset_min?: number
          start_date?: string
          times?: string[]
          total_quantity?: number | null
          unit?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          active?: boolean
          created_at?: string
          dose?: number | null
          end_date?: string | null
          frequency?: string
          id?: string
          name?: string
          notes?: string | null
          remind_offset_min?: number
          start_date?: string
          times?: string[]
          total_quantity?: number | null
          unit?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      planner_categories: {
        Row: {
          color: string
          created_at: string
          id: string
          name: string
          position: number
          updated_at: string
          user_id: string
        }
        Insert: {
          color?: string
          created_at?: string
          id?: string
          name: string
          position?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          color?: string
          created_at?: string
          id?: string
          name?: string
          position?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      planner_items: {
        Row: {
          category_id: string | null
          completed_at: string | null
          created_at: string
          description: string | null
          due_on: string | null
          end_time: string | null
          id: string
          location: string | null
          position: number
          priority: string
          scheduled_on: string
          start_time: string | null
          status: string
          title: string
          type: string
          updated_at: string
          user_id: string
        }
        Insert: {
          category_id?: string | null
          completed_at?: string | null
          created_at?: string
          description?: string | null
          due_on?: string | null
          end_time?: string | null
          id?: string
          location?: string | null
          position?: number
          priority?: string
          scheduled_on: string
          start_time?: string | null
          status?: string
          title: string
          type?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          category_id?: string | null
          completed_at?: string | null
          created_at?: string
          description?: string | null
          due_on?: string | null
          end_time?: string | null
          id?: string
          location?: string | null
          position?: number
          priority?: string
          scheduled_on?: string
          start_time?: string | null
          status?: string
          title?: string
          type?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "planner_items_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "planner_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          accent_color: string | null
          avatar_url: string | null
          background_url: string | null
          created_at: string
          display_name: string | null
          full_name: string | null
          help_enabled: boolean
          id: string
          updated_at: string
        }
        Insert: {
          accent_color?: string | null
          avatar_url?: string | null
          background_url?: string | null
          created_at?: string
          display_name?: string | null
          full_name?: string | null
          help_enabled?: boolean
          id: string
          updated_at?: string
        }
        Update: {
          accent_color?: string | null
          avatar_url?: string | null
          background_url?: string | null
          created_at?: string
          display_name?: string | null
          full_name?: string | null
          help_enabled?: boolean
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      shopping_items: {
        Row: {
          checked: boolean
          created_at: string
          id: string
          list_id: string
          name: string
          position: number
          updated_at: string
          user_id: string
        }
        Insert: {
          checked?: boolean
          created_at?: string
          id?: string
          list_id: string
          name: string
          position?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          checked?: boolean
          created_at?: string
          id?: string
          list_id?: string
          name?: string
          position?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "shopping_items_list_id_fkey"
            columns: ["list_id"]
            isOneToOne: false
            referencedRelation: "shopping_lists"
            referencedColumns: ["id"]
          },
        ]
      }
      shopping_lists: {
        Row: {
          created_at: string
          id: string
          name: string
          position: number
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          position?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          position?: number
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
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const