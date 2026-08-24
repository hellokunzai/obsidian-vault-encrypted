import { editorViewField } from "obsidian";
import { EditorView, ViewPlugin, WidgetType, Decoration, DecorationSet } from "@codemirror/view";
import { Extension } from "@codemirror/state";
import { t } from "../../i18n";
import { parseInlineEncryptFormat } from "./featureInplaceTextAnalysis.ts";
import { _PREFIX_INLINE_OPEN } from "./FeatureInplaceConstants.ts";
import { Decryptable } from "./Decryptable.ts";

/**
 * Live Preview (source mode) rendering for the new inline format
 * `encrypt(显示内容){加密内容}`.
 *
 * In Live Preview Obsidian does NOT run markdown post-processors, so the reading
 * view renderer is invisible here. This ViewPlugin scans the visible document
 * text, replaces each `encrypt(...){...}` block with a clickable widget that
 * shows the visible text, and on double-click opens the decrypt dialog.
 *
 * Decryption itself is delegated back to FeatureInplaceEncrypt via a callback so
 * that we reuse the exact same crypto + session-password + notice logic.
 */
export type InlineDecryptHandler = (
	sourcePath: string,
	decryptable: Decryptable,
	fullMarker: string
) => Promise<void>;

export class InlineEncryptLivePreview {
	/**
	 * Build the editor extension. `handler` is invoked on double-click of a
	 * rendered cipher widget; it should run the same flow as the reading view
	 * (password prompt → decrypt → show).
	 */
	static build(handler: InlineDecryptHandler): Extension {
		return ViewPlugin.fromClass(
			class {
				decorations: DecorationSet;

				constructor(view: EditorView) {
					this.decorations = buildDecorations(view);
				}

				update(update: ViewUpdateLike) {
					if (update.docChanged || update.viewportChanged || update.selectionSet) {
						this.decorations = buildDecorations(update.view);
					}
				}
			},
			{
				decorations: (v) => v.decorations,
				eventHandlers: {
					// Double-click triggers decryption (avoid clobbering the cursor on single click).
					dblclick: (ev: MouseEvent, view: EditorView) => {
						const target = ev.target as HTMLElement | null;
						const widgetEl = target?.closest(
							".meld-encrypt-inline-cipher"
						) as HTMLElement | null;
						if (widgetEl == null) return;

						const fullMarker = widgetEl.dataset["meldEncryptEncrypted"];
						if (fullMarker == null) return;

						const parsed = parseInlineEncryptFormat(fullMarker);
						if (parsed == null) return;

						const fileInfo = view.state.field(editorViewField);
						const sourcePath = fileInfo?.file?.path ?? "";

						ev.preventDefault();
						handler(sourcePath, parsed, fullMarker);
					},
				},
			}
		);
	}
}

// --- CodeMirror loose type aliases (avoid tight coupling to CM internals) ---
type ViewUpdateLike = {
	docChanged: boolean;
	viewportChanged: boolean;
	selectionSet: boolean;
	view: EditorView;
};

/**
 * Scan the current viewport for inline encrypt markers and produce a
 * DecorationSet that replaces each marker with a widget.
 */
function buildDecorations(view: EditorView): DecorationSet {
	const builder: { from: number; to: number; deco: Decoration }[] = [];

	const docText = view.state.doc;
	const viewport = view.visibleRanges;

	for (const range of viewport) {
		let from = range.from;
		while (from <= range.to) {
			const line = docText.lineAt(from);
			const lineText = line.text;

			let searchFrom = 0;
			while (searchFrom <= lineText.length) {
				const openIdx = lineText.indexOf(_PREFIX_INLINE_OPEN, searchFrom);
				if (openIdx < 0) break;

				const probe = lineText.substring(openIdx);
				const parsed = parseInlineEncryptFormat(probe);
				if (parsed == null) {
					searchFrom = openIdx + 1;
					continue;
				}

				const visible = parsed.visibleText && parsed.visibleText.length > 0
					? parsed.visibleText
					: t("inline.defaultVisible");
				const suffix = (parsed as any)._inlineSuffix as string;
				const fullMarker = _PREFIX_INLINE_OPEN + (parsed.visibleText ?? "") + suffix;

				const start = line.from + openIdx;
				const end = line.from + openIdx + fullMarker.length;

				const widget = new InlineCipherWidget(visible, fullMarker);
				builder.push({
					from: start,
					to: end,
					deco: Decoration.replace({ widget }),
				});

				searchFrom = openIdx + fullMarker.length;
			}

			if (line.to + 1 <= range.to) {
				from = line.to + 1;
			} else {
				break;
			}
		}
	}

	return Decoration.set(
		builder
			.sort((a, b) => a.from - b.from)
			.map((d) => d.deco.range(d.from, d.to)),
		true
	);
}

class InlineCipherWidget extends WidgetType {
	constructor(
		private visible: string,
		private fullMarker: string
	) {
		super();
	}

	eq(other: InlineCipherWidget): boolean {
		return other.visible === this.visible && other.fullMarker === this.fullMarker;
	}

	toDOM(_view: EditorView): HTMLElement {
		const label = '🔒 ' + this.visible;
		const el = document.createElement('span');
		el.className = "meld-encrypt-inline-cipher";
		el.textContent = label;
		el.dataset["meldEncryptEncrypted"] = this.fullMarker;
		el.dataset["meldEncryptVisible"] = this.visible;
		el.setAttribute("aria-label", t("inline.clickToView"));
		return el;
	}

	ignoreEvent(): boolean {
		// Return false so the view-level dblclick handler receives the event.
		return false;
	}
}
