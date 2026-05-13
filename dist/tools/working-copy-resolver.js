import * as fs from 'fs/promises';
import * as path from 'path';
export class WorkingCopyResolver {
    config;
    cache = new Map();
    constructor(config) {
        this.config = config;
    }
    getRoots() {
        return [...this.config.roots];
    }
    async discoverAll(forceRefresh = false) {
        const all = [];
        for (const root of this.config.roots) {
            const found = await this.discoverUnder(root, forceRefresh);
            all.push(...found);
        }
        return Array.from(new Set(all)).sort();
    }
    async discoverUnder(root, forceRefresh = false) {
        const cached = this.cache.get(root);
        const now = Date.now();
        if (!forceRefresh && cached && now - cached.discoveredAt < this.config.cacheTtlMs) {
            return cached.workingCopies;
        }
        const found = [];
        await this.walk(root, 0, found);
        this.cache.set(root, { workingCopies: found, discoveredAt: now });
        return found;
    }
    async walk(dir, depth, found) {
        if (depth > this.config.maxDepth)
            return;
        let entries;
        try {
            entries = await fs.readdir(dir, { withFileTypes: true });
        }
        catch {
            return;
        }
        if (entries.some(e => e.name === '.svn' && e.isDirectory())) {
            found.push(dir);
            return;
        }
        const skipDirs = new Set([
            'node_modules', 'target', 'dist', 'build', '.git', 'bin', 'obj', '__pycache__',
        ]);
        for (const entry of entries) {
            if (entry.isDirectory() &&
                !entry.name.startsWith('.') &&
                !skipDirs.has(entry.name)) {
                await this.walk(path.join(dir, entry.name), depth + 1, found);
            }
        }
    }
    isAllowedPath(targetPath) {
        const normalized = path.resolve(targetPath);
        return this.config.roots.some(root => {
            const normalizedRoot = path.resolve(root);
            return (normalized === normalizedRoot ||
                normalized.startsWith(normalizedRoot + path.sep));
        });
    }
    async findContainingWorkingCopy(targetPath) {
        const normalized = path.resolve(targetPath);
        const all = await this.discoverAll();
        let bestMatch = null;
        let bestLength = 0;
        for (const wc of all) {
            const normalizedWc = path.resolve(wc);
            if (normalized === normalizedWc || normalized.startsWith(normalizedWc + path.sep)) {
                if (normalizedWc.length > bestLength) {
                    bestMatch = wc;
                    bestLength = normalizedWc.length;
                }
            }
        }
        return bestMatch;
    }
    async resolveCwd(targetPath) {
        if (targetPath) {
            if (!this.isAllowedPath(targetPath)) {
                throw new Error(`Path "${targetPath}" is outside allowed SVN root(s): ${this.config.roots.join(', ')}`);
            }
            const containingWc = await this.findContainingWorkingCopy(targetPath);
            if (!containingWc) {
                throw new Error(`Path "${targetPath}" does not belong to any discovered SVN working copy. ` +
                    `Call svn_list_working_copies to see available paths, or refresh discovery.`);
            }
            return { cwd: containingWc, resolvedPath: path.resolve(targetPath) };
        }
        const all = await this.discoverAll();
        if (all.length === 0) {
            throw new Error(`No SVN working copy found under configured root(s): ${this.config.roots.join(', ')}. ` +
                `Check SVN_WORKING_DIRECTORIES environment variable.`);
        }
        return { cwd: all[0] };
    }
    invalidateCache() {
        this.cache.clear();
    }
}
//# sourceMappingURL=working-copy-resolver.js.map