// Hand-written Database type for Phase 0.
// Regenerate the full type with `pnpm db:types` after each migration; that
// produces `types.generated.ts`. Until then, this file keeps the workspace
// typechecking against a minimal shape.

export type Json =
    | string
    | number
    | boolean
    | null
    | { [key: string]: Json | undefined }
    | Json[];

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
            };
        };
        Views: Record<string, never>;
        Functions: {
            is_admin: {
                Args: { uid: string };
                Returns: boolean;
            };
        };
        Enums: Record<string, never>;
        CompositeTypes: Record<string, never>;
    };
}

export type Profile = Database['public']['Tables']['profiles']['Row'];
export type Notification = Database['public']['Tables']['notifications']['Row'];
export type AuditLogEntry = Database['public']['Tables']['audit_log']['Row'];
