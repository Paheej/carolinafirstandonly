import * as React from 'react';
import { Shield } from 'lucide-react';
import { systemIconComponent } from './SystemPill';

export interface GroupCrestProps {
    /** Lucide icon name of the group's main game (game_systems.icon). */
    icon?: string | null;
    /** 40K-family groups get the casualty-red rim; everything else old gold. */
    accent?: 'gold' | 'red';
    /** Width in px; the shield is a little taller than wide. */
    size?: number;
    className?: string;
}

/**
 * A group's crest: a black heater shield with a gold inner line and the main
 * game's icon. Decorative (aria-hidden); the group name always sits next to it.
 */
export function GroupCrest({ icon, accent = 'gold', size = 40, className }: GroupCrestProps) {
    const Icon = systemIconComponent(icon) ?? Shield;
    const rim = accent === 'red' ? '#9e2a2b' : '#9e7e38';
    return (
        <span
            aria-hidden="true"
            className={`relative inline-grid shrink-0 place-items-center ${className ?? ''}`}
            style={{ width: size, height: Math.round(size * 1.15) }}
        >
            <svg viewBox="0 0 40 46" className="absolute inset-0 h-full w-full">
                <path d="M20 1.5 37.5 6.5V21c0 11.5-7.4 19.4-17.5 23.5C9.9 40.4 2.5 32.5 2.5 21V6.5Z" fill="#0d0d0c" stroke={rim} strokeWidth="2.5" strokeLinejoin="round" />
                <path d="M20 5.6 34 9.6V21c0 9.3-5.8 15.8-14 19.4C11.8 36.8 6 30.3 6 21V9.6Z" fill="none" stroke="#cfab52" strokeOpacity=".45" strokeWidth="1" />
            </svg>
            <Icon className="relative" style={{ marginTop: -size * 0.08 }} size={Math.round(size * 0.46)} color="#cfab52" strokeWidth={2} />
        </span>
    );
}
