import {
  Component,
  computed,
  signal,
  ElementRef,
  AfterViewInit,
  OnDestroy,
  inject,
  viewChild,
} from '@angular/core';

import {
  FormBuilder,
  FormsModule,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import {
  KcInputComponent,
  KcButtonComponent,
  KcIconComponent,
} from '@kaspacom/ui-kit';
import { OnboardingStep } from '../onboarding-page/onboarding-step.enum';
import { ImportExistingFlowComponent } from '../onboarding-page/flows/import-existing-flow/import-existing-flow.component';
import { NewWalletFlowComponent } from '../onboarding-page/flows/new-wallet-flow/new-wallet-flow.component';
import { PasswordManagerService } from '../../../services/password-manager.service';
import { WalletService } from '../../../services/wallet.service';
import {
  DELETE_ALL_WALLET_CONFIRMATION_PHRASE,
  isDeleteWalletConfirmationValid,
} from '../../shared/constants/delete-wallet.constants';
import { IframeAccountSelectionService } from '../../services/iframe-account-selection.service';
import { MonitorService } from '../../../services/monitor.service';
import { IFrameCommunicationApp } from '../../../services/communication-service/communication-app/iframe-communication.service';
import { getSafeReturnUrl } from '../../shared/utils/return-url.util';

type LoginPasswordType = 'password' | 'text';

interface PanelCopy {
  title: string;
  description: string;
}

@Component({
  selector: 'app-onboarding-page-v2',
  imports: [
    FormsModule,
    ReactiveFormsModule,
    KcButtonComponent,
    KcIconComponent,
    KcInputComponent,
    ImportExistingFlowComponent,
    NewWalletFlowComponent,
  ],
  templateUrl: './onboarding-page-v2.component.html',
  styleUrl: './onboarding-page-v2.component.scss',
})
export class OnboardingPageV2Component implements AfterViewInit, OnDestroy {
  readonly graphCanvas =
    viewChild.required<ElementRef<HTMLCanvasElement>>('graphCanvas');
  readonly OnboardingStep = OnboardingStep;

  onboardingStep = signal(OnboardingStep.WELCOME);
  isTransitioning = signal(false);

  private readonly passwordManagerService = inject(PasswordManagerService);
  private readonly walletService = inject(WalletService);
  private readonly router = inject(Router);
  private readonly activatedRoute = inject(ActivatedRoute);
  private readonly fb = inject(FormBuilder);
  private readonly iframeAccountSelectionService = inject(
    IframeAccountSelectionService,
  );
  private readonly monitorService = inject(MonitorService);

  readonly shouldShowLogin = signal(
    this.passwordManagerService.isUserHasSavedPassword(),
  );

  passwordType = signal<LoginPasswordType>('password');
  passwordIcon = computed(() =>
    this.passwordType() === 'password' ? 'icon-eye' : 'icon-eye-crossed',
  );
  isSubmitting = signal(false);
  loginForm = this.fb.nonNullable.group({
    password: ['', [Validators.required]],
  });

  showDeleteConfirmation = signal(false);
  isDeletingWallet = signal(false);
  deleteConfirmationInput = signal('');
  readonly deleteConfirmationPhrase = DELETE_ALL_WALLET_CONFIRMATION_PHRASE;
  readonly isDeleteConfirmationValid = computed(() =>
    isDeleteWalletConfirmationValid(this.deleteConfirmationInput()),
  );
  readonly isIframeMode = IFrameCommunicationApp.isIframe();

  private ctx!: CanvasRenderingContext2D;
  private nodes: Node[] = [];
  private animationFrameId: number | null = null;
  private mouse = {
    x: null as number | null,
    y: null as number | null,
    radius: 150,
  };

  private boundResizeCanvas!: () => void;
  private boundMouseMove!: (e: MouseEvent) => void;
  private boundMouseLeave!: () => void;

  readonly panelCopy = computed<PanelCopy>(() => {
    if (this.shouldShowLogin()) {
      return {
        title: 'Welcome back',
        description: 'Enter your password to unlock your wallet.',
      };
    }
    switch (this.onboardingStep()) {
      case OnboardingStep.NEW_WALLET:
        return {
          title: 'Create a New Wallet',
          description:
            'Set your password, secure your recovery phrase, and start using the KaspaCom Wallet.',
        };
      case OnboardingStep.IMPORT_EXISTING_WALLET:
        return {
          title: 'Import an existing wallet',
          description: '',
        };
      default:
        return {
          title: 'Welcome to KaspaCom Wallet',
          description:
            'Start with a new wallet or connect one you already use.',
        };
    }
  });

  readonly isWelcome = computed(
    () =>
      !this.shouldShowLogin() &&
      this.onboardingStep() === OnboardingStep.WELCOME,
  );

  togglePwVisibility(): void {
    this.passwordType.set(
      this.passwordType() === 'password' ? 'text' : 'password',
    );
  }

  openDeleteWalletDialog(event?: MouseEvent): void {
    if (event) {
      event.preventDefault();
      event.stopPropagation();
    }
    if (this.isSubmitting()) {
      return;
    }
    this.deleteConfirmationInput.set('');
    this.showDeleteConfirmation.set(true);
  }

  closeDeleteWalletDialog(): void {
    if (this.isDeletingWallet()) {
      return;
    }
    this.deleteConfirmationInput.set('');
    this.showDeleteConfirmation.set(false);
  }

  async confirmDeleteWallet(): Promise<void> {
    if (this.isDeletingWallet()) {
      return;
    }

    if (!this.isDeleteConfirmationValid()) {
      return;
    }

    this.isDeletingWallet.set(true);

    try {
      await this.passwordManagerService.clearAllData();
      await this.walletService.logout();
      this.walletService.resetWalletLoadingState();

      this.shouldShowLogin.set(false);
      this.onboardingStep.set(OnboardingStep.WELCOME);
      this.isTransitioning.set(false);
      this.passwordType.set('password');
      this.loginForm.setValue({ password: '' });
      this.loginForm.markAsPristine();
      this.loginForm.markAsUntouched();
    } catch (error) {
      console.error('Error during wallet deletion:', error);
    } finally {
      this.isDeletingWallet.set(false);
      this.showDeleteConfirmation.set(false);
      this.isSubmitting.set(false);
      this.deleteConfirmationInput.set('');
    }
  }

  onDeleteConfirmationInputChange(value: string): void {
    this.deleteConfirmationInput.set(value ?? '');
  }

  getPasswordError(): string {
    const passwordControl = this.loginForm.get('password');
    if (passwordControl?.hasError('required')) {
      return 'Password is required';
    }
    if (passwordControl?.hasError('invalidCredentials')) {
      return 'Invalid password';
    }
    return '';
  }

  isInvalid(controlName: string): boolean {
    const control = this.loginForm.get(controlName);
    return control
      ? control.invalid && (control.dirty || control.touched)
      : false;
  }

  async onSubmit(): Promise<void> {
    if (this.loginForm.invalid || this.isSubmitting()) {
      return;
    }

    this.isSubmitting.set(true);
    const password = this.loginForm.controls.password.value;

    try {
      const isValidPassword =
        await this.passwordManagerService.checkAndLoadPassword(password);

      if (!isValidPassword) {
        this.loginForm.get('password')?.setErrors({ invalidCredentials: true });
        return;
      }

      await this.walletService.loadWallets();

      const shouldEnforceAccountSelection =
        this.iframeAccountSelectionService.shouldEnforceAccountSelection();

      if (shouldEnforceAccountSelection) {
        // Clear any previous wallet selection to force account selection
        await this.walletService.deselectCurrentWallet();
        // Open the account selection overlay
        this.iframeAccountSelectionService.openOverlay();
      } else {
        // Normal web mode - auto-select the previously selected wallet
        await this.walletService.selectCurrentWalletFromLocalStorageNullsafe();
      }

      this.monitorService.track('Wallet Logged In', {
        is_iframe: IFrameCommunicationApp.isIframe(),
      });

      await this.router.navigateByUrl(getSafeReturnUrl(this.activatedRoute));
    } catch (error) {
      console.error('Login failed', error);
      this.loginForm.get('password')?.setErrors({ invalidCredentials: true });
    } finally {
      this.isSubmitting.set(false);
    }
  }

  createNewWallet(): void {
    this.triggerTransition(() => {
      this.onboardingStep.set(OnboardingStep.NEW_WALLET);
    });
  }

  startExistingWallet(): void {
    this.triggerTransition(() => {
      this.onboardingStep.set(OnboardingStep.IMPORT_EXISTING_WALLET);
    });
  }

  resetFlow(): void {
    this.triggerTransition(() => {
      this.onboardingStep.set(OnboardingStep.WELCOME);
    });
  }

  openPublicWalletPage(): void {
    void this.router.navigate(['/'], {
      queryParams: { walletInfo: '1' },
    });
  }

  private triggerTransition(callback: () => void): void {
    this.isTransitioning.set(true);
    callback();

    // Re-enable scroll after transition completes (600ms matches typical CSS transitions)
    setTimeout(() => {
      this.isTransitioning.set(false);
    }, 600);
  }

  ngAfterViewInit(): void {
    this.initGraphAnimation();
  }

  ngOnDestroy(): void {
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
    }
    window.removeEventListener('resize', this.boundResizeCanvas);
    window.removeEventListener('mousemove', this.boundMouseMove);
    window.removeEventListener('mouseleave', this.boundMouseLeave);
  }

  private initGraphAnimation(): void {
    const canvas = this.graphCanvas().nativeElement;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    this.ctx = ctx;

    // Bind event handlers
    this.boundResizeCanvas = this.resizeCanvas.bind(this);
    this.boundMouseMove = this.handleMouseMove.bind(this);
    this.boundMouseLeave = this.handleMouseLeave.bind(this);

    // Set canvas size
    this.resizeCanvas();
    window.addEventListener('resize', this.boundResizeCanvas);

    // Mouse events
    window.addEventListener('mousemove', this.boundMouseMove);
    window.addEventListener('mouseleave', this.boundMouseLeave);

    // Create nodes
    const nodeCount = 40;
    for (let i = 0; i < nodeCount; i++) {
      this.nodes.push(new Node(canvas));
    }

    // Start animation
    this.animate();
  }

  private resizeCanvas(): void {
    const canvas = this.graphCanvas().nativeElement;
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
  }

  private handleMouseMove(e: MouseEvent): void {
    this.mouse.x = e.x;
    this.mouse.y = e.y;
  }

  private handleMouseLeave(): void {
    this.mouse.x = null;
    this.mouse.y = null;
  }

  private drawConnections(): void {
    const canvas = this.graphCanvas().nativeElement;
    const maxDistance = Math.max(canvas.width, canvas.height);

    for (let i = 0; i < this.nodes.length; i++) {
      for (let j = i + 1; j < this.nodes.length; j++) {
        const dx = this.nodes[i].x - this.nodes[j].x;
        const dy = this.nodes[i].y - this.nodes[j].y;
        const distance = Math.sqrt(dx * dx + dy * dy);

        // All nodes connected, opacity based on distance
        const opacity = Math.max(0.01, (1 - distance / maxDistance) * 0.05);

        this.ctx.beginPath();
        this.ctx.moveTo(this.nodes[i].x, this.nodes[i].y);
        this.ctx.lineTo(this.nodes[j].x, this.nodes[j].y);
        this.ctx.strokeStyle = `rgba(100, 200, 255, ${opacity})`;
        this.ctx.lineWidth = 0.5;
        this.ctx.stroke();
      }
    }

    // Connect to mouse
    if (this.mouse.x != null && this.mouse.y != null) {
      for (let i = 0; i < this.nodes.length; i++) {
        const dx = this.mouse.x - this.nodes[i].x;
        const dy = this.mouse.y - this.nodes[i].y;
        const distance = Math.sqrt(dx * dx + dy * dy);

        if (distance < this.mouse.radius) {
          const opacity = (1 - distance / this.mouse.radius) * 0.5;

          this.ctx.beginPath();
          this.ctx.moveTo(this.nodes[i].x, this.nodes[i].y);
          this.ctx.lineTo(this.mouse.x, this.mouse.y);
          this.ctx.strokeStyle = `rgba(255, 150, 100, ${opacity})`;
          this.ctx.lineWidth = 1;
          this.ctx.stroke();
        }
      }
    }
  }

  private animate(): void {
    const canvas = this.graphCanvas().nativeElement;

    // Clear canvas
    this.ctx.clearRect(0, 0, canvas.width, canvas.height);
    this.ctx.shadowBlur = 0;

    // Draw connections first (so nodes appear on top)
    this.drawConnections();

    // Update and draw nodes
    this.nodes.forEach((node) => {
      node.update(this.mouse, canvas);
      node.draw(this.ctx);
    });

    this.animationFrameId = requestAnimationFrame(() => this.animate());
  }
}

