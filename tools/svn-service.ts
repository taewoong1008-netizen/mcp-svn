import {
  SvnConfig,
  SvnResponse,
  SvnInfo,
  SvnStatus,
  SvnLogEntry,
  SvnCheckoutOptions,
  SvnUpdateOptions,
  SvnCommitOptions,
  SvnAddOptions,
  SvnDeleteOptions,
  SvnError
} from '../common/types.js';

import {
  createSvnConfig,
  executeSvnCommand,
  parseInfoOutput,
  parseStatusOutput,
  parseLogOutput,
  validateSvnInstallation,
  isWorkingCopy,
  normalizePath,
  validatePath,
  validateSvnUrl,
  cleanOutput,
  clearSvnCredentials,
} from '../common/utils.js';

import { WorkingCopyResolver } from './working-copy-resolver.js';

/**
 * Multi working-copy 인식 SVN 서비스.
 *
 * 동작 방식:
 * - 환경변수 SVN_WORKING_DIRECTORIES (콤마 구분) 또는 SVN_WORKING_DIRECTORY (단일, 호환)로 루트 설정
 * - 각 operation마다 path 인자에 따라 적절한 working copy를 cwd로 결정
 * - executeSvnCommand 호출 시 임시 config(`{...this.config, workingDirectory: cwd}`) 전달
 */
export class SvnService {
  private config: SvnConfig;
  private resolver: WorkingCopyResolver;

  constructor(config: Partial<SvnConfig> = {}) {
    this.config = createSvnConfig(config);

    // Resolver 초기화: config에서 roots 가져오기
    // workingDirectories(복수)가 있으면 그걸 쓰고, 없으면 workingDirectory(단수)를 배열로 감싸기
    const roots = this.config.workingDirectories
      ?? (this.config.workingDirectory ? [this.config.workingDirectory] : [process.cwd()]);

    this.resolver = new WorkingCopyResolver({
      roots,
      maxDepth: this.config.maxDiscoveryDepth ?? 5,
      cacheTtlMs: this.config.discoveryCacheTtlMs ?? 5 * 60 * 1000,
    });
  }

  // ============================================================
  // Helpers
  // ============================================================

  /**
   * 주어진 path에 대응하는 임시 config를 반환.
   * path 있음 → 그 path가 속한 WC를 cwd로
   * path 없음 → 첫 번째 발견된 WC를 cwd로
   */
  private async configFor(targetPath?: string): Promise<SvnConfig> {
    const { cwd } = await this.resolver.resolveCwd(targetPath);
    return { ...this.config, workingDirectory: cwd };
  }

  /**
   * 여러 path가 모두 같은 WC 안에 있는지 검증하고 그 WC를 cwd로 사용하는 config 반환.
   * 서로 다른 WC에 걸친 paths는 단일 SVN 명령으로 처리 불가 → 에러.
   */
  private async configForPaths(paths: string[]): Promise<SvnConfig> {
    if (paths.length === 0) {
      return this.configFor();
    }
    const wcs = await Promise.all(
      paths.map(p => this.resolver.findContainingWorkingCopy(p))
    );
    const unique = Array.from(new Set(wcs.filter(Boolean) as string[]));
    if (unique.length === 0) {
      throw new SvnError(
        `None of the provided paths belong to a known SVN working copy. ` +
        `Call svn_list_working_copies to see available WCs.`
      );
    }
    if (unique.length > 1) {
      throw new SvnError(
        `Paths span multiple working copies: ${unique.join(', ')}. ` +
        `One SVN command cannot operate across WCs. Split into per-WC calls.`
      );
    }
    return { ...this.config, workingDirectory: unique[0] };
  }

