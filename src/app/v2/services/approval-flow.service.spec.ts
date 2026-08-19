import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { ApprovalFlowService } from './approval-flow.service';
import { FlowPagesService } from './flow-pages.service';

describe('ApprovalFlowService', () => {
  let service: ApprovalFlowService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        ApprovalFlowService,
        {
          provide: FlowPagesService,
          useValue: {
            addPage: jasmine.createSpy('addPage'),
            removePage: jasmine.createSpy('removePage'),
          },
        },
        {
          provide: Router,
          useValue: {
            navigate: jasmine.createSpy('navigate'),
          },
        },
      ],
    });

    service = TestBed.inject(ApprovalFlowService);
  });

  it('ignores action A poll updates after skip when action B is pending', () => {
    const actionACompletion = Promise.resolve();
    const actionAPollId =
      service.setActionIndexingCompletion(actionACompletion);
    service.setPendingConfirmation(
      { status: 'checking', message: 'Waiting for action A' },
      actionAPollId,
    );

    service.skipActionIndexing();

    const actionBCompletion = Promise.resolve();
    const actionBPollId =
      service.setActionIndexingCompletion(actionBCompletion);
    service.setPendingConfirmation(
      { status: 'checking', message: 'Waiting for action B' },
      actionBPollId,
    );

    service.setPendingConfirmation(
      { status: 'confirmed', message: 'Action A indexed' },
      actionAPollId,
    );

    expect(service.pendingConfirmation()).toEqual({
      status: 'checking',
      message: 'Waiting for action B',
    });

    service.setPendingConfirmation(
      { status: 'confirmed', message: 'Action B indexed' },
      actionBPollId,
    );

    expect(service.pendingConfirmation()).toEqual({
      status: 'confirmed',
      message: 'Action B indexed',
    });
  });
});
