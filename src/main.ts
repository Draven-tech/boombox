import { platformBrowserDynamic } from '@angular/platform-browser-dynamic';
import { AppModule } from './app/app.module';

platformBrowserDynamic().bootstrapModule(AppModule)
  .catch(err => {
    console.error('Bootstrap Error:', err); // Check browser console for this
    document.write('<h1 style="color: red">Bootstrap Failed: ' + err.message + '</h1>');
  });