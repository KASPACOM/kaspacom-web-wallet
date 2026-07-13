import { FlowPageId } from '../flow-page.registry';

export interface IFlowPageConfig {
  id: FlowPageId;
  title: string;
  subtitle?: string;
  canNavigateBack?: boolean;
  canClose?: boolean;
  showTitle?: boolean;
  showBackground?: boolean;
  /** Cosmetic hint only — actual wide-workspace layout is driven by WideWorkspaceService. */
  wide?: boolean;
  previousPageId?: string | null;
  data?: any;
}

export interface IFlowPageStack {
  pages: IFlowPageConfig[];
  currentIndex: number;
}

export interface IFlowPageNavigation {
  navigateBack(): void;
  navigateToPage(config: IFlowPageConfig): void;
  closePage(): void;
  canNavigateBack(): boolean;
  getCurrentPage(): IFlowPageConfig | null;
}

export abstract class FlowPageBase {
  abstract get config(): IFlowPageConfig;

  onPageEnter?(): void;
  onPageExit?(): void;
  onNavigateBack?(): boolean; // Return false to prevent navigation
}
