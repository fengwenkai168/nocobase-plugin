type RequestFn = (options: {
    url: string;
    method?: string;
    headers?: Record<string, string>;
    params?: Record<string, unknown>;
    data?: unknown;
}) => Promise<unknown>;
export interface WatermarkController {
    load(): void;
    cleanup(): void;
}
export declare function createWatermarkController(request: RequestFn): WatermarkController;
export {};
