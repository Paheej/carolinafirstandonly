/** Shows the ?notice= / ?error= message a form action redirected back with. */
export function Notice({ notice, error }: { notice?: string; error?: string }) {
    if (error) {
        return (
            <p role="alert" className="cfo-ui mt-6 rounded-[3px] border border-casualty/50 bg-casualty/10 px-4 py-3 text-casualty">
                {error}
            </p>
        );
    }
    if (notice) {
        return (
            <p role="status" className="cfo-ui mt-6 rounded-[3px] border border-success/40 bg-success/10 px-4 py-3 text-success">
                {notice}
            </p>
        );
    }
    return null;
}

export function first(v: string | string[] | undefined): string | undefined {
    return Array.isArray(v) ? v[0] : v;
}
