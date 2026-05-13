// ===== TIPOS BASE =====

export interface SvnConfig {
  svnPath?: string;
  workingDirectory?: string;
  username?: string;
  password?: string;
  timeout?: number;

  // ▼ Multi-WC 지원용 신규 필드 (모두 옵셔널, 하위 호환)
  /** 다중 SVN 루트 (있으면 우선 사용, 없으면 workingDirectory를 단일 루트로 사용) */
  workingDirectories?: string[];
  /** Working copy 재귀 탐색 최대 깊이 (기본 5) */
  maxDiscoveryDepth?: number;
  /** Working copy 탐색 결과 캐시 TTL (ms, 기본 5분) */
  discoveryCacheTtlMs?: number;
}

export interface SvnResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  command: string;
  workingDirectory: string;
  executionTime?: number;
}

export class SvnError extends Error {
  code?: number;
  stderr?: string;
  command?: string;

  constructor(message: string) {
    super(message);
    this.name = 'SvnError';
  }
}

// ===== TIPOS DE INFORMACIÓN DEL REPOSITORIO =====

export interface SvnInfo {
  path: string;
  workingCopyRootPath: string;
  url: string;
  relativeUrl: string;
  repositoryRoot: string;
  repositoryUuid: string;
  revision: number;
  nodeKind: 'file' | 'directory';
  schedule: string;
  lastChangedAuthor: string;
  lastChangedRev: number;
  lastChangedDate: string;
  textLastUpdated?: string;
  checksum?: string;
}

export interface SvnStatus {
  path: string;
  status: 'unversioned' | 'added' | 'deleted' | 'modified' | 'replaced' | 'merged' | 'conflicted' | 'ignored' | 'none' | 'normal' | 'external' | 'incomplete';
  revision?: number;
  changedRev?: number;
  changedAuthor?: string;
  changedDate?: string;
}

export interface SvnLogEntry {
  revision: number;
  author: string;
  date: string;
  message: string;
  changedPaths?: SvnChangedPath[];
}

export interface SvnChangedPath {
  action: 'A' | 'D' | 'M' | 'R';
  path: string;
  copyFromPath?: string;
  copyFromRev?: number;
}

// ===== TIPOS DE DIFERENCIAS =====

export interface SvnDiff {
  oldPath: string;
  newPath: string;
  oldRevision?: number;
  newRevision?: number;
  hunks: SvnDiffHunk[];
}

export interface SvnDiffHunk {
  oldStart: number;
  oldCount: number;
  newStart: number;
  newCount: number;
  lines: SvnDiffLine[];
}

export interface SvnDiffLine {
  type: 'context' | 'added' | 'deleted';
  content: string;
  oldLineNumber?: number;
  newLineNumber?: number;
}

// ===== TIPOS DE RAMAS =====

export interface SvnBranch {
  name: string;
  url: string;
  lastChangedRev: number;
  lastChangedAuthor: string;
  lastChangedDate: string;
}

export interface SvnMergeInfo {
  sourcePath: string;
  mergedRevisions: number[];
  eligibleRevisions: number[];
}

// ===== TIPOS DE PROPIEDADES =====

export interface SvnProperty {
  name: string;
  value: string;
  path: string;
}

export interface SvnPropertyList {
  path: string;
  properties: Record<string, string>;
}

// ===== TIPOS DE LOCK =====

export interface SvnLock {
  path: string;
  token: string;
  owner: string;
  comment?: string;
  created: string;
  expires?: string;
}

// ===== TIPOS DE BLAME/ANNOTATION =====

export interface SvnBlameLine {
  revision: number;
  author: string;
  date: string;
  lineNumber: number;
  content: string;
}

export interface SvnBlame {
  path: string;
  lines: SvnBlameLine[];
}

// ===== TIPOS PARA OPERACIONES DE ARCHIVOS =====

export interface SvnAddOptions {
  force?: boolean;
  noIgnore?: boolean;
  autoProps?: boolean;
  noAutoProps?: boolean;
  parents?: boolean;
}

export interface SvnCommitOptions {
  message: string;
  file?: string;
  force?: boolean;
  keepLocks?: boolean;
  noUnlock?: boolean;
  targets?: string[];
}

