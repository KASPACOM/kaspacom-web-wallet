import { CommonModule, NgOptimizedImage } from '@angular/common';
import { Component } from '@angular/core';
import { RouterModule } from '@angular/router';

@Component({
  selector: 'app-wrapper-nav',
  imports: [CommonModule, NgOptimizedImage, RouterModule],
  templateUrl: './wrapper-nav.component.html',
  styleUrl: './wrapper-nav.component.scss',
})
export class WrapperNavComponent {}
