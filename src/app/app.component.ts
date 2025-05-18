import { Component } from '@angular/core';

@Component({
  selector: 'app-root',
  templateUrl: 'app.component.html',
  styleUrls: ['app.component.scss'],
  standalone: false,
})
export class AppComponent {
  platform: any;
  constructor() {}

  initializeApp() {
  console.log('App initializing...'); // Check if this appears
  this.platform.ready().then(() => {
    console.log('Platform ready!'); // Check this too
  });
}
}