  /** SVN 에러를 사람 친화적 메시지로 변환 */
  private handleSvnError(error: any, operation: string, cwd?: string): never {
    let message = `Failed to ${operation}`;
    const ctx = cwd ? ` (cwd: ${cwd})` : '';

    if (error.message?.includes('E155007') || error.message?.includes('not a working copy')) {
      message = `Directory${ctx} is not an SVN working copy. ` +
        `Run svn_list_working_copies or svn_checkout first.`;
    } else if (error.message?.includes('E175002') || error.message?.includes('Unable to connect')) {
      message = `Cannot connect to SVN repository${ctx}. Check network and credentials.`;
    } else if (error.message?.includes('E170001') || error.message?.includes('Authentication failed')) {
      message = `SVN authentication failed${ctx}. Check SVN_USERNAME / SVN_PASSWORD.`;
    } else if (error.message?.includes('E155036') || error.message?.includes('working copy locked')) {
      message = `Working copy is locked${ctx}. Run svn_cleanup to resolve.`;
    } else if (error.message?.includes('E200030') || error.message?.includes('sqlite')) {
      message = `Working copy database error${ctx}. Run svn_cleanup to repair.`;
    } else if (error.stderr && error.stderr.length > 0) {
      message = `${message}${ctx}: ${error.stderr}`;
    } else {
      message = `${message}${ctx}: ${error.message}`;
    }

    throw new SvnError(message);
  }

  // ============================================================
  // Multi-WC 전용 API (신규)
  // ============================================================

  /**
   * 설정된 루트(들) 아래의 모든 SVN working copy 목록 반환.
   *
   * @param refresh 캐시 무시하고 다시 스캔
   */
  async listWorkingCopies(refresh = false): Promise<SvnResponse<{
    count: number;
    workingCopies: string[];
    configuredRoots: string[];
    fromCache: boolean;
  }>> {
    try {
      const before = refresh ? 0 : Date.now();
      if (refresh) this.resolver.invalidateCache();

      const wcs = await this.resolver.discoverAll(refresh);
      const elapsedMs = Date.now() - before;

      return {
        success: true,
        data: {
          count: wcs.length,
          workingCopies: wcs,
          configuredRoots: this.resolver.getRoots(),
          fromCache: !refresh && elapsedMs < 50, // 캐시 히트면 거의 즉시 반환됨
        },
        command: 'list-working-copies',
        workingDirectory: this.resolver.getRoots().join(','),
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
        command: 'list-working-copies',
        workingDirectory: this.resolver.getRoots().join(','),
      };
    }
  }

  // ============================================================
  // Existing operations (refactored for multi-WC)
  // ============================================================

  /**
   * 전체 SVN 환경 + 모든 working copy 상태 점검.
   */
  async healthCheck(): Promise<SvnResponse<{
    svnAvailable: boolean;
    version?: string;
    discoveredCount: number;
    workingCopies: Array<{ path: string; valid: boolean; accessible: boolean; error?: string }>;
  }>> {
    try {
      // 1. SVN 자체 설치 확인 (cwd 무관)
      const svnAvailable = await validateSvnInstallation(this.config);
      if (!svnAvailable) {
        return {
          success: false,
          error: 'SVN is not available in the system PATH',
          command: 'svn --version',
          workingDirectory: this.resolver.getRoots().join(','),
        };
      }

      const versionResponse = await executeSvnCommand(this.config, ['--version', '--quiet']);
      const version = (versionResponse.data as string).trim();

      // 2. 모든 WC 발견 + 각각 검증
      const discovered = await this.resolver.discoverAll();
      const wcResults = await Promise.all(discovered.map(async (wcPath: string) => {
        const valid = await isWorkingCopy(wcPath);
        if (!valid) {
          return { path: wcPath, valid: false, accessible: false, error: 'Not a working copy (no .svn folder)' };
        }
        try {
          // svn info 실행 가능한지로 접근성 검증
          await executeSvnCommand({ ...this.config, workingDirectory: wcPath }, ['info']);
          return { path: wcPath, valid: true, accessible: true };
        } catch (err: any) {
          return { path: wcPath, valid: true, accessible: false, error: err.message };
        }
      }));

      return {
        success: true,
        data: {
          svnAvailable,
          version,
          discoveredCount: discovered.length,
          workingCopies: wcResults,
        },
        command: 'health-check',
        workingDirectory: this.resolver.getRoots().join(','),
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
        command: 'health-check',
        workingDirectory: this.resolver.getRoots().join(','),
      };
    }
  }

