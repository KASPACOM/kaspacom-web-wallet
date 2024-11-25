import { Component } from '@angular/core';
import { Router, RouterOutlet } from '@angular/router';
import { PasswordManagerService } from './services/password-manager.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss'
})
export class AppComponent {
  title = 'kaspiano-wallet';

  constructor(
    private readonly router: Router,
    private readonly passwordManagerService: PasswordManagerService) {
  }

  async ngOnInit() {
    if (this.passwordManagerService.isUserHasSavedPassword()) {
      console.log('User has saved password');

      this.router.navigate(['/login']);
    } else {
      console.log('User has not saved password');
      this.router.navigate(['/set-password']);    
    }
  }

}
