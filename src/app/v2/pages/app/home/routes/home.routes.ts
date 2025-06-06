import { Routes } from '@angular/router';
import { HomeComponent } from '../home.component';
import { SearchComponent } from '../search/search.component';

export const HomeRoutes: Routes = [
  {
    path: '',
    component: HomeComponent,
  },
  {
    path: 'search',
    component: SearchComponent,
  },
];
