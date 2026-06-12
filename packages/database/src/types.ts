// Hand-written Database type.
// Regenerate the full type with `pnpm db:types` after each migration; that
// produces `types.generated.ts`. Until then, this file is the canonical
// import path and stays in sync with the migrations manually.
//
// Note: each table needs `Relationships: []` (even when empty). Without it,
// postgrest-js v2.106+ treats the table as not-matching its `GenericTable`
// constraint and silently degrades query types to `never`.

export type Json =
    | string
    | number
    | boolean
    | null
    | { [key: string]: Json | undefined }
    | Json[];

export interface RecapPhoto {
    url: string;
    thumbnail_url?: string;
    caption?: string;
    file_id?: string;
    width?: number;
    height?: number;
}

export interface Database {
    public: {
        Tables: {
            profiles: {
                Row: {
                    id: string;
                    username: string;
                    display_name: string | null;
                    avatar_url: string | null;
                    bio: string | null;
                    preferred_systems: string[];
                    is_admin: boolean;
                    banned_until: string | null;
                    created_at: string;
                    updated_at: string;
                };
                Insert: {
                    id: string;
                    username: string;
                    display_name?: string | null;
                    avatar_url?: string | null;
                    bio?: string | null;
                    preferred_systems?: string[];
                    is_admin?: boolean;
                    banned_until?: string | null;
                };
                Update: Partial<Database['public']['Tables']['profiles']['Insert']>;
                Relationships: [];
            };
            notifications: {
                Row: {
                    id: string;
                    user_id: string;
                    kind: string;
                    title: string;
                    body: string | null;
                    link_url: string | null;
                    read_at: string | null;
                    created_at: string;
                };
                Insert: {
                    user_id: string;
                    kind: string;
                    title: string;
                    body?: string | null;
                    link_url?: string | null;
                };
                Update: Partial<Database['public']['Tables']['notifications']['Insert']> & {
                    read_at?: string | null;
                };
                Relationships: [];
            };
            audit_log: {
                Row: {
                    id: string;
                    actor_id: string | null;
                    action: string;
                    target_table: string | null;
                    target_id: string | null;
                    metadata: Json;
                    created_at: string;
                };
                Insert: {
                    actor_id?: string | null;
                    action: string;
                    target_table?: string | null;
                    target_id?: string | null;
                    metadata?: Json;
                };
                Update: Partial<Database['public']['Tables']['audit_log']['Insert']>;
                Relationships: [];
            };
            seasons: {
                Row: {
                    id: string;
                    slug: string;
                    name: string;
                    year: number | null;
                    description_md: string | null;
                    hero_image_url: string | null;
                    starts_on: string | null;
                    ends_on: string | null;
                    display_order: number;
                    created_at: string;
                    updated_at: string;
                };
                Insert: {
                    slug: string;
                    name: string;
                    year?: number | null;
                    description_md?: string | null;
                    hero_image_url?: string | null;
                    starts_on?: string | null;
                    ends_on?: string | null;
                    display_order?: number;
                };
                Update: Partial<Database['public']['Tables']['seasons']['Insert']>;
                Relationships: [];
            };
            archive_events: {
                Row: {
                    id: string;
                    slug: string;
                    name: string;
                    event_date: string | null;
                    description_md: string | null;
                    hero_image_url: string | null;
                    season_id: string | null;
                    display_order: number;
                    created_at: string;
                    updated_at: string;
                };
                Insert: {
                    slug: string;
                    name: string;
                    event_date?: string | null;
                    description_md?: string | null;
                    hero_image_url?: string | null;
                    season_id?: string | null;
                    display_order?: number;
                };
                Update: Partial<Database['public']['Tables']['archive_events']['Insert']>;
                Relationships: [];
            };
            recaps: {
                Row: {
                    id: string;
                    slug: string;
                    season_id: string | null;
                    archive_event_id: string | null;
                    title: string;
                    body_md: string;
                    photos: RecapPhoto[];
                    author_id: string | null;
                    published_at: string | null;
                    created_at: string;
                    updated_at: string;
                };
                Insert: {
                    slug: string;
                    season_id?: string | null;
                    archive_event_id?: string | null;
                    title: string;
                    body_md: string;
                    photos?: RecapPhoto[];
                    author_id?: string | null;
                    published_at?: string | null;
                };
                Update: Partial<Database['public']['Tables']['recaps']['Insert']>;
                Relationships: [];
            };
            recap_submissions: {
                Row: {
                    id: string;
                    season_id: string | null;
                    archive_event_id: string | null;
                    title: string;
                    body_md: string;
                    photos: RecapPhoto[];
                    author_id: string;
                    status: 'pending' | 'approved' | 'rejected';
                    reviewed_by: string | null;
                    review_notes: string | null;
                    published_recap_id: string | null;
                    submitted_at: string;
                    reviewed_at: string | null;
                };
                Insert: {
                    season_id?: string | null;
                    archive_event_id?: string | null;
                    title: string;
                    body_md: string;
                    photos?: RecapPhoto[];
                    author_id: string;
                    status?: 'pending' | 'approved' | 'rejected';
                    reviewed_by?: string | null;
                    review_notes?: string | null;
                };
                Update: Partial<Database['public']['Tables']['recap_submissions']['Insert']> & {
                    status?: 'pending' | 'approved' | 'rejected';
                    reviewed_by?: string | null;
                    review_notes?: string | null;
                };
                Relationships: [];
            };
        };
        Views: Record<string, never>;
        Functions: {
            is_admin: {
                Args: { uid: string };
                Returns: boolean;
            };
            slugify: {
                Args: { input: string };
                Returns: string;
            };
        };
        Enums: Record<string, never>;
        CompositeTypes: Record<string, never>;
    };
}

export type Profile = Database['public']['Tables']['profiles']['Row'];
export type Notification = Database['public']['Tables']['notifications']['Row'];
export type AuditLogEntry = Database['public']['Tables']['audit_log']['Row'];
export type Season = Database['public']['Tables']['seasons']['Row'];
export type ArchiveEvent = Database['public']['Tables']['archive_events']['Row'];
export type Recap = Database['public']['Tables']['recaps']['Row'];
export type RecapSubmission = Database['public']['Tables']['recap_submissions']['Row'];
