import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root',
})
export class UtilsHelper {
  async retryOnError<T>(
    fn: () => Promise<T>,
    times: number = 5,
    waitBeforeNextAttempt = 1000,
    skipLog: boolean = false,
    stopFunction?: (error: any) => boolean
  ): Promise<T> {
    let attempt = 0;
    let lastError: any = null;

    while (attempt < times) {
      try {
        return await fn();
      } catch (error) {
        if (stopFunction && stopFunction(error)) {
          throw error;
        }
        attempt++;

        if (!skipLog) {
          console.log(`retryOnError: Error on attempt ${attempt} of ${times}`);
          console.log(error);
        }

        if (waitBeforeNextAttempt) {
          await new Promise((resolve) =>
            setTimeout(resolve, waitBeforeNextAttempt)
          );
        }

        lastError = error;
      }
    }

    throw lastError;
  }
}
