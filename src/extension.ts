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

    const newCommand = vscode.commands.registerCommand('tmux-session-manager.new', async () => {
        const sessions = await tmuxService.getSessions();
        let nextId = 0;
        while (sessions.includes(String(nextId))) {
            nextId++;
        }

        const newName = await vscode.window.showInputBox({
            prompt: 'Enter new session name',
            value: String(nextId),
            validateInput: value => {
                if (!value) {
                    return 'Session name cannot be empty.';
                }
                if (sessions.includes(value)) {
                    return `Session name "${value}" already exists.`;
                }
                return null;
            }
        });

        if (newName) {
            try {
                await tmuxService.newSession(newName);
                tmuxSessionProvider.refresh();
                // Attach to the new session
                const terminal = vscode.window.createTerminal(newName);
                terminal.sendText(`tmux attach -t "${newName}"`);
                terminal.show();
            } catch (error) {
                // Error is already shown by the service
            }
        }
    });

    const deleteCommand = vscode.commands.registerCommand('tmux-session-manager.delete', async (item: vscode.TreeItem) => {
        const sessionName = item.label as string;
        if (!sessionName) {
            return;
        }

        const confirmation = await vscode.window.showWarningMessage(
            `Are you sure you want to delete the tmux session "${sessionName}"?`,
            { modal: true },
            'Delete'
        );

        if (confirmation === 'Delete') {
            await tmuxService.deleteSession(sessionName);
            tmuxSessionProvider.refresh();
        }
    });

    context.subscriptions.push(attachCommand, refreshCommand, renameCommand, newCommand, deleteCommand);
}

export function deactivate() {}