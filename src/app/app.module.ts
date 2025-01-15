import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { FormsModule } from '@angular/forms';

import { AppComponent } from './app.component';
import { WalletActionsFormsModule } from './components/wallet-actions-forms/wallet-actions-forms.module';

@NgModule({
  imports: [
    BrowserModule,
    FormsModule,
    WalletActionsFormsModule
  ],
  providers: []
})
export class AppModule { }
