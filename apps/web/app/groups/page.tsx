import Link from 'next/link';
import type { Metadata } from 'next';
import { EmptyState, PageHead, buttonClasses } from '@cfo/ui';
import { Plus } from 'lucide-react';
import { getCurrentUser } from '@/lib/auth';
import { getGroups, type GroupListItem } from '@/lib/groups';
import { excerpt } from '@/lib/markdown';
import { Notice, first } from './_components/Notice';
import { POLICY_LABEL } from './_components/GroupFields';

export const metadata: Metadata = {
    title: 'Groups',
    description: 'Play groups in the club: campaigns, game nights and the people in them.',
};

const ROLE_LABEL = { owner: 'You own this', admin: 'You help run this', member: 'You’re a member' } as const;

export default async function GroupsPage({
    searchParams,
}: {
    searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
    const sp = await searchParams;
    const user = await getCurrentUser();
    const groups = await getGroups(user?.id ?? null);
    const mine = groups.filter((g) => g.my_role);
    const others = groups.filter((g) => !g.my_role);

    return (
        <>
            <PageHead
                kicker="Groups"
                title="Find your table"
                lede="Each group is a set of regulars: a campaign, a game night, a painting crew. Join one to see its events and who's playing."
                actions={
                    <Link href={user ? '/groups/new' : '/auth/login?next=/groups/new'} className={buttonClasses('primary')}>
                        <Plus size={16} /> {user ? 'Start a group' : 'Sign in to start a group'}
                    </Link>
                }
            />
            <Notice notice={first(sp.notice)} error={first(sp.error)} />

            <div className="grid gap-14 py-12">
                {mine.length > 0 ? <GroupList title="Your groups" groups={mine} /> : null}
                {others.length > 0 ? (
                    <GroupList title={mine.length > 0 ? 'Other groups' : 'All groups'} groups={others} />
                ) : mine.length === 0 ? (
                    <EmptyState
                        title="No groups yet"
                        body="Start the first one. You'll be its owner and can invite people or approve requests to join."
                        action={
                            <Link href={user ? '/groups/new' : '/auth/signup'} className={buttonClasses('primary')}>
                                {user ? 'Start a group' : 'Create an account'}
                            </Link>
                        }
                    />
                ) : null}
            </div>
        </>
    );
}

function GroupList({ title, groups }: { title: string; groups: GroupListItem[] }) {
    return (
        <section className="min-w-0">
            <h2 className="mb-5 text-[2rem] font-extrabold">{title}</h2>
            <ul className="border-t border-graphite/15">
                {groups.map((g) => {
                    const blurb = excerpt(g.description_md, 160);
                    return (
                        <li key={g.id} className="border-b border-graphite/15">
                            <Link href={`/groups/${g.slug}`} className="group grid gap-1 py-4 no-underline sm:grid-cols-[minmax(0,1fr)_auto] sm:gap-x-8">
                                <h3 className="text-[1.6rem] font-bold decoration-gold underline-offset-4 group-hover:underline">{g.name}</h3>
                                <p className="cfo-ui cfo-num text-graphite-soft sm:row-span-2 sm:text-right">
                                    {g.member_count} {g.member_count === 1 ? 'member' : 'members'}
                                    <br className="hidden sm:block" />
                                    <span className="sm:hidden">, </span>
                                    {g.my_role ? ROLE_LABEL[g.my_role] : POLICY_LABEL[g.join_policy]}
                                </p>
                                {blurb ? <p className="text-base text-graphite-soft">{blurb}</p> : null}
                                {g.systems.length > 0 ? (
                                    <p className="cfo-ui text-sm font-semibold text-gold-deep">{g.systems.join(', ')}</p>
                                ) : null}
                            </Link>
                        </li>
                    );
                })}
            </ul>
        </section>
    );
}
