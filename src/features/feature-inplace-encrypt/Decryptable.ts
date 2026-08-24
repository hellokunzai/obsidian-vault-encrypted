export class Decryptable{
	version: number;
	base64CipherText:string;
	hint:string;
	showInReadingView: boolean;
	/** Visible plaintext shown to the user in reading/LP view (new encrypt(...) format only). */
	visibleText?: string;
}