'use client';

import * as React from 'react';
import { Label } from '@cfo/ui';
import type { GameSystem, GameEdition } from '@cfo/database/types';

export interface GameSystemSelectProps {
    systems: GameSystem[];
    editions: GameEdition[];
    /** Selected game_system NAME (not id), since storage is by name. */
    systemValue: string;
    editionValue: string;
    onChange: (next: { system: string; edition: string }) => void;
    required?: boolean;
}

/**
 * Two paired <select>s — system, then edition filtered by the system's id.
 * Storage is by display NAME (matches seasons.game_system / game_edition), so
 * the dropdown values are names. We carry id internally to filter editions.
 */
export function GameSystemSelect({
    systems,
    editions,
    systemValue,
    editionValue,
    onChange,
    required,
}: GameSystemSelectProps) {
    const selectedSystem = systems.find((s) => s.name === systemValue) ?? null;
    const availableEditions = selectedSystem
        ? editions.filter((e) => e.system_id === selectedSystem.id)
        : [];

    function handleSystemChange(name: string) {
        // Reset edition when system changes — old edition may not belong to new system.
        onChange({ system: name, edition: '' });
    }

    return (
        <div className="grid gap-4 sm:grid-cols-2">
            <div>
                <Label htmlFor="game_system" required={required}>
                    Game system
                </Label>
                <select
                    id="game_system"
                    value={systemValue}
                    onChange={(e) => handleSystemChange(e.target.value)}
                    required={required}
                    className="h-10 w-full rounded-sm border border-brass-dark/50 bg-parchment/60 px-3 text-ink focus-visible:border-brass focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brass"
                >
                    <option value="">Choose a system…</option>
                    {systems.map((s) => (
                        <option key={s.id} value={s.name}>
                            {s.name}
                        </option>
                    ))}
                </select>
            </div>
            <div>
                <Label htmlFor="game_edition">Edition</Label>
                <select
                    id="game_edition"
                    value={editionValue}
                    onChange={(e) => onChange({ system: systemValue, edition: e.target.value })}
                    disabled={!selectedSystem || availableEditions.length === 0}
                    className="h-10 w-full rounded-sm border border-brass-dark/50 bg-parchment/60 px-3 text-ink focus-visible:border-brass focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brass disabled:opacity-50"
                >
                    <option value="">
                        {selectedSystem && availableEditions.length === 0
                            ? '— no editions —'
                            : 'Choose an edition…'}
                    </option>
                    {availableEditions.map((ed) => (
                        <option key={ed.id} value={ed.name}>
                            {ed.name}
                        </option>
                    ))}
                </select>
            </div>
        </div>
    );
}
