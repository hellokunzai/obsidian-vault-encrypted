import MeldEncrypt from "../../main.ts";
import { t } from "../../i18n";
import { IMeldEncryptPluginSettings } from "../../settings/MeldEncryptPluginSettings.ts";
import { IMeldEncryptPluginFeature } from "../IMeldEncryptPluginFeature.ts";
import { Setting, TFile, TFolder } from "obsidian";
import { FolderEncryptModal } from "./FolderEncryptModal.ts";

export default class FeatureFolderEncrypt implements IMeldEncryptPluginFeature {

	plugin!: MeldEncrypt;
	featureSettings!: IMeldEncryptPluginSettings["featureFolderEncrypt"];

	async onload(plugin: MeldEncrypt, settings: IMeldEncryptPluginSettings) {
		this.plugin = plugin;
		this.featureSettings = settings.featureFolderEncrypt;

		// Right-click a folder in the file explorer → encrypt / decrypt it.
		//
		// We hook BOTH `folder-menu` and `file-menu` because Obsidian's file
		// explorer right-click on a folder only fires `file-menu` with a
		// TFolder payload — `folder-menu` is documented but does not actually
		// trigger in the file explorer. Registering only `folder-menu` results
		// in a missing menu item, even though the code "looks right".
		const addFolderMenuItems = (menu: any, folder: TFolder) => {
			menu.addItem((item: any) => {
				item
					.setTitle(t("menu.encryptFolder"))
					.setIcon("lock")
					.onClick(() => {
						new FolderEncryptModal(this.plugin.app, this.plugin, folder.path, "encrypt").open();
					});
			});
			menu.addItem((item: any) => {
				item
					.setTitle(t("menu.decryptFolder"))
					.setIcon("key")
					.onClick(() => {
						new FolderEncryptModal(this.plugin.app, this.plugin, folder.path, "decrypt").open();
					});
			});
		};

		// folder-menu (kept for completeness; few versions actually fire this).
		this.plugin.registerEvent(
			this.plugin.app.workspace.on(
				"folder-menu" as any,
				(menu: any, folder: TFolder) => addFolderMenuItems(menu, folder)
			)
		);

		// file-menu fires for both files and folders in the file explorer;
		// only contribute menu items when the target is a folder.
		this.plugin.registerEvent(
			this.plugin.app.workspace.on(
				"file-menu",
				(menu: any, file: any) => {
					if (file instanceof TFolder) {
						addFolderMenuItems(menu, file);
					}
				}
			)
		);

		// Command: act on the folder of the currently active file.
		this.plugin.addCommand({
			id: "meld-encrypt-folder-encrypt",
			name: t("command.folderEncrypt"),
			callback: () => {
				const file = this.plugin.app.workspace.getActiveFile();
				const folderPath = file?.parent?.path
					?? (file?.parent ? file.parent.path : "/");
				new FolderEncryptModal(this.plugin.app, this.plugin, folderPath, "encrypt").open();
			},
		});

		this.plugin.addCommand({
			id: "meld-encrypt-folder-decrypt",
			name: t("command.folderDecrypt"),
			callback: () => {
				const file = this.plugin.app.workspace.getActiveFile();
				const folderPath = file?.parent?.path
					?? (file?.parent ? file.parent.path : "/");
				new FolderEncryptModal(this.plugin.app, this.plugin, folderPath, "decrypt").open();
			},
		});
	}

	onunload(): void { }

	buildSettingsUi(containerEl: HTMLElement, saveSettingCallback: () => Promise<void>): void {
		containerEl.createEl("h3", { text: t("settings.folderEncrypt.heading") });
		containerEl.createEl("p", { text: t("settings.folderEncrypt.desc") });

		new Setting(containerEl)
			.setName(t("settings.folderEncrypt.recursive.name"))
			.setDesc(t("settings.folderEncrypt.recursive.desc"))
			.addToggle(toggle => toggle
				.setValue(this.featureSettings.recursive)
				.onChange(async value => {
					this.featureSettings.recursive = value;
					await saveSettingCallback();
				})
			);
	}
}
