// Brand tokens — lumo Brand Identity v1.0. Dark-first; Cream/Ink exist for
// marketing and print only, the app does not ship a light mode yet.

export const colors = {
  midnight: '#171334', // app ground
  surface: '#211C45', // cards, sheets, backlog
  elevated: '#2C2657', // modals, day-close sheet, pressed
  line: '#3A3370', // dividers, borders
  cream: '#FFFBF0',
  ink: '#221C4A', // text on Sunbeam / light

  sunbeam: '#FFC53D', // primary — focus goal, day close
  violet: '#7C6BFF', // secondary — earlier days
  lagoon: '#2FD4B4', // success, closed tasks
  blush: '#FF7A85', // missed — a fact, not an alarm
  cloud: '#F5F3FF', // primary text on dark
  muted: '#9B94C4', // secondary text, deferred
};

// Area palette: brights only. Excludes Lagoon and Blush (reserved for
// done / missed) and coral/crimson (Cadence/Aperis own those). Order checked
// with the dataviz validator: every adjacent pair passes colourblind
// separation on Surface. Assigned in this fixed order, never cycled by rank.
export const areaColors = [
  '#FFC53D', '#7C6BFF', '#5AB8FF', '#FFA94D', '#B98CFF', '#8EE07A', '#FF8AD8',
];

export const radius = { sm: 10, md: 16, lg: 24, pill: 999 };

export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 };

export const fonts = {
  wordmark: 'Baloo2_800ExtraBold',
  display: 'Baloo2_700Bold',
  body: 'Nunito_600SemiBold',
  bodyBold: 'Nunito_700Bold',
  bodyHeavy: 'Nunito_800ExtraBold',
  mono: 'JetBrainsMono_500Medium',
};

// Type scale from §07. Streak counts and day-close scores use `celebration`
// (Baloo) — they are trophies, not data.
export const type = {
  wordmark: { fontFamily: fonts.wordmark, fontSize: 40, letterSpacing: -0.2, color: colors.cloud },
  celebration: { fontFamily: fonts.wordmark, fontSize: 56, lineHeight: 64, color: colors.sunbeam },
  h1: { fontFamily: fonts.display, fontSize: 28, lineHeight: 34, color: colors.cloud },
  h2: { fontFamily: fonts.display, fontSize: 19, lineHeight: 25, color: colors.cloud },
  body: { fontFamily: fonts.body, fontSize: 15.5, lineHeight: 24, color: colors.cloud },
  emphasis: { fontFamily: fonts.bodyBold, fontSize: 15.5, lineHeight: 22, color: colors.cloud },
  data: { fontFamily: fonts.mono, fontSize: 14, color: colors.lagoon },
  caption: { fontFamily: fonts.body, fontSize: 12, lineHeight: 17, color: colors.muted },
  kicker: { fontFamily: fonts.mono, fontSize: 11, letterSpacing: 1.6, color: colors.muted, textTransform: 'uppercase' },
};

export const iconStroke = 2.25; // Lucide, rounded caps — thicker than Cadence/Aperis on purpose

export const navTheme = {
  dark: true,
  colors: {
    primary: colors.sunbeam,
    background: colors.midnight,
    card: colors.surface,
    text: colors.cloud,
    border: colors.line,
    notification: colors.blush,
  },
  fonts: {
    regular: { fontFamily: fonts.body, fontWeight: '600' },
    medium: { fontFamily: fonts.bodyBold, fontWeight: '700' },
    bold: { fontFamily: fonts.display, fontWeight: '700' },
    heavy: { fontFamily: fonts.wordmark, fontWeight: '800' },
  },
};
