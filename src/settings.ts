import * as fs from 'fs';
import * as path from 'path';

export enum AudioQuality {
    Normal = 'LOW',
    High = 'HIGH',
    HiFi = 'LOSSLESS',
    Master = 'HI_RES',
}

export interface ISettings {
    audioQuality: AudioQuality;
    downloadPath: string;
    saveCovers: boolean;
    // Add other settings as needed
}

export interface IToken {
    userid: string | null;
    countryCode: string | null;
    accessToken: string | null;
    refreshToken: string | null;
    expiresAfter: number;
}

const SETTINGS_FILE = 'settings.json';
const TOKEN_FILE = 'token.json';

export class SettingsManager {
    public settings: ISettings;
    public token: IToken;

    constructor() {
        this.settings = {
            audioQuality: AudioQuality.High,
            downloadPath: './downloads',
            saveCovers: true,
        };
        this.token = {
            userid: null,
            countryCode: null,
            accessToken: null,
            refreshToken: null,
            expiresAfter: 0,
        };
        this.loadSettings();
        this.loadToken();
    }

    public loadSettings() {
        if (fs.existsSync(SETTINGS_FILE)) {
            const data = fs.readFileSync(SETTINGS_FILE, 'utf-8');
            Object.assign(this.settings, JSON.parse(data));
        }
    }

    public saveSettings() {
        fs.writeFileSync(SETTINGS_FILE, JSON.stringify(this.settings, null, 4));
    }

    public loadToken() {
        if (fs.existsSync(TOKEN_FILE)) {
            const data = fs.readFileSync(TOKEN_FILE, 'utf-8');
            try {
                // Python code base64 encodes the whole JSON string
                const decoded = Buffer.from(data, 'base64').toString('utf-8');
                Object.assign(this.token, JSON.parse(decoded));
            } catch (e) {
                console.error('Error loading token:', e);
            }
        }
    }

    public saveToken() {
        const data = JSON.stringify(this.token);
        const encoded = Buffer.from(data).toString('base64');
        fs.writeFileSync(TOKEN_FILE, encoded);
    }
}

export const settingsManager = new SettingsManager();
