'use client';

import { Plus, X } from 'lucide-react';
import type { GameEdition, GameSystem } from '@cfo/database/types';
import { GameSystemSelect } from './GameSystemSelect';

export interface GameRow {
    system: string;
    edition: string;
}

/**
 * Every game a season or event used (Burning Star: 40K 11th and 3rd, Epic,
 * BFG). The first row is the main game: it picks the home page board.
 */
export function GamesPicker({
    systems,
    editions,
    value,
    onChange,
}: {
    systems: GameSystem[];
    editions: GameEdition[];
    value: GameRow[];
    onChange: (next: GameRow[]) => void;
}) {
    const rows = value.length > 0 ? value : [{ system: '', edition: '' }];
    const set = (i: number, row: GameRow) => onChange(rows.map((r, j) => (j === i ? row : r)));
    return (
        <fieldset className="grid gap-4">
            <legend className="cfo-ui mb-1 font-semibold">Games</legend>
            {rows.map((r, i) => (
                <div key={i} className="grid grid-cols-[minmax(0,1fr)_auto] items-end gap-2">
                    <GameSystemSelect
                        idPrefix={`g${i}-`}
                        systems={systems}
                        editions={editions}
                        systemValue={r.system}
                        editionValue={r.edition}
                        onChange={(next) => set(i, next)}
                    />
                    {rows.length > 1 ? (
                        <button
                            type="button"
                            onClick={() => onChange(rows.filter((_, j) => j !== i))}
                            aria-label={`Remove ${r.system || 'this game'}`}
                            className="mb-1 grid size-8 place-items-center rounded-[3px] text-graphite-soft hover:bg-graphite/10 hover:text-casualty"
                        >
                            <X size={16} />
                        </button>
                    ) : (
                        <span className="size-8" />
                    )}
                </div>
            ))}
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                <button
                    type="button"
                    onClick={() => onChange([...rows, { system: '', edition: '' }])}
                    className="cfo-ui inline-flex items-center gap-1.5 font-semibold text-gold-deep hover:underline"
                >
                    <Plus size={15} /> Add another game
                </button>
                {rows.length > 1 ? <span className="text-sm text-graphite-soft">The first game is the main one.</span> : null}
            </div>
        </fieldset>
    );
}
