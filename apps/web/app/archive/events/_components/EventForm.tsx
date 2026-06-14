'use client';

import * as React from 'react';
import {
    Button,
    Card,
    CardBody,
    CardFooter,
    CardHeader,
    Input,
    Label,
    MarkdownEditor,
} from '@cfo/ui';
import { Save } from 'lucide-react';
import type { GameSystem, GameEdition } from '@cfo/database/types';
import { GameSystemSelect } from '@/app/_components/GameSystemSelect';

function slugify(s: string): string {
    return s
        .toLowerCase()
        .trim()
        .replace(/['"`]/g, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
}

export interface EventFormValues {
    slug: string;
    name: string;
    event_date: string;
    game_system: string;
    game_edition: string;
    season_id: string;
    hero_image_url: string;
    description_md: string;
}

interface SeasonRef {
    id: string;
    name: string;
}

export interface EventFormProps {
    initial?: Partial<EventFormValues>;
    mode: 'create' | 'edit';
    systems: GameSystem[];
    editions: GameEdition[];
    seasons: SeasonRef[];
    onSubmit: (values: EventFormValues) => Promise<{ ok: boolean; error?: string }>;
    submitLabel?: string;
}

const blank: EventFormValues = {
    slug: '',
    name: '',
    event_date: '',
    game_system: '',
    game_edition: '',
    season_id: '',
    hero_image_url: '',
    description_md: '',
};

export function EventForm({
    initial,
    mode,
    systems,
    editions,
    seasons,
    onSubmit,
    submitLabel,
}: EventFormProps) {
    const [values, setValues] = React.useState<EventFormValues>({ ...blank, ...initial });
    const [slugTouched, setSlugTouched] = React.useState(mode === 'edit');
    const [submitting, setSubmitting] = React.useState(false);
    const [error, setError] = React.useState<string | null>(null);

    function set<K extends keyof EventFormValues>(k: K, v: EventFormValues[K]) {
        setValues((cur) => ({ ...cur, [k]: v }));
    }

    function onNameChange(name: string) {
        setValues((cur) => ({
            ...cur,
            name,
            slug: slugTouched ? cur.slug : slugify(name),
        }));
    }

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        setError(null);
        setSubmitting(true);
        try {
            const r = await onSubmit(values);
            if (!r.ok) setError(r.error ?? 'Save failed.');
        } catch (err) {
            if (err instanceof Error && err.message.includes('NEXT_REDIRECT')) return;
            setError(err instanceof Error ? err.message : 'Save failed.');
        } finally {
            setSubmitting(false);
        }
    }

    return (
        <form onSubmit={handleSubmit} className="space-y-5">
            <Card>
                <CardHeader>
                    <h2 className="font-display text-xl">
                        {mode === 'create' ? 'New special event' : 'Edit special event'}
                    </h2>
                </CardHeader>
                <CardBody className="space-y-5">
                    <div className="grid gap-4 sm:grid-cols-[2fr_1fr]">
                        <div>
                            <Label htmlFor="name" required>Name</Label>
                            <Input
                                id="name"
                                value={values.name}
                                onChange={(e) => onNameChange(e.target.value)}
                                placeholder="Showdown at Snyder's"
                                maxLength={140}
                                required
                            />
                        </div>
                        <div>
                            <Label htmlFor="slug" required>Slug</Label>
                            <Input
                                id="slug"
                                value={values.slug}
                                onChange={(e) => { setSlugTouched(true); set('slug', e.target.value); }}
                                placeholder="showdown-at-snyders"
                                pattern="[a-z0-9-]+"
                                required
                            />
                        </div>
                    </div>

                    <GameSystemSelect
                        systems={systems}
                        editions={editions}
                        systemValue={values.game_system}
                        editionValue={values.game_edition}
                        onChange={({ system, edition }) =>
                            setValues((cur) => ({ ...cur, game_system: system, game_edition: edition }))
                        }
                    />

                    <div className="grid gap-4 sm:grid-cols-2">
                        <div>
                            <Label htmlFor="event_date">Event date</Label>
                            <Input
                                id="event_date"
                                type="date"
                                value={values.event_date}
                                onChange={(e) => set('event_date', e.target.value)}
                            />
                        </div>
                        <div>
                            <Label htmlFor="season_id">Linked season</Label>
                            <select
                                id="season_id"
                                value={values.season_id}
                                onChange={(e) => set('season_id', e.target.value)}
                                className="h-10 w-full rounded-sm border border-brass-dark/50 bg-parchment/60 px-3 text-ink focus-visible:border-brass focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brass"
                            >
                                <option value="">— not linked —</option>
                                {seasons.map((s) => (
                                    <option key={s.id} value={s.id}>{s.name}</option>
                                ))}
                            </select>
                        </div>
                    </div>

                    <div>
                        <Label htmlFor="hero_image_url">Hero image URL</Label>
                        <Input
                            id="hero_image_url"
                            type="url"
                            value={values.hero_image_url}
                            onChange={(e) => set('hero_image_url', e.target.value)}
                            placeholder="https://ik.imagekit.io/…"
                        />
                    </div>

                    <div>
                        <Label required>Description (markdown)</Label>
                        <MarkdownEditor
                            value={values.description_md}
                            onChange={(v) => set('description_md', v)}
                        />
                    </div>
                </CardBody>
            </Card>

            {error ? (
                <div className="rounded-sm border border-danger/50 bg-danger/10 px-4 py-3 text-sm text-danger">
                    {error}
                </div>
            ) : null}

            <Card>
                <CardFooter className="flex items-center justify-end gap-3">
                    <Button type="submit" disabled={submitting}>
                        <Save size={14} />
                        {submitting ? 'Saving…' : (submitLabel ?? (mode === 'create' ? 'Create event' : 'Save changes'))}
                    </Button>
                </CardFooter>
            </Card>
        </form>
    );
}
