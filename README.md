# mcp-svn-multi

Multi working-copy 지원 SVN MCP 서버. [@grec0/mcp-svn](https://github.com/gcorroto/mcp-svn) fork 본.

## 추가 기능
- `svn_list_working_copies`: 설정된 루트 아래 모든 working copy 자동 탐색
- 도구별 path 자동 해석: 모델이 path 전달 시 자동으로 해당 WC를 cwd로 사용
- 다중 SVN 루트 지원 (콤마 구분)

## 사용법 (Cherry Studio)

\`\`\`json
{
  "mcpServers": {
    "svn": {
      "command": "npx",
      "args": ["-y", "github:taewoong1008-netizen/mcp-svn"],
      "env": {
        "SVN_PATH": "svn",
        "SVN_WORKING_DIRECTORIES": "H:\\\\02.회사자료",
        "SVN_DISCOVERY_MAX_DEPTH": "6",
        "SVN_DISCOVERY_CACHE_TTL_MS": "600000",
        "SVN_USERNAME": "<본인 SVN ID>",
        "SVN_PASSWORD": "<본인 SVN PW>"
      }
    }
  }
}
\`\`\`

## 사전 요구사항
- Node.js 18 이상 (https://nodejs.org/)
- TortoiseSVN의 command line client (svn이 PATH에 있어야 함)

## 환경변수

| 변수 | 설명 | 기본값 |
|------|------|--------|
| `SVN_WORKING_DIRECTORIES` | 콤마 구분 SVN 루트들 | (필수) |
| `SVN_DISCOVERY_MAX_DEPTH` | 재귀 탐색 최대 깊이 | 5 |
| `SVN_DISCOVERY_CACHE_TTL_MS` | 발견 결과 캐시 TTL (ms) | 300000 |
| `SVN_USERNAME` / `SVN_PASSWORD` | SVN 자격증명 | - |



# SVN MCP Server

Un servidor MCP (Model Context Protocol) completo para integración con Subversion (SVN), diseñado para permitir a agentes de IA gestionar repositorios SVN de manera eficiente.

## 🎯 Características

- ✅ **Operaciones básicas de repositorio**: info, status, log, diff, checkout, update
- ✅ **Gestión de archivos**: add, commit, delete, revert
- ✅ **Herramientas de mantenimiento**: cleanup
- 🔄 **Gestión de ramas**: (En desarrollo)
- 🔄 **Operaciones avanzadas**: merge, switch, properties (En desarrollo)
- 🔄 **Herramientas de análisis**: blame, conflict detection (En desarrollo)
- 🔄 **Operaciones en lote**: (En desarrollo)

## 📋 Requisitos

- **Node.js** >= 18.0.0
- **Subversion (SVN)** instalado y disponible en PATH
- **TypeScript** (para desarrollo)

### 🔍 Detectar instalación de SVN

#### Verificar si SVN está instalado

```bash
# Comando básico para verificar SVN
svn --version

# Verificar ruta completa del ejecutable
where svn        # Windows
which svn        # Linux/Mac

# Verificar cliente SVN completo
svn --version --verbose
```

#### Salida esperada si SVN está correctamente instalado:

```
svn, version 1.14.x (r1876290)
   compiled Apr 13 2023, 17:22:07 on x86_64-pc-mingw32

Copyright (C) 2023 The Apache Software Foundation.
This software consists of contributions made by many people;
see the NOTICE file for more information.
Subversion is open source software, see http://subversion.apache.org/
```

#### ❌ Errores comunes si SVN NO está instalado:

```bash
# Windows
'svn' is not recognized as an internal or external command

# Linux/Mac  
svn: command not found
bash: svn: command not found
```

#### 🛠️ Diagnóstico avanzado

```bash
# Verificar PATH del sistema
echo $PATH                    # Linux/Mac
echo %PATH%                   # Windows CMD
$env:PATH                     # Windows PowerShell

# Buscar executables SVN en el sistema
find / -name "svn" 2>/dev/null           # Linux
Get-ChildItem -Path C:\ -Name "svn.exe" -Recurse -ErrorAction SilentlyContinue  # Windows PowerShell

# Verificar versión específica del cliente
svn --version | head -1       # Obtener solo la primera línea con la versión
```

### 💾 Instalar SVN en Windows

#### Opción 1: Gestores de paquetes

```bash
# Usando Chocolatey (Recomendado)
choco install subversion

# Usando winget
winget install CollabNet.Subversion

# Usando Scoop
scoop install subversion
```

#### Opción 2: Instaladores oficiales

1. **TortoiseSVN** (incluye cliente de línea de comandos):
   ```
   https://tortoisesvn.net/downloads.html
   ✅ Incluye cliente GUI y CLI
   ✅ Integración con Windows Explorer
   ```

2. **SlikSVN** (solo línea de comandos):
   ```
   https://sliksvn.com/download/
   ✅ Ligero (solo CLI)
   ✅ Ideal para automatización
   ```

3. **CollabNet Subversion**:
   ```
   https://www.collab.net/downloads/subversion
   ✅ Versión empresarial
   ✅ Soporte comercial disponible
   ```

#### Opción 3: Visual Studio o Git for Windows

```bash
# Si tienes Git for Windows instalado, puede incluir SVN
git svn --version

# Visual Studio también puede incluir SVN
# Ir a: Visual Studio Installer > Modify > Individual Components > Subversion
```

### 🐧 Instalar SVN en Linux

```bash
# Ubuntu/Debian
sudo apt-get update
sudo apt-get install subversion

# CentOS/RHEL/Fedora
sudo yum install subversion        # CentOS 7
sudo dnf install subversion        # CentOS 8/Fedora

# Arch Linux
sudo pacman -S subversion

# Alpine Linux
sudo apk add subversion
```

### 🍎 Instalar SVN en macOS

```bash
# Homebrew (Recomendado)
brew install subversion

# MacPorts
sudo port install subversion

# Desde Xcode Command Line Tools (puede estar incluido)
xcode-select --install
```

### 🔧 Configurar SVN después de la instalación

#### Verificar configuración global

```bash
# Ver configuración actual
svn config --list

# Configurar usuario global
svn config --global auth:username tu_usuario

# Configurar editor por defecto
svn config --global editor "code --wait"     # VS Code
svn config --global editor "notepad"         # Windows Notepad
svn config --global editor "nano"            # Linux/Mac nano
```

#### Verificar acceso a repositorios

```bash
# Probar conexión a repositorio (sin hacer checkout)
svn list https://svn.ejemplo.com/repo/trunk

# Probar con credenciales específicas
svn list https://svn.ejemplo.com/repo/trunk --username usuario --password contraseña
```

## 🚀 Instalación

### Desde NPM

```bash
npm install -g @grec0/mcp-svn
```

### Desarrollo Local

```bash
git clone https://github.com/gcorroto/mcp-svn.git
cd mcp-svn
npm install
npm run build
```

## ⚙️ Configuración

### Variables de Entorno

| Variable | Descripción | Por Defecto |
|----------|-------------|-------------|
| `SVN_PATH` | Ruta del ejecutable SVN | `svn` |
| `SVN_WORKING_DIRECTORY` | Directorio de trabajo | `process.cwd()` |
| `SVN_USERNAME` | Usuario para autenticación | - |
| `SVN_PASSWORD` | Contraseña para autenticación | - |
| `SVN_TIMEOUT` | Timeout en milisegundos | `30000` |

### Ejemplo de configuración MCP

```json
{
  "mcpServers": {
    "svn": {
      "command": "npx",
      "args": ["@grec0/mcp-svn"],
      "env": {
        "SVN_PATH": "svn",
        "SVN_WORKING_DIRECTORY": "/path/to/working/copy",
        "SVN_USERNAME": "tu_usuario",
        "SVN_PASSWORD": "tu_contraseña"
      }
    }
  }
}
```

## 🛠️ Herramientas Disponibles

### Operaciones Básicas

#### `svn_health_check`
Verificar el estado de salud del sistema SVN y working copy.

```
svn_health_check()
```

#### `svn_info`
Obtener información detallada del working copy o archivo específico.

```
svn_info(path?: string)
```

#### `svn_status` 
Ver el estado de archivos en el working copy.

```
svn_status(path?: string, showAll?: boolean)
```

#### `svn_log`
Ver historial de commits del repositorio.

```
svn_log(path?: string, limit?: number, revision?: string)
```

#### `svn_diff`
Ver diferencias entre versiones de archivos.

```
svn_diff(path?: string, oldRevision?: string, newRevision?: string)
```

### Operaciones de Repositorio

#### `svn_checkout`
Hacer checkout de un repositorio SVN.

```
svn_checkout(
  url: string,
  path?: string,
  revision?: number | "HEAD",
  depth?: "empty" | "files" | "immediates" | "infinity",
  force?: boolean,
  ignoreExternals?: boolean
)
```

#### `svn_update`
Actualizar working copy desde el repositorio.

```
svn_update(
  path?: string,
  revision?: number | "HEAD" | "BASE" | "COMMITTED" | "PREV",
  force?: boolean,
  ignoreExternals?: boolean,
  acceptConflicts?: "postpone" | "base" | "mine-conflict" | "theirs-conflict" | "mine-full" | "theirs-full"
)
```

### Gestión de Archivos

#### `svn_add`
Añadir archivos al control de versiones.

```
svn_add(
  paths: string | string[],
  force?: boolean,
  noIgnore?: boolean,
  parents?: boolean,
  autoProps?: boolean,
  noAutoProps?: boolean
)
```

#### `svn_commit`
Confirmar cambios al repositorio.

```
svn_commit(
  message: string,
  paths?: string[],
  file?: string,
  force?: boolean,
  keepLocks?: boolean,
  noUnlock?: boolean
)
```

#### `svn_delete`
Eliminar archivos del control de versiones.

```
svn_delete(
  paths: string | string[],
  message?: string,
  force?: boolean,
  keepLocal?: boolean
)
```

#### `svn_revert`
Revertir cambios locales en archivos.

```
svn_revert(paths: string | string[])
```

### Herramientas de Mantenimiento

#### `svn_cleanup`
Limpiar working copy de operaciones interrumpidas.

```
svn_cleanup(path?: string)
```

## 📖 Ejemplos de Uso

### Verificar estado del sistema

```javascript
// Verificar que SVN esté disponible y el working copy sea válido
const healthCheck = await svn_health_check();
```

### Obtener información del repositorio

```javascript
// Información general del working copy
const info = await svn_info();

// Información de un archivo específico
const fileInfo = await svn_info("src/main.js");
```

### Ver estado de archivos

```javascript
// Estado de todos los archivos
const status = await svn_status();

// Estado con información remota
const fullStatus = await svn_status(null, true);
```

### Hacer checkout de un repositorio

```javascript
const checkout = await svn_checkout(
  "https://svn.example.com/repo/trunk",
  "local-copy",
  "HEAD",
  "infinity",
  false,
  false
);
```

### Confirmar cambios

```javascript
// Añadir archivos
await svn_add(["src/new-file.js", "docs/readme.md"], { parents: true });

// Hacer commit
await svn_commit(
  "Add new feature and documentation",
  ["src/new-file.js", "docs/readme.md"]
);
```

## 🧪 Testing

```bash
# Ejecutar tests
npm test

# Tests con cobertura
npm run test -- --coverage

# Tests en modo watch
npm run test -- --watch
```

## 🏗️ Desarrollo

### Scripts disponibles

```bash
# Compilar TypeScript
npm run build

# Modo desarrollo
npm run dev

# Modo watch
npm run watch

# Inspector MCP
npm run inspector

# Tests
npm test

# Publicar nueva versión
npm run release:patch
npm run release:minor
npm run release:major
```

### Estructura del proyecto

```
svn-mcp/
├── package.json
├── tsconfig.json
├── jest.config.js
├── index.ts
├── common/
│   ├── types.ts      # Tipos TypeScript
│   ├── utils.ts      # Utilidades para SVN
│   └── version.ts    # Versión del paquete
├── tools/
│   └── svn-service.ts # Servicio principal SVN
├── tests/
│   └── integration.test.ts # Tests de integración
└── README.md
```

## 📊 Estado del Desarrollo

Ver el archivo [SVN_MCP_IMPLEMENTATION.md](./SVN_MCP_IMPLEMENTATION.md) para el checklist completo de implementación.

**Progreso actual:** Etapa 1 completada (Operaciones Básicas) ✅

**Próximas etapas:**
- Gestión de ramas (branching)
- Operaciones avanzadas (merge, switch)
- Herramientas de análisis
- Operaciones en lote

## 🐛 Troubleshooting

### SVN no encontrado

```
Error: SVN is not available in the system PATH
```

**Solución:** Instalar SVN y asegurarse de que esté en el PATH del sistema.

### No es un working copy

```
Error: Failed to get SVN info: svn: warning: W155007: '.' is not a working copy
```

**Solución:** Navegar a un directorio que sea un working copy de SVN o hacer checkout primero.

### Problemas de autenticación

```
Error: svn: E170001: Authentication failed
```

**Solución:** Configurar las variables de entorno `SVN_USERNAME` y `SVN_PASSWORD`.

### Timeout en operaciones largas

```
Error: Command timeout after 30000ms
```

**Solución:** Incrementar el valor de `SVN_TIMEOUT`.

## 📄 Licencia

MIT License - ver [LICENSE](LICENSE) para más detalles.

## 🤝 Contribuir

1. Fork el proyecto
2. Crear una rama feature (`git checkout -b feature/nueva-caracteristica`)
3. Commit los cambios (`git commit -am 'Add nueva caracteristica'`)
4. Push a la rama (`git push origin feature/nueva-caracteristica`)
5. Crear un Pull Request

## 📞 Soporte

- **Issues:** [GitHub Issues](https://github.com/gcorroto/mcp-svn/issues)
- **Documentación:** [Wiki del proyecto](https://github.com/gcorroto/mcp-svn/wiki)
- **Email:** soporte@grec0.dev 