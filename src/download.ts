import axios from 'axios';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import ffmpeg from 'fluent-ffmpeg';
import ffmpegPath from 'ffmpeg-static';
import { StreamUrl, Track, Album } from './model';

if (ffmpegPath) {
    ffmpeg.setFfmpegPath(ffmpegPath);
}
import { decryptFile, decryptSecurityToken } from './decryption';
import { tidalAPI } from './tidal';
import { settingsManager } from './settings';

export async function downloadTrack(track: Track, album: Album): Promise<string> {
    try {
        const streamUrl = await tidalAPI.getStreamUrl(track.id);
        
        const artistName = track.artist.name.replace(/[\\/:*?"<>|$\.]/g, '_');
        const albumTitle = album.title.replace(/[\\/:*?"<>|$\.]/g, '_');
        const trackTitle = track.title.replace(/[\\/:*?"<>|$\.]/g, '_');
        
        const albumPath = path.resolve(settingsManager.settings.downloadPath, artistName, albumTitle);
        if (!fs.existsSync(albumPath)) {
            fs.mkdirSync(albumPath, { recursive: true });
        }

        const ext = 'mp3';
        /*
        let ext = 'flac';
        if (streamUrl.codec === 'eac3' || streamUrl.codec === 'mp4a.40.2' || streamUrl.codec === 'mp4a.40.5') {
            ext = 'mp4';
        }
        */

        const filename = `${track.trackNumber} - ${trackTitle}.${ext}`;
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

        // Add metadata (cover art, tags)
        console.log(`Tagging ${track.title}...`);
        
        const coverUrl = tidalAPI.getCoverUrl(album.cover);
        const coverPath = path.join(albumPath, 'cover.jpg');
        
        // Download cover if it doesn't exist
        if (!fs.existsSync(coverPath)) {
            try {
                const response = await axios({
                    url: coverUrl,
                    method: 'GET',
                    responseType: 'stream',
                });
                const coverWriter = fs.createWriteStream(coverPath);
                response.data.pipe(coverWriter);
                await new Promise<void>((resolve, reject) => {
                    coverWriter.on('finish', resolve);
                    coverWriter.on('error', reject);
                });
            } catch (e) {
                console.error('Error downloading cover art:', e);
            }
        }

        // Use system temp directory for the tagged file to avoid path issues
        // Normalize path to forward slashes for ffmpeg on Windows
        const taggedPath = path.join(os.tmpdir(), `temp_${Date.now()}_tagged.${ext}`).replace(/\\/g, '/');
        
        try {
            // Verify input file exists
            if (!fs.existsSync(filePath)) {
                throw new Error(`Input file not found: ${filePath}`);
            }

            await new Promise<void>((resolve, reject) => {
                const command = ffmpeg(filePath);

                if (fs.existsSync(coverPath)) {
                    command.input(coverPath)
                    .outputOptions(
                        '-map', '0', 
                        '-map', '1',
                        '-c:v', 'copy',
                        '-disposition:v:0', 'attached_pic',
                        '-c:a', 'libmp3lame',
                        '-b:a', '320k',
                        '-id3v2_version', '3'
                    );
                } else {
                    command.outputOptions(
                        '-c:a', 'libmp3lame',
                        '-b:a', '320k',
                        '-id3v2_version', '3'
                    );
                }

                // Simple sanitize: remove double quotes to avoid command line issues
                const sanitize = (str: string) => {
                    if (!str) return '';
                    return str.replace(/"/g, '');
                };

                command.outputOptions('-y');
                command.outputOptions('-strict', '-2'); // Allow experimental codecs if needed

                // Add metadata
                command.outputOptions('-metadata', `title=${sanitize(track.title)}`);
                command.outputOptions('-metadata', `artist=${sanitize(track.artist.name)}`);
                command.outputOptions('-metadata', `album=${sanitize(album.title)}`);
                command.outputOptions('-metadata', `track=${track.trackNumber}`);
                command.outputOptions('-metadata', `disc=${track.volumeNumber}`);
                command.outputOptions('-metadata', `date=${album.releaseDate}`);

                command
                    .on('start', (cmd) => console.log('FFmpeg command:', cmd))
                    .save(taggedPath)
                    .on('end', () => resolve())
                    .on('error', (err) => {
                        console.error('FFmpeg error:', err);
                        reject(err);
                    });
            });

            // Replace original file with tagged file
            if (fs.existsSync(filePath)) {
                fs.unlinkSync(filePath);
            }
            
            // Move from temp to final destination
            fs.copyFileSync(taggedPath, filePath);
            fs.unlinkSync(taggedPath);
            
        } catch (e) {
            console.error('Error tagging file:', e);
            if (taggedPath && fs.existsSync(taggedPath)) {
                try { fs.unlinkSync(taggedPath); } catch (err) {}
            }
            // Keep the original file if tagging fails
        }
        
        return filePath;
    } catch (e) {
        console.error(`Error downloading track ${track.title}:`, e);
        throw e;
    }
}
