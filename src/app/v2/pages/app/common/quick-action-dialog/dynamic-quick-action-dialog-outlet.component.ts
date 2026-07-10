import {
  Component,
  computed,
  effect,
  inject,
  ViewContainerRef,
  ComponentRef,
  Type,
  viewChild,
} from '@angular/core';

import { QuickActionDialogService } from '../../../../services/quick-action-dialog.service';
import {
  IQuickActionDialogComponent,
  QUICK_ACTION_DIALOG_REGISTRY,
  QuickActionDialogId,
} from './quick-action-dialog.registry';

@Component({
  selector: 'app-dynamic-quick-action-dialog-outlet',
  standalone: true,
  imports: [],
  template: ` <ng-template #host></ng-template> `,
})
export class DynamicQuickActionDialogOutletComponent {
  private quickActionDialogService = inject(QuickActionDialogService);

  private readonly hostContainer = viewChild.required('host', {
    read: ViewContainerRef,
  });

  readonly activeDialog = computed(() =>
    this.quickActionDialogService.activeDialog(),
  );
  readonly isOpen = computed(() =>
    this.quickActionDialogService.isAnyDialogOpen(),
  );

  constructor() {
    effect(() => {
      const dialog = this.activeDialog();
      this.render(
        (dialog?.id ?? null) as QuickActionDialogId | null,
        dialog?.data,
      );
    });
  }

  private render(id: QuickActionDialogId | null, data: unknown) {
    this.hostContainer().clear();
    if (!id) return;

    const componentType = QUICK_ACTION_DIALOG_REGISTRY[id];
    if (!componentType) return;

    const componentRef: ComponentRef<IQuickActionDialogComponent> =
      this.hostContainer().createComponent(componentType);

    // Set inputs via ComponentRef.setInput (Angular v16+)
    componentRef.setInput('isOpen', this.isOpen());
    componentRef.setInput('data', data as any);

    // Wire outputs
    componentRef.instance.backdropClick.subscribe(() =>
      this.quickActionDialogService.closeDialog(),
    );
    componentRef.instance.close.subscribe(() =>
      this.quickActionDialogService.closeDialog(),
    );
  }
}
