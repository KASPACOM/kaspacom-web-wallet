import { Component, inject } from '@angular/core';
import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import {
  KcButtonComponent,
  KcDialogComponent,
  NotificationService,
} from '@kaspacom/ui-kit';

export interface PartialSpendJsonDialogData {
  title?: string;
  showCloseButton?: boolean;
  json: string;
}

@Component({
  selector: 'app-partial-spend-json-modal',
  standalone: true,
  imports: [KcDialogComponent, KcButtonComponent],
  templateUrl: './partial-spend-json-modal.component.html',
  styleUrl: './partial-spend-json-modal.component.scss',
})
export class PartialSpendJsonModalComponent {
  private dialogRef = inject(DialogRef<void>);
  private notificationService = inject(NotificationService);
  data = inject<PartialSpendJsonDialogData>(DIALOG_DATA);

  copyJson() {
    navigator.clipboard.writeText(this.data.json).then(
      () =>
        this.notificationService.success(
          'Copied',
          'Partial spend JSON copied! Send it to the co-signer.',
        ),
      () => prompt('Copy this partial spend JSON:', this.data.json),
    );
  }

  onDone() {
    this.dialogRef.close();
  }
}
