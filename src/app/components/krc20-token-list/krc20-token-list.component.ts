import { NgFor, NgIf } from '@angular/common';
import { Component, Input } from '@angular/core';

@Component({
    standalone: true,
    selector: 'app-krc20-token-list',
    templateUrl: './krc20-token-list.component.html',
    styleUrls: ['./krc20-token-list.component.css'],
    imports: [
        NgIf,
        NgFor,
    ]
})
export class Krc20TokenListComponent {
    @Input() tokens!: { ticker: string; balance: number; }[] | undefined;  // Add '!' to assert definite assignment
} 