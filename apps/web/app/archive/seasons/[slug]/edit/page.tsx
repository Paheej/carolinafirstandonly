import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { ArrowLeft } from 'lucide-react';
import { getCurrentUser } from '@/lib/auth';
import {
    getSeasonBySlug,
    getGameSystems,
    getGameEditions,
} from '@/lib/archive';
import { SeasonForm } from '../../_components/SeasonForm';
import { updateSeason } from '../../actions';

interface PageProps {
    params: Promise<{ slug: string }>;
}

export const metadata: Metadata = { title: 'Edit season' };

export default async function EditSeasonPage({ params }: PageProps) {
    const { slug } = await params;
    const user = await getCurrentUser();
    if (!user?.profile?.is_admin) notFound();

    const [season, systems, editions] = await Promise.all([
        getSeasonBySlug(slug),
        getGameSystems(),
        getGameEditions(),
    ]);
    if (!season) notFound();

    const initial = {
        slug: season.slug,
        name: season.name,
        year: season.year ? String(season.year) : '',
        starts_on: season.starts_on ?? '',
        ends_on: season.ends_on ?? '',
        game_system: season.game_system ?? '',
        game_edition: season.game_edition ?? '',
        hero_image_url: season.hero_image_url ?? '',
        description_md: season.description_md ?? '',
    };

    return (
        <article className="space-y-8">
            <nav className="text-sm">
                <Link href={`/archive/seasons/${season.slug}`} className="inline-flex items-center gap-1 text-ink-soft">
                    <ArrowLeft size={14} /> {season.name}
                </Link>
            </nav>
            <header>
                <h1 className="cfo-heading-underline font-display text-3xl sm:text-4xl text-ink">
                    Edit {season.name}
                </h1>
            </header>
            <SeasonForm
                mode="edit"
                initial={initial}
                systems={systems}
                editions={editions}
                onSubmit={updateSeason.bind(null, season.slug)}
            />
        </article>
    );
}
