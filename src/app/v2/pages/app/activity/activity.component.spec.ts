import { HttpClientTestingModule } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';

import { RpcService } from '../../../../services/kaspa-netwrok-services/rpc.service';
import { ActivityComponent } from './activity.component';

describe('ActivityComponent', () => {
  let component: ActivityComponent;
  let fixture: ComponentFixture<ActivityComponent>;
  let mockRpcService: jasmine.SpyObj<RpcService>;

  beforeEach(async () => {
    mockRpcService = jasmine.createSpyObj('RpcService', ['getRpc', 'refreshRpc', 'getNetwork']);
    mockRpcService.getRpc.and.returnValue(undefined);
    mockRpcService.getNetwork.and.returnValue('mainnet');

    await TestBed.configureTestingModule({
      imports: [ActivityComponent, HttpClientTestingModule],
      providers: [
        { provide: RpcService, useValue: mockRpcService }
      ]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ActivityComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
