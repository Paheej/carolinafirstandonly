export const colors = {
    // Backgrounds
    parchment: '#f4ead5',
    parchmentDark: '#e8dcc0',
    ink: '#1a1815',
    inkSoft: '#4a4640',

    // Accents
    forest: '#2d4a2b',
    forestDark: '#1f3320',
    brass: '#b08d57',
    brassDark: '#8a6d3f',
    leather: '#6b4423',

    // Semantic
    success: '#3f6d3f',
    warning: '#b08d57',
    danger: '#8b2a2a',
    info: '#3a5a78',
} as const;

export const fonts = {
    display: '"EB Garamond", "Cormorant Garamond", Georgia, serif',
    body: 'Inter, system-ui, sans-serif',
    mono: '"JetBrains Mono", ui-monospace, monospace',
} as const;

export type ColorToken = keyof typeof colors;
