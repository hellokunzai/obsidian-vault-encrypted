import { Notice, Setting } from "obsidian";
import { t } from "../../i18n";
import { IMeldEncryptPluginFeature } from "../IMeldEncryptPluginFeature.ts";
import MeldEncrypt from "../../main.ts";
import { IMeldEncryptPluginSettings } from "../../settings/MeldEncryptPluginSettings.ts";
import { IFeatureRandomPasswordSettings } from "./IFeatureRandomPasswordSettings.ts";
import RandomPasswordModal from "./RandomPasswordModal.ts";

export default class FeatureRandomPassword implements IMeldEncryptPluginFeature {
	plugin: MeldEncrypt;
	pluginSettings: IMeldEncryptPluginSettings;
	featureSettings: IFeatureRandomPasswordSettings;

	async onload(plugin: MeldEncrypt, settings: IMeldEncryptPluginSettings) {
		this.plugin = plugin;
		this.pluginSettings = settings;
		this.featureSettings = settings.featureRandomPassword;

		plugin.addCommand({
			id: "meld-encrypt-generate-password",
			name: t("command.generatePassword"),
			icon: "dice",
			callback: () => this.openModal(),
		});

		plugin.addRibbonIcon(
			"dice",
			t("ribbon.generatePassword"),
			(_) => this.openModal()
		);
	}

	private openModal() {
		const modal = new RandomPasswordModal(this.plugin.app, this.plugin, this.plugin.pluginSettings.featureRandomPassword);
		modal.open();
	}

	onunload(): void {
		// No persistent resources to clean up.
	}

	buildSettingsUi(containerEl: HTMLElement, saveSettingCallback: () => Promise<void>): void {
		containerEl.createEl("h3", { text: t("settings.randomPassword.heading") });
		containerEl.createEl("p", { text: t("settings.randomPassword.desc") });

		new Setting(containerEl)
			.setName(t("settings.randomPassword.length"))
			.setDesc(t("settings.randomPassword.lengthDesc"))
			.addText(text => text
				.setValue(this.featureSettings.length.toString())
				.setPlaceholder("16")
				.onChange(async value => {
					const parsed = parseInt(value, 10);
					this.featureSettings.length = isNaN(parsed) || parsed < 1 ? 16 : parsed;
					await saveSettingCallback();
				})
			);

		new Setting(containerEl)
			.setName(t("settings.randomPassword.includeUppercase"))
			.addToggle(toggle => toggle
				.setValue(this.featureSettings.upper)
				.onChange(async value => {
					this.featureSettings.upper = value;
					await saveSettingCallback();
				})
			);

		new Setting(containerEl)
			.setName(t("settings.randomPassword.includeLowercase"))
			.addToggle(toggle => toggle
				.setValue(this.featureSettings.lower)
				.onChange(async value => {
					this.featureSettings.lower = value;
					await saveSettingCallback();
				})
			);

		new Setting(containerEl)
			.setName(t("settings.randomPassword.includeNumbers"))
			.addToggle(toggle => toggle
				.setValue(this.featureSettings.number)
				.onChange(async value => {
					this.featureSettings.number = value;
					await saveSettingCallback();
				})
			);

		new Setting(containerEl)
			.setName(t("settings.randomPassword.includeSymbols"))
			.addToggle(toggle => toggle
				.setValue(this.featureSettings.symbol)
				.onChange(async value => {
					this.featureSettings.symbol = value;
					await saveSettingCallback();
				})
			);
	}
}
