import axios, { AxiosInstance } from 'axios';
import * as crypto from 'crypto';
import * as qs from 'querystring';
import { XMLParser } from 'fast-xml-parser';
import { settingsManager } from './settings';
import { Album, Track, StreamUrl } from './model';
import { DashParser } from './dash';

const BASE_URL = 'https://api.tidalhifi.com/v1/';
const AUTH_URL = 'https://auth.tidal.com/v1/oauth2';
const CLIENT_ID = '7m7Ap0JC9j1cOM3n';
const CLIENT_SECRET = 'vRAdA108tlvkJpTsGZS8rGZ7xTlbJ0qaZ2K9saEzsgY=';

export class TidalAPI {
    private api: AxiosInstance;

    constructor() {
        this.api = axios.create({
            baseURL: BASE_URL,
        });

        this.api.interceptors.request.use((config) => {
            if (settingsManager.token.accessToken) {
                config.headers['Authorization'] = `Bearer ${settingsManager.token.accessToken}`;
            }
            return config;
        });

        this.api.interceptors.response.use(
            (response) => response,
            async (error) => {
                const originalRequest = error.config;
                if (error.response?.status === 401 && !originalRequest._retry) {
                    originalRequest._retry = true;
                    console.log('Token expired, refreshing...');
                    const refreshed = await this.refreshAccessToken();
                    if (refreshed) {
                        console.log('Token refreshed successfully');
                        originalRequest.headers['Authorization'] = `Bearer ${settingsManager.token.accessToken}`;
                        return this.api(originalRequest);
                    } else {
                        console.log('Token refresh failed');
                    }
                }
                return Promise.reject(error);
            }
        );
    }

    public async getDeviceCode() {
        const response = await axios.post(`${AUTH_URL}/device_authorization`, qs.stringify({
            client_id: CLIENT_ID,
            scope: 'r_usr w_usr w_sub',
        }), {
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
        });
        return response.data;
    }

    public async checkDeviceCode(deviceCode: string) {
        try {
            const response = await axios.post(`${AUTH_URL}/token`, qs.stringify({
                client_id: CLIENT_ID,
                client_secret: CLIENT_SECRET,
                grant_type: 'urn:ietf:params:oauth:grant-type:device_code',
                device_code: deviceCode,
                scope: 'r_usr w_usr w_sub',
            }), {
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
            });
            
            if (response.data.access_token) {
                settingsManager.token.accessToken = response.data.access_token;
                settingsManager.token.refreshToken = response.data.refresh_token;
                settingsManager.token.expiresAfter = Date.now() + response.data.expires_in * 1000;
                settingsManager.token.userid = response.data.user.userId;
                settingsManager.token.countryCode = response.data.user.countryCode;
                settingsManager.saveToken();
                return true;
            }
        } catch (e) {
            // Pending or error
        }
        return false;
    }

    public async refreshAccessToken() {
        if (!settingsManager.token.refreshToken) return false;
        try {
            const response = await axios.post(`${AUTH_URL}/token`, qs.stringify({
                client_id: CLIENT_ID,
                client_secret: CLIENT_SECRET,
                grant_type: 'refresh_token',
                refresh_token: settingsManager.token.refreshToken,
            }), {
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
            });

            if (response.data.access_token) {
                settingsManager.token.accessToken = response.data.access_token;
                settingsManager.token.expiresAfter = Date.now() + response.data.expires_in * 1000;
                settingsManager.saveToken();
                return true;
            }
        } catch (e) {
            console.error('Failed to refresh token', e);
        }
        return false;
    }

    public getCoverUrl(coverId: string): string {
        const parts = coverId.split('-');
        return `https://resources.tidal.com/images/${parts.join('/')}/1280x1280.jpg`;
    }

    public async search(query: string, type: 'TRACKS' | 'ALBUMS' | 'ARTISTS' | 'PLAYLISTS', limit: number = 10) {
        const response = await this.api.get('search', {
            params: {
                query,
                types: type,
                limit,
                countryCode: settingsManager.token.countryCode || 'US',
            }
        });
        return response.data;
    }

    public async getTrack(id: number): Promise<Track> {
        const response = await this.api.get(`tracks/${id}`, {
            params: { countryCode: settingsManager.token.countryCode || 'US' }
        });
        return response.data;
    }

    public async getAlbum(id: number): Promise<Album> {
        const response = await this.api.get(`albums/${id}`, {
            params: { countryCode: settingsManager.token.countryCode || 'US' }
        });
        return response.data;
    }

    public async getAlbumTracks(id: number): Promise<Track[]> {
        const response = await this.api.get(`albums/${id}/tracks`, {
            params: { 
                countryCode: settingsManager.token.countryCode || 'US',
                limit: 100
            }
        });
        return response.data.items;
    }

    public async getStreamUrl(id: number): Promise<StreamUrl> {
        const response = await this.api.get(`tracks/${id}/playbackinfopostpaywall`, {
            params: {
                countryCode: settingsManager.token.countryCode || 'US',
                audioquality: settingsManager.settings.audioQuality,
                playbackmode: 'STREAM',
                assetpresentation: 'FULL',
            }
        });
        
        const manifestMimeType = response.data.manifestMimeType;
        let url = '';
        let urls: string[] = [];
        let codec = '';
        let encryptionKey = '';
        console.log(response.data)
        if (manifestMimeType.includes('vnd.tidal.bt')) {
            const manifest = JSON.parse(Buffer.from(response.data.manifest, 'base64').toString('utf-8'));
            url = manifest.urls[0];
            urls = manifest.urls;
            codec = manifest.codecs;
            encryptionKey = manifest.keyId ? manifest.keyId : response.data.encryptionKey;
        } else if (manifestMimeType.includes('dash+xml')) {
            const xml = Buffer.from(response.data.manifest, 'base64').toString('utf-8');
            const dashParser = new DashParser();
            urls = dashParser.parse(xml);
            if (urls.length > 0) {
                url = urls[0];
            }

            const codecMatch = /codecs="(.*?)"/.exec(xml);
            if (codecMatch) {
                codec = codecMatch[1];
            }
        }
        
        if (!url && urls.length === 0) {
            throw new Error('Could not extract stream URL from manifest');
        }
        
        return {
            trackId: id,
            url: url,
            urls: urls,
            codec: codec,
            encryptionKey: encryptionKey,
            soundQuality: settingsManager.settings.audioQuality,
        };
    }
}

export const tidalAPI = new TidalAPI();