  /**
   * 특정 working copy(또는 첫 번째 WC)의 SVN 명령 상태 진단
   */
  async diagnoseCommands(targetPath?: string): Promise<SvnResponse<{
    statusLocal: boolean;
    statusRemote: boolean;
    logBasic: boolean;
    workingCopyPath: string;
    errors: string[];
    suggestions: string[];
  }>> {
    const config = await this.configFor(targetPath);
    const results = {
      statusLocal: false,
      statusRemote: false,
      logBasic: false,
      workingCopyPath: config.workingDirectory!,
      errors: [] as string[],
      suggestions: [] as string[],
    };

    try {
      try {
        await executeSvnCommand(config, ['status']);
        results.statusLocal = true;
      } catch (error: any) {
        const e = this.categorizeError(error, 'status local');
        results.errors.push(e.message);
        if (e.suggestion) results.suggestions.push(e.suggestion);
      }

      try {
        await executeSvnCommand(config, ['status', '--show-updates']);
        results.statusRemote = true;
      } catch (error: any) {
        const e = this.categorizeError(error, 'status remote');
        results.errors.push(e.message);
        if (e.suggestion) results.suggestions.push(e.suggestion);
      }

      try {
        await executeSvnCommand(config, ['log', '--limit', '1']);
        results.logBasic = true;
      } catch (error: any) {
        const e = this.categorizeError(error, 'log basic');
        results.errors.push(e.message);
        if (e.suggestion) results.suggestions.push(e.suggestion);
      }

      if (!results.statusRemote && !results.logBasic && results.statusLocal) {
        results.suggestions.push(
          'Remote commands fail but local works. Check network connectivity and SVN credentials.'
        );
      }

      return {
        success: true,
        data: results,
        command: 'diagnostic',
        workingDirectory: config.workingDirectory!,
      };
    } catch (error: any) {
      results.errors.push(`General error: ${error.message}`);
      return {
        success: false,
        data: results,
        error: error.message,
        command: 'diagnostic',
        workingDirectory: config.workingDirectory!,
      };
    }
  }

  async getInfo(targetPath?: string): Promise<SvnResponse<SvnInfo>> {
    let config: SvnConfig;
    try {
      const args = ['info'];

      if (targetPath && validateSvnUrl(targetPath)) {
        // URL이면 cwd는 임의의 WC면 충분
        config = await this.configFor();
        args.push(targetPath);
      } else if (targetPath) {
        if (!validatePath(targetPath)) {
          throw new SvnError(`Invalid path or URL: ${targetPath}`);
        }
        config = await this.configFor(targetPath);
        args.push(normalizePath(targetPath));
      } else {
        config = await this.configFor();
      }

      const response = await executeSvnCommand(config, args);
      const info = parseInfoOutput(cleanOutput(response.data as string));

      return {
        success: true,
        data: info,
        command: response.command,
        workingDirectory: response.workingDirectory,
        executionTime: response.executionTime,
      };
    } catch (error: any) {
      this.handleSvnError(error, 'get SVN info', (error as any).cwd);
    }
  }

  async getStatus(targetPath?: string, showAll = false): Promise<SvnResponse<SvnStatus[]>> {
    try {
      const config = await this.configFor(targetPath);
      const args = ['status'];

      if (targetPath) {
        if (!validatePath(targetPath)) {
          throw new SvnError(`Invalid path: ${targetPath}`);
        }
        args.push(normalizePath(targetPath));
      }

      let response;
      if (showAll) {
        try {
          response = await executeSvnCommand(config, [...args, '--show-updates']);
        } catch (error: any) {
          console.warn(`Warning: --show-updates failed, fallback to local: ${error.message}`);
          response = await executeSvnCommand(config, args);
        }
      } else {
        response = await executeSvnCommand(config, args);
      }

      const statusList = parseStatusOutput(cleanOutput(response.data as string));

      return {
        success: true,
        data: statusList,
        command: response.command,
        workingDirectory: response.workingDirectory,
        executionTime: response.executionTime,
      };
    } catch (error: any) {
      this.handleSvnError(error, 'get SVN status');
    }
  }

