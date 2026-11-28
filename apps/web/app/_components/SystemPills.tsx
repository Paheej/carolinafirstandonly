import { SystemPill } from '@cfo/ui';
import type { GameRef } from '@cfo/database/types';

/** One pill per game a season or event used. */
export function SystemPills({ games, iconMap, className }: { games: GameRef[]; iconMap: Record<string, string>; className?: string }) {
    if (games.length === 0) return null;
    return (
        <span className={`inline-flex flex-wrap gap-1.5 ${className ?? ''}`}>
            {games.map((g, i) => (
                <SystemPill key={`${g.system}-${g.edition ?? ''}-${i}`} system={g.system} edition={g.edition} icon={iconMap[g.system] ?? null} />
            ))}
        </span>
    );
}
