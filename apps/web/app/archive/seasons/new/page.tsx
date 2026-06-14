import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { ArrowLeft } from 'lucide-react';
import { getCurrentUser } from '@/lib/auth';
import { getGameSystems, getGameEditions } from '@/lib/archive';
import { SeasonForm } from '../_components/SeasonForm';
import { createSeason } from '../actions';

export const metadata: Metadata = { title: 'New season' };

export default async function NewSeasonPage() {
    const user = await getCurrentUser();
    if (!user?.profile?.is_admin) notFound();

    const [systems, editions] = await Promise.all([getGameSystems(), getGameEditions()]);

    return (
        <article className="space-y-8">
            <nav className="text-sm">
                <Link href="/archive" className="inline-flex items-center gap-1 text-ink-soft">
                    <ArrowLeft size={14} /> Archive
                </Link>
            </nav>
            <header>
                <h1 className="cfo-heading-underline font-display text-3xl sm:text-4xl text-ink">
                    New season
                </h1>
                <p className="mt-2 text-sm text-ink-soft">
                    Shipping a new campaign? Drop in the basics and write the overview here. Recaps and reference pages get attached later.
                </p>
            </header>
            <SeasonForm
                mode="create"
                systems={systems}
                editions={editions}
                onSubmit={createSeason}
            />
        </article>
    );
}
