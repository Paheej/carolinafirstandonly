import type { Metadata } from 'next';
import { PageHead } from '@cfo/ui';

export const metadata: Metadata = {
    title: 'Privacy policy',
    description: 'What Carolina First and Only collects, why, who it is shared with, and how to delete it.',
};

const CONTACT = 'privacy@carolinafirstandonly.com';
const UPDATED = 'November 27, 2026';

export default function PrivacyPage() {
    return (
        <>
            <PageHead kicker="Privacy" title="Privacy policy" lede={`Last updated ${UPDATED}.`} />
            <div className="cfo-prose py-12">
                <p>
                    Carolina First and Only is a website for a tabletop gaming club in the Clemmons and
                    Winston-Salem area. It&apos;s run by club members, not a company. This page explains what we
                    collect when you use carolinafirstandonly.com, why, and what you can do about it.
                </p>

                <h2>The short version</h2>
                <ul>
                    <li>We collect only what the site needs to work: your account, what you post, and the groups you join.</li>
                    <li>We never sell your data, show you ads, or use advertising or tracking cookies.</li>
                    <li>You can ask us to delete your account and everything tied to it at any time.</li>
                </ul>

                <h2>What we collect</h2>
                <h3>When you create an account</h3>
                <p>
                    If you sign up with email, we store your email address and a securely hashed password. If you
                    sign in with Google, Discord or Apple, that service tells us your email address, your name
                    and your profile picture. We don&apos;t get your password for those services, your contacts,
                    or anything else from those accounts.
                </p>
                <h3>Your profile</h3>
                <p>
                    A username, and anything you choose to add: a display name, a short bio, and the games you
                    play. Your username, display name, bio and games are visible to other visitors.
                </p>
                <h3>What you post and do</h3>
                <ul>
                    <li>Battle reports you submit, including text and photos.</li>
                    <li>Groups you create, join or ask to join, your role in them, and invites you send or receive.</li>
                    <li>Pinned posts you write in a group.</li>
                    <li>Notifications we show you on the site (for example, &ldquo;your request was approved&rdquo;).</li>
                </ul>
                <h3>Calendars, only if you connect one</h3>
                <p>
                    You can connect a Google or Apple (iCloud) calendar so the club can see when people are free.
                    For Google, you sign in with Google and allow read access to your free/busy times and your list
                    of calendars; Google never shares event titles or details with us. For iCloud, you paste your
                    calendar&apos;s share link, and we discard titles, descriptions, locations and attendees as the
                    calendar is read. Either way, once a day we keep only the times you&apos;re busy for the next 90
                    days, and the connection is stored encrypted. Members of your groups see combined availability
                    (&ldquo;5 of 8 free&rdquo;), not your calendar and not your name. You can pause or disconnect a
                    calendar at any time, and disconnecting deletes the connection and the stored busy times.
                </p>
                <h3>Technical data</h3>
                <p>
                    Our hosting providers keep standard server logs (such as IP address, browser type and the
                    pages requested) for security and to fix problems. We use cookies only to keep you signed
                    in.
                </p>

                <h2>How we use it</h2>
                <ul>
                    <li>To sign you in and keep your account secure.</li>
                    <li>To show your profile, battle reports and group membership to other members.</li>
                    <li>To let group admins approve requests and send invites, and to notify you about them.</li>
                    <li>To help organize game days, including availability if you connect a calendar.</li>
                </ul>
                <p>We don&apos;t use your data for advertising, and we don&apos;t sell or rent it to anyone.</p>

                <h2>Google user data</h2>
                <p>
                    If you sign in with Google, we receive only your name, email address and profile picture, and
                    use them only to create and display your account. If you connect Google Calendar, we request
                    access only to your free/busy times and calendar list, and use it only to find your busy times, as
                    described above. Our use of
                    information received from Google APIs follows the{' '}
                    <a href="https://developers.google.com/terms/api-services-user-data-policy">
                        Google API Services User Data Policy
                    </a>
                    , including its Limited Use requirements. We don&apos;t transfer Google user data to others
                    except to the service providers listed below that run the site. We don&apos;t use it for ads
                    or to train AI models, and people don&apos;t read it unless you ask us to help with a problem
                    or the law requires it.
                </p>

                <h2>Who we share it with</h2>
                <p>Only the services that run the site, and only so they can do that job:</p>
                <ul>
                    <li><strong>Supabase</strong>, which hosts our database and handles sign-in.</li>
                    <li><strong>Vercel</strong>, which hosts the website.</li>
                    <li><strong>ImageKit</strong>, which stores and resizes photos in battle reports.</li>
                    <li><strong>Google, Discord and Apple</strong>, only when you choose to sign in with them.</li>
                </ul>
                <p>
                    We may also disclose information if the law requires it. Otherwise, your information stays
                    with us.
                </p>

                <h2>How long we keep it</h2>
                <p>
                    We keep your account data while your account exists. Battle reports become part of the
                    club&apos;s archive. If you delete your account, we remove your profile, memberships,
                    invites, notifications and any calendar data. We also either delete your battle reports or
                    keep them with your name removed, whichever you prefer.
                </p>

                <h2>Your choices</h2>
                <ul>
                    <li>Edit your profile any time from your profile settings.</li>
                    <li>Leave any group from its page.</li>
                    <li>Disconnect a calendar, or revoke the site&apos;s access from your Google, Discord or Apple account settings.</li>
                    <li>
                        Ask for a copy of your data, a correction, or deletion of your account by emailing{' '}
                        <a href={`mailto:${CONTACT}`}>{CONTACT}</a>. We&apos;ll respond within 30 days.
                    </li>
                </ul>

                <h2>Security</h2>
                <p>
                    Connections to the site are encrypted. Passwords are hashed, and calendar links and access tokens
                    are stored encrypted. Each person can only see what they&apos;re allowed to, enforced in the
                    database itself. No system is perfectly secure, but we take reasonable steps to protect your
                    information.
                </p>

                <h2>Children</h2>
                <p>The site is meant for people 13 and older. We don&apos;t knowingly collect data from younger children.</p>

                <h2>Changes</h2>
                <p>
                    If we change this policy, we&apos;ll update the date at the top. For significant changes,
                    we&apos;ll post a notice on the site.
                </p>

                <h2>Contact</h2>
                <p>
                    Questions or requests: <a href={`mailto:${CONTACT}`}>{CONTACT}</a>.
                </p>
            </div>
        </>
    );
}
