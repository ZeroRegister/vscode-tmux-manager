import * as vscode from 'vscode';
import { TmuxService } from './tmuxService';

export class TmuxSessionProvider implements vscode.TreeDataProvider<vscode.TreeItem> {
    private _onDidChangeTreeData: vscode.EventEmitter<vscode.TreeItem | undefined | null | void> = new vscode.EventEmitter<vscode.TreeItem | undefined | null | void>();
    readonly onDidChangeTreeData: vscode.Event<vscode.TreeItem | undefined | null | void> = this._onDidChangeTreeData.event;

    constructor(private tmuxService: TmuxService) {}

    refresh(): void {
        this._onDidChangeTreeData.fire();
    }

    getTreeItem(element: vscode.TreeItem): vscode.TreeItem {
        return element;
    }

    async getChildren(element?: vscode.TreeItem): Promise<vscode.TreeItem[]> {
        if (element) {
            return [];
        }

        const sessions = await this.tmuxService.getSessions();
        if (sessions.length > 0) {
            return sessions.map(sessionName => {
                const item = new vscode.TreeItem(sessionName, vscode.TreeItemCollapsibleState.None);
                item.command = {
                    command: 'tmux-session-manager.attach',
                    title: 'Attach to Session',
                    arguments: [sessionName]
                };
                return item;
            });
        } else {
            return [new vscode.TreeItem('No running tmux sessions found.', vscode.TreeItemCollapsibleState.None)];
        }
    }
}