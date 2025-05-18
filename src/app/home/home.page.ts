import { Component } from '@angular/core';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { Platform } from '@ionic/angular';
import { HttpClient } from '@angular/common/http';
import { Preferences } from '@capacitor/preferences';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-home',
  templateUrl: 'home.page.html',
  styleUrls: ['home.page.scss'],
  standalone: false
})
export class HomePage {
  songs: { name: string; path: string; metadata?: any }[] = [];
  streamingSongs: any[] = [];
  playlists: any[] = [];
  currentPlaylist: any = null;
  searchQuery: string = '';
  newPlaylistName: string = '';
  isSearching: boolean = false;
  audio: HTMLAudioElement | null = null;
  currentTab: string = 'local';
  nowPlaying: any = null;
  showPlaylistDialog: boolean = false;
  selectedSong: any = null;

  constructor(private platform: Platform, private http: HttpClient) {}

  async ionViewDidEnter() {
    await this.platform.ready();
    await this.loadAudioFiles();
    await this.loadPlaylists();
  }

  async loadAudioFiles() {
    try {
      const result = await Filesystem.readdir({
        path: '',
        directory: Directory.ExternalStorage,
      });

      const supportedFormats = ['.mp3', '.m4a', '.aac', '.wav', '.ogg', '.flac', '.opus'];
      
      this.songs = [];
      
      for (const file of result.files) {
        const ext = file.name.toLowerCase().substring(file.name.lastIndexOf('.'));
        if (supportedFormats.includes(ext)) {
          const songPath = `/storage/emulated/0/${file.name}`;
          this.songs.push({
            name: file.name,
            path: songPath,
            metadata: {
              title: this.extractTitleFromFileName(file.name),
              artist: 'Unknown Artist',
              picture: 'assets/default-album.png'
            }
          });
        }
      }
    } catch (error) {
      console.error('Failed to read storage:', error);
    }
  }

  private extractTitleFromFileName(filename: string): string {
    return filename.substring(0, filename.lastIndexOf('.')).replace(/[_-]/g, ' ');
  }

  async playSong(song: any) {
    try {
      if (this.audio) {
        this.audio.pause();
        this.audio = null;
      }

      this.audio = new Audio(song.path);
      this.audio.play();
      this.nowPlaying = {
        title: song.metadata.title,
        artist: song.metadata.artist,
        cover: song.metadata.picture
      };

      this.audio.onended = () => {
        this.nowPlaying = null;
      };
    } catch (error) {
      console.error('Error playing file:', error);
    }
  }

  handleSearchChange(event: any) {
    this.searchQuery = event.detail.value || '';
    this.searchDeezer(this.searchQuery);
  }

  async searchDeezer(query: string) {
    if (!query) return;
    
    this.isSearching = true;
    try {
      const response: any = await this.http.get(`https://api.deezer.com/search?q=${query}`).toPromise();
      this.streamingSongs = response.data.map((track: any) => ({
        id: track.id,
        title: track.title,
        artist: track.artist.name,
        album: track.album.title,
        cover: track.album.cover_medium,
        preview: track.preview
      }));
    } catch (error) {
      console.error('Deezer API error:', error);
    } finally {
      this.isSearching = false;
    }
  }

  playStream(song: any) {
    if (this.audio) {
      this.audio.pause();
      this.audio = null;
    }
    
    this.audio = new Audio(song.preview);
    this.audio.play();
    this.nowPlaying = {
      title: song.title,
      artist: song.artist,
      cover: song.cover
    };

    this.audio.onended = () => {
      this.nowPlaying = null;
    };
  }

  handlePlaylistNameChange(event: any) {
    this.newPlaylistName = event.detail.value || '';
  }

  pause() {
    if (this.audio) {
      this.audio.pause();
    }
  }

  stop() {
    if (this.audio) {
      this.audio.pause();
      this.audio.currentTime = 0;
      this.nowPlaying = null;
    }
  }

  async createPlaylist() {
    if (!this.newPlaylistName) return;
    
    this.playlists.push({
      name: this.newPlaylistName,
      songs: []
    });
    this.newPlaylistName = '';
    await this.savePlaylists();
  }

  addToPlaylistDialog(song: any) {
    this.selectedSong = song;
    this.showPlaylistDialog = true;
  }

  async addToPlaylist(playlistIndex: number) {
    if (this.selectedSong) {
      this.playlists[playlistIndex].songs.push(this.selectedSong);
      await this.savePlaylists();
      this.showPlaylistDialog = false;
    }
  }

  async savePlaylists() {
    await Preferences.set({
      key: 'playlists',
      value: JSON.stringify(this.playlists)
    });
  }

  async loadPlaylists() {
    const { value } = await Preferences.get({ key: 'playlists' });
    if (value) {
      this.playlists = JSON.parse(value);
    }
  }

  async removeFromPlaylist(playlistIndex: number, songIndex: number) {
    this.playlists[playlistIndex].songs.splice(songIndex, 1);
    await this.savePlaylists();
  }

  async deletePlaylist(index: number) {
    this.playlists.splice(index, 1);
    await this.savePlaylists();
  }
}