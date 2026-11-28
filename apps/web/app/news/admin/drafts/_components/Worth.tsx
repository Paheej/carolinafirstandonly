/** Newsworthiness 1–5 as gold pips, like wound markers on a unit card. */
export function Worth({ value }: { value: number }) {
    const v = Math.min(5, Math.max(1, Math.round(value)));
    return (
        <span className="flex items-center gap-1 pt-1.5" role="img" aria-label={`Newsworthiness ${v} of 5`} title={`Newsworthiness ${v} of 5`}>
            {[1, 2, 3, 4, 5].map((i) => (
                <span
                    key={i}
                    aria-hidden
                    className={`block h-3 w-3 rounded-full border ${i <= v ? 'border-gold-deep bg-gold-bright' : 'border-graphite/25 bg-transparent'}`}
                />
            ))}
        </span>
    );
}
