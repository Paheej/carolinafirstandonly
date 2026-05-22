export const SITE_NAME = 'Carolina First and Only';
export const SITE_TAGLINE = 'A Charlotte-area tabletop gaming community';

export const GAME_SYSTEMS = [
    { id: '40k', label: 'Warhammer 40,000' },
    { id: 'aos', label: 'Age of Sigmar' },
    { id: 'horus_heresy', label: 'Horus Heresy' },
    { id: 'old_world', label: 'The Old World' },
    { id: 'kill_team', label: 'Kill Team' },
    { id: 'necromunda', label: 'Necromunda' },
    { id: 'dnd5e', label: 'D&D 5e' },
    { id: 'pf2e', label: 'Pathfinder 2e' },
    { id: 'one_page_rules', label: 'One Page Rules' },
    { id: 'other', label: 'Other' },
] as const;

export type GameSystemId = (typeof GAME_SYSTEMS)[number]['id'];

export const NEWS_CATEGORIES = [
    { id: 'official_news', label: 'Official News' },
    { id: 'tactics', label: 'Tactics' },
    { id: 'painting', label: 'Painting' },
    { id: 'lore', label: 'Lore' },
    { id: 'community', label: 'Community' },
    { id: 'industry', label: 'Industry' },
    { id: 'battle_report', label: 'Battle Report' },
] as const;

export type NewsCategoryId = (typeof NEWS_CATEGORIES)[number]['id'];

export function adminEmails(): string[] {
    const raw = process.env.NEXT_PUBLIC_ADMIN_EMAILS ?? '';
    return raw
        .split(',')
        .map((e) => e.trim().toLowerCase())
        .filter(Boolean);
}

export function isAdminEmail(email: string | null | undefined): boolean {
    if (!email) return false;
    return adminEmails().includes(email.toLowerCase());
}
