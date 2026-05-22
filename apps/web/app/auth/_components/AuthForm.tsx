'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { createBrowserSupabase } from '@cfo/database/browser';
import { Button, Input, Label } from '@cfo/ui';

type Mode = 'login' | 'signup';

interface AuthFormProps {
    mode: Mode;
    initialError?: string | null;
}

export function AuthForm({ mode, initialError }: AuthFormProps) {
    const router = useRouter();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState<string | null>(initialError ?? null);
    const [info, setInfo] = useState<string | null>(null);
    const [pending, startTransition] = useTransition();

    function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        setError(null);
        setInfo(null);
        startTransition(async () => {
            const supabase = createBrowserSupabase();
            if (mode === 'signup') {
                const { error: signupError } = await supabase.auth.signUp({
                    email,
                    password,
                    options: {
                        emailRedirectTo: `${window.location.origin}/auth/callback`,
                    },
                });
                if (signupError) {
                    setError(signupError.message);
                    return;
                }
                // Local dev has email confirmation disabled (see config.toml).
                // In prod the user will get a confirmation email; reflect that.
                setInfo(
                    'Check your inbox to confirm your email. If you signed up locally, you are already in — try logging in.',
                );
                router.refresh();
            } else {
                const { error: loginError } = await supabase.auth.signInWithPassword({
                    email,
                    password,
                });
                if (loginError) {
                    setError(loginError.message);
                    return;
                }
                router.push('/');
                router.refresh();
            }
        });
    }

    async function handleOAuth(provider: 'google' | 'discord' | 'apple') {
        setError(null);
        const supabase = createBrowserSupabase();
        const { error: oauthError } = await supabase.auth.signInWithOAuth({
            provider,
            options: {
                redirectTo: `${window.location.origin}/auth/callback`,
            },
        });
        if (oauthError) setError(oauthError.message);
    }

    return (
        <div className="space-y-4">
            <div className="grid gap-2">
                <Button
                    type="button"
                    variant="secondary"
                    onClick={() => handleOAuth('google')}
                >
                    Continue with Google
                </Button>
                <Button
                    type="button"
                    variant="secondary"
                    onClick={() => handleOAuth('discord')}
                >
                    Continue with Discord
                </Button>
                <Button
                    type="button"
                    variant="ghost"
                    disabled
                    title="Apple Sign-In is configured but disabled until the Developer account is provisioned."
                >
                    Continue with Apple (coming soon)
                </Button>
            </div>

            <div className="flex items-center gap-3 text-xs text-ink-soft/70">
                <span className="h-px flex-1 bg-brass-dark/40" />
                or with email
                <span className="h-px flex-1 bg-brass-dark/40" />
            </div>

            <form onSubmit={handleSubmit} className="space-y-3">
                <div>
                    <Label htmlFor="email" required>
                        Email
                    </Label>
                    <Input
                        id="email"
                        type="email"
                        required
                        autoComplete="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                    />
                </div>
                <div>
                    <Label htmlFor="password" required>
                        Password
                    </Label>
                    <Input
                        id="password"
                        type="password"
                        required
                        minLength={8}
                        autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                    />
                </div>

                {error ? (
                    <p className="text-sm text-danger">{error}</p>
                ) : null}
                {info ? (
                    <p className="text-sm text-success">{info}</p>
                ) : null}

                <Button type="submit" disabled={pending} className="w-full">
                    {pending
                        ? 'Working…'
                        : mode === 'login'
                          ? 'Log in'
                          : 'Create account'}
                </Button>
            </form>
        </div>
    );
}
