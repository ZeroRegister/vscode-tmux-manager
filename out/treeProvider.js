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
exports.TmuxPaneTreeItem = exports.TmuxWindowTreeItem = exports.TmuxSessionTreeItem = exports.TmuxSessionProvider = void 0;
const vscode = __importStar(require("vscode"));
class TmuxSessionProvider {
    constructor(tmuxService, extensionPath) {
        this.tmuxService = tmuxService;
        this.extensionPath = extensionPath;
        this._onDidChangeTreeData = new vscode.EventEmitter();
        this.onDidChangeTreeData = this._onDidChangeTreeData.event;
        this.autoRefreshEnabled = false;
        this.AUTO_REFRESH_INTERVAL = 3000; // 3 seconds
        // Start auto refresh by default
        this.startAutoRefresh();
    }
    refresh() {
        this._onDidChangeTreeData.fire();
    }
    startAutoRefresh() {
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
    stopAutoRefresh() {
        this.autoRefreshEnabled = false;
        if (this.autoRefreshInterval) {
            clearInterval(this.autoRefreshInterval);
            this.autoRefreshInterval = undefined;
        }
    }
    toggleAutoRefresh() {
        if (this.autoRefreshEnabled) {
            this.stopAutoRefresh();
            vscode.window.showInformationMessage('Auto-refresh disabled');
        }
        else {
            this.startAutoRefresh();
            vscode.window.showInformationMessage('Auto-refresh enabled');
        }
    }
    isAutoRefreshEnabled() {
        return this.autoRefreshEnabled;
    }
    dispose() {
        this.stopAutoRefresh();
    }
    getTreeItem(element) {
        return element;
    }
    async getChildren(element) {
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
        }
        else {
            const item = new vscode.TreeItem('No running tmux sessions found.', vscode.TreeItemCollapsibleState.None);
            // This is a bit of a hack to make it fit the type, but it's a leaf node so it's fine.
            return [item];
        }
    }
}
exports.TmuxSessionProvider = TmuxSessionProvider;
class TmuxSessionTreeItem extends vscode.TreeItem {
    constructor(session) {
        const label = session.name;
        super(label, vscode.TreeItemCollapsibleState.Expanded);
        this.session = session;
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
exports.TmuxSessionTreeItem = TmuxSessionTreeItem;
class TmuxWindowTreeItem extends vscode.TreeItem {
    constructor(window, extensionPath, sessionAttached) {
        const label = `${window.index}:${window.name}`;
        super(label, vscode.TreeItemCollapsibleState.Expanded);
        this.window = window;
        this.contextValue = 'tmuxWindow';
        this.iconPath = new vscode.ThemeIcon('window');
        // Use description and icon color to show status
        if (window.isActive && sessionAttached) {
            // this.description = '🔵';
            this.description = '';
            this.iconPath = new vscode.ThemeIcon('window', new vscode.ThemeColor('terminal.ansiGreen'));
        }
        else if (window.isActive) {
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
exports.TmuxWindowTreeItem = TmuxWindowTreeItem;
class TmuxPaneTreeItem extends vscode.TreeItem {
    constructor(pane, extensionPath, sessionAttached, windowActive) {
        const label = `${pane.index}: ${pane.command}`;
        super(label, vscode.TreeItemCollapsibleState.None);
        this.pane = pane;
        this.contextValue = 'tmuxPane';
        const iconName = TmuxPaneTreeItem.getCommandIconName(pane.command);
        this.iconPath = new vscode.ThemeIcon(iconName);
        // Use description and icon color to show status
        if (pane.isActive && windowActive && sessionAttached) {
            this.iconPath = new vscode.ThemeIcon(iconName, new vscode.ThemeColor('terminal.ansiGreen'));
            // Don't add description for panes to keep it clean, the green icon is sufficient
        }
        else if (pane.isActive) {
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
    static getCommandIconName(command) {
        const cmd = command.toLowerCase();
        if (cmd.includes('vim') || cmd.includes('nvim'))
            return 'edit';
        if (cmd.includes('ssh'))
            return 'remote';
        if (cmd.includes('bash') || cmd.includes('zsh') || cmd.includes('sh'))
            return 'terminal-bash';
        if (cmd.includes('python') || cmd.includes('py'))
            return 'symbol-method';
        if (cmd.includes('node') || cmd.includes('npm'))
            return 'nodejs';
        if (cmd.includes('git'))
            return 'git-branch';
        if (cmd.includes('docker'))
            return 'server-environment';
        if (cmd.includes('htop') || cmd.includes('top'))
            return 'pulse';
        if (cmd.includes('tail') || cmd.includes('less') || cmd.includes('more'))
            return 'output';
        if (cmd.includes('mysql') || cmd.includes('psql'))
            return 'database';
        return 'terminal'; // Default icon
    }
}
exports.TmuxPaneTreeItem = TmuxPaneTreeItem;
//# sourceMappingURL=treeProvider.js.map