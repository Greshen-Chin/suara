export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  public: {
    Tables: {
      akun: {
        Row: {
          aktif: boolean;
          created_at: string;
          hash_kata_sandi: string;
          id: string;
          nama_pengguna: string;
          peran: string;
          updated_at: string;
          versi_sesi: number;
          warga_id: string | null;
        };
        ComputedFields: never;
        Insert: {
          aktif?: boolean;
          created_at?: string;
          hash_kata_sandi: string;
          id?: string;
          nama_pengguna: string;
          peran: string;
          updated_at?: string;
          versi_sesi?: number;
          warga_id?: string | null;
        };
        Update: {
          aktif?: boolean;
          created_at?: string;
          hash_kata_sandi?: string;
          id?: string;
          nama_pengguna?: string;
          peran?: string;
          updated_at?: string;
          versi_sesi?: number;
          warga_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "akun_warga_id_fkey";
            columns: ["warga_id"];
            isOneToOne: false;
            referencedRelation: "warga";
            referencedColumns: ["id"];
          },
        ];
      };
      percobaan_masuk: {
        Row: {
          gagal: number;
          jendela_mulai: string;
          nama_pengguna: string;
          terkunci_sampai: string | null;
        };
        ComputedFields: never;
        Insert: {
          gagal?: number;
          jendela_mulai?: string;
          nama_pengguna: string;
          terkunci_sampai?: string | null;
        };
        Update: {
          gagal?: number;
          jendela_mulai?: string;
          nama_pengguna?: string;
          terkunci_sampai?: string | null;
        };
        Relationships: [];
      };
      accountability_logs: {
        Row: {
          actor: string;
          created_at: string;
          detail: NonNullable<Json>;
          id: number;
          log_type: string;
          message: string;
          proposal_id: string | null;
        };
        ComputedFields: never;
        Insert: {
          actor?: string;
          created_at?: string;
          detail?: NonNullable<Json>;
          id?: never;
          log_type: string;
          message: string;
          proposal_id?: string | null;
        };
        Update: {
          actor?: string;
          created_at?: string;
          detail?: NonNullable<Json>;
          id?: never;
          log_type?: string;
          message?: string;
          proposal_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "accountability_logs_proposal_id_fkey";
            columns: ["proposal_id"];
            isOneToOne: false;
            referencedRelation: "proposals";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "accountability_logs_proposal_id_fkey";
            columns: ["proposal_id"];
            isOneToOne: false;
            referencedRelation: "v_forum";
            referencedColumns: ["id"];
          },
        ];
      };
      komentar: {
        Row: {
          akun_id: string;
          alasan_disembunyikan: string | null;
          created_at: string;
          disembunyikan_pada: string | null;
          id: string;
          isi: string;
          proposal_id: string;
        };
        ComputedFields: never;
        Insert: {
          akun_id: string;
          alasan_disembunyikan?: string | null;
          created_at?: string;
          disembunyikan_pada?: string | null;
          id?: string;
          isi: string;
          proposal_id: string;
        };
        Update: {
          akun_id?: string;
          alasan_disembunyikan?: string | null;
          created_at?: string;
          disembunyikan_pada?: string | null;
          id?: string;
          isi?: string;
          proposal_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "komentar_akun_id_fkey";
            columns: ["akun_id"];
            isOneToOne: false;
            referencedRelation: "akun";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "komentar_proposal_id_fkey";
            columns: ["proposal_id"];
            isOneToOne: false;
            referencedRelation: "proposals";
            referencedColumns: ["id"];
          },
        ];
      };
      proposals: {
        Row: {
          category: string;
          created_at: string;
          description: string | null;
          embedding: string | null;
          estimated_budget: number;
          feasibility_score: number | null;
          id: string;
          impact_score: number | null;
          location: unknown;
          nama_singkat: string | null;
          proposer_id: string | null;
          rw: number | null;
          source: string;
          status: string;
          title: string;
          updated_at: string;
          urgency_reason: string | null;
          urgency_score: number | null;
          disembunyikan_pada: string | null;
          alasan_disembunyikan: string | null;
        };
        ComputedFields: never;
        Insert: {
          category: string;
          created_at?: string;
          description?: string | null;
          embedding?: string | null;
          estimated_budget: number;
          feasibility_score?: number | null;
          id?: string;
          impact_score?: number | null;
          location?: unknown;
          nama_singkat?: string | null;
          proposer_id?: string | null;
          rw?: number | null;
          source?: string;
          status?: string;
          title: string;
          updated_at?: string;
          urgency_reason?: string | null;
          urgency_score?: number | null;
          disembunyikan_pada?: string | null;
          alasan_disembunyikan?: string | null;
        };
        Update: {
          category?: string;
          created_at?: string;
          description?: string | null;
          embedding?: string | null;
          estimated_budget?: number;
          feasibility_score?: number | null;
          id?: string;
          impact_score?: number | null;
          location?: unknown;
          nama_singkat?: string | null;
          proposer_id?: string | null;
          rw?: number | null;
          source?: string;
          status?: string;
          title?: string;
          updated_at?: string;
          urgency_reason?: string | null;
          urgency_score?: number | null;
          disembunyikan_pada?: string | null;
          alasan_disembunyikan?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "proposals_proposer_id_fkey";
            columns: ["proposer_id"];
            isOneToOne: false;
            referencedRelation: "warga";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "proposals_rw_fkey";
            columns: ["rw"];
            isOneToOne: false;
            referencedRelation: "wilayah";
            referencedColumns: ["rw"];
          },
          {
            foreignKeyName: "proposals_rw_fkey";
            columns: ["rw"];
            isOneToOne: false;
            referencedRelation: "v_wilayah";
            referencedColumns: ["rw"];
          },
        ];
      };
      scoring_weights: {
        Row: {
          catatan: string | null;
          id: number;
          updated_at: string;
          w_pemerataan: number;
          w_popularitas: number;
          w_urgensi: number;
        };
        ComputedFields: never;
        Insert: {
          catatan?: string | null;
          id?: number;
          updated_at?: string;
          w_pemerataan: number;
          w_popularitas: number;
          w_urgensi: number;
        };
        Update: {
          catatan?: string | null;
          id?: number;
          updated_at?: string;
          w_pemerataan?: number;
          w_popularitas?: number;
          w_urgensi?: number;
        };
        Relationships: [];
      };
      votes: {
        Row: {
          created_at: string;
          proposal_id: string;
          warga_id: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          proposal_id: string;
          warga_id: string;
        };
        Update: {
          created_at?: string;
          proposal_id?: string;
          warga_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "votes_proposal_id_fkey";
            columns: ["proposal_id"];
            isOneToOne: false;
            referencedRelation: "proposals";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "votes_proposal_id_fkey";
            columns: ["proposal_id"];
            isOneToOne: false;
            referencedRelation: "v_forum";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "votes_warga_id_fkey";
            columns: ["warga_id"];
            isOneToOne: false;
            referencedRelation: "warga";
            referencedColumns: ["id"];
          },
        ];
      };
      wilayah: {
        Row: {
          anggaran_lalu: number;
          nama: string;
          penduduk: number;
          rw: number;
        };
        ComputedFields: never;
        Insert: {
          anggaran_lalu?: number;
          nama: string;
          penduduk: number;
          rw: number;
        };
        Update: {
          anggaran_lalu?: number;
          nama?: string;
          penduduk?: number;
          rw?: number;
        };
        Relationships: [];
      };
      warga: {
        Row: {
          created_at: string;
          id: string;
          nama: string;
          nomor: number;
          rt: number;
          rw: number;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          id?: string;
          nama: string;
          nomor?: never;
          rt: number;
          rw: number;
        };
        Update: {
          created_at?: string;
          id?: string;
          nama?: string;
          nomor?: never;
          rt?: number;
          rw?: number;
        };
        Relationships: [];
      };
    };
    Views: {
      v_forum: {
        Row: {
          category: string | null;
          created_at: string | null;
          estimated_budget: number | null;
          id: string | null;
          jumlah_komentar: number | null;
          nama_singkat: string | null;
          penduduk: number | null;
          pengusul_nama_depan: string | null;
          pengusul_rw: number | null;
          rw: number | null;
          source: string | null;
          status: string | null;
          suara_per_1000: number | null;
          title: string | null;
          vote_count: number | null;
        };
        ComputedFields: never;
        Relationships: [];
      };
      v_usulan: {
        Row: {
          alasan_disembunyikan: string | null;
          category: string | null;
          created_at: string | null;
          description: string | null;
          disembunyikan_pada: string | null;
          estimated_budget: number | null;
          id: string | null;
          jumlah_komentar: number | null;
          nama_singkat: string | null;
          penduduk: number | null;
          pengusul_nama_depan: string | null;
          pengusul_rw: number | null;
          rw: number | null;
          source: string | null;
          status: string | null;
          suara_per_1000: number | null;
          title: string | null;
          urgency_reason: string | null;
          urgency_score: number | null;
          vote_count: number | null;
        };
        ComputedFields: never;
        Relationships: [];
      };
      v_komentar: {
        Row: {
          alasan_disembunyikan: string | null;
          created_at: string | null;
          dari_admin: boolean | null;
          disembunyikan_pada: string | null;
          id: string | null;
          isi: string | null;
          penulis_nama_depan: string | null;
          penulis_rw: number | null;
          proposal_id: string | null;
        };
        ComputedFields: never;
        Relationships: [];
      };
      v_wilayah: {
        Row: {
          anggaran_lalu: number | null;
          jumlah_suara: number | null;
          jumlah_usulan: number | null;
          nama: string | null;
          penduduk: number | null;
          rw: number | null;
        };
        ComputedFields: never;
        Relationships: [];
      };
    };
    Functions: {
      ajukan_usulan: {
        Args: {
          p_akun: string;
          p_biaya: number;
          p_deskripsi: string;
          p_embedding?: string | null;
          p_judul: string;
          p_kategori: string;
          p_nama_singkat: string | null;
          p_rw: number;
        };
        Returns: Json;
      };
      batal_dukung: {
        Args: { p_akun: string; p_proposal: string };
        Returns: Json;
      };
      cari_usulan_mirip: {
        Args: { p_batas?: number; p_embedding: string };
        Returns: {
          category: string;
          description: string | null;
          id: string;
          kosinus: number;
          rw: number | null;
          status: string;
          title: string;
          vote_count: number;
        }[];
      };
      cari_usulan_mirip_teks: {
        Args: { p_batas?: number; p_deskripsi: string; p_judul: string };
        Returns: {
          category: string;
          description: string | null;
          id: string;
          punya_embedding: boolean;
          rw: number | null;
          sim_isi: number;
          sim_judul: number;
          status: string;
          title: string;
          vote_count: number;
        }[];
      };
      dukung_usulan: {
        Args: { p_akun: string; p_proposal: string };
        Returns: Json;
      };
      sembunyikan: {
        Args: { p_akun: string; p_alasan: string; p_id: string; p_jenis: string };
        Returns: Json;
      };
      tambah_komentar: {
        Args: { p_akun: string; p_isi: string; p_proposal: string };
        Returns: Json;
      };
      catat_gagal_masuk: {
        Args: {
          p_batas?: number;
          p_jendela?: string;
          p_kunci?: string;
          p_nama_pengguna: string;
        };
        Returns: string | null;
      };
      greedy_pilih: {
        Args: {
          p_mode?: string;
          p_pagu: number;
          p_w_pemerataan?: number;
          p_w_popularitas?: number;
          p_w_urgensi?: number;
        };
        Returns: Database["public"]["CompositeTypes"]["hasil_pilih"][];
        SetofOptions: {
          from: "*";
          to: "hasil_pilih";
          isOneToOne: false;
          isSetofReturn: true;
        };
      };
      pilih_optimal: {
        Args: {
          p_pagu: number;
          p_w_pemerataan?: number;
          p_w_popularitas?: number;
          p_w_urgensi?: number;
        };
        Returns: Database["public"]["CompositeTypes"]["hasil_pilih"][];
        SetofOptions: {
          from: "*";
          to: "hasil_pilih";
          isOneToOne: false;
          isSetofReturn: true;
        };
      };
      rekomendasi_resmi: {
        Args: { p_pagu: number };
        Returns: Database["public"]["CompositeTypes"]["hasil_pilih"][];
        SetofOptions: {
          from: "*";
          to: "hasil_pilih";
          isOneToOne: false;
          isSetofReturn: true;
        };
      };
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      hasil_pilih: {
        peringkat: number | null;
        id: string | null;
        title: string | null;
        nama_singkat: string | null;
        category: string | null;
        rw: number | null;
        estimated_budget: number | null;
        vote_count: number | null;
        urgency_score: number | null;
        skor: number | null;
        selected: boolean | null;
        total_berjalan: number | null;
      };
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<
  keyof Database,
  "public"
>];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    keyof DefaultSchema["Enums"] | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  public: {
    Enums: {},
  },
} as const;
