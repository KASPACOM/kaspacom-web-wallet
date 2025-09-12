import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ErrorNewWalletStepComponent } from './error-new-wallet-step.component';

describe('ErrorNewWalletStepComponent', () => {
  let component: ErrorNewWalletStepComponent;
  let fixture: ComponentFixture<ErrorNewWalletStepComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ErrorNewWalletStepComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ErrorNewWalletStepComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
