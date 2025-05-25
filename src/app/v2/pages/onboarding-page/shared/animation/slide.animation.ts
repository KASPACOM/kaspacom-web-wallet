import { trigger, transition, style, animate } from '@angular/animations';

export const slideAnimation = trigger('stepAnimation', [
  transition(':enter', [
    style({ transform: 'translateX(100%)', opacity: 0 }),
    animate(
      '300ms ease-out',
      style({
        transform: 'translateX(0)',
        opacity: 1,
      }),
    ),
  ]),
  // transition(':leave', [
  //   animate(
  //     '300ms ease-in',
  //     style({
  //       position: 'absolute',
  //       transform: 'translateX(-100%)',
  //       opacity: 0,
  //     }),
  //   ),
  // ]),
]);
