import { TFile } from "obsidian";
import { t } from "../i18n";
import { MemoryCache } from "./MemoryCache.ts";
import { Utils } from "./Utils.ts";

export type PasswordAndHint = {
	password: string;
	hint: string;
}

export class SessionPasswordService{

	private static isActive = true;

	public static blankPasswordAndHint : PasswordAndHint = { password:'', hint:'' };

	private static cache = new MemoryCache<PasswordAndHint>();
	
	private static baseMinutesToExpire = 0;
	private static expiryTime : number | null = null;

	public static setActive( isActive: boolean ) {
		SessionPasswordService.isActive = isActive;
		if (!SessionPasswordService.isActive){
			this.clear();
		}
	}

	public static setAutoExpire( minutesToExpire:number | null ) : void{
		SessionPasswordService.baseMinutesToExpire = minutesToExpire ?? 0;
		SessionPasswordService.updateExpiryTime();
	}

	public static updateExpiryTime() : void {
		if (
			SessionPasswordService.baseMinutesToExpire == 0
			|| SessionPasswordService.baseMinutesToExpire == null
		){
			SessionPasswordService.expiryTime = null;
		} else {
			SessionPasswordService.expiryTime = Date.now() + SessionPasswordService.baseMinutesToExpire * 1000 * 60;
		}
	}

	/* ----------------------------------------------------------------- file */

	public static putByFile( pw: PasswordAndHint, file:TFile ): void {
		if (!SessionPasswordService.isActive){
			return;
		}
		const key = SessionPasswordService.getFileCacheKey( file );
		this.putByKey( key, pw );
		SessionPasswordService.updateExpiryTime();
	}

	public static async getByFile( file:TFile  ) : Promise<PasswordAndHint> {
		if (!SessionPasswordService.isActive){
			return SessionPasswordService.blankPasswordAndHint;
		}
		this.clearIfExpired();
		SessionPasswordService.updateExpiryTime();
		const key = SessionPasswordService.getFileCacheKey( file );
		return await this.getByKeyAsync( key, SessionPasswordService.blankPasswordAndHint );
	}

	public static clearForFile( file: TFile ) : void {
		const key = SessionPasswordService.getFileCacheKey( file );
		this.cache.removeKey( key );
	}

	/* --------------------------------------------------------------- path */

	/**
	 * Folder-level (no markerIndex) and inline-level (with markerIndex).
	 *
	 * - `markerIndex` given  → inline encryption: one remembered password per
	 *   marker, keyed by its position (0-based) in the file.
	 * - `markerIndex` omitted → folder-level: every note in the same folder
	 *   shares one remembered password.
	 */
	public static putByPath( pw: PasswordAndHint, path:string, markerIndex?: number ): void {
		if (!SessionPasswordService.isActive){
			return;
		}
		const key = SessionPasswordService.getPathCacheKey( path, markerIndex );
		this.putByKey( key, pw );
		SessionPasswordService.updateExpiryTime();
	}

	public static getByPath( path: string, markerIndex?: number ) : PasswordAndHint {
		if (!SessionPasswordService.isActive){
			return SessionPasswordService.blankPasswordAndHint;
		}
		this.clearIfExpired();
		SessionPasswordService.updateExpiryTime();
		const key = SessionPasswordService.getPathCacheKey( path, markerIndex );
		return this.getByKey( key, SessionPasswordService.blankPasswordAndHint );
	}

	public static async getByPathAsync( path: string, markerIndex?: number ) : Promise<PasswordAndHint> {
		if (!SessionPasswordService.isActive){
			return SessionPasswordService.blankPasswordAndHint;
		}
		this.clearIfExpired();
		SessionPasswordService.updateExpiryTime();
		const key = SessionPasswordService.getPathCacheKey( path, markerIndex );
		return await this.getByKeyAsync( key, SessionPasswordService.blankPasswordAndHint );
	}

	public static clearForPath( path: string, markerIndex?: number ) : void {
		if ( markerIndex != null && markerIndex >= 0 ){
			this.cache.removeKey( SessionPasswordService.getPathCacheKey( path, markerIndex ) );
			return;
		}
		// folder-level key + every inline marker key belonging to this file
		this.cache.removeKey( SessionPasswordService.getPathCacheKey( path ) );
		this.cache.removeKeysWithPrefix( `${path}#` );
	}

	/* ------------------------------------------------------------ keying */

	private static getPathCacheKey( path : string, markerIndex?: number ) : string {
		if ( markerIndex != null && markerIndex >= 0 ){
			// inline encryption: one password per marker, ordered by position
			return `${path}#${markerIndex}`;
		}
		// folder-level: share one password across all notes in the same folder
		const parentPath = path.split('/').slice(0,-1).join('/');
		return parentPath || '$root';
	}

	private static getFileCacheKey( file : TFile ) : string {
		// whole-note encryption: one password per file
		return Utils.getFilePathExcludingExtension( file );
	}

	/* ------------------------------------------------------------- infra */

	private static clearIfExpired() : void{
		if ( SessionPasswordService.expiryTime == null ){
			return;
		}
		if ( Date.now() < SessionPasswordService.expiryTime ){
			return;
		}
		this.clear();
	}

	public static clear(): number {
		const count = this.cache.getKeys().length;
		this.cache.clear();
		return count;
	}

	private static putByKey( key: string, pw: PasswordAndHint ) : void {
		this.cache.put( key, pw );
	}

	private static getByKey( key: string, defaultValue: PasswordAndHint ): PasswordAndHint {
		return this.cache.get( key, defaultValue );
	}

	public static async getByKeyAsync( key: string, defaultValue: PasswordAndHint ): Promise<PasswordAndHint> {
		return this.cache.get( key, defaultValue );
	}
}
