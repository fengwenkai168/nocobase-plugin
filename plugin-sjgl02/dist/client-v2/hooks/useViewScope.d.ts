export declare function useViewScope(api: any, target?: {
    type?: string;
    id?: string | number;
} | null): {
    viewScope: string;
    setViewScope: (val: string) => any;
    loading: boolean;
};
