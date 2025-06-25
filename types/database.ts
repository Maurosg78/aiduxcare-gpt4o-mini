export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      clinical_documents: {
        Row: {
          id: string
          content: string
          embedding: number[]
          metadata: Json
          document_type: string
          patient_id: string | null
          session_id: string | null
          created_at: string
          updated_at: string | null
        }
        Insert: {
          id?: string
          content: string
          embedding: number[]
          metadata?: Json
          document_type?: string
          patient_id?: string | null
          session_id?: string | null
          created_at?: string
          updated_at?: string | null
        }
        Update: {
          id?: string
          content?: string
          embedding?: number[]
          metadata?: Json
          document_type?: string
          patient_id?: string | null
          session_id?: string | null
          created_at?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "clinical_documents_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clinical_documents_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          }
        ]
      }
      patients: {
        Row: {
          id: string
          name: string
          email: string | null
          phone: string | null
          date_of_birth: string | null
          gender: string | null
          address: Json | null
          medical_history: Json | null
          created_at: string
          updated_at: string | null
        }
        Insert: {
          id?: string
          name: string
          email?: string | null
          phone?: string | null
          date_of_birth?: string | null
          gender?: string | null
          address?: Json | null
          medical_history?: Json | null
          created_at?: string
          updated_at?: string | null
        }
        Update: {
          id?: string
          name?: string
          email?: string | null
          phone?: string | null
          date_of_birth?: string | null
          gender?: string | null
          address?: Json | null
          medical_history?: Json | null
          created_at?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      sessions: {
        Row: {
          id: string
          patient_id: string
          therapist_id: string
          session_date: string
          session_type: string
          notes: string | null
          status: string
          created_at: string
          updated_at: string | null
        }
        Insert: {
          id?: string
          patient_id: string
          therapist_id: string
          session_date: string
          session_type: string
          notes?: string | null
          status?: string
          created_at?: string
          updated_at?: string | null
        }
        Update: {
          id?: string
          patient_id?: string
          therapist_id?: string
          session_date?: string
          session_type?: string
          notes?: string | null
          status?: string
          created_at?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sessions_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sessions_therapist_id_fkey"
            columns: ["therapist_id"]
            isOneToOne: false
            referencedRelation: "therapists"
            referencedColumns: ["id"]
          }
        ]
      }
      therapists: {
        Row: {
          id: string
          name: string
          email: string
          specialization: string | null
          license_number: string | null
          created_at: string
          updated_at: string | null
        }
        Insert: {
          id?: string
          name: string
          email: string
          specialization?: string | null
          license_number?: string | null
          created_at?: string
          updated_at?: string | null
        }
        Update: {
          id?: string
          name?: string
          email?: string
          specialization?: string | null
          license_number?: string | null
          created_at?: string
          updated_at?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      match_documents: {
        Args: {
          query_embedding: number[]
          match_threshold: number
          match_count: number
          filter?: Json
        }
        Returns: {
          id: string
          content: string
          metadata: Json
          similarity: number
        }[]
      }
      match_documents_by_patient: {
        Args: {
          query_embedding: number[]
          match_threshold: number
          match_count: number
          patient_id: string
        }
        Returns: {
          id: string
          content: string
          metadata: Json
          similarity: number
        }[]
      }
      match_documents_by_type: {
        Args: {
          query_embedding: number[]
          match_threshold: number
          match_count: number
          document_type: string
        }
        Returns: {
          id: string
          content: string
          metadata: Json
          similarity: number
        }[]
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
} 