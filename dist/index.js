#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { SvnService } from "./tools/svn-service.js";
import { formatDuration } from "./common/utils.js";
import { VERSION } from "./common/version.js";
const server = new McpServer({
    name: "svn-mcp-server",
    version: VERSION,
});
let svnService = null;
function getSvnService() {
    if (!svnService) {
        try {
            svnService = new SvnService();
        }
        catch (error) {
            throw new Error(`SVN configuration error: ${error.message}`);
        }
    }
    return svnService;
}
// ============================================================
// 신규 도구: svn_list_working_copies (multi-WC 디스커버리)
// ============================================================
server.tool("svn_list_working_copies", "설정된 SVN 루트(들) 아래의 모든 working copy 경로를 재귀 탐색하여 반환합니다. " +
    "결과는 캐시되며 (기본 5분), refresh=true로 강제 재스캔 가능합니다.", {
    refresh: z.boolean().optional().default(false)
        .describe("캐시를 무시하고 다시 스캔할지 여부"),
}, async (args) => {
    try {
        const result = await getSvnService().listWorkingCopies(args.refresh ?? false);
        const data = result.data;
        if (!result.success || data.count === 0) {
            return {
                content: [{
                        type: "text",
                        text: `📭 **발견된 Working Copy 없음**\n\n` +
                            `**설정된 루트:** ${data?.configuredRoots.join(', ') ?? 'N/A'}\n` +
                            `**최대 깊이:** SVN_DISCOVERY_MAX_DEPTH 환경변수 확인\n\n` +
                            `해결책:\n` +
                            `- SVN_WORKING_DIRECTORIES 환경변수가 올바른 루트를 가리키는지 확인\n` +
                            `- 해당 경로 아래에 \`.svn\` 폴더를 포함하는 디렉토리가 있는지 확인\n` +
                            `- 첫 스캔이라면 시간이 걸릴 수 있으니 잠시 후 다시 시도`,
                    }],
            };
        }
        const lines = [
            `📚 **발견된 SVN Working Copy** (${data.count}개${data.fromCache ? ', 캐시' : ', 새로 스캔'})\n`,
            `**설정된 루트:** ${data.configuredRoots.join(', ')}\n`,
            `**Working Copies:**`,
            ...data.workingCopies.map((wc, i) => `${i + 1}. \`${wc}\``),
        ];
        return {
            content: [{ type: "text", text: lines.join('\n') }],
        };
    }
    catch (error) {
        return {
            content: [{ type: "text", text: `❌ **Error:** ${error.message}` }],
        };
    }
});
// ============================================================
// 갱신: svn_health_check (multi-WC 전체 상태)
// ============================================================
server.tool("svn_health_check", "SVN 설치 상태 + 발견된 모든 working copy의 유효성·접근성 점검", {}, async () => {
    try {
        const result = await getSvnService().healthCheck();
        if (!result.success || !result.data) {
            return {
                content: [{ type: "text", text: `❌ **Error:** ${result.error || 'Unknown'}` }],
            };
        }
        const d = result.data;
        const lines = [
            `${d.svnAvailable ? '✅' : '❌'} **SVN 시스템 상태**\n`,
            `**SVN Available:** ${d.svnAvailable ? '예' : '아니오'}`,
            `**Version:** ${d.version ?? 'N/A'}`,
            `**Discovered Working Copies:** ${d.discoveredCount}개\n`,
        ];
        if (d.workingCopies.length === 0) {
            lines.push(`⚠️  **발견된 Working Copy 없음** — svn_list_working_copies를 호출하여 진단해 보세요.`);
        }
        else {
            lines.push(`**Working Copies:**`);
            for (const wc of d.workingCopies) {
                const icon = wc.valid && wc.accessible ? '✅' : (wc.valid ? '⚠️' : '❌');
                let line = `${icon} \`${wc.path}\``;
                if (!wc.accessible && wc.error) {
                    line += ` — ${wc.error}`;
                }
                lines.push(line);
            }
        }
        return {
            content: [{ type: "text", text: lines.join('\n') }],
        };
    }
    catch (error) {
        return {
            content: [{ type: "text", text: `❌ **Error:** ${error.message}` }],
        };
    }
});
// ============================================================
// 진단 (특정 WC 대상)
// ============================================================
server.tool("svn_diagnose", "특정 working copy에 대해 SVN 명령(status/log) 진단 실행. path를 생략하면 첫 번째 WC 대상.", {
    path: z.string().optional().describe("진단할 working copy 경로 (생략 시 첫 번째 WC)"),
}, async (args) => {
    try {
        const result = await getSvnService().diagnoseCommands(args.path);
        const data = result.data;
        const lines = [
            `🔍 **SVN 진단 결과**\n`,
            `**대상 WC:** ${data.workingCopyPath}\n`,
            `${data.statusLocal ? '✅' : '❌'} Status local`,
            `${data.statusRemote ? '✅' : '❌'} Status remote`,
            `${data.logBasic ? '✅' : '❌'} Log basic`,
        ];
        if (data.errors.length > 0) {
            lines.push(`\n**에러:**`);
            data.errors.forEach((e, i) => lines.push(`${i + 1}. ${e}`));
        }
        if (data.suggestions.length > 0) {
            lines.push(`\n**제안:**`);
            data.suggestions.forEach((s, i) => lines.push(`${i + 1}. ${s}`));
        }
        return { content: [{ type: "text", text: lines.join('\n') }] };
    }
    catch (error) {
        return {
            content: [{ type: "text", text: `❌ **Error:** ${error.message}` }],
        };
    }
});
// ============================================================
// 정보 조회
// ============================================================
server.tool("svn_info", "Working copy 또는 특정 경로/URL의 상세 SVN 정보 조회", {
    path: z.string().optional().describe("조회할 경로 또는 URL (생략 시 첫 번째 WC)"),
}, async (args) => {
    try {
        const result = await getSvnService().getInfo(args.path);
        const info = result.data;
        const text = `📋 **SVN Info**\n\n` +
            `**Path:** ${info.path}\n` +
            `**URL:** ${info.url}\n` +
            `**Relative URL:** ${info.relativeUrl}\n` +
            `**Repository Root:** ${info.repositoryRoot}\n` +
            `**UUID:** ${info.repositoryUuid}\n` +
            `**Revision:** ${info.revision}\n` +
            `**Node Kind:** ${info.nodeKind}\n` +
            `**Last Author:** ${info.lastChangedAuthor}\n` +
            `**Last Revision:** ${info.lastChangedRev}\n` +
            `**Last Date:** ${info.lastChangedDate}\n` +
            `**WC Root:** ${info.workingCopyRootPath}\n` +
            `**Exec Time:** ${formatDuration(result.executionTime || 0)}`;
        return { content: [{ type: "text", text }] };
    }
    catch (error) {
        return { content: [{ type: "text", text: `❌ **Error:** ${error.message}` }] };
    }
});
// ============================================================
// 상태
// ============================================================
server.tool("svn_status", "Working copy 파일 상태 조회", {
    path: z.string().optional().describe("조회할 경로 (생략 시 첫 번째 WC)"),
    showAll: z.boolean().optional().default(false).describe("원격 상태도 함께 표시"),
}, async (args) => {
    try {
        const result = await getSvnService().getStatus(args.path, args.showAll);
        const statusList = result.data;
        if (statusList.length === 0) {
            return { content: [{ type: "text", text: "✅ **변경 사항 없음**" }] };
        }
        const statusIcon = {
            added: '➕', deleted: '➖', modified: '✏️', replaced: '🔄',
            merged: '🔀', conflicted: '⚠️', ignored: '🙈', none: '⚪',
            normal: '✅', external: '🔗', incomplete: '⏸️', unversioned: '❓', missing: '❌',
        };
        const text = `📊 **SVN Status** (${statusList.length} items)\n\n` +
            statusList.map(s => `${statusIcon[s.status] || '📄'} **${s.status.toUpperCase()}** - ${s.path}`).join('\n') +
            `\n\n**Exec Time:** ${formatDuration(result.executionTime || 0)}`;
        return { content: [{ type: "text", text }] };
    }
    catch (error) {
        return { content: [{ type: "text", text: `❌ **Error:** ${error.message}` }] };
    }
});
// ============================================================
// 로그
// ============================================================
server.tool("svn_log", "Repository 커밋 이력 조회", {
    path: z.string().optional().describe("조회할 경로 (생략 시 첫 번째 WC)"),
    limit: z.number().optional().default(10).describe("최대 엔트리 개수"),
    revision: z.string().optional().describe("특정 리비전 또는 범위 (예: 100:200)"),
}, async (args) => {
    try {
        const result = await getSvnService().getLog(args.path, args.limit, args.revision);
        const entries = result.data;
        if (entries.length === 0) {
            return { content: [{ type: "text", text: "📝 **로그 없음**" }] };
        }
        const text = `📚 **SVN Log** (${entries.length} entries)\n\n` +
            entries.map((e, i) => `**${i + 1}. r${e.revision}**\n` +
                `👤 **Author:** ${e.author}\n` +
                `📅 **Date:** ${e.date}\n` +
                `💬 **Message:** ${e.message || 'No message'}\n---`).join('\n\n') +
            `\n**Exec Time:** ${formatDuration(result.executionTime || 0)}`;
        return { content: [{ type: "text", text }] };
    }
    catch (error) {
        return { content: [{ type: "text", text: `❌ **Error:** ${error.message}` }] };
    }
});
// ============================================================
// Diff
// ============================================================
server.tool("svn_diff", "파일 버전 간 차이 조회", {
    path: z.string().optional().describe("조회할 경로"),
    oldRevision: z.string().optional().describe("기준 리비전"),
    newRevision: z.string().optional().describe("비교 대상 리비전"),
}, async (args) => {
    try {
        const result = await getSvnService().getDiff(args.path, args.oldRevision, args.newRevision);
        const diff = result.data || '(no differences)';
        return {
            content: [{
                    type: "text",
                    text: `📑 **SVN Diff**\n\n\`\`\`diff\n${diff}\n\`\`\`\n\n**Exec Time:** ${formatDuration(result.executionTime || 0)}`,
                }],
        };
    }
    catch (error) {
        return { content: [{ type: "text", text: `❌ **Error:** ${error.message}` }] };
    }
});
// ============================================================
// Checkout / Update / Add / Commit / Delete / Revert / Cleanup / ClearCreds
// (원본과 시그니처/UI 동일, path 처리만 multi-WC 인식)
// ============================================================
server.tool("svn_checkout", "SVN repository 체크아웃 (새 working copy 생성)", {
    url: z.string().describe("SVN repository URL"),
    path: z.string().optional().describe("체크아웃 대상 경로"),
    revision: z.union([z.number(), z.literal("HEAD")]).optional(),
    depth: z.enum(["empty", "files", "immediates", "infinity"]).optional(),
    force: z.boolean().optional().default(false),
    ignoreExternals: z.boolean().optional().default(false),
}, async (args) => {
    try {
        const result = await getSvnService().checkout(args.url, args.path, {
            revision: args.revision,
            depth: args.depth,
            force: args.force,
            ignoreExternals: args.ignoreExternals,
        });
        return {
            content: [{
                    type: "text",
                    text: `📥 **Checkout 완료**\n\n**URL:** ${args.url}\n**Path:** ${args.path || '기본 경로'}\n**Command:** ${result.command}\n**Exec Time:** ${formatDuration(result.executionTime || 0)}\n\n\`\`\`\n${result.data}\n\`\`\``,
                }],
        };
    }
    catch (error) {
        return { content: [{ type: "text", text: `❌ **Error:** ${error.message}` }] };
    }
});
server.tool("svn_update", "Working copy를 repository 최신 상태로 업데이트", {
    path: z.string().optional().describe("업데이트할 경로 (생략 시 첫 번째 WC)"),
    revision: z.union([z.number(), z.literal("HEAD")]).optional(),
    force: z.boolean().optional().default(false),
    ignoreExternals: z.boolean().optional().default(false),
    acceptConflicts: z.enum(["postpone", "base", "mine-conflict", "theirs-conflict", "mine-full", "theirs-full"]).optional(),
}, async (args) => {
    try {
        const result = await getSvnService().update(args.path, {
            revision: args.revision,
            force: args.force,
            ignoreExternals: args.ignoreExternals,
            acceptConflicts: args.acceptConflicts,
        });
        return {
            content: [{
                    type: "text",
                    text: `🔄 **Update 완료**\n\n**Path:** ${args.path || '기본 경로'}\n**Command:** ${result.command}\n**Exec Time:** ${formatDuration(result.executionTime || 0)}\n\n\`\`\`\n${result.data}\n\`\`\``,
                }],
        };
    }
    catch (error) {
        return { content: [{ type: "text", text: `❌ **Error:** ${error.message}` }] };
    }
});
server.tool("svn_add", "버전 관리에 파일 추가", {
    paths: z.union([z.string(), z.array(z.string())]).describe("추가할 파일(들)"),
    force: z.boolean().optional().default(false),
    noIgnore: z.boolean().optional().default(false),
    parents: z.boolean().optional().default(false),
}, async (args) => {
    try {
        const result = await getSvnService().add(args.paths, {
            force: args.force,
            noIgnore: args.noIgnore,
            parents: args.parents,
        });
        const pathsArr = Array.isArray(args.paths) ? args.paths : [args.paths];
        return {
            content: [{
                    type: "text",
                    text: `➕ **Add 완료**\n\n**Files:** ${pathsArr.join(', ')}\n**Command:** ${result.command}\n**Exec Time:** ${formatDuration(result.executionTime || 0)}\n\n\`\`\`\n${result.data}\n\`\`\``,
                }],
        };
    }
    catch (error) {
        return { content: [{ type: "text", text: `❌ **Error:** ${error.message}` }] };
    }
});
server.tool("svn_commit", "변경 사항 repository에 커밋", {
    message: z.string().describe("커밋 메시지"),
    paths: z.array(z.string()).optional().describe("커밋할 특정 파일"),
    file: z.string().optional().describe("커밋 메시지 파일"),
    force: z.boolean().optional().default(false),
    keepLocks: z.boolean().optional().default(false),
    noUnlock: z.boolean().optional().default(false),
}, async (args) => {
    try {
        const result = await getSvnService().commit({
            message: args.message,
            file: args.file,
            force: args.force,
            keepLocks: args.keepLocks,
            noUnlock: args.noUnlock,
        }, args.paths);
        return {
            content: [{
                    type: "text",
                    text: `✅ **Commit 완료**\n\n**Message:** ${args.message}\n**Files:** ${args.paths?.join(', ') || '모든 변경'}\n**Command:** ${result.command}\n**Exec Time:** ${formatDuration(result.executionTime || 0)}\n\n\`\`\`\n${result.data}\n\`\`\``,
                }],
        };
    }
    catch (error) {
        return { content: [{ type: "text", text: `❌ **Error:** ${error.message}` }] };
    }
});
server.tool("svn_delete", "버전 관리에서 파일 삭제", {
    paths: z.union([z.string(), z.array(z.string())]).describe("삭제할 파일(들)"),
    message: z.string().optional().describe("저장소 직접 삭제 시 메시지"),
    force: z.boolean().optional().default(false),
    keepLocal: z.boolean().optional().default(false),
}, async (args) => {
    try {
        const result = await getSvnService().delete(args.paths, {
            message: args.message,
            force: args.force,
            keepLocal: args.keepLocal,
        });
        const pathsArr = Array.isArray(args.paths) ? args.paths : [args.paths];
        return {
            content: [{
                    type: "text",
                    text: `🗑️ **Delete 완료**\n\n**Files:** ${pathsArr.join(', ')}\n**Keep Local:** ${args.keepLocal ? '예' : '아니오'}\n**Command:** ${result.command}\n**Exec Time:** ${formatDuration(result.executionTime || 0)}\n\n\`\`\`\n${result.data}\n\`\`\``,
                }],
        };
    }
    catch (error) {
        return { content: [{ type: "text", text: `❌ **Error:** ${error.message}` }] };
    }
});
server.tool("svn_revert", "로컬 변경 되돌리기", {
    paths: z.union([z.string(), z.array(z.string())]).describe("revert할 파일(들)"),
}, async (args) => {
    try {
        const result = await getSvnService().revert(args.paths);
        const pathsArr = Array.isArray(args.paths) ? args.paths : [args.paths];
        return {
            content: [{
                    type: "text",
                    text: `↩️ **Revert 완료**\n\n**Files:** ${pathsArr.join(', ')}\n**Command:** ${result.command}\n**Exec Time:** ${formatDuration(result.executionTime || 0)}\n\n\`\`\`\n${result.data}\n\`\`\``,
                }],
        };
    }
    catch (error) {
        return { content: [{ type: "text", text: `❌ **Error:** ${error.message}` }] };
    }
});
server.tool("svn_cleanup", "중단된 작업 흔적 정리", {
    path: z.string().optional().describe("cleanup할 경로 (생략 시 첫 번째 WC)"),
}, async (args) => {
    try {
        const result = await getSvnService().cleanup(args.path);
        return {
            content: [{
                    type: "text",
                    text: `🧹 **Cleanup 완료**\n\n**Path:** ${args.path || '기본 경로'}\n**Command:** ${result.command}\n**Exec Time:** ${formatDuration(result.executionTime || 0)}\n\n\`\`\`\n${result.data}\n\`\`\``,
                }],
        };
    }
    catch (error) {
        return { content: [{ type: "text", text: `❌ **Error:** ${error.message}` }] };
    }
});
server.tool("svn_clear_credentials", "인증 에러 해결용 SVN 자격증명 캐시 클리어", {}, async () => {
    try {
        const result = await getSvnService().clearCredentials();
        return {
            content: [{
                    type: "text",
                    text: `🔐 **Credentials 캐시 클리어 완료**\n\n**Command:** ${result.command}\n**Exec Time:** ${formatDuration(result.executionTime || 0)}\n\n\`\`\`\n${result.data}\n\`\`\``,
                }],
        };
    }
    catch (error) {
        return { content: [{ type: "text", text: `❌ **Error:** ${error.message}` }] };
    }
});
// ============================================================
// 서버 부트
// ============================================================
async function runServer() {
    try {
        console.error("Creating SVN MCP Server...");
        console.error("Server info: svn-mcp-server");
        console.error("Version:", VERSION);
        if (!process.env.SVN_PATH) {
            console.error("Info: SVN_PATH not set, using 'svn' from PATH");
        }
        else {
            console.error("SVN_PATH:", process.env.SVN_PATH);
        }
        if (process.env.SVN_WORKING_DIRECTORIES) {
            console.error("SVN_WORKING_DIRECTORIES:", process.env.SVN_WORKING_DIRECTORIES);
        }
        else if (process.env.SVN_WORKING_DIRECTORY) {
            console.error("SVN_WORKING_DIRECTORY (legacy):", process.env.SVN_WORKING_DIRECTORY);
        }
        else {
            console.error("Info: no SVN_WORKING_DIRECTORIES / SVN_WORKING_DIRECTORY set, using cwd");
        }
        if (process.env.SVN_DISCOVERY_MAX_DEPTH) {
            console.error("SVN_DISCOVERY_MAX_DEPTH:", process.env.SVN_DISCOVERY_MAX_DEPTH);
        }
        if (process.env.SVN_DISCOVERY_CACHE_TTL_MS) {
            console.error("SVN_DISCOVERY_CACHE_TTL_MS:", process.env.SVN_DISCOVERY_CACHE_TTL_MS);
        }
        if (process.env.SVN_USERNAME) {
            console.error("SVN_USERNAME:", process.env.SVN_USERNAME);
        }
        if (process.env.SVN_PASSWORD) {
            console.error("SVN_PASSWORD:", "***");
        }
        console.error("Starting SVN MCP Server in stdio mode...");
        const transport = new StdioServerTransport();
        await server.connect(transport);
        console.error("MCP Server connected and ready!");
        console.error("Available tools:", [
            "svn_list_working_copies", // 신규
            "svn_health_check",
            "svn_diagnose",
            "svn_info",
            "svn_status",
            "svn_log",
            "svn_diff",
            "svn_checkout",
            "svn_update",
            "svn_add",
            "svn_commit",
            "svn_delete",
            "svn_revert",
            "svn_cleanup",
            "svn_clear_credentials",
        ]);
    }
    catch (error) {
        console.error("Error starting server:", error);
        console.error("Stack trace:", error.stack);
        process.exit(1);
    }
}
runServer();
//# sourceMappingURL=index.js.map