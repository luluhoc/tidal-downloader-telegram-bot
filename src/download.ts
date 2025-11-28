import axios from 'axios';
import * as fs from 'fs';
import * as path from 'path';
import { StreamUrl, Track, Album } from './model';
import { decryptFile, decryptSecurityToken } from './decryption';
import { tidalAPI } from './tidal';
import { settingsManager } from './settings';

export async function downloadTrack(track: Track, album: Album): Promise<string> {
    try {
        const streamUrl = await tidalAPI.getStreamUrl(track.id);
        
        const artistName = track.artist.name.replace(/[\\/:*?"<>|]/g, '_');
        const albumTitle = album.title.replace(/[\\/:*?"<>|]/g, '_');
        const trackTitle = track.title.replace(/[\\/:*?"<>|]/g, '_');
        
        const albumPath = path.join(settingsManager.settings.downloadPath, artistName, albumTitle);
        if (!fs.existsSync(albumPath)) {
            fs.mkdirSync(albumPath, { recursive: true });
        }

        const filename = `${track.trackNumber} - ${trackTitle}.flac`; // Assuming FLAC for now
        const filePath = path.join(albumPath, filename);
        const tempPath = filePath + '.tmp';

        console.log(`Downloading ${track.title}...`);

        const urls = streamUrl.urls && streamUrl.urls.length > 0 ? streamUrl.urls : [streamUrl.url];
        const writer = fs.createWriteStream(tempPath);

        for (const url of urls) {
            const response = await axios({
                url: url,
                method: 'GET',
                responseType: 'stream',
            });

            response.data.pipe(writer, { end: false });

            await new Promise<void>((resolve, reject) => {
                response.data.on('end', () => resolve());
                response.data.on('error', reject);
            });
        }

        writer.end();
        await new Promise<void>((resolve, reject) => {
            writer.on('finish', () => resolve());
            writer.on('error', reject);
        });

        if (streamUrl.encryptionKey) {
            console.log(`Decrypting ${track.title}...`);
            const { key, nonce } = decryptSecurityToken(streamUrl.encryptionKey);
            await decryptFile(tempPath, filePath, key, nonce);
            fs.unlinkSync(tempPath);
        } else {
            fs.renameSync(tempPath, filePath);
        }

        // TODO: Add metadata (cover art, tags)
        
        return filePath;
    } catch (e) {
        console.error(`Error downloading track ${track.title}:`, e);
        throw e;
    }
}
