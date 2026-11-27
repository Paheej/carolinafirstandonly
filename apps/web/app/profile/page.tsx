import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';

export default async function ProfilePage() {
    const user = await getCurrentUser();
    if (!user) redirect('/auth/login?next=/profile');
    redirect(user.profile ? `/profile/${user.profile.username}` : '/profile/settings');
}
