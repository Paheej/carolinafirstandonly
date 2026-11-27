import { redirect } from 'next/navigation';
import type { Metadata } from 'next';
import { Button, PageHead } from '@cfo/ui';
import { getCurrentUser } from '@/lib/auth';
import { getGameSystems } from '@/lib/archive';
import { createGroup } from '../actions';
import { GroupFields } from '../_components/GroupFields';
import { Notice, first } from '../_components/Notice';

export const metadata: Metadata = { title: 'Start a group' };

export default async function NewGroupPage({
    searchParams,
}: {
    searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
    const user = await getCurrentUser();
    if (!user) redirect('/auth/login?next=/groups/new');
    const [sp, systems] = await Promise.all([searchParams, getGameSystems()]);

    return (
        <>
            <PageHead kicker="Groups" title="Start a group" lede="You'll be the owner. You can make other members admins later, and they can approve requests and send invites." />
            <Notice error={first(sp.error)} />
            <form action={createGroup} className="max-w-3xl py-10">
                <GroupFields systems={systems} />
                <div className="mt-8">
                    <Button type="submit" size="lg">Create group</Button>
                </div>
            </form>
        </>
    );
}
