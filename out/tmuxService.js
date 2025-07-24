"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.TmuxService = void 0;
const cp = __importStar(require("child_process"));
const util = __importStar(require("util"));
const vscode = __importStar(require("vscode"));
const exec = util.promisify(cp.exec);
class TmuxService {
    constructor() {
        this.cache = null;
        this.CACHE_DURATION = 2000; // 2 seconds
        this.tmuxInstalled = null;
    }
    async checkTmuxInstallation() {
        if (this.tmuxInstalled !== null) {
            return this.tmuxInstalled;
        }
        try {
            await exec('tmux -V');
            this.tmuxInstalled = true;
            return true;
        }
        catch (error) {
            this.tmuxInstalled = false;
            vscode.window.showErrorMessage('tmux is not installed or not in PATH. Please install tmux to use this extension.');
            return false;
        }
    }
    isCacheValid() {
        return this.cache !== null && (Date.now() - this.cache.timestamp) < this.CACHE_DURATION;
    }
    async getTmuxData() {
        try {
            const [sessionsOutput, windowsOutput, panesOutput] = await Promise.all([
                exec('tmux list-sessions -F "#{session_name}:#{session_attached}:#{session_created}:#{session_activity}"'),
                exec('tmux list-windows -a -F "#{session_name}:#{window_index}:#{window_name}:#{window_active}"'),
                exec('tmux list-panes -a -F "#{session_name}:#{window_index}:#{pane_index}:#{pane_current_command}:#{pane_current_path}:#{pane_active}:#{pane_pid}"')
            ]);
            return this.parseTmuxData(sessionsOutput.stdout, windowsOutput.stdout, panesOutput.stdout);
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            if (errorMessage.includes('no server running')) {
                // No tmux server running is not an error, just return empty array
                return [];
            }
            vscode.window.showErrorMessage(`Failed to get tmux data: ${errorMessage}`);
            throw error;
        }
    }
    parseTmuxData(sessionsData, windowsData, panesData) {
        // Parse sessions
        const sessionsMap = new Map();
        if (sessionsData) {
            sessionsData.trim().split('\n').forEach(line => {
                const [name, attached, created, activity] = line.split(':');
                if (name) {
                    sessionsMap.set(name, {
                        name,
                        isAttached: attached === '1',
                        created,
                        lastActivity: activity,
                        windows: []
                    });
                }
            });
        }
        // Parse panes
        const panesByWindow = new Map();
        if (panesData) {
            panesData.trim().split('\n').forEach(line => {
                const parts = line.split(':');
                if (parts.length >= 7) {
                    const [sessionName, windowIndex, paneIndex, paneCommand, currentPath, isActive, pid] = parts;
                    const key = `${sessionName}:${windowIndex}`;
                    if (!panesByWindow.has(key)) {
                        panesByWindow.set(key, []);
                    }
                    panesByWindow.get(key).push({
                        sessionName,
                        windowIndex,
                        index: paneIndex,
                        command: paneCommand,
                        currentPath: currentPath || '~',
                        isActive: isActive === '1',
                        pid: parseInt(pid) || 0
                    });
                }
            });
        }
        // Parse windows
        const windowsBySession = new Map();
        if (windowsData) {
            windowsData.trim().split('\n').forEach(line => {
                const [sessionName, windowIndex, windowName, isActive] = line.split(':');
                if (sessionName && windowIndex) {
                    const key = `${sessionName}:${windowIndex}`;
                    if (!windowsBySession.has(sessionName)) {
                        windowsBySession.set(sessionName, []);
                    }
                    windowsBySession.get(sessionName).push({
                        sessionName,
                        index: windowIndex,
                        name: windowName,
                        isActive: isActive === '1',
                        panes: panesByWindow.get(key) || []
                    });
                }
            });
        }
        // Combine data
        const sessions = [];
        sessionsMap.forEach(session => {
            session.windows = windowsBySession.get(session.name) || [];
            sessions.push(session);
        });
        return sessions;
    }
    async getTmuxTree() {
        if (!await this.checkTmuxInstallation()) {
            return [];
        }
        // Use cache if valid
        if (this.isCacheValid()) {
            return this.cache.data;
        }
        try {
            const data = await this.getTmuxData();
            this.cache = {
                data,
                timestamp: Date.now()
            };
            return data;
        }
        catch (error) {
            // Return cached data if available, even if stale
            if (this.cache) {
                return this.cache.data;
            }
            return [];
        }
    }
    clearCache() {
        this.cache = null;
    }
    async getTmuxTreeFresh() {
        this.clearCache();
        return this.getTmuxTree();
    }
    // Legacy method for backward compatibility
    async getTmuxTreeLegacy() {
        try {
            const [windowsOutput, panesOutput] = await Promise.all([
                exec('tmux list-windows -a -F "#{session_name}:#{window_index}:#{window_name}"'),
                exec('tmux list-panes -a -F "#{session_name}:#{window_index}:#{pane_index}:#{pane_current_command}"')
            ]);
            const panesByWindow = {};
            if (panesOutput.stdout) {
                panesOutput.stdout.trim().split('\n').forEach(line => {
                    const [sessionName, windowIndex, paneIndex, paneCommand] = line.split(':');
                    const key = `${sessionName}:${windowIndex}`;
                    if (!panesByWindow[key]) {
                        panesByWindow[key] = [];
                    }
                    panesByWindow[key].push({
                        sessionName,
                        windowIndex,
                        index: paneIndex,
                        command: paneCommand,
                        currentPath: '~', // Legacy data doesn't have path
                        isActive: false, // Legacy data doesn't have active status
                        pid: 0 // Legacy data doesn't have pid
                    });
                });
            }
            const windowsBySession = {};
            if (windowsOutput.stdout) {
                windowsOutput.stdout.trim().split('\n').forEach(line => {
                    const [sessionName, windowIndex, windowName] = line.split(':');
                    const key = `${sessionName}:${windowIndex}`;
                    if (!windowsBySession[sessionName]) {
                        windowsBySession[sessionName] = [];
                    }
                    windowsBySession[sessionName].push({
                        sessionName,
                        index: windowIndex,
                        name: windowName,
                        isActive: false, // Legacy data doesn't have active status
                        panes: panesByWindow[key] || []
                    });
                });
            }
            const sessions = Object.keys(windowsBySession).map(sessionName => ({
                name: sessionName,
                isAttached: false, // Legacy data doesn't have attached status
                created: '', // Legacy data doesn't have created time
                lastActivity: '', // Legacy data doesn't have activity time
                windows: windowsBySession[sessionName]
            }));
            return sessions;
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            vscode.window.showWarningMessage(`Failed to get tmux data (legacy mode): ${errorMessage}`);
            return [];
        }
    }
    async getSessions() {
        if (!await this.checkTmuxInstallation()) {
            return [];
        }
        try {
            const { stdout } = await exec('tmux ls -F "#{session_name}"');
            if (stdout && stdout.trim()) {
                return stdout.trim().split('\n').filter(name => name.length > 0);
            }
            return [];
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            if (!errorMessage.includes('no server running')) {
                vscode.window.showWarningMessage(`Failed to get sessions: ${errorMessage}`);
            }
            return [];
        }
    }
    async renameSession(oldName, newName) {
        if (!await this.checkTmuxInstallation()) {
            return;
        }
        try {
            await exec(`tmux rename-session -t "${oldName}" "${newName}"`);
            this.clearCache(); // Clear cache after modification
            vscode.window.showInformationMessage(`Session renamed from "${oldName}" to "${newName}"`);
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            vscode.window.showErrorMessage(`Failed to rename session "${oldName}" to "${newName}": ${errorMessage}`);
            throw error;
        }
    }
    async renameWindow(sessionName, windowIndex, newName) {
        if (!await this.checkTmuxInstallation()) {
            return;
        }
        try {
            await exec(`tmux rename-window -t "${sessionName}:${windowIndex}" "${newName}"`);
            this.clearCache(); // Clear cache after modification
            vscode.window.showInformationMessage(`Window ${windowIndex} renamed to "${newName}"`);
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            if (errorMessage.includes('session not found')) {
                vscode.window.showErrorMessage(`Session "${sessionName}" not found`);
            }
            else if (errorMessage.includes('window not found')) {
                vscode.window.showErrorMessage(`Window ${windowIndex} not found in session "${sessionName}"`);
            }
            else {
                vscode.window.showErrorMessage(`Failed to rename window ${windowIndex}: ${errorMessage}`);
            }
            throw error;
        }
    }
    async newSession(sessionName) {
        if (!await this.checkTmuxInstallation()) {
            throw new Error('tmux is not installed');
        }
        try {
            await exec(`tmux new-session -d -s "${sessionName}"`);
            this.clearCache(); // Clear cache after modification
            vscode.window.showInformationMessage(`Created new session "${sessionName}"`);
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            if (errorMessage.includes('duplicate session')) {
                vscode.window.showErrorMessage(`Session "${sessionName}" already exists`);
            }
            else {
                vscode.window.showErrorMessage(`Failed to create session "${sessionName}": ${errorMessage}`);
            }
            throw error;
        }
    }
    async deleteSession(sessionName) {
        if (!await this.checkTmuxInstallation()) {
            return;
        }
        try {
            await exec(`tmux kill-session -t "${sessionName}"`);
            this.clearCache(); // Clear cache after modification
            vscode.window.showInformationMessage(`Deleted session "${sessionName}"`);
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            if (errorMessage.includes('session not found')) {
                vscode.window.showWarningMessage(`Session "${sessionName}" not found`);
            }
            else {
                vscode.window.showErrorMessage(`Failed to delete session "${sessionName}": ${errorMessage}`);
            }
            throw error;
        }
    }
    async killWindow(sessionName, windowIndex) {
        if (!await this.checkTmuxInstallation()) {
            return;
        }
        try {
            await exec(`tmux kill-window -t "${sessionName}:${windowIndex}"`);
            this.clearCache(); // Clear cache after modification
            vscode.window.showInformationMessage(`Killed window ${windowIndex} in session "${sessionName}"`);
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            if (errorMessage.includes('window not found')) {
                vscode.window.showWarningMessage(`Window ${windowIndex} not found in session "${sessionName}"`);
            }
            else {
                vscode.window.showErrorMessage(`Failed to kill window ${windowIndex}: ${errorMessage}`);
            }
            throw error;
        }
    }
    async killPane(sessionName, windowIndex, paneIndex) {
        if (!await this.checkTmuxInstallation()) {
            return;
        }
        try {
            await exec(`tmux kill-pane -t "${sessionName}:${windowIndex}.${paneIndex}"`);
            this.clearCache(); // Clear cache after modification
            vscode.window.showInformationMessage(`Killed pane ${paneIndex} in window ${windowIndex}`);
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            if (errorMessage.includes('pane not found')) {
                vscode.window.showWarningMessage(`Pane ${paneIndex} not found in window ${windowIndex}`);
            }
            else {
                vscode.window.showErrorMessage(`Failed to kill pane ${paneIndex}: ${errorMessage}`);
            }
            throw error;
        }
    }
    async selectWindow(sessionName, windowIndex) {
        if (!await this.checkTmuxInstallation()) {
            return;
        }
        try {
            await exec(`tmux select-window -t "${sessionName}:${windowIndex}"`);
        }
        catch (error) {
            // Don't show error message here, as it might be confusing if attach works.
            // But log it for debugging
            console.warn(`Failed to select window ${windowIndex}:`, error);
        }
    }
    async selectPane(sessionName, windowIndex, paneIndex) {
        if (!await this.checkTmuxInstallation()) {
            return;
        }
        try {
            await exec(`tmux select-pane -t "${sessionName}:${windowIndex}.${paneIndex}"`);
        }
        catch (error) {
            // Don't show error message here.
            // But log it for debugging
            console.warn(`Failed to select pane ${paneIndex}:`, error);
        }
    }
    async newWindow(sessionName, windowName) {
        if (!await this.checkTmuxInstallation()) {
            return;
        }
        try {
            let command = `tmux new-window -t "${sessionName}"`;
            if (windowName) {
                command += ` -n "${windowName}"`;
            }
            await exec(command);
            this.clearCache(); // Clear cache after modification
            const message = windowName
                ? `Created new window "${windowName}" in session "${sessionName}"`
                : `Created new window in session "${sessionName}"`;
            vscode.window.showInformationMessage(message);
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            if (errorMessage.includes('session not found')) {
                vscode.window.showErrorMessage(`Session "${sessionName}" not found`);
            }
            else {
                vscode.window.showErrorMessage(`Failed to create new window: ${errorMessage}`);
            }
            throw error;
        }
    }
    async splitPane(targetPane, direction) {
        if (!await this.checkTmuxInstallation()) {
            return;
        }
        try {
            await exec(`tmux split-window -t "${targetPane}" -${direction}`);
            this.clearCache(); // Clear cache after modification
            const directionText = direction === 'h' ? 'horizontally' : 'vertically';
            vscode.window.showInformationMessage(`Split pane ${directionText}`);
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            if (errorMessage.includes('pane not found')) {
                vscode.window.showErrorMessage(`Target pane ${targetPane} not found`);
            }
            else {
                vscode.window.showErrorMessage(`Failed to split pane: ${errorMessage}`);
            }
            throw error;
        }
    }
}
exports.TmuxService = TmuxService;
//# sourceMappingURL=tmuxService.js.map