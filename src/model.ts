export interface Album {
    id: number;
    title: string;
    cover: string;
    artist: { id: number; name: string };
    url: string;
    releaseDate: string;
}

export interface Track {
    id: number;
    title: string;
    duration: number;
    trackNumber: number;
    volumeNumber: number;
    artist: { id: number; name: string };
    album: { id: number; title: string; cover: string };
    url: string;
}

export interface StreamUrl {
    trackId: number;
    url: string;
    urls?: string[];
    codec: string;
    encryptionKey: string;
    soundQuality: string;
}
