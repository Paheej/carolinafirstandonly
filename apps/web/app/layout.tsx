import './globals.css';
import type { Metadata } from 'next';
import { Archivo, Source_Serif_4 } from 'next/font/google';
import { NavBar, Footer } from '@cfo/ui';
import { SITE_NAME, SITE_TAGLINE } from '@cfo/shared';
import { getCurrentUser } from '@/lib/auth';
import { getUnreadCount } from '@/lib/groups';
import { UserMenu } from './_components/UserMenu';
import { MobileNav } from './_components/MobileNav';

const archivo = Archivo({
    subsets: ['latin'],
    axes: ['wdth'],
    variable: '--font-archivo',
    display: 'swap',
});

const sourceSerif = Source_Serif_4({
    subsets: ['latin'],
    style: ['normal', 'italic'],
    axes: ['opsz'],
    variable: '--font-source-serif',
    display: 'swap',
});

export const metadata: Metadata = {
    title: { default: SITE_NAME, template: `%s · ${SITE_NAME}` },
    description: SITE_TAGLINE,
    metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'),
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
    const user = await getCurrentUser();
    const unread = user ? await getUnreadCount(user.id) : 0;
    const links = [
        { href: '/archive', label: 'Archive' },
        { href: '/events', label: 'Events' },
        { href: '/calendar', label: 'Calendar' },
        { href: '/groups', label: 'Groups' },
        { href: '/news', label: 'News' },
    ];

    return (
        <html lang="en" className={`${archivo.variable} ${sourceSerif.variable}`}>
            <body>
                <NavBar
                    siteName={SITE_NAME}
                    links={links}
                    rightSlot={<UserMenu user={user} unread={unread} />}
                    mobileMenu={<MobileNav links={links} user={user} unread={unread} />}
                />
                <main className="cfo-main mx-auto max-w-6xl px-4 py-8 md:px-6 min-h-[calc(100dvh-12rem)]">
                    {children}
                </main>
                <Footer siteName={SITE_NAME} />
            </body>
        </html>
    );
}
