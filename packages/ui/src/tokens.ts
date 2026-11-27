/** "War table" palette. Keep in sync with the @theme block in styles.css. */
export const colors = {
    // The mat: nav, page-head bands, footer
    mat: '#0d0d0c',
    matRaised: '#1a1a18',
    matLine: '#46453f',
    onMat: '#ecebe6',
    onMatSoft: '#a3a198',

    // Primer: the page ground
    primer: '#d8d7d3',
    primerLift: '#e6e5e1',
    graphite: '#1b1b1a',
    graphiteSoft: '#55544f',

    // Wake Forest old gold
    gold: '#9e7e38',
    goldBright: '#cfab52',
    goldDeep: '#6f5823',

    // Semantic
    casualty: '#9e2a2b',
    danger: '#9e2a2b',
    success: '#3c6a3c',
    warning: '#9e7e38',
    info: '#3a5a78',
} as const;

export const fonts = {
    display: '"Archivo", "Arial Narrow", "Helvetica Neue", sans-serif',
    body: '"Source Serif 4", Georgia, "Times New Roman", serif',
    mono: 'ui-monospace, Menlo, monospace',
} as const;

export type ColorToken = keyof typeof colors;
