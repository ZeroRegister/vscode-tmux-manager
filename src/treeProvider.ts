import * as vscode from 'vscode';
import * as path from 'path';
import { TmuxService } from './tmuxService';
import { TmuxSession, TmuxWindow, TmuxPane } from './types';

type TmuxTreeItem = TmuxSessionTreeItem | TmuxWindowTreeItem | TmuxPaneTreeItem;

export class TmuxSessionProvider implements vscode.TreeDataProvider<TmuxTreeItem> {
    private _onDidChangeTreeData: vscode.EventEmitter<TmuxTreeItem | undefined | null | void> = new vscode.EventEmitter<TmuxTreeItem | undefined | null | void>();
    readonly onDidChangeTreeData: vscode.Event<TmuxTreeItem | undefined | null | void> = this._onDidChangeTreeData.event;
    private autoRefreshInterval: NodeJS.Timeout | undefined;
    private autoRefreshEnabled: boolean = false;
    private readonly AUTO_REFRESH_INTERVAL = 3000; // 3 seconds

    constructor(private tmuxService: TmuxService, private extensionPath: string) {
        // Start auto refresh by default
        this.startAutoRefresh();
    }

    refresh(): void {
        this._onDidChangeTreeData.fire();
    }

    startAutoRefresh(): void {
        if (this.autoRefreshInterval) {
            return; // Already running
        }
        
        this.autoRefreshEnabled = true;
        this.autoRefreshInterval = setInterval(() => {
            if (this.autoRefreshEnabled) {
                this.refresh();
            }
        }, this.AUTO_REFRESH_INTERVAL);
    }

    stopAutoRefresh(): void {
        this.autoRefreshEnabled = false;
        if (this.autoRefreshInterval) {
            clearInterval(this.autoRefreshInterval);
            this.autoRefreshInterval = undefined;
        }
    }

    toggleAutoRefresh(): void {
        if (this.autoRefreshEnabled) {
            this.stopAutoRefresh();
            vscode.window.showInformationMessage('Auto-refresh disabled');
        } else {
            this.startAutoRefresh();
            vscode.window.showInformationMessage('Auto-refresh enabled');
        }
    }

    isAutoRefreshEnabled(): boolean {
        return this.autoRefreshEnabled;
    }

    dispose(): void {
        this.stopAutoRefresh();
    }

    getTreeItem(element: TmuxTreeItem): vscode.TreeItem {
        return element;
    }

    async getChildren(element?: TmuxTreeItem): Promise<TmuxTreeItem[]> {
        if (element) {
            if (element instanceof TmuxSessionTreeItem) {
                if (!element.session || !element.session.windows) {
                    return [];
                }
                return element.session.windows.map(win => new TmuxWindowTreeItem(win, this.extensionPath, element.session.isAttached));
            }
            if (element instanceof TmuxWindowTreeItem) {
                if (!element.window || !element.window.panes) {
                    return [];
                }
                // Need to find the session to check if it's attached
                const sessions = await this.tmuxService.getTmuxTree();
                const session = sessions.find(s => s.name === element.window.sessionName);
                const sessionAttached = session?.isAttached || false;
                
                return element.window.panes.map(pane => new TmuxPaneTreeItem(pane, this.extensionPath, sessionAttached, element.window.isActive));
            }
            return [];
        }

        const sessions = await this.tmuxService.getTmuxTree();
        if (sessions.length > 0) {
            return sessions.map(session => new TmuxSessionTreeItem(session));
        } else {
            const item = new vscode.TreeItem('No running tmux sessions found.', vscode.TreeItemCollapsibleState.None);
            // This is a bit of a hack to make it fit the type, but it's a leaf node so it's fine.
            return [item as TmuxTreeItem];
        }
    }
}

export class TmuxSessionTreeItem extends vscode.TreeItem {
    constructor(public readonly session: TmuxSession) {
        const label = session.name;
        super(label, vscode.TreeItemCollapsibleState.Expanded);
        this.contextValue = 'tmuxSession';
        this.iconPath = new vscode.ThemeIcon('server');
        
        // Use icon color to show attached status
        if (session.isAttached) {
            this.iconPath = new vscode.ThemeIcon('server', new vscode.ThemeColor('terminal.ansiGreen'));
        }
        
        // Add tooltip with session info
        const tooltip = new vscode.MarkdownString();
        tooltip.appendMarkdown(`**Session:** ${session.name}\n\n`);
        tooltip.appendMarkdown(`**Status:** ${session.isAttached ? 'Attached' : 'Detached'}\n\n`);
        if (session.created) {
            tooltip.appendMarkdown(`**Created:** ${new Date(parseInt(session.created) * 1000).toLocaleString()}\n\n`);
        }
        if (session.lastActivity) {
            tooltip.appendMarkdown(`**Last Activity:** ${new Date(parseInt(session.lastActivity) * 1000).toLocaleString()}\n\n`);
        }
        tooltip.appendMarkdown(`**Windows:** ${session.windows.length}`);
        this.tooltip = tooltip;
    }
}

