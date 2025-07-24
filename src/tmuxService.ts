import * as cp from 'child_process';
import * as util from 'util';
import * as vscode from 'vscode';
import { TmuxSession, TmuxWindow, TmuxPane } from './types';

const exec = util.promisify(cp.exec);

interface CacheEntry {
    data: TmuxSession[];
    timestamp: number;
}

export class TmuxService {
    private cache: CacheEntry | null = null;
    private readonly CACHE_DURATION = 2000; // 2 seconds
    private tmuxInstalled: boolean | null = null;

    private async checkTmuxInstallation(): Promise<boolean> {
        if (this.tmuxInstalled !== null) {
            return this.tmuxInstalled;
        }
        
        try {
            await exec('tmux -V');
            this.tmuxInstalled = true;
            return true;
        } catch (error) {
            this.tmuxInstalled = false;
            vscode.window.showErrorMessage('tmux is not installed or not in PATH. Please install tmux to use this extension.');
            return false;
        }
    }

    private isCacheValid(): boolean {
        return this.cache !== null && (Date.now() - this.cache.timestamp) < this.CACHE_DURATION;
    }

    private async getTmuxData(): Promise<TmuxSession[]> {
        try {
            const [sessionsOutput, windowsOutput, panesOutput] = await Promise.all([
                exec('tmux list-sessions -F "#{session_name}:#{session_attached}:#{session_created}:#{session_activity}"'),
                exec('tmux list-windows -a -F "#{session_name}:#{window_index}:#{window_name}:#{window_active}"'),
                exec('tmux list-panes -a -F "#{session_name}:#{window_index}:#{pane_index}:#{pane_current_command}:#{pane_current_path}:#{pane_active}:#{pane_pid}"')
            ]);

            return this.parseTmuxData(sessionsOutput.stdout, windowsOutput.stdout, panesOutput.stdout);
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            if (errorMessage.includes('no server running')) {
                // No tmux server running is not an error, just return empty array
                return [];
            }
            vscode.window.showErrorMessage(`Failed to get tmux data: ${errorMessage}`);
            throw error;
        }
    }

