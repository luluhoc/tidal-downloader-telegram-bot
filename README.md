# Tidal Media Downloader - Telegram Bot

This is a Node.js TypeScript Telegram Bot for downloading music from Tidal. It allows you to search for tracks or paste Tidal URLs directly to download high-quality music with metadata and cover art.

## Features

-   **Authentication**: Secure login via Tidal Device Authorization flow.
-   **Search**: Search for tracks directly within Telegram.
-   **URL Support**: Download tracks and full albums by pasting Tidal links (e.g., `https://tidal.com/browse/track/...`).
-   **High Quality**: Downloads tracks and converts them to high-quality MP3 (320kbps).
-   **Metadata**: Automatically tags files with:
    -   Title, Artist(s), Album, Track Number, Disc Number, Release Date.
    -   Embedded Album Cover Art.
-   **Album Zipping**: Option to zip albums before sending them to Telegram (configurable via environment variable).
-   **Windows Support**: Includes one-click scripts for starting and updating the bot.

## Prerequisites

-   Node.js (v16 or higher)
-   Yarn (recommended) or npm
-   A Telegram Bot Token (get one from [@BotFather](https://t.me/BotFather))
-   **FFmpeg**: Required for audio conversion and tagging.
    -   The bot attempts to use a static binary, but having FFmpeg installed in your system PATH is recommended if issues arise.

## Installation

1.  Clone or download this repository.
2.  Open a terminal in the project folder.
3.  Install dependencies:
    ```bash
    yarn install
    ```
4.  Create a `.env` file in the root directory and add your Telegram Bot Token:
    ```env
    BOT_TOKEN=your_telegram_bot_token_here
    # Optional: Comma-separated list of allowed Telegram User IDs
    ALLOWED_USERS=123456789,987654321
    # Optional: Set to true to zip albums before sending (default: false)
    ZIP_ALBUMS=false
    ```

## Usage

### Starting the Bot

**On Windows:**
-   Double-click `start_bot.bat` to start the bot.

**Manual Start:**
1.  Build the project (optional if running in dev mode):
    ```bash
    yarn build
    ```
2.  Start the bot:
    ```bash
    yarn start
    ```

### Bot Commands

1.  **Start**: `/start` - Welcome message.
2.  **Login**: `/login` - Authenticate with your Tidal account. Follow the link and enter the code provided.
3.  **Search**: `/search <query>` - Search for tracks on Tidal. Click the buttons to download.
4.  **Direct Download**: Simply paste a Tidal Track or Album URL into the chat.
    -   **Track URL**: Downloads the single track.
    -   **Album URL**: Downloads all tracks in the album sequentially.

### Updating

**On Windows:**
-   Double-click `update_bot.bat` to pull the latest changes from Git and update dependencies.

**Manual Update:**
```bash
git pull
yarn install
```

## Notes

-   Downloads are saved in the `downloads/` folder, organized by `Artist/Album/`.
-   The bot handles Dolby Atmos/EAC3 and AAC sources by transcoding them to MP3 320kbps for maximum compatibility.
-   Large album downloads may take some time; the bot has an extended timeout to handle this.
-   If `ZIP_ALBUMS=true` is set in `.env`, albums will be sent as a single ZIP file instead of individual tracks.

## Disclaimer

This tool is for educational purposes only. Please respect copyright laws and Tidal's terms of service.
