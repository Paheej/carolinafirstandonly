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
                    game_system: string | null;
                    game_edition: string | null;
                    status: 'active' | 'completed';
                    external_url: string | null;
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
                    game_system?: string | null;
                    game_edition?: string | null;
                    status?: 'active' | 'completed';
                    external_url?: string | null;
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
                    game_system: string | null;
                    game_edition: string | null;
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
                    game_system?: string | null;
                    game_edition?: string | null;
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
            game_systems: {
                Row: {
                    id: string;
                    slug: string;
                    name: string;
                    icon: string;
                    display_order: number;
                    created_at: string;
                };
                Insert: {
                    slug: string;
                    name: string;
                    icon: string;
                    display_order?: number;
                };
                Update: Partial<Database['public']['Tables']['game_systems']['Insert']>;
                Relationships: [];
            };
            game_editions: {
                Row: {
                    id: string;
                    system_id: string;
                    slug: string;
                    name: string;
                    display_order: number;
                    created_at: string;
                };
                Insert: {
                    system_id: string;
                    slug: string;
                    name: string;
                    display_order?: number;
                };
                Update: Partial<Database['public']['Tables']['game_editions']['Insert']>;
                Relationships: [];
            };
            archive_pages: {
                Row: {
                    id: string;
                    slug: string;
                    title: string;
                    body_md: string;
                    category: string | null;
                    season_id: string | null;
                    display_order: number;
                    created_at: string;
                    updated_at: string;
                };
                Insert: {
                    slug: string;
                    title: string;
                    body_md: string;
                    category?: string | null;
                    season_id?: string | null;
                    display_order?: number;
                };
                Update: Partial<Database['public']['Tables']['archive_pages']['Insert']>;
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
            groups: {
                Row: {
                    id: string;
                    slug: string;
                    name: string;
                    description_md: string | null;
                    systems: string[];
                    visibility: 'public' | 'private';
                    join_policy: 'open' | 'request' | 'invite';
                    banner_url: string | null;
                    accent_color: string | null;
                    created_by: string | null;
                    created_at: string;
                    updated_at: string;
                };
                Insert: {
                    slug: string;
                    name: string;
                    description_md?: string | null;
                    systems?: string[];
                    visibility?: 'public' | 'private';
                    join_policy?: 'open' | 'request' | 'invite';
                    banner_url?: string | null;
                    accent_color?: string | null;
                    created_by?: string | null;
                };
                Update: Partial<Database['public']['Tables']['groups']['Insert']>;
                Relationships: [];
            };
            group_members: {
                Row: {
                    group_id: string;
                    user_id: string;
                    role: 'owner' | 'admin' | 'member';
                    joined_at: string;
                };
                Insert: {
                    group_id: string;
                    user_id: string;
                    role?: 'owner' | 'admin' | 'member';
                };
                Update: Partial<Database['public']['Tables']['group_members']['Insert']>;
                Relationships: [
                    {
                        foreignKeyName: 'group_members_user_id_fkey';
                        columns: ['user_id'];
                        isOneToOne: false;
                        referencedRelation: 'profiles';
                        referencedColumns: ['id'];
                    },
                    {
                        foreignKeyName: 'group_members_group_id_fkey';
                        columns: ['group_id'];
                        isOneToOne: false;
                        referencedRelation: 'groups';
                        referencedColumns: ['id'];
                    },
                ];
            };
            group_join_requests: {
                Row: {
                    id: string;
                    group_id: string;
                    user_id: string;
                    message: string | null;
                    status: 'pending' | 'approved' | 'declined' | 'cancelled';
                    decided_by: string | null;
                    decided_at: string | null;
                    created_at: string;
                };
                Insert: {
                    group_id: string;
                    user_id: string;
                    message?: string | null;
                };
                Update: Partial<Database['public']['Tables']['group_join_requests']['Insert']>;
                Relationships: [
                    {
                        foreignKeyName: 'group_join_requests_user_id_fkey';
                        columns: ['user_id'];
                        isOneToOne: false;
                        referencedRelation: 'profiles';
                        referencedColumns: ['id'];
                    },
                ];
            };
            group_invites: {
                Row: {
                    id: string;
                    group_id: string;
                    kind: 'direct' | 'link';
                    invited_user_id: string | null;
                    token: string | null;
                    status: 'pending' | 'accepted' | 'declined' | 'revoked';
                    uses: number;
                    max_uses: number | null;
                    expires_at: string | null;
                    created_by: string | null;
                    created_at: string;
                };
                Insert: {
                    group_id: string;
                    kind: 'direct' | 'link';
                    invited_user_id?: string | null;
                    token?: string | null;
                };
                Update: Partial<Database['public']['Tables']['group_invites']['Insert']>;
                Relationships: [
                    {
                        foreignKeyName: 'group_invites_invited_user_id_fkey';
                        columns: ['invited_user_id'];
                        isOneToOne: false;
                        referencedRelation: 'profiles';
                        referencedColumns: ['id'];
                    },
                ];
            };
            group_pinned_posts: {
                Row: {
                    id: string;
                    group_id: string;
                    author_id: string | null;
                    title: string;
                    body_md: string;
                    position: number;
                    created_at: string;
                    updated_at: string;
                };
                Insert: {
                    group_id: string;
                    author_id?: string | null;
                    title: string;
                    body_md: string;
                    position?: number;
                };
                Update: Partial<Database['public']['Tables']['group_pinned_posts']['Insert']>;
                Relationships: [];
            };
            group_role_templates: {
                Row: {
                    id: string;
                    group_id: string;
                    role_name: string;
                    default_max: number | null;
                    position: number;
                };
                Insert: {
                    group_id: string;
                    role_name: string;
                    default_max?: number | null;
                    position?: number;
                };
                Update: Partial<Database['public']['Tables']['group_role_templates']['Insert']>;
                Relationships: [];
            };
            events: {
                Row: {
                    id: string;
                    slug: string;
                    title: string;
                    description_md: string | null;
                    group_id: string | null;
                    starts_at: string;
                    ends_at: string;
                    location: string | null;
                    visibility: 'public' | 'group' | 'hidden';
                    capacity: number | null;
                    created_by: string | null;
                    cancelled_at: string | null;
                    ics_sequence: number;
                    created_at: string;
                    updated_at: string;
                };
                Insert: {
                    slug: string;
                    title: string;
                    description_md?: string | null;
                    group_id?: string | null;
                    starts_at: string;
                    ends_at: string;
                    location?: string | null;
                    visibility?: 'public' | 'group' | 'hidden';
                    capacity?: number | null;
                    created_by?: string | null;
                };
                Update: Partial<Database['public']['Tables']['events']['Insert']>;
                Relationships: [];
            };
            event_roles: {
                Row: {
                    id: string;
                    event_id: string;
                    role_name: string;
                    max_count: number | null;
                    position: number;
                };
                Insert: {
                    id?: string;
                    event_id: string;
                    role_name: string;
                    max_count?: number | null;
                    position?: number;
                };
                Update: Partial<Database['public']['Tables']['event_roles']['Insert']>;
                Relationships: [];
            };
            event_rsvps: {
                Row: {
                    event_id: string;
                    user_id: string;
                    status: 'yes' | 'no' | 'maybe' | 'waitlist';
                    role_id: string | null;
                    waitlist_position: number | null;
                    note: string | null;
                    rsvped_at: string;
                    updated_at: string;
                };
                Insert: {
                    event_id: string;
                    user_id: string;
                    status: 'yes' | 'no' | 'maybe' | 'waitlist';
                };
                Update: Partial<Database['public']['Tables']['event_rsvps']['Insert']>;
                Relationships: [];
            };
            event_invites: {
                Row: {
                    event_id: string;
                    user_id: string;
                    invited_by: string | null;
                    created_at: string;
                };
                Insert: { event_id: string; user_id: string };
                Update: Partial<Database['public']['Tables']['event_invites']['Insert']>;
                Relationships: [];
            };
            user_calendar_feeds: {
                Row: { user_id: string; token: string; created_at: string };
                Insert: { user_id: string; token: string };
                Update: Partial<Database['public']['Tables']['user_calendar_feeds']['Insert']>;
                Relationships: [];
            };
            calendar_connections: {
                Row: {
                    id: string;
                    user_id: string;
                    provider: 'ics' | 'google' | 'outlook';
                    label: string;
                    source_host: string | null;
                    encrypted_secret: string;
                    enabled: boolean;
                    last_synced_at: string | null;
                    last_error: string | null;
                    block_count: number;
                    created_at: string;
                };
                Insert: {
                    user_id: string;
                    provider?: 'ics' | 'google' | 'outlook';
                    label: string;
                    source_host?: string | null;
                    encrypted_secret: string;
                    enabled?: boolean;
                    last_synced_at?: string | null;
                    last_error?: string | null;
                    block_count?: number;
                };
                Update: Partial<Database['public']['Tables']['calendar_connections']['Insert']>;
                Relationships: [];
            };
            user_busy_blocks: {
                Row: { id: string; user_id: string; connection_id: string; starts_at: string; ends_at: string };
                Insert: { user_id: string; connection_id: string; starts_at: string; ends_at: string };
                Update: Partial<Database['public']['Tables']['user_busy_blocks']['Insert']>;
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
            join_group: { Args: { p_group: string; p_message?: string | null }; Returns: string };
            cancel_join_request: { Args: { p_group: string }; Returns: undefined };
            decide_join_request: { Args: { p_request: string; p_approve: boolean }; Returns: undefined };
            invite_member: { Args: { p_group: string; p_username: string }; Returns: undefined };
            decline_invite: { Args: { p_group: string }; Returns: undefined };
            create_invite_link: { Args: { p_group: string; p_days?: number | null; p_max_uses?: number | null }; Returns: string };
            revoke_invite: { Args: { p_invite: string }; Returns: undefined };
            invite_link_preview: { Args: { p_token: string }; Returns: { group_name: string; group_slug: string; is_valid: boolean }[] };
            redeem_invite_link: { Args: { p_token: string }; Returns: string };
            leave_group: { Args: { p_group: string }; Returns: undefined };
            set_member_role: { Args: { p_group: string; p_user: string; p_role: string }; Returns: undefined };
            remove_member: { Args: { p_group: string; p_user: string }; Returns: undefined };
            rsvp: { Args: { p_event: string; p_status: string; p_role?: string | null; p_note?: string | null }; Returns: string };
            invite_to_event: { Args: { p_event: string; p_username: string }; Returns: undefined };
            uninvite_from_event: { Args: { p_event: string; p_user: string }; Returns: undefined };
            can_manage_event: { Args: { eid: string; uid: string }; Returns: boolean };
            cancel_event: { Args: { p_event: string }; Returns: undefined };
            restore_event: { Args: { p_event: string }; Returns: undefined };
            rotate_calendar_feed: { Args: Record<string, never>; Returns: string };
            delete_calendar_feed: { Args: Record<string, never>; Returns: undefined };
            calendar_feed_events: {
                Args: { p_token: string };
                Returns: {
                    id: string;
                    slug: string;
                    title: string;
                    description_md: string | null;
                    location: string | null;
                    starts_at: string;
                    ends_at: string;
                    cancelled_at: string | null;
                    ics_sequence: number;
                    updated_at: string;
                    my_status: string | null;
                }[];
            };
            replace_busy_blocks: { Args: { p_connection: string; p_blocks: Json }; Returns: number };
            group_availability: {
                Args: { p_group: string; p_start: string; p_end: string; p_days?: number };
                Returns: { day_index: number; starts_at: string; ends_at: string; members: number; connected: number; free: number }[];
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
export type ArchivePage = Database['public']['Tables']['archive_pages']['Row'];
export type GameSystem = Database['public']['Tables']['game_systems']['Row'];
export type GameEdition = Database['public']['Tables']['game_editions']['Row'];
export type Group = Database['public']['Tables']['groups']['Row'];
export type GroupMember = Database['public']['Tables']['group_members']['Row'];
export type GroupJoinRequest = Database['public']['Tables']['group_join_requests']['Row'];
export type GroupInvite = Database['public']['Tables']['group_invites']['Row'];
export type GroupPinnedPost = Database['public']['Tables']['group_pinned_posts']['Row'];
export type GroupRole = GroupMember['role'];
export type GameDay = Database['public']['Tables']['events']['Row'];
export type EventRole = Database['public']['Tables']['event_roles']['Row'];
export type EventRsvp = Database['public']['Tables']['event_rsvps']['Row'];
export type GroupRoleTemplate = Database['public']['Tables']['group_role_templates']['Row'];
export type CalendarConnection = Database['public']['Tables']['calendar_connections']['Row'];
