export const metadata = {
    title: 'CFO Agent',
    description: 'Internal AI content agent for carolinafirstandonly.com',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
    return (
        <html lang="en">
            <body>{children}</body>
        </html>
    );
}