  async getLog(
    targetPath?: string,
    limit?: number,
    revision?: string
  ): Promise<SvnResponse<SvnLogEntry[]>> {
    try {
      const config = await this.configFor(targetPath);
      const args = ['log'];

      if (limit && limit > 0) args.push('--limit', limit.toString());
      if (revision) args.push('--revision', revision);

      if (targetPath) {
        if (!validatePath(targetPath)) {
          throw new SvnError(`Invalid path: ${targetPath}`);
        }
        args.push(normalizePath(targetPath));
      }

      let response;
      try {
        response = await executeSvnCommand(config, args);
      } catch (error: any) {
        if ((error.message?.includes('spawn') && error.message?.includes('ENOENT')) || error.code === 127) {
          throw new SvnError(
            'SVN is not installed or not in PATH. Install Subversion to use this command.'
          );
        }
        if (
          error.message?.includes('E175002') ||
          error.message?.includes('Unable to connect') ||
          error.message?.includes('Connection refused') ||
          error.message?.includes('Network is unreachable') ||
          error.code === 1
        ) {
          console.warn(`Remote log failed: ${error.message}`);
          throw new SvnError(
            `Failed to get log. Possible causes:\n` +
            `- No connectivity to SVN server\n` +
            `- Missing or wrong credentials\n` +
            `- SVN server temporarily unavailable\n` +
            `- Working copy out of sync`
          );
        }
        throw error;
      }

      const logEntries = parseLogOutput(cleanOutput(response.data as string));

      return {
        success: true,
        data: logEntries,
        command: response.command,
        workingDirectory: response.workingDirectory,
        executionTime: response.executionTime,
      };
    } catch (error: any) {
      this.handleSvnError(error, 'get SVN log');
    }
  }

  async getDiff(
    targetPath?: string,
    oldRevision?: string,
    newRevision?: string
  ): Promise<SvnResponse<string>> {
    try {
      const config = await this.configFor(targetPath);
      const args = ['diff'];

      if (oldRevision && newRevision) {
        args.push('--old', `${targetPath || '.'}@${oldRevision}`);
        args.push('--new', `${targetPath || '.'}@${newRevision}`);
      } else if (oldRevision) {
        args.push('--revision', oldRevision);
        if (targetPath) args.push(normalizePath(targetPath));
      } else if (targetPath) {
        if (!validatePath(targetPath)) {
          throw new SvnError(`Invalid path: ${targetPath}`);
        }
        args.push(normalizePath(targetPath));
      }

      const response = await executeSvnCommand(config, args);

      return {
        success: true,
        data: cleanOutput(response.data as string),
        command: response.command,
        workingDirectory: response.workingDirectory,
        executionTime: response.executionTime,
      };
    } catch (error: any) {
      throw new SvnError(`Failed to get SVN diff: ${error.message}`);
    }
  }

  async checkout(
    url: string,
    targetPath?: string,
    options: SvnCheckoutOptions = {}
  ): Promise<SvnResponse<string>> {
    try {
      if (!validateSvnUrl(url)) {
        throw new SvnError(`Invalid SVN URL: ${url}`);
      }

      // checkout은 작업 결과로 새 WC를 만드는 명령.
      // targetPath가 있으면 그 부모 디렉토리를 cwd로, 없으면 첫 번째 루트를 cwd로
      let cwd: string;
      if (targetPath) {
        if (!validatePath(targetPath)) {
          throw new SvnError(`Invalid path: ${targetPath}`);
        }
        // checkout target은 아직 WC가 아닐 수 있음 → 루트 검증만
        if (!this.resolver.isAllowedPath(targetPath)) {
          throw new SvnError(
            `Path "${targetPath}" is outside allowed roots: ${this.resolver.getRoots().join(', ')}`
          );
        }
        cwd = this.resolver.getRoots()[0];
      } else {
        cwd = this.resolver.getRoots()[0];
      }
      const config: SvnConfig = { ...this.config, workingDirectory: cwd };

      const args = ['checkout'];
      if (options.revision) args.push('--revision', options.revision.toString());
      if (options.depth) args.push('--depth', options.depth);
      if (options.force) args.push('--force');
      if (options.ignoreExternals) args.push('--ignore-externals');

      args.push(url);
      if (targetPath) args.push(normalizePath(targetPath));

      const response = await executeSvnCommand(config, args);

      // 새 WC가 추가됐을 수 있으니 캐시 무효화
      this.resolver.invalidateCache();

      return {
        success: true,
        data: cleanOutput(response.data as string),
        command: response.command,
        workingDirectory: response.workingDirectory,
        executionTime: response.executionTime,
      };
    } catch (error: any) {
      throw new SvnError(`Failed to checkout: ${error.message}`);
    }
  }

