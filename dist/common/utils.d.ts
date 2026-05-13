import { SvnConfig, SvnResponse, SvnError, SvnInfo, SvnStatus, SvnLogEntry } from './types.js';
/**
 * Crear configuración de SVN desde variables de entorno y parámetros
 */
export declare function createSvnConfig(overrides?: Partial<SvnConfig>): SvnConfig;
/**
 * Validar que SVN esté disponible en el sistema
 */
export declare function validateSvnInstallation(config: SvnConfig): Promise<boolean>;
/**
 * Detectar si el directorio actual es un working copy de SVN
 */
export declare function isWorkingCopy(workingDirectory: string): Promise<boolean>;
/**
 * Normalizar rutas para Windows
 */
export declare function normalizePath(filePath: string): string;
/**
 * Escapar argumentos para línea de comandos en Windows
 */
export declare function escapeArgument(arg: string): string;
/**
 * Construir argumentos de autenticación
 */
export declare function buildAuthArgs(config: SvnConfig, options?: {
    noAuthCache?: boolean;
}): string[];
/**
 * Ejecutar comando SVN con manejo de errores mejorado
 */
export declare function executeSvnCommand(config: SvnConfig, args: string[], options?: {
    input?: string;
    encoding?: BufferEncoding;
    noAuthCache?: boolean;
}): Promise<SvnResponse>;
/**
 * Parsear output XML de SVN
 */
export declare function parseXmlOutput(xmlString: string): any;
/**
 * Parsear información de svn info
 */
export declare function parseInfoOutput(output: string): SvnInfo;
/**
 * Parsear output de svn status
 */
export declare function parseStatusOutput(output: string): SvnStatus[];
/**
 * Parsear output de svn log
 */
export declare function parseLogOutput(output: string): SvnLogEntry[];
/**
 * Formatear duración en milisegundos a formato legible
 */
export declare function formatDuration(milliseconds: number): string;
/**
 * Validar nombre de archivo/directorio
 */
export declare function validatePath(filePath: string): boolean;
/**
 * Obtener rutas relativas desde el directorio de trabajo
 */
export declare function getRelativePath(fullPath: string, workingDirectory: string): string;
/**
 * Validar URL de repositorio SVN
 */
export declare function validateSvnUrl(url: string): boolean;
/**
 * Limpiar y normalizar salida de comando
 */
export declare function cleanOutput(output: string): string;
/**
 * Crear mensaje de error SVN más descriptivo
 */
export declare function createSvnError(message: string, command?: string, stderr?: string): SvnError;
/**
 * Limpiar cache de credenciales SVN para resolver errores E215004
 */
export declare function clearSvnCredentials(config: SvnConfig): Promise<SvnResponse>;
//# sourceMappingURL=utils.d.ts.map