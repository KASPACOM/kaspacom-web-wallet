import { Injectable } from "@angular/core";
import { AnalyticsBrowser } from '@segment/analytics-next'
import { environment } from "../../environments/environment";


@Injectable({
    providedIn: 'root',
})
export class MonitorService {
    private analytics: AnalyticsBrowser | undefined;

    constructor() {
        if (environment.segmentKey) {
            this.analytics = AnalyticsBrowser.load({ writeKey: environment.segmentKey });
        }
    }

    normalizeProperties(obj: any): any {
        if (typeof obj === 'object') {
            Object.keys(obj).forEach(key => {
                if (typeof obj[key] === 'bigint') {
                    obj[key] = Number(obj[key]);
                } else if (typeof obj[key] === 'object') {
                    obj[key] = this.normalizeProperties(obj[key]);
                }
            });
        }
        return obj;
    }

    track(event: string, properties?: any) {
        if (this.analytics) {
            console.log('TRACING', event, this.normalizeProperties(properties));
            this.analytics.track(event, this.normalizeProperties(properties));
        }
    }
}