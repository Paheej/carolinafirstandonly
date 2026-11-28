/** Crest props for a group from its systems: first system's icon, red rim for the 40K family. */
const FORTY_K_FAMILY = new Set(['Warhammer 40k', 'Net Epic Armageddon', 'Battlefleet Gothic']);

export function crestFor(systems: string[] | null | undefined, iconMap: Record<string, string>) {
    const main = systems?.[0] ?? null;
    return { icon: main ? (iconMap[main] ?? null) : null, accent: main && FORTY_K_FAMILY.has(main) ? ('red' as const) : ('gold' as const) };
}
