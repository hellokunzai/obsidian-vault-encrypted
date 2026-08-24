
export const ENCRYPTED_ICON = '🔐';
export const _PREFIX_B = '%%🔐β ';
export const _PREFIX_B_VISIBLE = '🔐β ';

export const _PREFIX_A = '%%🔐α ';
export const _PREFIX_A_VISIBLE = '🔐α ';
export const _PREFIX_OBSOLETE = '%%🔐 ';
export const _PREFIX_OBSOLETE_VISIBLE = '🔐 ';

export const _PREFIX_ENCODE_DEFAULT = _PREFIX_B;
export const _PREFIX_ENCODE_DEFAULT_VISIBLE = _PREFIX_B_VISIBLE;

// Should be listed by evaluation priority
export const _PREFIXES = [
	_PREFIX_B,
	_PREFIX_B_VISIBLE,
	_PREFIX_A,
	_PREFIX_A_VISIBLE,
	_PREFIX_OBSOLETE,
	_PREFIX_OBSOLETE_VISIBLE
];

export const _SUFFIX_WITH_COMMENT = ' 🔐%%';
export const _SUFFIX_NO_COMMENT = ' 🔐';

// Should be listed by evaluation priority
export const _SUFFIXES = [
	_SUFFIX_WITH_COMMENT,
	_SUFFIX_NO_COMMENT
]

export const _HINT = '💡';

// --- New inline format: encrypt(显示内容){加密内容} ---
// `encrypt(` ... `)` holds the visible plaintext hint; `{` ... `}` holds the base64 cipher text.
export const _PREFIX_INLINE_OPEN = 'encrypt(';
export const _PREFIX_INLINE_CLOSE = ')';
export const _INLINE_CIPHER_OPEN = '{';
export const _INLINE_CIPHER_CLOSE = '}';

// Fallback visible text when the user provides no display content.
export const _INLINE_DEFAULT_VISIBLE = '加密内容';

// Combined list of all recognized prefix markers (old + new) for scanning.
export const _ALL_PREFIX_MARKERS = [
	..._PREFIXES,
	_PREFIX_INLINE_OPEN
];

// Combined list of all recognized suffix markers (old + new) for scanning.
export const _ALL_SUFFIX_MARKERS = [
	..._SUFFIXES,
	_PREFIX_INLINE_CLOSE + _INLINE_CIPHER_CLOSE
];