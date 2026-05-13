import { SvnConfig, SvnResponse, SvnInfo, SvnStatus, SvnLogEntry, SvnCheckoutOptions, SvnUpdateOptions, SvnCommitOptions, SvnAddOptions, SvnDeleteOptions } from '../common/types.js';
/**
 * Multi working-copy 인식 SVN 서비스.
 *
 * 동작 방식:
 * - 환경변수 SVN_WORKING_DIRECTORIES (콤마 구분) 또는 SVN_WORKING_DIRECTORY (단일, 호환)로 루트 설정
 * - 각 operation마다 path 인자에 따라 적절한 working copy를 cwd로 결정
 * - executeSvnCommand 호출 시 임시 config(`{...this.config, workingDirectory: cwd}`) 전달
 */
export declare class SvnService {
    private config;
    private resolver;
    constructor(config?: Partial<SvnConfig>);
    /**
     * 주어진 path에 대응하는 임시 config를 반환.
     * path 있음 → 그 path가 속한 WC를 cwd로
     * path 없음 → 첫 번째 발견된 WC를 cwd로
     */
    private configFor;
    /**
     * 여러 path가 모두 같은 WC 안에 있는지 검증하고 그 WC를 cwd로 사용하는 config 반환.
     * 서로 다른 WC에 걸친 paths는 단일 SVN 명령으로 처리 불가 → 에러.
     */
    private configForPaths;
    /** SVN 에러를 사람 친화적 메시지로 변환 */
    private handleSvnError;
    /**
     * 설정된 루트(들) 아래의 모든 SVN working copy 목록 반환.
     *
     * @param refresh 캐시 무시하고 다시 스캔
     */
    listWorkingCopies(refresh?: boolean): Promise<SvnResponse<{
        count: number;
        workingCopies: string[];
        configuredRoots: string[];
        fromCache: boolean;
    }>>;
    /**
     * 전체 SVN 환경 + 모든 working copy 상태 점검.
     */
    healthCheck(): Promise<SvnResponse<{
        svnAvailable: boolean;
        version?: string;
        discoveredCount: number;
        workingCopies: Array<{
            path: string;
            valid: boolean;
            accessible: boolean;
            error?: string;
        }>;
    }>>;
    /**
     * 특정 working copy(또는 첫 번째 WC)의 SVN 명령 상태 진단
     */
    diagnoseCommands(targetPath?: string): Promise<SvnResponse<{
        statusLocal: boolean;
        statusRemote: boolean;
        logBasic: boolean;
        workingCopyPath: string;
        errors: string[];
        suggestions: string[];
    }>>;
    getInfo(targetPath?: string): Promise<SvnResponse<SvnInfo>>;
    getStatus(targetPath?: string, showAll?: boolean): Promise<SvnResponse<SvnStatus[]>>;
    getLog(targetPath?: string, limit?: number, revision?: string): Promise<SvnResponse<SvnLogEntry[]>>;
    getDiff(targetPath?: string, oldRevision?: string, newRevision?: string): Promise<SvnResponse<string>>;
    checkout(url: string, targetPath?: string, options?: SvnCheckoutOptions): Promise<SvnResponse<string>>;
    update(targetPath?: string, options?: SvnUpdateOptions): Promise<SvnResponse<string>>;
    add(paths: string | string[], options?: SvnAddOptions): Promise<SvnResponse<string>>;
    commit(options: SvnCommitOptions, paths?: string[]): Promise<SvnResponse<string>>;
    delete(paths: string | string[], options?: SvnDeleteOptions): Promise<SvnResponse<string>>;
    revert(paths: string | string[]): Promise<SvnResponse<string>>;
    cleanup(targetPath?: string): Promise<SvnResponse<string>>;
    clearCredentials(): Promise<SvnResponse>;
    private categorizeError;
}
//# sourceMappingURL=svn-service.d.ts.map