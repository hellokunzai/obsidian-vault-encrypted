import { App, Modal, Notice, Setting, TFile, TFolder } from "obsidian";
import MeldEncrypt from "../../main.ts";
import { t } from "../../i18n";
import { ENCRYPTED_FILE_EXTENSIONS, ENCRYPTED_FILE_EXTENSION_DEFAULT } from "../../services/Constants.ts";
import { FileEncryptHelper } from "../../services/FileEncryptHelper.ts";
import { PasswordAndHint, SessionPasswordService } from "../../services/SessionPasswordService.ts";
import PluginPasswordModal from "../../PluginPasswordModal.ts";

export type FolderEncryptMode = "encrypt" | "decrypt";

interface FolderEncryptResult {
	succeeded: number;
	skipped: number;
	failed: number;
	failedFiles: string[];
}

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

	private collectFiles(folder: TFolder, recursive: boolean, targetExtensions: string[]): TFile[] {
		const result: TFile[] = [];
		for (const child of folder.children) {
			if (child instanceof TFolder) {
				if (recursive) {
					result.push(...this.collectFiles(child, recursive, targetExtensions));
				}
			} else if (child instanceof TFile) {
				if (targetExtensions.contains(child.extension)) {
					result.push(child);
				}
			}
		}
		return result;
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

		const targetExtensions = this.mode === "encrypt"
			? ["md"]
			: ENCRYPTED_FILE_EXTENSIONS.slice();

		const files = this.collectFiles(abstractFile, this.recursive, targetExtensions);
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
				this.mode === "encrypt",
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

		const result: FolderEncryptResult = { succeeded: 0, skipped: 0, failed: 0, failedFiles: [] };

		for (let i = 0; i < files.length; i++) {
			const file = files[i];
			try {
				if (this.mode === "encrypt") {
					await this.encryptOne(file, passwordAndHint);
				} else {
					await this.decryptOne(file, passwordAndHint);
				}
				result.succeeded++;
			} catch (error) {
				result.failed++;
				result.failedFiles.push(file.path);
			}
			summaryEl.setText(
				t("modal.folderEncrypt.progress", { done: (i + 1).toString(), total: files.length.toString() })
				+ "\n" + t("modal.folderEncrypt.summary", {
					succeeded: result.succeeded.toString(),
					skipped: result.skipped.toString(),
					failed: result.failed.toString()
				})
			);
		}

		this.running = false;

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

	private async encryptOne(file: TFile, passwordAndHint: PasswordAndHint): Promise<void> {
		const encryptedContent = await FileEncryptHelper.encryptFile(this.plugin, file, passwordAndHint);
		await FileEncryptHelper.closeUpdateRememberPasswordThenReopen(
			this.plugin,
			file,
			ENCRYPTED_FILE_EXTENSION_DEFAULT,
			encryptedContent,
			passwordAndHint
		);
	}

	private async decryptOne(file: TFile, passwordAndHint: PasswordAndHint): Promise<void> {
		const content = await FileEncryptHelper.decryptFile(this.plugin, file, passwordAndHint.password);
		if (content == null) {
			throw new Error(t("error.decryptionFailed"));
		}
		await FileEncryptHelper.closeUpdateRememberPasswordThenReopen(
			this.plugin,
			file,
			"md",
			content,
			passwordAndHint
		);
	}
}
