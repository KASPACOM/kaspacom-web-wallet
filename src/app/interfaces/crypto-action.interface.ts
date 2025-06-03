export interface ICryptoAction {
  title: string;
  iconClass: string;
  iconColor: string;
  action: () => void;
}

export interface IFooterAction {
  title: string;
  iconClass: string;
  iconColor: string;
  action: (route: string) => void;
}
