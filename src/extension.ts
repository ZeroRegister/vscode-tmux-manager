import * as vscode from 'vscode';
import { TmuxSessionProvider } from './treeProvider';
import { TmuxService } from './tmuxService';

export function activate(context: vscode.ExtensionContext) {
    const tmuxService = new TmuxService();
    const tmuxSessionProvider = new TmuxSessionProvider(tmuxService);

    vscode.window.registerTreeDataProvider('tmux-session-manager', tmuxSessionProvider);

    const attachCommand = vscode.commands.registerCommand('tmux-session-manager.attach', (sessionName: string) => {
        const terminal = vscode.window.createTerminal(sessionName);
        terminal.sendText(`tmux attach -t "${sessionName}"`);
        terminal.show();
    });

    const refreshCommand = vscode.commands.registerCommand('tmux-session-manager.refresh', () => {
        tmuxSessionProvider.refresh();
    });

    const renameCommand = vscode.commands.registerCommand('tmux-session-manager.rename', async (item: vscode.TreeItem) => {
        const oldName = item.label as string;
        if (!oldName) {
            return;
        }

        const newName = await vscode.window.showInputBox({
            prompt: `Rename tmux session "${oldName}"`,
            value: oldName,
            validateInput: value => {
                return value ? null : 'Session name cannot be empty.';
            }
        });

        if (newName && newName !== oldName) {
            await tmuxService.renameSession(oldName, newName);
            tmuxSessionProvider.refresh();
        }
    });

    context.subscriptions.push(attachCommand, refreshCommand, renameCommand);
}

export function deactivate() {}