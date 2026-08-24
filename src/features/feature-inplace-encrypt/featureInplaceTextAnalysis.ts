import { Decryptable } from "./Decryptable.ts";
import {
	_HINT,
	_PREFIXES,
	_PREFIX_A, _PREFIX_A_VISIBLE,
	_PREFIX_B, _PREFIX_B_VISIBLE,
	_PREFIX_OBSOLETE, _PREFIX_OBSOLETE_VISIBLE,
	_SUFFIXES,
	_PREFIX_INLINE_OPEN, _PREFIX_INLINE_CLOSE,
	_INLINE_CIPHER_OPEN, _INLINE_CIPHER_CLOSE
} from "./FeatureInplaceConstants.ts";

export class FeatureInplaceTextAnalysis{
	processedText:string;
	isEmpty: boolean;

	prefix: string;
	suffix: string;

	hasObsoleteEncryptedPrefix: boolean;
	hasEncryptedPrefix: boolean;
	hasEncryptedSuffix: boolean;
	canDecrypt: boolean;
	canEncrypt: boolean;
	containsEncryptedMarkers: boolean;
	decryptable? : Decryptable;

	constructor(text: string){
		this.process(text);
	}

	private process( text: string ) : void{

		this.processedText = text;

		this.isEmpty = text.length === 0;

		this.prefix = _PREFIXES.find( (prefix) => text.startsWith(prefix) ) ?? '';
		this.suffix = _SUFFIXES.find( (suffix) => text.endsWith(suffix) ) ?? '';

		this.hasEncryptedPrefix = this.prefix.length > 0;
		this.hasEncryptedSuffix = this.suffix.length > 0;

		this.hasObsoleteEncryptedPrefix = this.prefix === _PREFIX_OBSOLETE || this.prefix === _PREFIX_OBSOLETE_VISIBLE;

		this.containsEncryptedMarkers = [..._PREFIXES, ..._SUFFIXES].some( (marker) => text.includes(marker ));

		this.canDecrypt = this.hasEncryptedPrefix && this.hasEncryptedSuffix;
		this.canEncrypt = !this.hasEncryptedPrefix && !this.containsEncryptedMarkers;

		// New inline format: encrypt(显示内容){密文}
		const inlineDecryptable = parseInlineEncryptFormat(text);
		if ( inlineDecryptable != null ){
			this.canDecrypt = true;
			this.canEncrypt = false;
			this.decryptable = inlineDecryptable;
			return;
		}

		if (this.canDecrypt){
			const decryptable = this.parseDecryptableContent(text);

			if ( decryptable != null ){
				this.decryptable = decryptable;
			}else{
				this.canDecrypt = false;
			}
		}
	}

	private parseDecryptableContent(text: string) : Decryptable | null {
		const result = new Decryptable();

		if (
			!this.hasEncryptedPrefix
			|| !this.hasEncryptedSuffix
		){
			return null; // invalid format
		}

		if ( this.hasObsoleteEncryptedPrefix ){
			result.version = 0;
		}else if ( this.prefix == _PREFIX_B || this.prefix == _PREFIX_B_VISIBLE ){
			result.version = 2;
		}else if ( this.prefix == _PREFIX_A || this.prefix == _PREFIX_A_VISIBLE ){
			result.version = 1;
		}

		// remove markers from start and end
		const content = text.substring(this.prefix.length, text.length - this.suffix.length);

		if ( [..._PREFIXES, ..._SUFFIXES].some( (marker) => content.includes( marker )) ){
			// content, itself has markers
			return null;
		}

		// check if there is a hint
		if (content.substring(0,_HINT.length) == _HINT){
			const endHintMarker = content.indexOf(_HINT,_HINT.length);
			if (endHintMarker<0){
				return null; // invalid format
			}
			result.hint = content.substring(_HINT.length,endHintMarker)
			result.base64CipherText = content.substring(endHintMarker+_HINT.length);
		}else{
			result.base64CipherText = content;
		}
		result.showInReadingView = !this.prefix.includes("%%");
		return result;

	}
}

/**
 * Parse the new inline format: `encrypt(显示内容){加密内容}`.
 *
 * Returns a Decryptable carrying the visible plaintext and the base64 cipher,
 * or null when the text does not match the format. The visible part is optional:
 * `encrypt(){密文}` is valid and falls back to the default visible text.
 */
export function parseInlineEncryptFormat(text: string): Decryptable | null {
	const trimmed = text;
	if ( !trimmed.startsWith(_PREFIX_INLINE_OPEN) ){
		return null;
	}

	const openIdx = _PREFIX_INLINE_OPEN.length; // index right after "encrypt("
	const closeIdx = trimmed.indexOf(_PREFIX_INLINE_CLOSE, openIdx);
	if ( closeIdx < 0 ){
		return null; // no closing ")" for the visible part
	}

	const visibleText = trimmed.substring(openIdx, closeIdx);

	// after ")" must come the cipher opener "{"
	if ( trimmed.charAt(closeIdx + 1) !== _INLINE_CIPHER_OPEN ){
		return null;
	}

	const cipherStart = closeIdx + 2; // index right after "{"
	const cipherEnd = trimmed.indexOf(_INLINE_CIPHER_CLOSE, cipherStart);
	if ( cipherEnd < 0 ){
		return null; // no closing "}"
	}

	const cipherText = trimmed.substring(cipherStart, cipherEnd);
	if ( cipherText.length === 0 ){
		return null; // empty cipher is invalid
	}

	// The suffix is "){...}" — we store only the marker's trailing portion so callers that
	// do string replacement (decrypt-in-place) can locate the exact substring without
	// swallowing the plain text that follows the cipher.
	const suffix = _PREFIX_INLINE_CLOSE + _INLINE_CIPHER_OPEN + cipherText + _INLINE_CIPHER_CLOSE; // "){加密内容}"

	const result = new Decryptable();
	result.version = 2; // new format uses the current default crypto helper
	result.visibleText = visibleText;
	result.base64CipherText = cipherText;
	result.hint = '';
	result.showInReadingView = true;
	// expose the full suffix so replacement helpers can match it
	(result as any)._inlineSuffix = suffix;
	return result;
}
