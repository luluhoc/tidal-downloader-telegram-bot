# Tidal Media Downloader - Telegram Bot

This is a Node.js TypeScript port of the Tidal Media Downloader, designed to run as a Telegram Bot.

## Prerequisites

- Node.js (v16 or higher)
- npm or yarn
- A Telegram Bot Token (from @BotFather)

## Installation

1.  Navigate to the `ts-bot` directory:
    ```bash
    cd ts-bot
    ```

2.  Install dependencies:
    ```bash
    npm install
    ```

3.  Create a `.env` file (or rename `.env.example` if available) and add your Bot Token:
    ```
    BOT_TOKEN=your_telegram_bot_token_here
    ```

## Usage

1.  Build the project:
    ```bash
    npm run build
    ```

2.  Start the bot:
    ```bash
    npm start
    ```

3.  In Telegram, start a chat with your bot.
4.  Use `/login` to authenticate with your Tidal account.
5.  Use `/search <query>` to search for tracks.
6.  Click on a track to download it.

## Features

-   **Authentication**: Supports Tidal Device Authorization flow.
-   **Search**: Search for tracks.
-   **Download**: Download tracks in FLAC/AAC quality (depending on account).
-   **Decryption**: Automatically decrypts tracks.

## Notes

-   This is a simplified port focusing on the core downloading functionality.
-   Video downloading and advanced metadata tagging are not yet fully implemented.
