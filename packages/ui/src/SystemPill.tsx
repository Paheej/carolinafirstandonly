import * as React from 'react';
import {
    Skull,
    Swords,
    Crown,
    Castle,
    Scroll,
    Dices,
    Shield,
    Flame,
    type LucideIcon,
} from 'lucide-react';
import { Badge } from './Badge';

/**
 * Lucide icon names allowed in `game_systems.icon`. Each new system added
 * via admin must use one of these — otherwise the pill renders without an
 * icon. Tree-shaking-friendly static map instead of dynamic lookup.
 */
const ICONS: Record<string, LucideIcon> = {
    Skull,
    Swords,
    Crown,
    Castle,
    Scroll,
    Dices,
    Shield,
    Flame,
};

export const ALLOWED_SYSTEM_ICONS = Object.keys(ICONS);

export interface SystemPillProps {
    system: string | null;
    edition?: string | null;
    /** Lucide icon name from game_systems.icon, if available. */
    icon?: string | null;
    className?: string;
}

export function SystemPill({ system, edition, icon, className }: SystemPillProps) {
    if (!system) return null;
    const Icon = icon ? ICONS[icon] : undefined;
    return (
        <Badge variant="brass" className={className}>
            {Icon ? <Icon size={12} strokeWidth={2.25} /> : null}
            <span>
                {system}
                {edition ? ` · ${edition}` : null}
            </span>
        </Badge>
    );
}
