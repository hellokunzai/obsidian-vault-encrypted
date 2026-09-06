import { App, Modal, Notice, Setting, TFolder } from "obsidian";
import MeldEncrypt from "../../main.ts";
import { t } from "../../i18n";
import { PasswordAndHint, SessionPasswordService } from "../../services/SessionPasswordService.ts";
import PluginPasswordModal from "../../PluginPasswordModal.ts";
import { FolderBulkService, IFolderBulkResult } from "./FolderBulkService.ts";
import { FolderMarkService } from "./FolderMarkService.ts";
import { EncryptedIconService } from "../../services/EncryptedIconService.ts";

export type FolderEncryptMode = "encrypt" | "decrypt";

/**
 * Modal that lets the user pick a folder, choose a mode (encrypt / decrypt),
 * toggle recursion, then runs the bulk operation.
 */
export class FolderEncryptModal extends Modal {

	private mode: FolderEncryptMode;
	private folderPath: string;
	private recursive: boolean;
	private running = false;
	private readonly plugin: MeldEncrypt;

	constructor(app: App, plugin: MeldEncrypt, folderPath: string, mode: FolderEncryptMode) {
		super(app);
		this.plugin = plugin;
		this.folderPath = folderPath;
		this.mode = mode;
		this.recursive = plugin.pluginSettings.featureFolderEncrypt?.recursive ?? true;
	}

	onOpen(): void {
		const { contentEl } = this;
		contentEl.empty();

		contentEl.createEl("h2", { text: t(this.mode === "encrypt" ? "modal.folderEncrypt.titleEncrypt" : "modal.folderEncrypt.titleDecrypt") });

		// Folder path
		new Setting(contentEl)
			.setName(t("modal.folderEncrypt.folder"))
			.setDesc(t("modal.folderEncrypt.folderDesc"))
			.addText(text => text
				.setPlaceholder(t("modal.folderEncrypt.folderPlaceholder"))
				.setValue(this.folderPath)
				.onChange(value => {
					this.folderPath = value.trim();
				})
			);

		// Mode toggle
		new Setting(contentEl)
			.setName(t("modal.folderEncrypt.mode"))
			.setDesc(t("modal.folderEncrypt.modeDesc"))
			.addDropdown(dropdown => dropdown
				.addOption("encrypt", t("modal.folderEncrypt.modeEncrypt"))
				.addOption("decrypt", t("modal.folderEncrypt.modeDecrypt"))
				.setValue(this.mode)
				.onChange(value => {
					this.mode = value as FolderEncryptMode;
				})
			);

		// Recursion toggle
		new Setting(contentEl)
			.setName(t("modal.folderEncrypt.recursive"))
			.setDesc(t("modal.folderEncrypt.recursiveDesc"))
			.addToggle(toggle => toggle
				.setValue(this.recursive)
				.onChange(value => {
					this.recursive = value;
				})
			);

		// Run button
		new Setting(contentEl)
			.addButton(button => button
				.setButtonText(t("modal.folderEncrypt.run"))
				.setCta()
				.onClick(() => void this.run())
			)
			.addButton(button => button
				.setButtonText(t("modal.folderEncrypt.cancel"))
				.onClick(() => this.close())
			);
	}

	onClose(): void {
		this.contentEl.empty();
	}

