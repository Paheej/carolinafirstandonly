import { Input, Label, Select, Textarea } from '@cfo/ui';
import type { GameSystem, Group } from '@cfo/database/types';

export const POLICY_LABEL: Record<Group['join_policy'], string> = {
    open: 'Anyone can join',
    request: 'Members ask to join, an admin approves',
    invite: 'Invite only',
};

/** Form fields shared by "create group" and the manage page's settings. */
export function GroupFields({ group, systems }: { group?: Group; systems: GameSystem[] }) {
    return (
        <div className="grid gap-5">
            <div className="grid gap-4 sm:grid-cols-[2fr_1fr]">
                <div>
                    <Label htmlFor="name" required>Name</Label>
                    <Input id="name" name="name" required minLength={2} maxLength={80} defaultValue={group?.name} placeholder="Tuesday Night 40K" />
                </div>
                {group ? null : (
                    <div>
                        <Label htmlFor="slug">Web address</Label>
                        <Input id="slug" name="slug" pattern="[a-z0-9\-]*" maxLength={60} placeholder="tuesday-40k" />
                        <p className="mt-1 text-sm text-graphite-soft">Leave blank to use the name.</p>
                    </div>
                )}
            </div>

            <div>
                <Label htmlFor="description_md">What the group is about</Label>
                <Textarea id="description_md" name="description_md" rows={5} defaultValue={group?.description_md ?? ''} placeholder="When you meet, where, what you play. Markdown works." />
            </div>

            <fieldset>
                <legend className="cfo-ui mb-2 font-semibold">Games played</legend>
                <div className="flex flex-wrap gap-x-5 gap-y-2">
                    {systems.map((s) => (
                        <label key={s.id} className="cfo-ui inline-flex items-center gap-2">
                            <input type="checkbox" name="systems" value={s.name} defaultChecked={group?.systems.includes(s.name)} className="size-4 accent-gold" />
                            {s.name}
                        </label>
                    ))}
                </div>
            </fieldset>

            <div className="grid gap-4 sm:grid-cols-2">
                <div>
                    <Label htmlFor="join_policy">Who can join</Label>
                    <Select id="join_policy" name="join_policy" defaultValue={group?.join_policy ?? 'request'}>
                        {(Object.keys(POLICY_LABEL) as Group['join_policy'][]).map((k) => (
                            <option key={k} value={k}>{POLICY_LABEL[k]}</option>
                        ))}
                    </Select>
                </div>
                <div>
                    <Label htmlFor="visibility">Who can see it</Label>
                    <Select id="visibility" name="visibility" defaultValue={group?.visibility ?? 'public'}>
                        <option value="public">Everyone (listed in the directory)</option>
                        <option value="private">Members only (hidden from the directory)</option>
                    </Select>
                </div>
            </div>

            <div>
                <Label htmlFor="banner_url">Banner image URL</Label>
                <Input id="banner_url" name="banner_url" type="url" defaultValue={group?.banner_url ?? ''} placeholder="https://ik.imagekit.io/…" />
            </div>
        </div>
    );
}
