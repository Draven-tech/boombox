import { Platform } from '@ionic/angular';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Component } from '@angular/core';
import { 
  IonHeader, IonToolbar, IonTitle, IonContent, IonList, IonItem, 
  IonAvatar, IonLabel, IonButtons, IonButton, IonIcon, IonFooter, 
  IonGrid, IonRow, IonCol, IonThumbnail, IonSearchbar, IonInput, IonModal,
  IonBadge, IonSegment, IonSegmentButton
} from '@ionic/angular/standalone';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { Preferences } from '@capacitor/preferences';
import { environment } from '../../environments/environment';
import { Browser } from '@capacitor/browser';

@Component({
  selector: 'app-home',
  templateUrl: './home.page.html',
  styleUrls: ['./home.page.scss'],
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    IonHeader, IonToolbar, IonTitle, IonContent, IonList, IonItem,
    IonAvatar, IonLabel, IonButtons, IonButton, IonIcon, IonFooter,
    IonGrid, IonRow, IonCol, IonThumbnail, IonSearchbar, IonInput, IonModal,
    IonBadge, IonSegment, IonSegmentButton
  ]
})
export class HomePage {
  songs: any[] = [];
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


  async requestStoragePermission() {
    try {
      // 1. Check current permissions
      const status = await Filesystem.checkPermissions();
      
      // 2. Already granted
      if (status.publicStorage === 'granted') {
        return true;
      }
      
      // 3. Request permission
      const newStatus = await Filesystem.requestPermissions();
      
      // 4. Still not granted - guide user manually
      if (newStatus.publicStorage !== 'granted') {
        if (confirm('Please enable storage permissions in Android settings')) {
          // Open device settings page
          await Browser.open({ url: 'android.settings.APPLICATION_DETAILS_SETTINGS' });
        }
        return false;
      }
      
      return true;
    } catch (err) {
      console.error('Permission error:', err);
      return false;
    }
  }

  async loadAudioFiles() {
    try {
      // 1. Request permission
      const hasPermission = await this.requestStoragePermission();
      if (!hasPermission) return;

      // 2. Scan directories (with error handling)
      const musicDirs = [
        { path: 'Music', dir: Directory.ExternalStorage },
        { path: 'Download', dir: Directory.ExternalStorage },
        { path: '', dir: Directory.Documents } // Fallback
      ];

      this.songs = [];

      for (const location of musicDirs) {
        try {
          const result = await Filesystem.readdir({
            path: location.path,
            directory: location.dir
          });

          // Process files
          result.files.forEach(async file => {
            if (/\.(mp3|m4a|wav|flac)$/i.test(file.name)) {
              this.songs.push({
                name: file.name,
                path: `${location.path}/${file.name}`,
                uri: await this.getFileUri(location.path, file.name, location.dir),
                metadata: {
                  title: file.name.replace(/\.[^/.]+$/, '').replace(/[_-]/g, ' '),
                  artist: 'Unknown Artist',
                  cover: 'assets/default-album.png'
                }
              });
            }
          });
        } catch (error) {
          console.warn(`Skipped ${location.path}:`, error);
        }
      }
    } catch (error) {
      console.error('Failed to load files:', error);
    }
  }


  
  async getFileUri(filename: string, path: string, directory: Directory): Promise<string> {
    const file = await Filesystem.getUri({
      path: path ? `${path}/${filename}` : filename,
      directory: directory
    });
    return file.uri;
  }

  private extractTitleFromFileName(filename: string): string {
    return filename
      .substring(0, filename.lastIndexOf('.'))
      .replace(/[_-]/g, ' ')
      .replace(/([a-z])([A-Z])/g, '$1 $2') // Add space between camelCase
      .trim();
  }

  async playSong(song: any) {
    try {
      if (this.audio) {
        this.audio.pause();
        this.audio = null;
      }

      // For Android, we need to use the Filesystem API to read the file
      if (this.platform.is('android') && song.path.startsWith('file://')) {
        const file = await Filesystem.readFile({
          path: song.path.replace('file://', ''),
          directory: Directory.ExternalStorage
        });
        const audioBlob = new Blob([file.data], { type: 'audio/mp3' });
        this.audio = new Audio(URL.createObjectURL(audioBlob));
      } else {
        this.audio = new Audio(song.path);
      }

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
      // Fallback to direct audio source if Filesystem read fails
      this.audio = new Audio(song.path);
      this.audio.play();
    }
  }

  // ... [keep all your other existing methods exactly as they were]
  handleSearchChange(event: any) {
    this.searchQuery = event.detail.value || '';
    this.searchDeezer(this.searchQuery);
  }

  async searchDeezer(query: string) {
    if (!query) return;
    
    this.isSearching = true;
    try {
      const headers = new HttpHeaders({
        'X-RapidAPI-Key': environment.rapidApiKey,
        'X-RapidAPI-Host': environment.rapidApiHost
      });

      const response: any = await this.http.get(`${environment.deezerApiUrl}/search`, {
        headers,
        params: { q: query }
      }).toPromise();

      this.streamingSongs = response.data.map((track: any) => ({
        id: track.id,
        title: track.title,
        artist: track.artist.name,
        album: track.album.title,
        cover: track.album.cover_medium || 'assets/default-album.png',
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