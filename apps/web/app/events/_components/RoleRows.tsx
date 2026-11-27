'use client';

import { useEffect, useState } from 'react';
import { Plus, X } from 'lucide-react';
import { Input } from '@cfo/ui';

export interface RoleRowValue {
    id?: string;
    role_name: string;
    max: number | null;
}

/**
 * Editable list of roles ("DM, 1 seat", "Player, 5 seats"). Submits as
 * parallel role_id[] / role_name[] / role_max[] fields. When `templatesByGroup`
 * is given, picking a group in the same form swaps in that group's defaults
 * as long as the organizer hasn't edited the rows yet.
 */
export function RoleRows({
    initial,
    templatesByGroup,
    groupSelectId,
}: {
    initial: RoleRowValue[];
    templatesByGroup?: Record<string, RoleRowValue[]>;
    groupSelectId?: string;
}) {
    const [rows, setRows] = useState<RoleRowValue[]>(initial);
    const [touched, setTouched] = useState(false);

    useEffect(() => {
        if (!templatesByGroup || !groupSelectId) return;
        const el = document.getElementById(groupSelectId) as HTMLSelectElement | null;
        if (!el) return;
        const onChange = () => {
            if (touched) return;
            setRows(templatesByGroup[el.value] ?? []);
        };
        el.addEventListener('change', onChange);
        return () => el.removeEventListener('change', onChange);
    }, [templatesByGroup, groupSelectId, touched]);

    function update(i: number, patch: Partial<RoleRowValue>) {
        setTouched(true);
        setRows((cur) => cur.map((r, j) => (j === i ? { ...r, ...patch } : r)));
    }

    return (
        <fieldset className="grid gap-2">
            <legend className="cfo-ui mb-1 font-semibold">Roles</legend>
            <p className="mb-1 text-sm text-graphite-soft">
                Optional. For example a DM with 1 seat and Players with 5. Leave seats blank for no limit.
            </p>
            {rows.map((r, i) => (
                <div key={i} className="flex items-center gap-2">
                    <input type="hidden" name="role_id" value={r.id ?? ''} />
                    <Input
                        name="role_name"
                        aria-label={`Role ${i + 1} name`}
                        value={r.role_name}
                        maxLength={40}
                        placeholder="Player"
                        onChange={(e) => update(i, { role_name: e.target.value })}
                    />
                    <Input
                        name="role_max"
                        aria-label={`Role ${i + 1} seats`}
                        type="number"
                        min={1}
                        inputMode="numeric"
                        className="w-28"
                        placeholder="Seats"
                        value={r.max ?? ''}
                        onChange={(e) => update(i, { max: e.target.value ? Number(e.target.value) : null })}
                    />
                    <button
                        type="button"
                        aria-label={`Remove role ${r.role_name || i + 1}`}
                        onClick={() => {
                            setTouched(true);
                            setRows((cur) => cur.filter((_, j) => j !== i));
                        }}
                        className="inline-flex size-10 shrink-0 items-center justify-center rounded-[3px] text-graphite-soft hover:bg-primer-lift hover:text-casualty"
                    >
                        <X size={16} />
                    </button>
                </div>
            ))}
            <div>
                <button
                    type="button"
                    onClick={() => {
                        setTouched(true);
                        setRows((cur) => [...cur, { role_name: '', max: null }]);
                    }}
                    className="cfo-ui inline-flex items-center gap-1.5 font-semibold text-gold-deep hover:underline"
                >
                    <Plus size={15} /> Add a role
                </button>
            </div>
        </fieldset>
    );
}
