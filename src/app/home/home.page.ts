import { Component, ElementRef, ViewChild } from '@angular/core';
import { Platform } from '@ionic/angular';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { 
  IonHeader, IonToolbar, IonTitle, IonContent, IonList, IonItem, 
  IonAvatar, IonLabel, IonButtons, IonButton, IonIcon, IonFooter, 
  IonGrid, IonRow, IonCol, IonThumbnail, IonSearchbar, IonInput, IonModal,
  IonBadge, IonSegment, IonSegmentButton, IonProgressBar
} from '@ionic/angular/standalone';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Capacitor } from '@capacitor/core';
import { Preferences } from '@capacitor/preferences';
import { environment } from '../../environments/environment';

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
    IonBadge, IonSegment, IonSegmentButton, IonProgressBar
  ]
})
export class HomePage {
  @ViewChild('fileInput') fileInput!: ElementRef<HTMLInputElement>;
  
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
  progressInterval: any = null;
  currentProgress: number = 0;
  isPlaying: boolean = false;

  constructor(private platform: Platform, private http: HttpClient) {}

  // SIMPLE AND RELIABLE FILE SELECTION
  triggerFileInput() {
    this.fileInput.nativeElement.click();
  }

  async ionViewWillEnter() {
    await this.loadPlaylists();
    await this.loadLocalSongs();
  }

  async handleFileInput(event: Event) {
    const input = event.target as HTMLInputElement;
    if (!input.files || input.files.length === 0) return;

    for (let i = 0; i < input.files.length; i++) {
      const file = input.files[i];
      
      // Check for duplicates
      const isDuplicate = await this.checkForDuplicate(file);
      if (isDuplicate) {
        alert(`"${file.name}" is already in your library`);
        continue;
      }

      const objectUrl = URL.createObjectURL(file);
      
      this.songs.push({
        name: file.name,
        path: objectUrl,
        file: file,
        fileSize: file.size,
        lastModified: file.lastModified,
        metadata: {
          title: this.cleanFileName(file.name),
          artist: 'Unknown Artist',
          cover: 'assets/default-album.png'
        }
      });
    }

    await this.saveLocalSongs();
    input.value = '';
  }

  async checkForDuplicate(file: File): Promise<boolean> {
    // First check by name and size (quick check)
    const nameSizeMatch = this.songs.some(song => 
      song.name === file.name && song.fileSize === file.size
    );
    if (nameSizeMatch) return true;

    // More thorough check using file content
    const fileHash = await this.calculateFileHash(file);
    return this.songs.some(song => song.fileHash === fileHash);
  }

