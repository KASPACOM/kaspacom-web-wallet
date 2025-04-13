export interface KnsDomainCheckResponse {
    success: boolean;
    data: {
        domains: Array<{
            domain: string;
            available: boolean;
            isReservedDomain: boolean;
        }>;
    };
}
