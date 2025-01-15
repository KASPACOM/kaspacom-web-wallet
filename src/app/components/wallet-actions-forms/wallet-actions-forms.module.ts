import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TestInscriptionComponent } from './test-inscription/test-inscription.component';

@NgModule({
  declarations: [
    TestInscriptionComponent
  ],
  imports: [
    CommonModule,
    FormsModule
  ]
})
export class WalletActionsFormsModule { }