class Node {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  originalRadius: number;

  constructor(canvas: HTMLCanvasElement) {
    this.x = Math.random() * canvas.width;
    this.y = Math.random() * canvas.height;
    this.vx = (Math.random() - 0.5) * 0.5;
    this.vy = (Math.random() - 0.5) * 0.5;
    this.radius = Math.random() * 2 + 1;
    this.originalRadius = this.radius;
  }

  update(
    mouse: { x: number | null; y: number | null; radius: number },
    canvas: HTMLCanvasElement,
  ): void {
    // Boundary collision
    if (this.x < 0 || this.x > canvas.width) this.vx = -this.vx;
    if (this.y < 0 || this.y > canvas.height) this.vy = -this.vy;

    // Move
    this.x += this.vx;
    this.y += this.vy;

    // Mouse interaction
    if (mouse.x != null && mouse.y != null) {
      const dx = mouse.x - this.x;
      const dy = mouse.y - this.y;
      const distance = Math.sqrt(dx * dx + dy * dy);

      if (distance < mouse.radius) {
        // Repel from mouse
        const force = (mouse.radius - distance) / mouse.radius;
        const angle = Math.atan2(dy, dx);
        this.x -= Math.cos(angle) * force * 2;
        this.y -= Math.sin(angle) * force * 2;

        // Grow size
        this.radius = this.originalRadius + force * 3;
      } else {
        // Return to original size
        this.radius = this.originalRadius;
      }
    } else {
      this.radius = this.originalRadius;
    }
  }

  draw(ctx: CanvasRenderingContext2D): void {
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(100, 200, 255, 0.8)';
    ctx.fill();

    // Glow effect
    ctx.shadowBlur = 10;
    ctx.shadowColor = 'rgba(100, 200, 255, 0.5)';
  }
}
