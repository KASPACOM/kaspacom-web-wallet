export interface IFlowPageConfig {
  id: string;
  title: string;
  canNavigateBack?: boolean;
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
  canGoBack(): boolean;
  getCurrentPage(): IFlowPageConfig | null;
}

export abstract class FlowPageBase {
  abstract get config(): IFlowPageConfig;
  
  onPageEnter?(): void;
  onPageExit?(): void;
  onNavigateBack?(): boolean; // Return false to prevent navigation
}