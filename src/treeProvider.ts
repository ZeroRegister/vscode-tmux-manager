import * as vscode from 'vscode';
import * as path from 'path';
import { TmuxService } from './tmuxService';
import { TmuxSession, TmuxWindow, TmuxPane } from './types';

type TmuxTreeItem = TmuxSessionTreeItem | TmuxWindowTreeItem | TmuxPaneTreeItem;

export class TmuxSessionProvider implements vscode.TreeDataProvider<TmuxTreeItem> {
    private _onDidChangeTreeData: vscode.EventEmitter<TmuxTreeItem | undefined | null | void> = new vscode.EventEmitter<TmuxTreeItem | undefined | null | void>();
    readonly onDidChangeTreeData: vscode.Event<TmuxTreeItem | undefined | null | void> = this._onDidChangeTreeData.event;

    constructor(private tmuxService: TmuxService, private extensionPath: string) {}

    refresh(): void {
        this._onDidChangeTreeData.fire();
    }

    getTreeItem(element: TmuxTreeItem): vscode.TreeItem {
        return element;
    }

    async getChildren(element?: TmuxTreeItem): Promise<TmuxTreeItem[]> {
        if (element) {
            if (element instanceof TmuxSessionTreeItem) {
                return element.session.windows.map(win => new TmuxWindowTreeItem(win, this.extensionPath));
            }
            if (element instanceof TmuxWindowTreeItem) {
                return element.window.panes.map(pane => new TmuxPaneTreeItem(pane, this.extensionPath));
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
        super(session.name, vscode.TreeItemCollapsibleState.Expanded);
        this.contextValue = 'tmuxSession';
        this.iconPath = new vscode.ThemeIcon('server-process');
    }
}

export class TmuxWindowTreeItem extends vscode.TreeItem {
    constructor(public readonly window: TmuxWindow, extensionPath: string) {
        super(`${window.index}:${window.name}`, vscode.TreeItemCollapsibleState.Expanded);
        this.contextValue = 'tmuxWindow';
        this.iconPath = {
            light: vscode.Uri.file(path.join(extensionPath, 'resources', 'window.svg')),
            dark: vscode.Uri.file(path.join(extensionPath, 'resources', 'window.svg'))
        };
    }
}

export class TmuxPaneTreeItem extends vscode.TreeItem {
    constructor(public readonly pane: TmuxPane, extensionPath: string) {
        super(`${pane.index}: ${pane.command}`, vscode.TreeItemCollapsibleState.None);
        this.contextValue = 'tmuxPane';
        this.iconPath = {
            light: vscode.Uri.file(path.join(extensionPath, 'resources', 'pane.svg')),
            dark: vscode.Uri.file(path.join(extensionPath, 'resources', 'pane.svg'))
        };
    }
}