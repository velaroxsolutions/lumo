// F8 — Systems are presets, not settings. Each is a plain config object;
// planning logic reads these fields and never branches on a preset id.
// Adding a fifth system means adding an entry here, nothing else.

export const SYSTEMS = {
  backlog_tomorrow: {
    id: 'backlog_tomorrow',
    name: 'Backlog → Tomorrow',
    tagline: 'Keep a big backlog. Each evening, pick what tomorrow gets.',
    timeBlocking: false,
    dailyCap: null,
    showPriority: false,
    sortBy: 'manual',
    unfinished: 'tomorrow', // default answer to "push the rest, or let them go?"
  },
  time_blocker: {
    id: 'time_blocker',
    name: 'Time Blocker',
    tagline: 'Every task gets a clock time. Your day, laid out like a calendar.',
    timeBlocking: true,
    dailyCap: null,
    showPriority: false,
    sortBy: 'time',
    unfinished: 'backlog',
  },
  top_three: {
    id: 'top_three',
    name: 'Top 3',
    tagline: 'Three tasks a day, ranked. Nothing else gets in. Brutal, and it works.',
    timeBlocking: false,
    dailyCap: 3,
    showPriority: true,
    sortBy: 'manual',
    unfinished: 'backlog',
  },
};

export const DEFAULT_SYSTEM = 'backlog_tomorrow';

export const getSystem = (id) => SYSTEMS[id] || SYSTEMS[DEFAULT_SYSTEM];

export const systemList = () => Object.values(SYSTEMS);
