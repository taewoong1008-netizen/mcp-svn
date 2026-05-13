// ===== TIPOS BASE =====
export class SvnError extends Error {
    code;
    stderr;
    command;
    constructor(message) {
        super(message);
        this.name = 'SvnError';
    }
}
// ===== CONSTANTES =====
export const SVN_STATUS_CODES = {
    ' ': 'none',
    'A': 'added',
    'D': 'deleted',
    'M': 'modified',
    'R': 'replaced',
    'C': 'conflicted',
    'X': 'external',
    'I': 'ignored',
    '?': 'unversioned',
    '!': 'missing',
    '~': 'obstructed'
};
export const SVN_ACTION_CODES = {
    'A': 'added',
    'D': 'deleted',
    'M': 'modified',
    'R': 'replaced'
};
//# sourceMappingURL=types.js.map