export class TmuxWindowTreeItem extends vscode.TreeItem {
    constructor(public readonly window: TmuxWindow, extensionPath: string, sessionAttached: boolean) {
        const label = `${window.index}:${window.name}`;
        super(label, vscode.TreeItemCollapsibleState.Expanded);
        this.contextValue = 'tmuxWindow';
        this.iconPath = new vscode.ThemeIcon('window');
        
        // Use description and icon color to show status
        if (window.isActive && sessionAttached) {
            // this.description = '🔵';
            this.description = '';
            this.iconPath = new vscode.ThemeIcon('window', new vscode.ThemeColor('terminal.ansiGreen'));
        } else if (window.isActive) {
            // this.description = '🔵';
            this.description = '';
        }
        
        // Add tooltip with window info
        const tooltip = new vscode.MarkdownString();
        tooltip.appendMarkdown(`**Window:** ${window.index}:${window.name}\n\n`);
        tooltip.appendMarkdown(`**Status:** ${window.isActive ? 'Active' : 'Inactive'}\n\n`);
        tooltip.appendMarkdown(`**Session:** ${window.sessionName}\n\n`);
        tooltip.appendMarkdown(`**Panes:** ${window.panes.length}`);
        this.tooltip = tooltip;
    }
}

export class TmuxPaneTreeItem extends vscode.TreeItem {
    constructor(public readonly pane: TmuxPane, extensionPath: string, sessionAttached: boolean, windowActive: boolean) {
        const label = `${pane.index}: ${pane.command}`;
        super(label, vscode.TreeItemCollapsibleState.None);
        this.contextValue = 'tmuxPane';
        
        const iconName = TmuxPaneTreeItem.getCommandIconName(pane.command);
        this.iconPath = new vscode.ThemeIcon(iconName);
        
        // Use description and icon color to show status
        if (pane.isActive && windowActive && sessionAttached) {
            this.iconPath = new vscode.ThemeIcon(iconName, new vscode.ThemeColor('terminal.ansiGreen'));
            // Don't add description for panes to keep it clean, the green icon is sufficient
        } else if (pane.isActive) {
            // Show that pane is active but not fully connected
        }
        
        // Add tooltip with pane info
        const tooltip = new vscode.MarkdownString();
        tooltip.appendMarkdown(`**Pane:** ${pane.index}\n\n`);
        tooltip.appendMarkdown(`**Command:** ${pane.command}\n\n`);
        tooltip.appendMarkdown(`**Status:** ${pane.isActive ? 'Active' : 'Inactive'}\n\n`);
        tooltip.appendMarkdown(`**Current Path:** ${pane.currentPath}\n\n`);
        if (pane.pid > 0) {
            tooltip.appendMarkdown(`**PID:** ${pane.pid}\n\n`);
        }
        tooltip.appendMarkdown(`**Session:** ${pane.sessionName}\n\n`);
        tooltip.appendMarkdown(`**Window:** ${pane.windowIndex}`);
        this.tooltip = tooltip;
        
        // Add description to show path
        this.description = pane.currentPath !== '~' ? pane.currentPath : undefined;
    }

    private static getCommandIconName(command: string): string {
        const cmd = command.toLowerCase();
        if (cmd.includes('vim') || cmd.includes('nvim')) return 'edit';
        if (cmd.includes('ssh')) return 'remote';
        if (cmd.includes('bash') || cmd.includes('zsh') || cmd.includes('sh')) return 'terminal-bash';
        if (cmd.includes('python') || cmd.includes('py')) return 'symbol-method';
        if (cmd.includes('node') || cmd.includes('npm')) return 'nodejs';
        if (cmd.includes('git')) return 'git-branch';
        if (cmd.includes('docker')) return 'server-environment';
        if (cmd.includes('htop') || cmd.includes('top')) return 'pulse';
        if (cmd.includes('tail') || cmd.includes('less') || cmd.includes('more')) return 'output';
        if (cmd.includes('mysql') || cmd.includes('psql')) return 'database';
        return 'terminal'; // Default icon
    }
}