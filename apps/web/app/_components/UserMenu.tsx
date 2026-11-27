import { Bell } from 'lucide-react';
import { buttonClasses } from '@cfo/ui';
import type { CurrentUser } from '@/lib/auth';

export function UserMenu({ user, unread = 0 }: { user: CurrentUser | null; unread?: number }) {
    if (!user) {
        return (
            <div className="flex items-center gap-2">
                <a href="/auth/login" className={buttonClasses('ghost', 'sm')}>
                    Sign in
                </a>
                <a href="/auth/signup" className={buttonClasses('primary', 'sm')}>
                    Join
                </a>
            </div>
        );
    }

    const label = user.profile?.display_name ?? user.profile?.username ?? user.email ?? 'You';

    return (
        <div className="flex items-center gap-2">
            {user.profile?.is_admin ? (
                <a href="/admin" className="cfo-admin-chip">
                    Admin
                </a>
            ) : null}
            <a
                href="/profile/notifications"
                aria-label={unread > 0 ? `Notifications, ${unread} unread` : 'Notifications'}
                className="relative inline-flex h-9 w-9 items-center justify-center rounded-[3px] text-on-mat-soft hover:text-on-mat"
            >
                <Bell size={18} />
                {unread > 0 ? (
                    <span className="cfo-ui cfo-num absolute -right-0.5 -top-0.5 min-w-[1.15rem] rounded-full bg-gold-bright px-1 text-center text-[0.7rem] font-bold leading-[1.15rem] text-graphite">
                        {unread > 9 ? '9+' : unread}
                    </span>
                ) : null}
            </a>
            <a
                href="/profile"
                className="cfo-ui rounded-[3px] px-2.5 py-1.5 text-[0.95rem] font-semibold text-on-mat-soft no-underline hover:text-on-mat"
            >
                {label}
            </a>
            <form action="/api/auth/signout" method="post">
                <button type="submit" className={buttonClasses('outline', 'sm')}>
                    Sign out
                </button>
            </form>
        </div>
    );
}