  async update(
    targetPath?: string,
    options: SvnUpdateOptions = {}
  ): Promise<SvnResponse<string>> {
    try {
      const config = await this.configFor(targetPath);
      const args = ['update'];

      if (options.revision) args.push('--revision', options.revision.toString());
      if (options.force) args.push('--force');
      if (options.ignoreExternals) args.push('--ignore-externals');
      if (options.acceptConflicts) args.push('--accept', options.acceptConflicts);

      if (targetPath) {
        if (!validatePath(targetPath)) {
          throw new SvnError(`Invalid path: ${targetPath}`);
        }
        args.push(normalizePath(targetPath));
      }

      const response = await executeSvnCommand(config, args);

      return {
        success: true,
        data: cleanOutput(response.data as string),
        command: response.command,
        workingDirectory: response.workingDirectory,
        executionTime: response.executionTime,
      };
    } catch (error: any) {
      throw new SvnError(`Failed to update: ${error.message}`);
    }
  }

  async add(
    paths: string | string[],
    options: SvnAddOptions = {}
  ): Promise<SvnResponse<string>> {
    try {
      const pathArray = Array.isArray(paths) ? paths : [paths];
      for (const p of pathArray) {
        if (!validatePath(p)) throw new SvnError(`Invalid path: ${p}`);
      }

      const config = await this.configForPaths(pathArray);
      const args = ['add'];

      if (options.force) args.push('--force');
      if (options.noIgnore) args.push('--no-ignore');
      if (options.autoProps) args.push('--auto-props');
      if (options.noAutoProps) args.push('--no-auto-props');
      if (options.parents) args.push('--parents');

      args.push(...pathArray.map(p => normalizePath(p)));

      const response = await executeSvnCommand(config, args);

      return {
        success: true,
        data: cleanOutput(response.data as string),
        command: response.command,
        workingDirectory: response.workingDirectory,
        executionTime: response.executionTime,
      };
    } catch (error: any) {
      throw new SvnError(`Failed to add files: ${error.message}`);
    }
  }

  async commit(
    options: SvnCommitOptions,
    paths?: string[]
  ): Promise<SvnResponse<string>> {
    try {
      if (!options.message && !options.file) {
        throw new SvnError('Commit message is required');
      }

      // commit은 특정 path가 없으면 default WC에서, 있으면 path들의 WC에서
      const commitPaths = paths && paths.length > 0 ? paths : (options.targets ?? []);
      for (const p of commitPaths) {
        if (!validatePath(p)) throw new SvnError(`Invalid path: ${p}`);
      }

      const config = commitPaths.length > 0
        ? await this.configForPaths(commitPaths)
        : await this.configFor();

      const args = ['commit'];
      if (options.message) args.push('--message', options.message);
      if (options.file) args.push('--file', normalizePath(options.file));
      if (options.force) args.push('--force');
      if (options.keepLocks) args.push('--keep-locks');
      if (options.noUnlock) args.push('--no-unlock');

      if (commitPaths.length > 0) {
        args.push(...commitPaths.map(p => normalizePath(p)));
      }

      const response = await executeSvnCommand(config, args);

      return {
        success: true,
        data: cleanOutput(response.data as string),
        command: response.command,
        workingDirectory: response.workingDirectory,
        executionTime: response.executionTime,
      };
    } catch (error: any) {
      throw new SvnError(`Failed to commit: ${error.message}`);
    }
  }

