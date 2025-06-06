import { Routes } from '@angular/router';
import { LoginComponent } from './login/login.component';
import { HomeComponent } from './home/home.component';
import { SwapComponent } from './swap/swap.component';
import { AppWrapperComponent } from './app-wrapper.component';
import { SearchComponent } from './home/search/search.component';

export const loggedRoutes: Routes = [
  {
    path: '',
    component: AppWrapperComponent,
    children: [
      {
        path: 'home',
        component: HomeComponent,
        data: { animation: 'Home' },
      },
      {
        path: 'home/search',
        component: SearchComponent,
      },
      {
        path: 'swap',
        component: SwapComponent,
        data: { animation: 'Swap' },
      },
    ],
  },
  {
    path: 'login',
    component: LoginComponent,
    data: { animation: 'Login' },
  },
];
