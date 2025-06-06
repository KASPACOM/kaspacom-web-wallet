import { Component, inject } from '@angular/core';
import { Router, RouterModule } from '@angular/router';
import { KcIconComponent } from 'kaspacom-ui';
import { SearchBarComponent } from '../../home/search/search-bar/search-bar.component';

@Component({
  selector: 'app-wrapper-header',
  imports: [KcIconComponent, RouterModule, SearchBarComponent],
  templateUrl: './wrapper-header.component.html',
  styleUrl: './wrapper-header.component.scss',
})
export class WrapperHeaderComponent {
  router = inject(Router);
}
