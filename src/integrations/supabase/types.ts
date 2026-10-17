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
      admin_alert_settings: {
        Row: {
          user_id: string
          signups: boolean
          visits: string
          daily_report: boolean
          visits_last_sent_at: string | null
          updated_at: string
        }
        Insert: {
          user_id: string
          signups?: boolean
          visits?: string
          daily_report?: boolean
          visits_last_sent_at?: string | null
          updated_at?: string
        }
        Update: {
          user_id?: string
          signups?: boolean
          visits?: string
          daily_report?: boolean
          visits_last_sent_at?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      vendor_applications: {
        Row: {
          admin_note: string | null
          city: string
          created_at: string
          description: string
          full_name: string
          phone: string
          reviewed_at: string | null
          reviewed_by: string | null
          shop_name: string
          state: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          admin_note?: string | null
          city: string
          created_at?: string
          description: string
          full_name: string
          phone: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          shop_name: string
          state: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          admin_note?: string | null
          city?: string
          created_at?: string
          description?: string
          full_name?: string
          phone?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          shop_name?: string
          state?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      featured_placements: {
        Row: {
          amount: number
          created_at: string
          ends_at: string | null
          id: string
          kind: string
          paid_at: string | null
          payment_reference: string | null
          product_id: string | null
          starts_at: string | null
          status: string
          vendor_id: string
          weeks: number
        }
        Insert: {
          amount: number
          created_at?: string
          ends_at?: string | null
          id?: string
          kind: string
          paid_at?: string | null
          payment_reference?: string | null
          product_id?: string | null
          starts_at?: string | null
          status?: string
          vendor_id: string
          weeks: number
        }
        Update: {
          amount?: number
          created_at?: string
          ends_at?: string | null
          id?: string
          kind?: string
          paid_at?: string | null
          payment_reference?: string | null
          product_id?: string | null
          starts_at?: string | null
          status?: string
          vendor_id?: string
          weeks?: number
        }
        Relationships: [
          {
            foreignKeyName: "featured_placements_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "featured_placements_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      vendor_verification_requests: {
        Row: {
          tier: string
          admin_note: string | null
          amount: number
          business_address: string
          business_name: string
          contact_phone: string
          created_at: string
          id: string
          id_document_path: string | null
          id_number: string
          id_type: string
          notes: string | null
          paid_at: string | null
          payment_reference: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          updated_at: string
          vendor_id: string
        }
        Insert: {
          tier?: string
          admin_note?: string | null
          amount?: number
          business_address: string
          business_name: string
          contact_phone: string
          created_at?: string
          id?: string
          id_document_path?: string | null
          id_number: string
          id_type: string
          notes?: string | null
          paid_at?: string | null
          payment_reference?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          updated_at?: string
          vendor_id: string
        }
        Update: {
          tier?: string
          admin_note?: string | null
          amount?: number
          business_address?: string
          business_name?: string
          contact_phone?: string
          created_at?: string
          id?: string
          id_document_path?: string | null
          id_number?: string
          id_type?: string
          notes?: string | null
          paid_at?: string | null
          payment_reference?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          updated_at?: string
          vendor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "vendor_verification_requests_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      ambassadors: {
        Row: {
          id: string
          code: string
          full_name: string
          phone: string | null
          email: string | null
          bank_name: string | null
          account_number: string | null
          account_name: string | null
          notes: string | null
          is_active: boolean
          link_visits: number
          user_id: string | null
          created_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: never
        Update: never
        Relationships: []
      }
      seller_referrals: {
        Row: {
          seller_id: string
          ambassador_id: string
          status: string
          reward_amount: number | null
          source: string
          approved_at: string | null
          first_sale_order_id: string | null
          earned_at: string | null
          paid_at: string | null
          paid_by: string | null
          payment_note: string | null
          created_at: string
          updated_at: string
        }
        Insert: never
        Update: never
        Relationships: []
      }
      admin_unlocks: {
        Row: {
          unlocked_until: string
          updated_at: string
          user_id: string
        }
        Insert: {
          unlocked_until: string
          updated_at?: string
          user_id: string
        }
        Update: {
          unlocked_until?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      cart_items: {
        Row: {
          color: string | null
          size: string | null
          created_at: string
          id: string
          product_id: string
          quantity: number
          session_id: string | null
          updated_at: string
          user_id: string | null
          variant_id: string | null
        }
        Insert: {
          color?: string | null
          size?: string | null
          created_at?: string
          id?: string
          product_id: string
          quantity?: number
          session_id?: string | null
          updated_at?: string
          user_id?: string | null
          variant_id?: string | null
        }
        Update: {
          color?: string | null
          size?: string | null
          created_at?: string
          id?: string
          product_id?: string
          quantity?: number
          session_id?: string | null
          updated_at?: string
          user_id?: string | null
          variant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "cart_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cart_items_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "product_variants"
            referencedColumns: ["id"]
          },
        ]
      }
      categories: {
        Row: {
          created_at: string
          description: string | null
          id: string
          image_url: string | null
          name: string
          parent_id: string | null
          slug: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          name: string
          parent_id?: string | null
          slug: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          name?: string
          parent_id?: string | null
          slug?: string
        }
        Relationships: [
          {
            foreignKeyName: "categories_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
      conversations: {
        Row: {
          created_at: string
          customer_id: string
          customer_last_read_at: string
          id: string
          kind: string
          last_message_at: string | null
          last_message_preview: string | null
          last_sender_id: string | null
          product_id: string | null
          vendor_id: string | null
          vendor_last_read_at: string
        }
        Insert: {
          created_at?: string
          customer_id: string
          customer_last_read_at?: string
          id?: string
          kind?: string
          last_message_at?: string | null
          last_message_preview?: string | null
          last_sender_id?: string | null
          product_id?: string | null
          vendor_id?: string | null
          vendor_last_read_at?: string
        }
        Update: {
          created_at?: string
          customer_id?: string
          customer_last_read_at?: string
          id?: string
          kind?: string
          last_message_at?: string | null
          last_message_preview?: string | null
          last_sender_id?: string | null
          product_id?: string | null
          vendor_id?: string | null
          vendor_last_read_at?: string
        }
        Relationships: []
      }
      delivery_addresses: {
        Row: {
          city: string
          created_at: string
          full_name: string
          id: string
          is_default: boolean
          label: string
          landmark: string | null
          latitude: number | null
          longitude: number | null
          phone: string
          state: string
          street_address: string
          updated_at: string
          user_id: string
        }
        Insert: {
          city: string
          created_at?: string
          full_name: string
          id?: string
          is_default?: boolean
          label?: string
          landmark?: string | null
          latitude?: number | null
          longitude?: number | null
          phone: string
          state: string
          street_address: string
          updated_at?: string
          user_id: string
        }
        Update: {
          city?: string
          created_at?: string
          full_name?: string
          id?: string
          is_default?: boolean
          label?: string
          landmark?: string | null
          latitude?: number | null
          longitude?: number | null
          phone?: string
          state?: string
          street_address?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      flash_sales: {
        Row: {
          created_at: string
          created_by: string | null
          ends_at: string
          id: string
          is_active: boolean
          max_quantity: number | null
          original_price: number
          product_id: string
          sale_price: number
          sold_quantity: number
          starts_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          ends_at: string
          id?: string
          is_active?: boolean
          max_quantity?: number | null
          original_price: number
          product_id: string
          sale_price: number
          sold_quantity?: number
          starts_at: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          ends_at?: string
          id?: string
          is_active?: boolean
          max_quantity?: number | null
          original_price?: number
          product_id?: string
          sale_price?: number
          sold_quantity?: number
          starts_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "flash_sales_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      client_errors: {
        Row: {
          id: string
          fingerprint: string
          message: string
          stack: string | null
          page: string | null
          user_agent: string | null
          release: string | null
          last_user_id: string | null
          occurrences: number
          affected_users: number
          first_seen_at: string
          last_seen_at: string
          resolved_at: string | null
        }
        Insert: never
        Update: never
        Relationships: []
      }
      messages: {
        Row: {
          media_path: string | null
          product_id: string | null
          message_type: string
          body: string
          conversation_id: string
          created_at: string
          id: string
          reply_to_id: string | null
          sender_id: string
        }
        Insert: {
          media_path?: string | null
          product_id?: string | null
          message_type?: string
          body: string
          conversation_id: string
          created_at?: string
          id?: string
          reply_to_id?: string | null
          sender_id?: string
        }
        Update: {
          media_path?: string | null
          product_id?: string | null
          message_type?: string
          body?: string
          conversation_id?: string
          created_at?: string
          id?: string
          reply_to_id?: string | null
          sender_id?: string
        }
        Relationships: []
      }
      notifications: {
        Row: {
          action_url: string | null
          category: string
          created_at: string
          id: string
          is_read: boolean
          message: string
          metadata: Json | null
          title: string
          type: string
          user_id: string
        }
        Insert: {
          action_url?: string | null
          category?: string
          created_at?: string
          id?: string
          is_read?: boolean
          message: string
          metadata?: Json | null
          title: string
          type?: string
          user_id: string
        }
        Update: {
          action_url?: string | null
          category?: string
          created_at?: string
          id?: string
          is_read?: boolean
          message?: string
          metadata?: Json | null
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      order_deliveries: {
        Row: {
          assigned_automatically: boolean
          company_id: string | null
          company_phone: string | null
          created_at: string
          created_by: string | null
          delivery_company: string | null
          dispatched_at: string | null
          order_id: string
          pickup_code: string
          tracking_reference: string | null
          updated_at: string
        }
        Insert: {
          assigned_automatically?: boolean
          company_id?: string | null
          company_phone?: string | null
          created_at?: string
          created_by?: string | null
          delivery_company?: string | null
          dispatched_at?: string | null
          order_id: string
          pickup_code: string
          tracking_reference?: string | null
          updated_at?: string
        }
        Update: {
          assigned_automatically?: boolean
          company_id?: string | null
          company_phone?: string | null
          created_at?: string
          created_by?: string | null
          delivery_company?: string | null
          dispatched_at?: string | null
          order_id?: string
          pickup_code?: string
          tracking_reference?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      logistics_companies: {
        Row: {
          areas: string[]
          contact_name: string | null
          created_at: string
          email: string | null
          id: string
          is_active: boolean
          is_default: boolean
          name: string
          notes: string | null
          phone: string | null
          priority: number
          updated_at: string
          whatsapp: string | null
        }
        Insert: {
          areas?: string[]
          contact_name?: string | null
          created_at?: string
          email?: string | null
          id?: string
          is_active?: boolean
          is_default?: boolean
          name: string
          notes?: string | null
          phone?: string | null
          priority?: number
          updated_at?: string
          whatsapp?: string | null
        }
        Update: {
          areas?: string[]
          contact_name?: string | null
          created_at?: string
          email?: string | null
          id?: string
          is_active?: boolean
          is_default?: boolean
          name?: string
          notes?: string | null
          phone?: string | null
          priority?: number
          updated_at?: string
          whatsapp?: string | null
        }
        Relationships: []
      }
      order_items: {
        Row: {
          color: string | null
          size: string | null
          created_at: string
          id: string
          order_id: string
          product_id: string
          product_name: string
          quantity: number
          total_price: number
          unit_price: number
          variant_id: string | null
          variant_name: string | null
          vendor_id: string
        }
        Insert: {
          color?: string | null
          size?: string | null
          created_at?: string
          id?: string
          order_id: string
          product_id: string
          product_name: string
          quantity: number
          total_price: number
          unit_price: number
          variant_id?: string | null
          variant_name?: string | null
          vendor_id: string
        }
        Update: {
          color?: string | null
          size?: string | null
          created_at?: string
          id?: string
          order_id?: string
          product_id?: string
          product_name?: string
          quantity?: number
          total_price?: number
          unit_price?: number
          variant_id?: string | null
          variant_name?: string | null
          vendor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "product_variants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "public_vendor_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          auto_release_at: string | null
          dispute_reason: string | null
          dispute_resolved_at: string | null
          dispute_status: string | null
          disputed_at: string | null
          shipped_at: string | null
          confirmed_at: string | null
          created_at: string
          delivery_type: string | null
          escrow_status: string | null
          estimated_delivery_date: string | null
          id: string
          notes: string | null
          payment_reference: string | null
          payment_status: string
          shipping_address: Json
          shipping_fee: number
          status: string
          subtotal: number
          total: number
          tracking_updates: Json | null
          updated_at: string
          user_id: string
        }
        Insert: {
          auto_release_at?: string | null
          dispute_reason?: string | null
          dispute_resolved_at?: string | null
          dispute_status?: string | null
          disputed_at?: string | null
          shipped_at?: string | null
          confirmed_at?: string | null
          created_at?: string
          delivery_type?: string | null
          escrow_status?: string | null
          estimated_delivery_date?: string | null
          id?: string
          notes?: string | null
          payment_reference?: string | null
          payment_status?: string
          shipping_address: Json
          shipping_fee?: number
          status?: string
          subtotal: number
          total: number
          tracking_updates?: Json | null
          updated_at?: string
          user_id: string
        }
        Update: {
          auto_release_at?: string | null
          dispute_reason?: string | null
          dispute_resolved_at?: string | null
          dispute_status?: string | null
          disputed_at?: string | null
          shipped_at?: string | null
          confirmed_at?: string | null
          created_at?: string
          delivery_type?: string | null
          escrow_status?: string | null
          estimated_delivery_date?: string | null
          id?: string
          notes?: string | null
          payment_reference?: string | null
          payment_status?: string
          shipping_address?: Json
          shipping_fee?: number
          status?: string
          subtotal?: number
          total?: number
          tracking_updates?: Json | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      payouts: {
        Row: {
          amount: number
          attempts: number
          commission_amount: number
          commission_percent: number
          created_at: string
          failure_reason: string | null
          gross_amount: number
          id: string
          order_id: string
          paid_at: string | null
          reference: string | null
          status: string
          tranche: number
          transfer_code: string | null
          updated_at: string
          vendor_id: string
        }
        Insert: {
          amount: number
          attempts?: number
          commission_amount: number
          commission_percent: number
          created_at?: string
          failure_reason?: string | null
          gross_amount: number
          id?: string
          order_id: string
          paid_at?: string | null
          reference?: string | null
          status: string
          tranche: number
          transfer_code?: string | null
          updated_at?: string
          vendor_id: string
        }
        Update: {
          amount?: number
          attempts?: number
          commission_amount?: number
          commission_percent?: number
          created_at?: string
          failure_reason?: string | null
          gross_amount?: number
          id?: string
          order_id?: string
          paid_at?: string | null
          reference?: string | null
          status?: string
          tranche?: number
          transfer_code?: string | null
          updated_at?: string
          vendor_id?: string
        }
        Relationships: []
      }
      platform_settings: {
        Row: {
          gold_verification_fee: number
          featured_max_weeks: number
          featured_product_weekly_fee: number
          featured_shop_weekly_fee: number
          verification_fee: number
          verification_period_days: number | null
          auto_release_days: number
          checkout_commission_percent: number
          ambassador_seller_reward: number
          commission_percent: number
          id: number
          updated_at: string
        }
        Insert: {
          gold_verification_fee?: number
          featured_max_weeks?: number
          featured_product_weekly_fee?: number
          featured_shop_weekly_fee?: number
          verification_fee?: number
          verification_period_days?: number | null
          auto_release_days?: number
          checkout_commission_percent?: number
          ambassador_seller_reward?: number
          commission_percent?: number
          id?: number
          updated_at?: string
        }
        Update: {
          gold_verification_fee?: number
          featured_max_weeks?: number
          featured_product_weekly_fee?: number
          featured_shop_weekly_fee?: number
          verification_fee?: number
          verification_period_days?: number | null
          auto_release_days?: number
          checkout_commission_percent?: number
          ambassador_seller_reward?: number
          commission_percent?: number
          id?: number
          updated_at?: string
        }
        Relationships: []
      }
      product_images: {
        Row: {
          alt_text: string | null
          created_at: string
          display_order: number
          id: string
          is_primary: boolean
          product_id: string
          url: string
        }
        Insert: {
          alt_text?: string | null
          created_at?: string
          display_order?: number
          id?: string
          is_primary?: boolean
          product_id: string
          url: string
        }
        Update: {
          alt_text?: string | null
          created_at?: string
          display_order?: number
          id?: string
          is_primary?: boolean
          product_id?: string
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_images_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      product_variants: {
        Row: {
          color: string | null
          created_at: string
          id: string
          name: string
          price_adjustment: number | null
          product_id: string
          size: string | null
          stock_quantity: number
        }
        Insert: {
          color?: string | null
          created_at?: string
          id?: string
          name: string
          price_adjustment?: number | null
          product_id: string
          size?: string | null
          stock_quantity?: number
        }
        Update: {
          color?: string | null
          created_at?: string
          id?: string
          name?: string
          price_adjustment?: number | null
          product_id?: string
          size?: string | null
          stock_quantity?: number
        }
        Relationships: [
          {
            foreignKeyName: "product_variants_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          vendor_rank: number
          featured_until: string | null
          colors: string[]
          sizes: string[]
          category_id: string | null
          compare_at_price: number | null
          created_at: string
          deleted_at: string | null
          description: string | null
          featured: boolean
          id: string
          is_active: boolean
          name: string
          price: number
          slug: string
          stock_quantity: number
          updated_at: string
          vendor_id: string
        }
        Insert: {
          vendor_rank?: number
          featured_until?: string | null
          colors?: string[]
          sizes?: string[]
          category_id?: string | null
          compare_at_price?: number | null
          created_at?: string
          deleted_at?: string | null
          description?: string | null
          featured?: boolean
          id?: string
          is_active?: boolean
          name: string
          price: number
          slug: string
          stock_quantity?: number
          updated_at?: string
          vendor_id: string
        }
        Update: {
          vendor_rank?: number
          featured_until?: string | null
          colors?: string[]
          sizes?: string[]
          category_id?: string | null
          compare_at_price?: number | null
          created_at?: string
          deleted_at?: string | null
          description?: string | null
          featured?: boolean
          id?: string
          is_active?: boolean
          name?: string
          price?: number
          slug?: string
          stock_quantity?: number
          updated_at?: string
          vendor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "products_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "public_vendor_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      push_subscriptions: {
        Row: {
          auth: string
          created_at: string
          endpoint: string
          id: string
          last_used_at: string | null
          p256dh: string
          user_agent: string | null
          user_id: string
        }
        Insert: {
          auth: string
          created_at?: string
          endpoint: string
          id?: string
          last_used_at?: string | null
          p256dh: string
          user_agent?: string | null
          user_id: string
        }
        Update: {
          auth?: string
          created_at?: string
          endpoint?: string
          id?: string
          last_used_at?: string | null
          p256dh?: string
          user_agent?: string | null
          user_id?: string
        }
        Relationships: []
      }
      calls: {
        Row: {
          kind: string
          answered_at: string | null
          callee_id: string | null
          caller_id: string
          caller_name: string
          conversation_id: string
          created_at: string
          ended_at: string | null
          id: string
          status: string
          to_support: boolean
        }
        Insert: {
          kind?: string
          answered_at?: string | null
          callee_id?: string | null
          caller_id: string
          caller_name: string
          conversation_id: string
          created_at?: string
          ended_at?: string | null
          id?: string
          status?: string
          to_support?: boolean
        }
        Update: {
          kind?: string
          answered_at?: string | null
          callee_id?: string | null
          caller_id?: string
          caller_name?: string
          conversation_id?: string
          created_at?: string
          ended_at?: string | null
          id?: string
          status?: string
          to_support?: boolean
        }
        Relationships: []
      }
      message_reactions: {
        Row: { conversation_id: string; emoji: string | null; message_id: string; updated_at: string; user_id: string }
        Insert: { conversation_id: string; emoji?: string | null; message_id: string; updated_at?: string; user_id: string }
        Update: { conversation_id?: string; emoji?: string | null; message_id?: string; updated_at?: string; user_id?: string }
        Relationships: []
      }
      profiles: {
        Row: {
          last_seen_at: string | null
          verification_tier: string | null
          shop_featured_until: string | null
          verified_until: string | null
          account_name: string | null
          account_number: string | null
          avatar_url: string | null
          bank_name: string | null
          created_at: string
          email: string
          full_name: string | null
          id: string
          is_verified: boolean
          notification_orders: boolean | null
          notification_promotions: boolean | null
          notification_push: boolean | null
          payout_preference: string | null
          phone: string | null
          preferred_currency: string | null
          preferred_language: string | null
          store_address: Json | null
          store_banner_url: string | null
          store_description: string | null
          store_name: string | null
          store_slug: string | null
          updated_at: string
        }
        Insert: {
          last_seen_at?: string | null
          verification_tier?: string | null
          shop_featured_until?: string | null
          verified_until?: string | null
          account_name?: string | null
          account_number?: string | null
          avatar_url?: string | null
          bank_name?: string | null
          created_at?: string
          email: string
          full_name?: string | null
          id: string
          is_verified?: boolean
          notification_orders?: boolean | null
          notification_promotions?: boolean | null
          notification_push?: boolean | null
          payout_preference?: string | null
          phone?: string | null
          preferred_currency?: string | null
          preferred_language?: string | null
          store_address?: Json | null
          store_banner_url?: string | null
          store_description?: string | null
          store_name?: string | null
          store_slug?: string | null
          updated_at?: string
        }
        Update: {
          last_seen_at?: string | null
          verification_tier?: string | null
          shop_featured_until?: string | null
          verified_until?: string | null
          account_name?: string | null
          account_number?: string | null
          avatar_url?: string | null
          bank_name?: string | null
          created_at?: string
          email?: string
          full_name?: string | null
          id?: string
          is_verified?: boolean
          notification_orders?: boolean | null
          notification_promotions?: boolean | null
          notification_push?: boolean | null
          payout_preference?: string | null
          phone?: string | null
          preferred_currency?: string | null
          preferred_language?: string | null
          store_address?: Json | null
          store_banner_url?: string | null
          store_description?: string | null
          store_name?: string | null
          store_slug?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      reviews: {
        Row: {
          created_at: string
          fit_feedback: string | null
          id: string
          is_approved: boolean
          order_item_id: string | null
          photos: Json | null
          product_id: string
          rating: number
          review_text: string | null
          seller_replied_at: string | null
          seller_reply: string | null
          updated_at: string
          user_id: string
          would_recommend: boolean | null
        }
        Insert: {
          created_at?: string
          fit_feedback?: string | null
          id?: string
          is_approved?: boolean
          order_item_id?: string | null
          photos?: Json | null
          product_id: string
          rating: number
          review_text?: string | null
          seller_replied_at?: string | null
          seller_reply?: string | null
          updated_at?: string
          user_id: string
          would_recommend?: boolean | null
        }
        Update: {
          created_at?: string
          fit_feedback?: string | null
          id?: string
          is_approved?: boolean
          order_item_id?: string | null
          photos?: Json | null
          product_id?: string
          rating?: number
          review_text?: string | null
          seller_replied_at?: string | null
          seller_reply?: string | null
          updated_at?: string
          user_id?: string
          would_recommend?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "reviews_order_item_id_fkey"
            columns: ["order_item_id"]
            isOneToOne: false
            referencedRelation: "order_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reviews_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      shipping_promo_codes: {
        Row: {
          code: string
          created_at: string
          discount_type: string
          discount_value: number
          expires_at: string | null
          id: string
          is_active: boolean | null
        }
        Insert: {
          code: string
          created_at?: string
          discount_type: string
          discount_value?: number
          expires_at?: string | null
          id?: string
          is_active?: boolean | null
        }
        Update: {
          code?: string
          created_at?: string
          discount_type?: string
          discount_value?: number
          expires_at?: string | null
          id?: string
          is_active?: boolean | null
        }
        Relationships: []
      }
      shop_follows: {
        Row: {
          created_at: string
          user_id: string
          vendor_id: string
        }
        Insert: {
          created_at?: string
          user_id: string
          vendor_id: string
        }
        Update: {
          created_at?: string
          user_id?: string
          vendor_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      vendor_payout_accounts: {
        Row: {
          account_name: string
          account_number: string
          bank_code: string
          bank_name: string
          created_at: string
          recipient_code: string
          updated_at: string
          vendor_id: string
        }
        Insert: {
          account_name: string
          account_number: string
          bank_code: string
          bank_name: string
          created_at?: string
          recipient_code: string
          updated_at?: string
          vendor_id: string
        }
        Update: {
          account_name?: string
          account_number?: string
          bank_code?: string
          bank_name?: string
          created_at?: string
          recipient_code?: string
          updated_at?: string
          vendor_id?: string
        }
        Relationships: []
      }
      wishlists: {
        Row: {
          created_at: string
          id: string
          product_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          product_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          product_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "wishlists_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      public_vendor_profiles: {
        Row: {
          verification_tier: string | null
          avatar_url: string | null
          full_name: string | null
          id: string | null
          is_verified: boolean | null
          store_address: Json | null
          store_banner_url: string | null
          store_description: string | null
          store_name: string | null
          store_slug: string | null
        }
        Insert: {
          verification_tier?: string | null
          avatar_url?: string | null
          full_name?: string | null
          id?: string | null
          is_verified?: boolean | null
          store_address?: Json | null
          store_description?: string | null
          store_name?: string | null
        }
        Update: {
          verification_tier?: string | null
          avatar_url?: string | null
          full_name?: string | null
          id?: string | null
          is_verified?: boolean | null
          store_address?: Json | null
          store_description?: string | null
          store_name?: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      delete_product: {
        Args: { p_product_id: string }
        Returns: string
      }
      send_product_card: { Args: { p_conversation_id: string; p_product_id: string }; Returns: undefined }
      request_protected_purchase: { Args: { p_product_id: string }; Returns: string }
      conversation_block_state: {
        Args: { p_conversation_id: string }
        Returns: { i_blocked: boolean; blocked_me: boolean }[]
      }
      set_conversation_block: { Args: { p_conversation_id: string; p_block: boolean }; Returns: undefined }
      report_content: {
        Args: { p_target_type: string; p_target_id: string; p_reason: string; p_details?: string }
        Returns: string
      }
      admin_list_reports: {
        Args: { p_status?: string | null; p_limit?: number }
        Returns: {
          id: string
          target_type: string
          target_id: string
          reason: string
          details: string | null
          status: string
          admin_note: string | null
          created_at: string
          reporter_name: string
          reported_user_id: string | null
          reported_name: string
          conversation_id: string | null
          message_body: string | null
          story_image_url: string | null
          story_caption: string | null
          story_live: boolean
          reports_against_user: number
        }[]
      }
      admin_resolve_report: { Args: { p_report_id: string; p_status: string; p_note?: string }; Returns: undefined }
      admin_live_stories: {
        Args: Record<PropertyKey, never>
        Returns: {
          id: string
          vendor_id: string
          store_name: string | null
          image_url: string
          caption: string | null
          created_at: string
          expires_at: string
          view_count: number
          like_count: number
          open_reports: number
        }[]
      }
      story_viewers: {
        Args: { p_story_id: string }
        Returns: { user_id: string; name: string; avatar_url: string | null; viewed_at: string; liked: boolean }[]
      }
      log_client_error: {
        Args: { p_message: string; p_stack?: string; p_page?: string; p_user_agent?: string; p_release?: string }
        Returns: undefined
      }
      admin_set_error_resolved: { Args: { p_error_id: string; p_resolved: boolean }; Returns: undefined }
      track_events: { Args: { p_events: Json }; Returns: undefined }
      admin_analytics: { Args: { p_from: string; p_to: string }; Returns: Json }
      admin_live_visitors: { Args: Record<PropertyKey, never>; Returns: Json }
      admin_today_overview: { Args: Record<PropertyKey, never>; Returns: Json }
      set_shop_like: { Args: { p_vendor_id: string; p_like: boolean }; Returns: Json }
      get_shop_social: {
        Args: { p_vendor_id: string }
        Returns: { follower_count: number; like_count: number; i_follow: boolean; i_like: boolean }[]
      }
      get_my_shop_fans: {
        Args: { p_kind: string; p_limit?: number; p_offset?: number }
        Returns: {
          user_id: string
          name: string
          avatar_url: string | null
          since: string
          follows: boolean
          likes: boolean
          orders_count: number
        }[]
      }
      get_my_shop_fan_summary: { Args: Record<PropertyKey, never>; Returns: Json }
      get_my_reviewable_items: {
        Args: { p_vendor_id?: string | null; p_product_id?: string | null }
        Returns: {
          order_item_id: string
          order_id: string
          product_id: string
          product_name: string
          product_slug: string
          image_url: string | null
          vendor_id: string
          store_name: string | null
          variant: string | null
          delivered_at: string
        }[]
      }
      get_my_shop_reviews: {
        Args: { p_limit?: number; p_offset?: number }
        Returns: {
          id: string
          rating: number
          review_text: string | null
          photos: Json
          fit_feedback: string | null
          would_recommend: boolean | null
          seller_reply: string | null
          seller_replied_at: string | null
          created_at: string
          reviewer_name: string
          reviewer_avatar: string | null
          product_id: string
          product_name: string
          product_slug: string
          product_image: string | null
        }[]
      }
      admin_dispatch_delivery: {
        Args: { p_order_id: string; p_company_id: string; p_pickup_code?: string | null; p_tracking_reference?: string | null }
        Returns: undefined
      }
      admin_logistics_overview: { Args: Record<PropertyKey, never>; Returns: Json }
      get_ambassador_invite: { Args: { p_code: string }; Returns: { code: string; first_name: string }[] }
      record_ambassador_visit: { Args: { p_code: string }; Returns: undefined }
      claim_seller_referral: { Args: { p_code: string }; Returns: boolean }
      admin_save_ambassador: {
        Args: {
          p_id: string | null
          p_full_name: string
          p_phone?: string | null
          p_email?: string | null
          p_bank_name?: string | null
          p_account_number?: string | null
          p_account_name?: string | null
          p_notes?: string | null
          p_is_active?: boolean
          p_code?: string | null
        }
        Returns: Database["public"]["Tables"]["ambassadors"]["Row"]
      }
      admin_ambassador_overview: {
        Args: Record<PropertyKey, never>
        Returns: {
          id: string
          code: string
          full_name: string
          phone: string | null
          email: string | null
          bank_name: string | null
          account_number: string | null
          account_name: string | null
          notes: string | null
          is_active: boolean
          link_visits: number
          created_at: string
          sign_ups: number
          approved: number
          selling: number
          owed: number
          paid: number
        }[]
      }
      admin_ambassador_referrals: {
        Args: { p_ambassador_id: string }
        Returns: {
          seller_id: string
          shop_name: string | null
          seller_name: string | null
          seller_phone: string | null
          status: string
          source: string
          reward_amount: number | null
          created_at: string
          approved_at: string | null
          earned_at: string | null
          paid_at: string | null
          payment_note: string | null
        }[]
      }
      admin_mark_referral_paid: {
        Args: { p_seller_id: string; p_note?: string | null }
        Returns: Database["public"]["Tables"]["seller_referrals"]["Row"]
      }
      admin_assign_seller_referral: { Args: { p_seller_id: string; p_code: string }; Returns: boolean }
      reply_to_review: { Args: { p_review_id: string; p_reply: string }; Returns: undefined }
      admin_vendor_overview: { Args: { p_vendor_id: string }; Returns: Json }
      admin_customer_overview: { Args: { p_user_id: string }; Returns: Json }
      admin_list_conversations: {
        Args: { p_vendor_id?: string; p_customer_id?: string }
        Returns: {
          id: string
          kind: string
          customer_id: string
          customer_name: string
          customer_avatar: string | null
          vendor_id: string
          vendor_name: string
          vendor_avatar: string | null
          product_name: string | null
          last_message_at: string | null
          last_message_preview: string | null
          last_sender_id: string | null
          message_count: number
          created_at: string
        }[]
      }
      vendor_analytics: { Args: { p_days?: number }; Returns: Json }
      story_rings: {
        Args: { p_limit?: number }
        Returns: {
          vendor_id: string
          store_name: string
          store_slug: string | null
          avatar_url: string | null
          verification_tier: string | null
          latest_at: string
          story_count: number
          all_seen: boolean
        }[]
      }
      vendor_live_stories: {
        Args: { p_vendor_id: string }
        Returns: {
          id: string
          image_url: string
          caption: string | null
          created_at: string
          expires_at: string
          like_count: number
          liked_by_me: boolean
          seen_by_me: boolean
        }[]
      }
      my_stories: {
        Args: Record<PropertyKey, never>
        Returns: {
          id: string
          image_url: string
          caption: string | null
          created_at: string
          expires_at: string
          removed_at: string | null
          view_count: number
          like_count: number
        }[]
      }
      create_story: {
        Args: { p_image_url: string; p_caption?: string }
        Returns: { id: string; vendor_id: string; image_url: string; caption: string | null; created_at: string; expires_at: string; removed_at: string | null }
      }
      remove_story: { Args: { p_story_id: string }; Returns: undefined }
      mark_story_viewed: { Args: { p_story_id: string }; Returns: undefined }
      set_story_like: { Args: { p_story_id: string; p_liked: boolean }; Returns: number }
      set_message_reaction: { Args: { p_message_id: string; p_emoji?: string }; Returns: undefined }
      start_call_with: { Args: { p_conversation_id: string; p_kind?: string }; Returns: Database["public"]["Tables"]["calls"]["Row"] }
      list_my_calls: {
        Args: { p_limit?: number }
        Returns: {
          id: string
          conversation_id: string
          kind: string
          status: string
          outgoing: boolean
          other_party_name: string
          other_party_avatar: string | null
          created_at: string
          duration_seconds: number | null
        }[]
      }
      touch_last_seen: { Args: Record<PropertyKey, never>; Returns: undefined }
      conversation_presence: { Args: { p_conversation_id: string }; Returns: string | null }
      start_call: { Args: { p_conversation_id: string }; Returns: Database["public"]["Tables"]["calls"]["Row"] }
      answer_call: { Args: { p_call_id: string }; Returns: Database["public"]["Tables"]["calls"]["Row"] }
      end_call: { Args: { p_call_id: string; p_reason?: string }; Returns: Database["public"]["Tables"]["calls"]["Row"] }
      admin_set_verification_tier: {
        Args: { p_tier: string; p_vendor_id: string }
        Returns: string
      }
      featured_shop_strip: {
        Args: { p_limit?: number }
        Returns: {
          id: string
          store_name: string
          store_slug: string
          avatar_url: string
          verification_tier: string
        }[]
      }
      submit_gold_verification: {
        Args: {
          p_business_address: string
          p_business_name: string
          p_contact_phone: string
          p_id_document_path?: string
          p_id_number: string
          p_id_type: string
          p_notes?: string
        }
        Returns: Json
      }
      save_push_subscription: {
        Args: { p_auth: string; p_endpoint: string; p_p256dh: string; p_user_agent?: string }
        Returns: undefined
      }
      admin_broadcast_notification: {
        Args: { p_action_url?: string; p_audience?: string; p_message: string; p_title: string; p_title_ha?: string; p_message_ha?: string }
        Returns: number
      }
      admin_review_vendor_application: {
        Args: { p_approve: boolean; p_note?: string; p_user_id: string }
        Returns: Database["public"]["Tables"]["vendor_applications"]["Row"]
      }
      submit_vendor_application: {
        Args: {
          p_city: string
          p_description: string
          p_full_name?: string
          p_phone: string
          p_shop_name: string
          p_state: string
        }
        Returns: Database["public"]["Tables"]["vendor_applications"]["Row"]
      }
      admin_review_verification: {
        Args: { p_approve: boolean; p_note?: string; p_request_id: string }
        Returns: Database["public"]["Tables"]["vendor_verification_requests"]["Row"]
      }
      featured_shops: {
        Args: { p_limit?: number }
        Returns: {
          avatar_url: string
          id: string
          is_verified: boolean
          store_name: string
          store_slug: string
        }[]
      }
      request_featured_placement: {
        Args: { p_kind: string; p_product_id?: string; p_weeks: number }
        Returns: Database["public"]["Tables"]["featured_placements"]["Row"]
      }
      submit_verification: {
        Args: {
          p_business_address: string
          p_business_name: string
          p_contact_phone: string
          p_id_document_path?: string
          p_id_number: string
          p_id_type: string
          p_notes?: string
        }
        Returns: Json
      }
      vendor_is_verified: {
        Args: { p_vendor_id: string }
        Returns: boolean
      }
      can_access_conversation: {
        Args: { p_conversation_id: string }
        Returns: boolean
      }
      become_vendor: {
        Args: { p_store_name: string; p_store_description?: string | null; p_phone?: string | null }
        Returns: undefined
      }
      admin_create_order: {
        Args: { p_customer_id: string; p_items: Json; p_delivery_fee: number; p_shipping_address: Json; p_notes?: string | null; p_conversation_id?: string | null }
        Returns: Database["public"]["Tables"]["orders"]["Row"]
      }
      admin_mark_delivered: {
        Args: { p_order_id: string }
        Returns: undefined
      }
      admin_set_delivery: {
        Args: { p_order_id: string; p_delivery_company: string; p_pickup_code: string; p_tracking_reference?: string | null }
        Returns: undefined
      }
      list_inbox: {
        Args: { p_conversation_id?: string | null }
        Returns: {
          id: string
          kind: string
          role: string
          other_party_id: string | null
          other_party_name: string
          other_party_avatar: string | null
          other_party_is_vendor: boolean
          shop_slug: string | null
          product_id: string | null
          product_name: string | null
          product_slug: string | null
          last_message_at: string | null
          last_message_preview: string | null
          unread: boolean
        }[]
      }
      start_support_conversation: {
        Args: { p_product_id?: string | null }
        Returns: string
      }
      get_shop: {
        Args: { p_slug?: string | null; p_vendor_id?: string | null }
        Returns: {
          id: string
          store_name: string
          store_slug: string
          store_description: string | null
          avatar_url: string | null
          store_banner_url: string | null
          is_verified: boolean
          city: string | null
          state: string | null
          joined_at: string
          product_count: number
          follower_count: number
          items_sold: number
          rating: number | null
          review_count: number
          verification_tier: string | null
        }[]
      }
      get_shop_reviews: {
        Args: { p_vendor_id: string; p_limit?: number }
        Returns: {
          id: string
          rating: number
          review_text: string | null
          seller_reply: string | null
          created_at: string
          product_name: string
          product_slug: string
          reviewer_name: string
        }[]
      }
      list_my_conversations: {
        Args: { p_conversation_id?: string | null }
        Returns: {
          id: string
          role: string
          other_party_id: string
          other_party_name: string
          other_party_avatar: string | null
          shop_slug: string | null
          product_id: string | null
          product_name: string | null
          product_slug: string | null
          last_message_at: string | null
          last_message_preview: string | null
          unread: boolean
        }[]
      }
      browse_shops: {
        Args: { p_search?: string | null; p_badge?: string; p_type?: string; p_limit?: number; p_offset?: number }
        Returns: {
          id: string
          store_name: string
          store_slug: string
          store_description: string | null
          avatar_url: string | null
          store_banner_url: string | null
          is_verified: boolean
          city: string | null
          state: string | null
          joined_at: string
          product_count: number
          follower_count: number
          items_sold: number
          rating: number | null
          review_count: number
          verification_tier: string | null
          shop_type: string
        }[]
      }
      shop_filter_counts: { Args: { p_search?: string | null; p_badge?: string; p_type?: string }; Returns: Json }
      set_my_shop_type: { Args: { p_type: string }; Returns: string }
      my_shop_type: { Args: Record<PropertyKey, never>; Returns: string | null }
      shop_directory: {
        Args: {
          p_search?: string | null
          p_badge?: string
          p_type?: string
          p_town?: string | null
          p_sort?: string
          p_lat?: number | null
          p_lng?: number | null
          p_limit?: number
          p_offset?: number
        }
        Returns: {
          id: string
          store_name: string
          store_slug: string
          store_description: string | null
          avatar_url: string | null
          store_banner_url: string | null
          is_verified: boolean
          verification_tier: string | null
          city: string | null
          state: string | null
          joined_at: string
          product_count: number
          follower_count: number
          items_sold: number
          rating: number | null
          review_count: number
          shop_type: string
          location_precise: boolean
          distance_km: number | null
        }[]
      }
      shop_directory_counts: { Args: { p_search?: string | null; p_badge?: string; p_type?: string; p_town?: string | null }; Returns: Json }
      shop_towns: { Args: Record<PropertyKey, never>; Returns: { town: string; shops: number }[] }
      admin_set_shop_type: { Args: { p_vendor_id: string; p_type: string }; Returns: string }
      admin_shop_type: { Args: { p_vendor_id: string }; Returns: string | null }
      admin_link_ambassador_account: { Args: { p_ambassador_id: string; p_email_or_phone: string }; Returns: Json }
      admin_ambassador_accounts: {
        Args: Record<PropertyKey, never>
        Returns: { ambassador_id: string; user_id: string; account_email: string | null; account_name: string | null }[]
      }
      my_ambassador_id: { Args: Record<PropertyKey, never>; Returns: string | null }
      my_ambassador_dashboard: { Args: Record<PropertyKey, never>; Returns: Json }
      my_shop_setup: { Args: Record<PropertyKey, never>; Returns: Json }
      vendor_setup_status: { Args: { p_vendor_id: string }; Returns: Json }
      list_shops: {
        Args: { p_search?: string | null; p_limit?: number; p_offset?: number }
        Returns: {
          id: string
          store_name: string
          store_slug: string
          store_description: string | null
          avatar_url: string | null
          store_banner_url: string | null
          is_verified: boolean
          city: string | null
          state: string | null
          joined_at: string
          product_count: number
          follower_count: number
          items_sold: number
          rating: number | null
          review_count: number
          verification_tier: string | null
        }[]
      }
      mark_conversation_read: {
        Args: { p_conversation_id: string }
        Returns: undefined
      }
      start_conversation: {
        Args: { p_vendor_id: string; p_product_id?: string | null }
        Returns: string
      }
      admin_resolve_dispute: {
        Args: { p_order_id: string; p_outcome: string }
        Returns: undefined
      }
      admin_retry_payout: {
        Args: { p_payout_id: string }
        Returns: undefined
      }
      confirm_order_delivery: {
        Args: { p_order_id: string }
        Returns: undefined
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_order_customer: {
        Args: { _order_id: string; _user_id: string }
        Returns: boolean
      }
      is_order_vendor: {
        Args: { _order_id: string; _vendor_id: string }
        Returns: boolean
      }
      open_order_dispute: {
        Args: { p_order_id: string; p_reason: string }
        Returns: undefined
      }
      place_order: {
        Args: { p_address_id: string; p_notes?: string | null; p_promo_code?: string | null }
        Returns: Database["public"]["Tables"]["orders"]["Row"]
      }
    }
    Enums: {
      app_role: "customer" | "vendor" | "admin"
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
      app_role: ["customer", "vendor", "admin"],
    },
  },
} as const
