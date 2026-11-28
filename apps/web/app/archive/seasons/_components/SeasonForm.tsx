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
    Select,
} from '@cfo/ui';
import { Save } from 'lucide-react';
import type { GameSystem, GameEdition } from '@cfo/database/types';
import { GamesPicker, type GameRow } from '@/app/_components/GamesPicker';

function slugify(s: string): string {
    return s
        .toLowerCase()
        .trim()
        .replace(/['"`]/g, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
}

export interface SeasonFormValues {
    slug: string;
    name: string;
    year: string;
    starts_on: string;
    ends_on: string;
    games: GameRow[];
    hero_image_url: string;
    description_md: string;
    status: 'active' | 'completed';
    external_url: string;
}

export interface SeasonFormProps {
    initial?: Partial<SeasonFormValues>;
    mode: 'create' | 'edit';
    systems: GameSystem[];
    editions: GameEdition[];
    onSubmit: (values: SeasonFormValues) => Promise<{ ok: boolean; error?: string }>;
    submitLabel?: string;
}

const blank: SeasonFormValues = {
    slug: '',
    name: '',
    year: '',
    starts_on: '',
    ends_on: '',
    games: [],
    hero_image_url: '',
    description_md: '',
    status: 'completed',
    external_url: '',
};

export function SeasonForm({
    initial,
    mode,
    systems,
    editions,
    onSubmit,
    submitLabel,
}: SeasonFormProps) {
    const [values, setValues] = React.useState<SeasonFormValues>({ ...blank, ...initial });
    const [slugTouched, setSlugTouched] = React.useState(mode === 'edit');
    const [submitting, setSubmitting] = React.useState(false);
    const [error, setError] = React.useState<string | null>(null);

    function set<K extends keyof SeasonFormValues>(k: K, v: SeasonFormValues[K]) {
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
                        {mode === 'create' ? 'New season' : 'Edit season'}
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
                                placeholder="Season IV (2026)"
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
                                placeholder="season-4"
                                pattern="[a-z0-9-]+"
                                required
                                disabled={mode === 'edit'}
                                readOnly={mode === 'edit'}
                            />
                            {mode === 'edit' ? (
                                <p className="mt-1 text-[11px] text-graphite-soft">
                                    Slug is locked — changing it would break existing URLs.
                                </p>
                            ) : null}
                        </div>
                    </div>

                    <GamesPicker
                        systems={systems}
                        editions={editions}
                        value={values.games}
                        onChange={(games) => setValues((cur) => ({ ...cur, games }))}
                    />

                    <div className="grid gap-4 sm:grid-cols-3">
                        <div>
                            <Label htmlFor="year">Year</Label>
                            <Input
                                id="year"
                                type="number"
                                inputMode="numeric"
                                value={values.year}
                                onChange={(e) => set('year', e.target.value)}
                                placeholder="2026"
                                min={1990}
                                max={2100}
                            />
                        </div>
                        <div>
                            <Label htmlFor="starts_on">Starts on</Label>
                            <Input
                                id="starts_on"
                                type="date"
                                value={values.starts_on}
                                onChange={(e) => set('starts_on', e.target.value)}
                            />
                        </div>
                        <div>
                            <Label htmlFor="ends_on">Ends on</Label>
                            <Input
                                id="ends_on"
                                type="date"
                                value={values.ends_on}
                                onChange={(e) => set('ends_on', e.target.value)}
                            />
                        </div>
                    </div>

                    <div className="grid gap-4 sm:grid-cols-[1fr_2fr]">
                        <div>
                            <Label htmlFor="status">Status</Label>
                            <Select
                                id="status"
                                value={values.status}
                                onChange={(e) => set('status', e.target.value as SeasonFormValues['status'])}
                            >
                                <option value="active">Running now</option>
                                <option value="completed">Finished</option>
                            </Select>
                            <p className="mt-1 text-[11px] text-graphite-soft">
                                Running campaigns are featured on the home page.
                            </p>
                        </div>
                        <div>
                            <Label htmlFor="external_url">Tracked elsewhere (link)</Label>
                            <Input
                                id="external_url"
                                type="url"
                                value={values.external_url}
                                onChange={(e) => set('external_url', e.target.value)}
                                placeholder="https://campaign-chronicle.app"
                            />
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
                        <Label required>Overview (markdown)</Label>
                        <MarkdownEditor
                            value={values.description_md}
                            onChange={(v) => set('description_md', v)}
                        />
                    </div>
                </CardBody>
            </Card>

            {error ? (
                <div className="rounded-[3px] border border-casualty/50 bg-casualty/10 px-4 py-3 text-sm text-casualty">
                    {error}
                </div>
            ) : null}

            <Card>
                <CardFooter className="flex items-center justify-end gap-3">
                    <Button type="submit" disabled={submitting}>
                        <Save size={14} />
                        {submitting ? 'Saving…' : (submitLabel ?? (mode === 'create' ? 'Create season' : 'Save changes'))}
                    </Button>
                </CardFooter>
            </Card>
        </form>
    );
}
