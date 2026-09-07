interface VaultWithConfig {
	getConfig(key: string): unknown;
}

function getVaultConfigBoolean(key: string, defaultValue: boolean): boolean {
	const value = (app.vault as unknown as VaultWithConfig).getConfig(key);
	return typeof value === 'boolean' ? value : defaultValue;
}

export class ObsidianEx {

	public static get showInlineTitle(): boolean {
		return getVaultConfigBoolean('showInlineTitle', true);
	}

	public static get readableLineLength(): boolean {
		return getVaultConfigBoolean('readableLineLength', true);
	}

}