export interface SvnUpdateOptions {
  revision?: number | 'HEAD' | 'BASE' | 'COMMITTED' | 'PREV';
  force?: boolean;
  ignoreExternals?: boolean;
  acceptConflicts?: 'postpone' | 'base' | 'mine-conflict' | 'theirs-conflict' | 'mine-full' | 'theirs-full';
}

export interface SvnCheckoutOptions {
  revision?: number | 'HEAD';
  depth?: 'empty' | 'files' | 'immediates' | 'infinity';
  force?: boolean;
  ignoreExternals?: boolean;
}

export interface SvnCopyOptions {
  message?: string;
  revision?: number | 'HEAD' | 'BASE' | 'COMMITTED' | 'PREV';
  parents?: boolean;
}

export interface SvnMoveOptions {
  message?: string;
  force?: boolean;
  parents?: boolean;
}

export interface SvnDeleteOptions {
  message?: string;
  force?: boolean;
  keepLocal?: boolean;
}

// ===== TIPOS PARA MERGE =====

export interface SvnMergeOptions {
  dryRun?: boolean;
  force?: boolean;
  ignoreAncestry?: boolean;
  recordOnly?: boolean;
  acceptConflicts?: 'postpone' | 'base' | 'mine-conflict' | 'theirs-conflict' | 'mine-full' | 'theirs-full';
}

// ===== TIPOS PARA SWITCH =====

export interface SvnSwitchOptions {
  revision?: number | 'HEAD';
  force?: boolean;
  ignoreExternals?: boolean;
  acceptConflicts?: 'postpone' | 'base' | 'mine-conflict' | 'theirs-conflict' | 'mine-full' | 'theirs-full';
}

// ===== TIPOS PARA RESOLVE =====

export interface SvnResolveOptions {
  accept: 'base' | 'working' | 'mine-conflict' | 'theirs-conflict' | 'mine-full' | 'theirs-full';
  recursive?: boolean;
}

// ===== TIPOS PARA IMPORT/EXPORT =====

export interface SvnImportOptions {
  message: string;
  noIgnore?: boolean;
  force?: boolean;
  noAutoProps?: boolean;
  autoProps?: boolean;
}

export interface SvnExportOptions {
  revision?: number | 'HEAD';
  force?: boolean;
  nativeEol?: 'LF' | 'CR' | 'CRLF';
  ignoreExternals?: boolean;
}

// ===== TIPOS PARA HERRAMIENTAS DE ANÁLISIS =====

export interface SvnWorkingCopySummary {
  info: SvnInfo;
  status: SvnStatus[];
  branches: SvnBranch[];
  conflictedFiles: string[];
  modifiedFiles: string[];
  addedFiles: string[];
  deletedFiles: string[];
  unversionedFiles: string[];
  totalFiles: number;
  totalSize?: number;
}

export interface SvnBranchComparison {
  sourceBranch: string;
  targetBranch: string;
  differences: SvnLogEntry[];
  mergeInfo: SvnMergeInfo;
  conflictingFiles: string[];
}

export interface SvnHealthCheck {
  status: 'healthy' | 'warning' | 'error';
  issues: SvnHealthIssue[];
  workingCopyValid: boolean;
  repositoryAccessible: boolean;
  conflictsDetected: boolean;
  uncommittedChanges: boolean;
  lastUpdate: string;
}

export interface SvnHealthIssue {
  type: 'error' | 'warning' | 'info';
  message: string;
  path?: string;
  suggestion?: string;
}

// ===== TIPOS PARA OPERACIONES EN LOTE =====

export interface SvnBatchOperation {
  type: 'add' | 'delete' | 'move' | 'copy' | 'revert';
  source: string;
  target?: string;
  options?: any;
}

export interface SvnBatchResult {
  operation: SvnBatchOperation;
  success: boolean;
  error?: string;
  result?: any;
}

// ===== CONSTANTES =====

export const SVN_STATUS_CODES = {
  ' ': 'none',
  'A': 'added',
  'D': 'deleted',
  'M': 'modified',
  'R': 'replaced',
  'C': 'conflicted',
  'X': 'external',
  'I': 'ignored',
  '?': 'unversioned',
  '!': 'missing',
  '~': 'obstructed'
} as const;

export const SVN_ACTION_CODES = {
  'A': 'added',
  'D': 'deleted',
  'M': 'modified',
  'R': 'replaced'
} as const; 