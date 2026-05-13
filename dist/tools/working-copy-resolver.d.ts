export interface ResolverConfig {
    roots: string[];
    maxDepth: number;
    cacheTtlMs: number;
}
export declare class WorkingCopyResolver {
    private readonly config;
    private cache;
    constructor(config: ResolverConfig);
    getRoots(): string[];
    discoverAll(forceRefresh?: boolean): Promise<string[]>;
    discoverUnder(root: string, forceRefresh?: boolean): Promise<string[]>;
    private walk;
    isAllowedPath(targetPath: string): boolean;
    findContainingWorkingCopy(targetPath: string): Promise<string | null>;
    resolveCwd(targetPath?: string): Promise<{
        cwd: string;
        resolvedPath?: string;
    }>;
    invalidateCache(): void;
}
//# sourceMappingURL=working-copy-resolver.d.ts.map