	private async run(): Promise<void> {
		if (this.running) {
			return;
		}

		const abstractFile = this.app.vault.getAbstractFileByPath(this.folderPath);
		if (!(abstractFile instanceof TFolder)) {
			new Notice(t("notice.folderNotFound"), 10000);
			return;
		}

		const files = this.mode === "encrypt"
			? FolderBulkService.collectPlainNotes(abstractFile, this.recursive)
			: FolderBulkService.collectEncryptedNotes(abstractFile, this.recursive);
		if (files.length === 0) {
			new Notice(t("notice.folderNoMatchingFiles"), 8000);
			return;
		}

		// Single password for the whole folder
		const passwordAndHint: PasswordAndHint = await SessionPasswordService.getByFile(files[0]);
		if (passwordAndHint.password == "") {
			const pm = new PluginPasswordModal(
				this.app,
				t(this.mode === "encrypt" ? "modal.folderEncrypt.passwordTitleEncrypt" : "modal.folderEncrypt.passwordTitleDecrypt"),
				this.mode === "encrypt",
				this.mode === "encrypt" && this.plugin.pluginSettings.confirmPassword,
				passwordAndHint
			);
			const result = await pm.openAsync();
			if (!pm.resultConfirmed) {
				return;
			}
			passwordAndHint.password = result.password;
			passwordAndHint.hint = result.hint;
		}

		this.running = true;
		this.contentEl.empty();
		this.contentEl.createEl("h2", { text: t("modal.folderEncrypt.processing") });

		const summaryEl = this.contentEl.createEl("pre", {
			text: t("modal.folderEncrypt.progress", { done: "0", total: files.length.toString() })
		});
		summaryEl.style.whiteSpace = "pre-wrap";

		let result: IFolderBulkResult = { succeeded: 0, skipped: 0, failed: 0, failedFiles: [] };

		const onProgress = (res: IFolderBulkResult, done: number, total: number) => {
			result = res;
			summaryEl.setText(
				t("modal.folderEncrypt.progress", { done: done.toString(), total: total.toString() })
				+ "\n" + t("modal.folderEncrypt.summary", {
					succeeded: res.succeeded.toString(),
					skipped: res.skipped.toString(),
					failed: res.failed.toString()
				})
			);
		};

		result = this.mode === "encrypt"
			? await FolderBulkService.encrypt(this.plugin, abstractFile, this.recursive, passwordAndHint, onProgress)
			: await FolderBulkService.decrypt(this.plugin, abstractFile, this.recursive, passwordAndHint, onProgress);

		this.running = false;

		// A folder that now contains encrypted files carries the "encrypted"
		// mark: new notes are auto-encrypted and the file explorer shows the
		// lock icon. Without this the folder icon would stay unchanged after
		// a bulk encrypt (the decrypt branch below removes the mark again).
		if (this.mode === "encrypt" && result.succeeded > 0) {
			const normalizedPath = FolderMarkService.normalizeFolderPath(this.folderPath);
			const wasMarked = FolderMarkService.isMarked(normalizedPath);
			FolderMarkService.addMark({
				path: normalizedPath,
				hint: passwordAndHint.hint,
				recursive: this.recursive
			});
			FolderMarkService.putPassword(normalizedPath, passwordAndHint);
			await this.plugin.saveSettings();
			EncryptedIconService.refresh();
			if (!wasMarked) {
				new Notice(t("notice.folderMarked", { path: normalizedPath }));
			}
		}

		// A fully decrypted folder becomes a normal folder again: drop its
		// encrypted-folder mark (if any) so new notes are no longer
		// auto-encrypted and the lock icon disappears. Partial failures keep
		// the mark — the folder still contains encrypted files.
		if (this.mode === "decrypt" && result.succeeded > 0 && result.failed === 0) {
			if (FolderMarkService.removeMark(this.folderPath)) {
				await this.plugin.saveSettings();
				EncryptedIconService.refresh();
				new Notice(t("notice.folderUnmarked", {
					path: FolderMarkService.normalizeFolderPath(this.folderPath)
				}));
			}
		}

		// Final summary notice
		new Notice(t("notice.folderEncryptSummary", {
			succeeded: result.succeeded.toString(),
			skipped: result.skipped.toString(),
			failed: result.failed.toString()
		}), 15000);

		if (result.failed > 0) {
			this.contentEl.createEl("h3", { text: t("modal.folderEncrypt.failedListTitle") });
			const listEl = this.contentEl.createEl("pre", { text: result.failedFiles.join("\n") });
			listEl.style.whiteSpace = "pre-wrap";
		}

		new Setting(this.contentEl)
			.addButton(button => button
				.setButtonText(t("modal.folderEncrypt.done"))
				.setCta()
				.onClick(() => this.close())
			);
	}

}
