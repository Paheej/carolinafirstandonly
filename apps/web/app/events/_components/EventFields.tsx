import { Input, Label, Select, Textarea } from '@cfo/ui';
import type { EventRole, GameDay } from '@cfo/database/types';
import type { PlannerGroup } from '@/lib/events';
import { utcToZonedParts } from '@/lib/time';
import { RoleRows, type RoleRowValue } from './RoleRows';

export const VISIBILITY_LABEL: Record<GameDay['visibility'], string> = {
    public: 'Everyone',
    group: 'Group members only',
    hidden: 'Only people I invite',
};

/** Fields shared by "plan a game day" and "edit game day". */
export function EventFields({
    event,
    roles,
    groups,
    defaultGroupId,
}: {
    event?: GameDay;
    roles?: EventRole[];
    groups: PlannerGroup[];
    defaultGroupId?: string;
}) {
    const start = event ? utcToZonedParts(event.starts_at) : null;
    const end = event ? utcToZonedParts(event.ends_at) : null;
    const groupId = event?.group_id ?? defaultGroupId ?? '';
    const templatesByGroup = Object.fromEntries(
        groups.map((g) => [g.id, g.templates.map((t) => ({ role_name: t.role_name, max: t.default_max }))]),
    ) as Record<string, RoleRowValue[]>;
    const initialRoles: RoleRowValue[] = roles
        ? roles.map((r) => ({ id: r.id, role_name: r.role_name, max: r.max_count }))
        : (templatesByGroup[groupId] ?? []);

    return (
        <div className="grid gap-6">
            <div>
                <Label htmlFor="title" required>Title</Label>
                <Input id="title" name="title" required minLength={2} maxLength={120} defaultValue={event?.title} placeholder="Curse of Strahd, session 14" />
            </div>

            <div className="grid gap-4 sm:grid-cols-[1.4fr_1fr_1fr]">
                <div>
                    <Label htmlFor="date" required>Date</Label>
                    <Input id="date" name="date" type="date" required defaultValue={start?.date} />
                </div>
                <div>
                    <Label htmlFor="start" required>Starts</Label>
                    <Input id="start" name="start" type="time" required step={900} defaultValue={start?.time ?? '13:00'} />
                </div>
                <div>
                    <Label htmlFor="end" required>Ends</Label>
                    <Input id="end" name="end" type="time" required step={900} defaultValue={end?.time ?? '17:00'} />
                </div>
            </div>
            <p className="-mt-3 text-sm text-graphite-soft">Eastern time. An end time earlier than the start means it runs past midnight.</p>

            <div>
                <Label htmlFor="location">Where</Label>
                <Input id="location" name="location" maxLength={200} defaultValue={event?.location ?? ''} placeholder="Snyder's basement, or the store's address" />
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
                <div>
                    <Label htmlFor="group_id">Group</Label>
                    <Select id="group_id" name="group_id" defaultValue={groupId}>
                        <option value="">No group</option>
                        {groups.map((g) => (
                            <option key={g.id} value={g.id}>{g.name}</option>
                        ))}
                    </Select>
                </div>
                <div>
                    <Label htmlFor="visibility">Who can see it</Label>
                    <Select id="visibility" name="visibility" defaultValue={event?.visibility ?? (groupId ? 'group' : 'public')}>
                        {(Object.keys(VISIBILITY_LABEL) as GameDay['visibility'][]).map((v) => (
                            <option key={v} value={v}>{VISIBILITY_LABEL[v]}</option>
                        ))}
                    </Select>
                </div>
                <div>
                    <Label htmlFor="capacity">Seats</Label>
                    <Input id="capacity" name="capacity" type="number" min={1} inputMode="numeric" defaultValue={event?.capacity ?? ''} placeholder="No limit" />
                </div>
            </div>

            <RoleRows initial={initialRoles} templatesByGroup={event ? undefined : templatesByGroup} groupSelectId="group_id" />

            <div>
                <Label htmlFor="description_md">Details</Label>
                <Textarea id="description_md" name="description_md" rows={6} defaultValue={event?.description_md ?? ''} placeholder="Points limit, mission, what to bring. Markdown works." />
            </div>
        </div>
    );
}
