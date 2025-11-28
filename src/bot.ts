import { Telegraf, Markup } from 'telegraf';
import * as dotenv from 'dotenv';
import { tidalAPI } from './tidal';
import { settingsManager } from './settings';
import { downloadTrack } from './download';

dotenv.config();

const bot = new Telegraf(process.env.BOT_TOKEN || '');

bot.start((ctx) => {
    ctx.reply('Welcome to Tidal Media Downloader Bot!\n\nUse /login to log in to your Tidal account.\nUse /search <query> to search for music.');
});

bot.command('login', async (ctx) => {
    try {
        const deviceCode = await tidalAPI.getDeviceCode();
        console.log('Device Code Response:', deviceCode);
        
        const verificationUri = deviceCode.verificationUriComplete || deviceCode.verification_uri_complete;
        const userCode = deviceCode.userCode || deviceCode.user_code;
        const dCode = deviceCode.deviceCode || deviceCode.device_code;
        const expiresIn = deviceCode.expiresIn || deviceCode.expires_in;
        const intervalTime = deviceCode.interval || 5;

        if (!verificationUri) {
            throw new Error('Could not get verification URI from Tidal');
        }
        
        ctx.reply(`Please visit ${verificationUri} to authorize the bot. Code: ${userCode}`, 
            Markup.inlineKeyboard([
                Markup.button.url('Login', verificationUri)
            ])
        );

        // Poll for token
        const interval = setInterval(async () => {
            const success = await tidalAPI.checkDeviceCode(dCode);
            if (success) {
                clearInterval(interval);
                ctx.reply('Login successful!');
            }
        }, intervalTime * 1000);

        // Stop polling after some time (e.g. expires_in)
        setTimeout(() => {
            clearInterval(interval);
        }, expiresIn * 1000);

    } catch (e) {
        console.error(e);
        ctx.reply('Login failed. Please try again.');
    }
});

bot.command('search', async (ctx) => {
    const query = ctx.message.text.split(' ').slice(1).join(' ');
    if (!query) {
        return ctx.reply('Please provide a search query.');
    }

    try {
        const results = await tidalAPI.search(query, 'TRACKS', 5);
        const tracks = results.tracks.items;

        if (tracks.length === 0) {
            return ctx.reply('No results found.');
        }

        const buttons = tracks.map((track: any) => {
            const artistName = track.artist?.name || (track.artists && track.artists[0]?.name) || 'Unknown Artist';
            return [Markup.button.callback(`${track.title} - ${artistName}`, `dl_${track.id}`)];
        });

        ctx.reply('Select a track to download:', Markup.inlineKeyboard(buttons));
    } catch (e) {
        console.error(e);
        ctx.reply('Search failed.');
    }
});

bot.action(/dl_(\d+)/, async (ctx) => {
    const trackId = parseInt(ctx.match[1]);
    try {
        ctx.reply('Fetching track info...');
        const track = await tidalAPI.getTrack(trackId);
        const album = await tidalAPI.getAlbum(track.album.id);
        
        ctx.reply(`Downloading ${track.title}...`);
        const filePath = await downloadTrack(track, album);
        
        ctx.replyWithDocument({ source: filePath });
    } catch (e) {
        console.error(e);
        ctx.reply('Download failed.');
    }
});

bot.launch();

console.log('Bot started');

// Enable graceful stop
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
