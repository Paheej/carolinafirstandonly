import Link from 'next/link';
import { cookies } from 'next/headers';
import type { Metadata } from 'next';
import { createServerSupabase } from '@cfo/database/server';
import { Button, PageHead, buttonClasses } from '@cfo/ui';
import { getCurrentUser } from '@/lib/auth';
import { redeemInviteLink } from '../../actions';
import { Notice, first } from '../../_components/Notice';

export const metadata: Metadata = { title: 'Group invite', robots: { index: false } };

export default async function InvitePage({
    params,
    searchParams,
}: {
    params: Promise<{ token: string }>;
    searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
    const [{ token }, sp, user] = await Promise.all([params, searchParams, getCurrentUser()]);
    const supabase = createServerSupabase(await cookies());
    const { data } = await supabase.rpc('invite_link_preview', { p_token: token });
    const invite = data?.[0] ?? null;

    if (!invite || !invite.is_valid) {
        return (
            <>
                <PageHead kicker="Groups" title="This invite link has expired" lede="Ask whoever sent it for a new one." />
                <div className="py-10">
                    <Link href="/groups" className={buttonClasses('outline')}>Browse groups</Link>
                </div>
            </>
        );
    }

    return (
        <>
            <PageHead kicker="You're invited" title={invite.group_name} />
            <Notice error={first(sp.error)} />
            <div className="py-10">
                {user ? (
                    <form action={redeemInviteLink}>
                        <input type="hidden" name="token" value={token} />
                        <Button type="submit" size="lg">Join {invite.group_name}</Button>
                    </form>
                ) : (
                    <div className="flex flex-wrap gap-3">
                        <Link href={`/auth/signup?next=/groups/invite/${token}`} className={buttonClasses('primary', 'lg')}>Create an account to join</Link>
                        <Link href={`/auth/login?next=/groups/invite/${token}`} className={buttonClasses('outline', 'lg')}>Sign in</Link>
                    </div>
                )}
            </div>
        </>
    );
}
