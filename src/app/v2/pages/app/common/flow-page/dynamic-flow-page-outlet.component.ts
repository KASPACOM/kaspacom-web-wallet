import { Component, Input, inject, computed } from '@angular/core';
import { CommonModule, NgComponentOutlet } from '@angular/common';
import { FlowPagesService } from '../../../../services/flow-pages.service';
import {
  FLOW_PAGE_REGISTRY,
  FlowPageRegistryEntry,
  FlowPageId,
} from './flow-page.registry';
import { IFlowPageConfig } from './interfaces/flow-page.interface';

@Component({
  selector: 'app-dynamic-flow-page-outlet',
  standalone: true,
  imports: [CommonModule, NgComponentOutlet],
  template: `
    @if (componentToRender(); as comp) {
      <ng-container
        *ngComponentOutlet="comp; inputs: componentInputs()"
      ></ng-container>
    }
    `,
})
export class DynamicFlowPageOutletComponent {
  private flowPagesService = inject(FlowPagesService);

  readonly activeConfig = computed<IFlowPageConfig | null>(() =>
    this.flowPagesService.activePage(),
  );

  readonly registryEntry = computed<FlowPageRegistryEntry | undefined>(() => {
    const id = (this.activeConfig()?.id ?? '') as FlowPageId | '';
    return id ? FLOW_PAGE_REGISTRY[id] : undefined;
  });

  readonly componentToRender = computed<any>(() => {
    const entry = this.registryEntry();
    if (!entry) return null;
    return (entry as any).component ?? entry;
  });

  readonly componentInputs = computed<Record<string, unknown> | undefined>(
    () => {
      const entry = this.registryEntry() as any;
      if (entry && entry.getInputs) {
        return entry.getInputs(this.activeConfig());
      }
      return undefined;
    },
  );
}