  private async calculateFileHash(file: File): Promise<string> {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = async (e) => {
        const arrayBuffer = e.target?.result as ArrayBuffer;
        const hashBuffer = await crypto.subtle.digest('SHA-1', arrayBuffer);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
        resolve(hashHex);
      };
      reader.readAsArrayBuffer(file);
    });
  }

  async saveLocalSongs() {
    const songsToSave = await Promise.all(this.songs.map(async song => {
      if (song.file) {
        const base64 = await this.fileToBase64(song.file);
        const fileHash = song.fileHash || await this.calculateFileHash(song.file);
        return {
          name: song.name,
          base64: base64,
          fileSize: song.fileSize,
          lastModified: song.lastModified,
          fileHash: fileHash,
          metadata: song.metadata
        };
      }
      return song;
    }));
    
    await Preferences.set({
      key: 'localSongs',
      value: JSON.stringify(songsToSave)
    });
  }

  async loadLocalSongs() {
    const { value } = await Preferences.get({ key: 'localSongs' });
    if (value) {
      const savedSongs = JSON.parse(value);
      this.songs = await Promise.all(savedSongs.map(async (song: any) => {
        if (song.base64) {
          const blob = this.base64ToBlob(song.base64, 'audio/mpeg');
          const objectUrl = URL.createObjectURL(blob);
          return {
            name: song.name,
            path: objectUrl,
            fileSize: song.fileSize,
            lastModified: song.lastModified,
            fileHash: song.fileHash,
            metadata: song.metadata
          };
        }
        return song;
      }));
    }
  }

  private fileToBase64(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = error => reject(error);
    });
  }

  private base64ToBlob(base64: string, contentType: string): Blob {
    const byteCharacters = atob(base64.split(',')[1]);
    const byteNumbers = new Array(byteCharacters.length);
    for (let i = 0; i < byteCharacters.length; i++) {
      byteNumbers[i] = byteCharacters.charCodeAt(i);
    }
    const byteArray = new Uint8Array(byteNumbers);
    return new Blob([byteArray], { type: contentType });
  }

  async removeSong(index: number) {
    this.songs.splice(index, 1);
    await this.saveLocalSongs();
  }

  private cleanFileName(filename: string): string {
    return filename
      .replace(/\.[^/.]+$/, '')
      .replace(/[_-]/g, ' ')
      .trim();
  }

  // AUDIO PLAYBACK
  async playSong(song: any) {
    try {
      this.stop();
      this.audio = new Audio(song.path);
      
      this.audio.onloadedmetadata = () => {
        this.nowPlaying = {
          title: song.metadata.title,
          artist: song.metadata.artist,
          cover: song.metadata.cover,
          duration: this.audio?.duration || 0,
          currentTime: 0
        };
      };

      this.audio.ontimeupdate = () => this.updateProgress();
      this.audio.onplay = () => {
        this.isPlaying = true;
        this.startProgressUpdate();
      };
      this.audio.onpause = () => {
        this.isPlaying = false;
        this.stopProgressUpdate();
      };
      this.audio.onended = () => this.stop();

      await this.audio.play();
    } catch (error) {
      console.error('Playback error:', error);
      alert('Could not play this file: ' + song.name);
    }
  }

  // PLAYBACK CONTROLS
  togglePlayPause() {
    if (!this.audio) return;
    this.audio.paused ? this.audio.play() : this.audio.pause();
  }

  stop() {
    if (this.audio) {
      this.audio.pause();
      this.audio.currentTime = 0;
      this.audio = null;
    }
    this.isPlaying = false;
    this.nowPlaying = null;
    this.currentProgress = 0;
    this.stopProgressUpdate();
  }

  // PROGRESS HANDLING
  startProgressUpdate() {
    this.progressInterval = setInterval(() => this.updateProgress(), 1000);
  }

  stopProgressUpdate() {
    if (this.progressInterval) {
      clearInterval(this.progressInterval);
      this.progressInterval = null;
    }
  }

  updateProgress() {
    if (this.audio && this.nowPlaying) {
      this.nowPlaying.currentTime = this.audio.currentTime;
      this.currentProgress = (this.audio.currentTime / this.audio.duration) * 100;
    }
  }

  formatTime(seconds: number): string {
    if (isNaN(seconds)) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  }

  // DEEZER INTEGRATION
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
    this.stop();
    this.audio = new Audio(song.preview);
    this.audio.play();

    this.nowPlaying = {
      title: song.title,
      artist: song.artist,
      cover: song.cover,
      duration: 30,
      currentTime: 0
    };

    this.audio.ontimeupdate = () => this.updateProgress();
    this.audio.onended = () => this.stop();
    this.isPlaying = true;
  }

  // PLAYLIST MANAGEMENT
  handlePlaylistNameChange(event: any) {
    this.newPlaylistName = event.detail.value || '';
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

  seekAudio(event: MouseEvent) {
    if (!this.audio || !this.nowPlaying) return;

    const progressBar = event.currentTarget as HTMLElement;
    const rect = progressBar.getBoundingClientRect();
    const clickPosition = event.clientX - rect.left;
    const progressBarWidth = rect.width;
    const seekPercentage = clickPosition / progressBarWidth;
    
    this.audio.currentTime = this.audio.duration * seekPercentage;
    this.updateProgress();
  }
}