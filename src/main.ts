import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/core/app.config';
import { AppComponent } from './app/app.component';
import * as kaspa from '../public/kaspa/kaspa';

kaspa.default('./kaspa/kaspa_bg.wasm').then(() => {
  kaspa.initWASM32Bindings({validateClassNames: false});
  bootstrapApplication(AppComponent, appConfig).catch((err) =>
    console.error(err)
  );
});

export class MainModule {}
