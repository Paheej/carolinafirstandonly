export default function AgentRoot() {
    return (
        <main style={{ fontFamily: 'system-ui', padding: '2rem', maxWidth: 720 }}>
            <h1>CFO Agent</h1>
            <p>
                This is the internal agent app. It runs the daily news pipeline.
                Endpoints:
            </p>
            <ul>
                <li><code>POST /api/cron/run</code> — Vercel Cron entry (Phase 6)</li>
                <li><code>POST /api/trigger</code> — admin-triggered run (Phase 6)</li>
            </ul>
            <p style={{ marginTop: '2rem', color: '#666' }}>
                Phase 0 ships only the scaffold. The pipeline implementation lands in Phase 6.
            </p>
        </main>
    );
}