  async delete(
    paths: string | string[],
    options: SvnDeleteOptions = {}
  ): Promise<SvnResponse<string>> {
    try {
      const pathArray = Array.isArray(paths) ? paths : [paths];
      for (const p of pathArray) {
        if (!validatePath(p)) throw new SvnError(`Invalid path: ${p}`);
      }

      const config = await this.configForPaths(pathArray);
      const args = ['delete'];
      if (options.force) args.push('--force');
      if (options.keepLocal) args.push('--keep-local');
      if (options.message) args.push('--message', options.message);

      args.push(...pathArray.map(p => normalizePath(p)));

      const response = await executeSvnCommand(config, args);

      return {
        success: true,
        data: cleanOutput(response.data as string),
        command: response.command,
        workingDirectory: response.workingDirectory,
        executionTime: response.executionTime,
      };
    } catch (error: any) {
      throw new SvnError(`Failed to delete files: ${error.message}`);
    }
  }

  async revert(paths: string | string[]): Promise<SvnResponse<string>> {
    try {
      const pathArray = Array.isArray(paths) ? paths : [paths];
      for (const p of pathArray) {
        if (!validatePath(p)) throw new SvnError(`Invalid path: ${p}`);
      }

      const config = await this.configForPaths(pathArray);
      const args = ['revert', ...pathArray.map(p => normalizePath(p))];
      const response = await executeSvnCommand(config, args);

      return {
        success: true,
        data: cleanOutput(response.data as string),
        command: response.command,
        workingDirectory: response.workingDirectory,
        executionTime: response.executionTime,
      };
    } catch (error: any) {
      throw new SvnError(`Failed to revert files: ${error.message}`);
    }
  }

  async cleanup(targetPath?: string): Promise<SvnResponse<string>> {
    try {
      const config = await this.configFor(targetPath);
      const args = ['cleanup'];
      if (targetPath) {
        if (!validatePath(targetPath)) {
          throw new SvnError(`Invalid path: ${targetPath}`);
        }
        args.push(normalizePath(targetPath));
      }
      const response = await executeSvnCommand(config, args);

      return {
        success: true,
        data: cleanOutput(response.data as string),
        command: response.command,
        workingDirectory: response.workingDirectory,
        executionTime: response.executionTime,
      };
    } catch (error: any) {
      throw new SvnError(`Failed to cleanup: ${error.message}`);
    }
  }

  async clearCredentials(): Promise<SvnResponse> {
    return await clearSvnCredentials(this.config);
  }

  // ============================================================
  // Internal: error categorization (그대로 유지)
  // ============================================================

  private categorizeError(error: any, commandType: string): { message: string; suggestion?: string } {
    const base = `${commandType} failed`;

    if ((error.message?.includes('spawn') && error.message?.includes('ENOENT')) || error.code === 127) {
      return {
        message: `${base}: SVN not installed or not in PATH`,
        suggestion: 'Install SVN (subversion) or verify PATH',
      };
    }
    if (
      error.message?.includes('E175002') ||
      error.message?.includes('Unable to connect') ||
      error.message?.includes('Connection refused') ||
      error.message?.includes('Network is unreachable')
    ) {
      return {
        message: `${base}: no connectivity to SVN server`,
        suggestion: 'Check internet connection and SVN server accessibility',
      };
    }
    if (
      error.message?.includes('E215004') ||
      error.message?.includes('No more credentials') ||
      error.message?.includes('we tried too many times')
    ) {
      return {
        message: `${base}: too many failed auth attempts`,
        suggestion: 'Clear SVN credential cache and verify SVN_USERNAME / SVN_PASSWORD',
      };
    }
    if (
      error.message?.includes('E170001') ||
      error.message?.includes('Authentication failed') ||
      error.message?.includes('authorization failed')
    ) {
      return {
        message: `${base}: authentication error`,
        suggestion: 'Verify SVN_USERNAME and SVN_PASSWORD',
      };
    }
    if (error.message?.includes('E155007') || error.message?.includes('not a working copy')) {
      return {
        message: `${base}: not a valid working copy`,
        suggestion: 'Use svn_list_working_copies to find a real WC, or svn_checkout first',
      };
    }
    if (error.message?.includes('E155036') || error.message?.includes('working copy locked')) {
      return {
        message: `${base}: working copy locked`,
        suggestion: 'Run svn_cleanup to unlock',
      };
    }
    if (error.code === 1) {
      return {
        message: `${base}: command failed with code 1 (possible network/auth issue)`,
        suggestion: 'Check connectivity, credentials, and repository accessibility',
      };
    }
    return { message: `${base}: ${error.message}` };
  }
}