    private parseTmuxData(sessionsData: string, windowsData: string, panesData: string): TmuxSession[] {
        // Parse sessions
        const sessionsMap = new Map<string, TmuxSession>();
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
        const panesByWindow = new Map<string, TmuxPane[]>();
        if (panesData) {
            panesData.trim().split('\n').forEach(line => {
                const parts = line.split(':');
                if (parts.length >= 7) {
                    const [sessionName, windowIndex, paneIndex, paneCommand, currentPath, isActive, pid] = parts;
                    const key = `${sessionName}:${windowIndex}`;
                    if (!panesByWindow.has(key)) {
                        panesByWindow.set(key, []);
                    }
                    panesByWindow.get(key)!.push({
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
        const windowsBySession = new Map<string, TmuxWindow[]>();
        if (windowsData) {
            windowsData.trim().split('\n').forEach(line => {
                const [sessionName, windowIndex, windowName, isActive] = line.split(':');
                if (sessionName && windowIndex) {
                    const key = `${sessionName}:${windowIndex}`;
                    if (!windowsBySession.has(sessionName)) {
                        windowsBySession.set(sessionName, []);
                    }
                    windowsBySession.get(sessionName)!.push({
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
        const sessions: TmuxSession[] = [];
        sessionsMap.forEach(session => {
            session.windows = windowsBySession.get(session.name) || [];
            sessions.push(session);
        });

        return sessions;
    }

    public async getTmuxTree(): Promise<TmuxSession[]> {
        if (!await this.checkTmuxInstallation()) {
            return [];
        }

        // Use cache if valid
        if (this.isCacheValid()) {
            return this.cache!.data;
        }

        try {
            const data = await this.getTmuxData();
            this.cache = {
                data,
                timestamp: Date.now()
            };
            return data;
        } catch (error) {
            // Return cached data if available, even if stale
            if (this.cache) {
                return this.cache.data;
            }
            return [];
        }
    }

    public clearCache(): void {
        this.cache = null;
    }

    public async getTmuxTreeFresh(): Promise<TmuxSession[]> {
        this.clearCache();
        return this.getTmuxTree();
    }

    // Legacy method for backward compatibility
    public async getTmuxTreeLegacy(): Promise<TmuxSession[]> {
        try {
            const [windowsOutput, panesOutput] = await Promise.all([
                exec('tmux list-windows -a -F "#{session_name}:#{window_index}:#{window_name}"'),
                exec('tmux list-panes -a -F "#{session_name}:#{window_index}:#{pane_index}:#{pane_current_command}"')
            ]);

            const panesByWindow: { [key: string]: TmuxPane[] } = {};
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

            const windowsBySession: { [key: string]: TmuxWindow[] } = {};
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

            const sessions: TmuxSession[] = Object.keys(windowsBySession).map(sessionName => ({
                name: sessionName,
                isAttached: false, // Legacy data doesn't have attached status
                created: '', // Legacy data doesn't have created time
                lastActivity: '', // Legacy data doesn't have activity time
                windows: windowsBySession[sessionName]
            }));

            return sessions;

        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            vscode.window.showWarningMessage(`Failed to get tmux data (legacy mode): ${errorMessage}`);
            return [];
        }
    }

    public async getSessions(): Promise<string[]> {
        if (!await this.checkTmuxInstallation()) {
            return [];
        }
        
        try {
            const { stdout } = await exec('tmux ls -F "#{session_name}"');
            if (stdout && stdout.trim()) {
                return stdout.trim().split('\n').filter(name => name.length > 0);
            }
            return [];
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            if (!errorMessage.includes('no server running')) {
                vscode.window.showWarningMessage(`Failed to get sessions: ${errorMessage}`);
            }
            return [];
        }
    }

    public async renameSession(oldName: string, newName: string): Promise<void> {
        if (!await this.checkTmuxInstallation()) {
            return;
        }
        
        try {
            await exec(`tmux rename-session -t "${oldName}" "${newName}"`);
            this.clearCache(); // Clear cache after modification
            vscode.window.showInformationMessage(`Session renamed from "${oldName}" to "${newName}"`);
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            vscode.window.showErrorMessage(`Failed to rename session "${oldName}" to "${newName}": ${errorMessage}`);
            throw error;
        }
    }

    public async renameWindow(sessionName: string, windowIndex: string, newName: string): Promise<void> {
        if (!await this.checkTmuxInstallation()) {
            return;
        }
        
        try {
            await exec(`tmux rename-window -t "${sessionName}:${windowIndex}" "${newName}"`);
            this.clearCache(); // Clear cache after modification
            vscode.window.showInformationMessage(`Window ${windowIndex} renamed to "${newName}"`);
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            if (errorMessage.includes('session not found')) {
                vscode.window.showErrorMessage(`Session "${sessionName}" not found`);
            } else if (errorMessage.includes('window not found')) {
                vscode.window.showErrorMessage(`Window ${windowIndex} not found in session "${sessionName}"`);
            } else {
                vscode.window.showErrorMessage(`Failed to rename window ${windowIndex}: ${errorMessage}`);
            }
            throw error;
        }
    }

    public async newSession(sessionName: string): Promise<void> {
        if (!await this.checkTmuxInstallation()) {
            throw new Error('tmux is not installed');
        }
        
        try {
            await exec(`tmux new-session -d -s "${sessionName}"`);
            this.clearCache(); // Clear cache after modification
            vscode.window.showInformationMessage(`Created new session "${sessionName}"`);
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            if (errorMessage.includes('duplicate session')) {
                vscode.window.showErrorMessage(`Session "${sessionName}" already exists`);
            } else {
                vscode.window.showErrorMessage(`Failed to create session "${sessionName}": ${errorMessage}`);
            }
            throw error;
        }
    }

    public async deleteSession(sessionName: string): Promise<void> {
        if (!await this.checkTmuxInstallation()) {
            return;
        }
        
        try {
            await exec(`tmux kill-session -t "${sessionName}"`);
            this.clearCache(); // Clear cache after modification
            vscode.window.showInformationMessage(`Deleted session "${sessionName}"`);
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            if (errorMessage.includes('session not found')) {
                vscode.window.showWarningMessage(`Session "${sessionName}" not found`);
            } else {
                vscode.window.showErrorMessage(`Failed to delete session "${sessionName}": ${errorMessage}`);
            }
            throw error;
        }
    }

    public async killWindow(sessionName: string, windowIndex: string): Promise<void> {
        if (!await this.checkTmuxInstallation()) {
            return;
        }
        
        try {
            await exec(`tmux kill-window -t "${sessionName}:${windowIndex}"`);
            this.clearCache(); // Clear cache after modification
            vscode.window.showInformationMessage(`Killed window ${windowIndex} in session "${sessionName}"`);
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            if (errorMessage.includes('window not found')) {
                vscode.window.showWarningMessage(`Window ${windowIndex} not found in session "${sessionName}"`);
            } else {
                vscode.window.showErrorMessage(`Failed to kill window ${windowIndex}: ${errorMessage}`);
            }
            throw error;
        }
    }

    public async killPane(sessionName: string, windowIndex: string, paneIndex: string): Promise<void> {
        if (!await this.checkTmuxInstallation()) {
            return;
        }
        
        try {
            await exec(`tmux kill-pane -t "${sessionName}:${windowIndex}.${paneIndex}"`);
            this.clearCache(); // Clear cache after modification
            vscode.window.showInformationMessage(`Killed pane ${paneIndex} in window ${windowIndex}`);
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            if (errorMessage.includes('pane not found')) {
                vscode.window.showWarningMessage(`Pane ${paneIndex} not found in window ${windowIndex}`);
            } else {
                vscode.window.showErrorMessage(`Failed to kill pane ${paneIndex}: ${errorMessage}`);
            }
            throw error;
        }
    }

    public async selectWindow(sessionName: string, windowIndex: string): Promise<void> {
        if (!await this.checkTmuxInstallation()) {
            return;
        }
        
        try {
            await exec(`tmux select-window -t "${sessionName}:${windowIndex}"`);
        } catch (error) {
            // Don't show error message here, as it might be confusing if attach works.
            // But log it for debugging
            console.warn(`Failed to select window ${windowIndex}:`, error);
        }
    }

    public async selectPane(sessionName: string, windowIndex: string, paneIndex: string): Promise<void> {
        if (!await this.checkTmuxInstallation()) {
            return;
        }
        
        try {
            await exec(`tmux select-pane -t "${sessionName}:${windowIndex}.${paneIndex}"`);
        } catch (error) {
            // Don't show error message here.
            // But log it for debugging
            console.warn(`Failed to select pane ${paneIndex}:`, error);
        }
    }

    public async newWindow(sessionName: string, windowName?: string): Promise<void> {
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
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            if (errorMessage.includes('session not found')) {
                vscode.window.showErrorMessage(`Session "${sessionName}" not found`);
            } else {
                vscode.window.showErrorMessage(`Failed to create new window: ${errorMessage}`);
            }
            throw error;
        }
    }

    public async splitPane(targetPane: string, direction: 'h' | 'v'): Promise<void> {
        if (!await this.checkTmuxInstallation()) {
            return;
        }
        
        try {
            await exec(`tmux split-window -t "${targetPane}" -${direction}`);
            this.clearCache(); // Clear cache after modification
            const directionText = direction === 'h' ? 'horizontally' : 'vertically';
            vscode.window.showInformationMessage(`Split pane ${directionText}`);
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            if (errorMessage.includes('pane not found')) {
                vscode.window.showErrorMessage(`Target pane ${targetPane} not found`);
            } else {
                vscode.window.showErrorMessage(`Failed to split pane: ${errorMessage}`);
            }
            throw error;
        }
    }
}