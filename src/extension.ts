import * as vscode from 'vscode';
import { TmuxSessionProvider, TmuxSessionTreeItem, TmuxWindowTreeItem, TmuxPaneTreeItem } from './treeProvider';
import { TmuxService } from './tmuxService';

export function activate(context: vscode.ExtensionContext) {
    const tmuxService = new TmuxService();
    const tmuxSessionProvider = new TmuxSessionProvider(tmuxService, context.extensionPath);

    vscode.window.registerTreeDataProvider('tmux-session-manager', tmuxSessionProvider);

    const attachCommand = vscode.commands.registerCommand('tmux-session-manager.attach', async (item: TmuxSessionTreeItem | TmuxWindowTreeItem | TmuxPaneTreeItem) => {
        let sessionName: string;

        if (item instanceof TmuxSessionTreeItem) {
            sessionName = item.session.name;
        } else if (item instanceof TmuxWindowTreeItem) {
            sessionName = item.window.sessionName;
        } else if (item instanceof TmuxPaneTreeItem) {
            sessionName = item.pane.sessionName;
        } else {
            sessionName = (item as any).label || 'tmux';
        }

        const existingTerminal = vscode.window.terminals.find(t => t.name === sessionName);

        if (existingTerminal) {
            existingTerminal.show();
            if (item instanceof TmuxWindowTreeItem) {
                await tmuxService.selectWindow(item.window.sessionName, item.window.index);
            } else if (item instanceof TmuxPaneTreeItem) {
                await tmuxService.selectPane(item.pane.sessionName, item.pane.windowIndex, item.pane.index);
            }
        } else {
            if (item instanceof TmuxWindowTreeItem) {
                await tmuxService.selectWindow(item.window.sessionName, item.window.index);
            } else if (item instanceof TmuxPaneTreeItem) {
                await tmuxService.selectPane(item.pane.sessionName, item.pane.windowIndex, item.pane.index);
            }
            const terminal = vscode.window.createTerminal(sessionName);
            terminal.sendText(`tmux attach -t "${sessionName}"`);
            terminal.show();
        }
    });

    const refreshCommand = vscode.commands.registerCommand('tmux-session-manager.refresh', () => {
        tmuxSessionProvider.refresh();
    });

    const renameCommand = vscode.commands.registerCommand('tmux-session-manager.rename', async (item: TmuxSessionTreeItem) => {
        const oldName = item.session.name;
        if (!oldName) return;

        const newName = await vscode.window.showInputBox({
            prompt: `Rename tmux session "${oldName}"`,
            value: oldName,
            validateInput: value => value ? null : 'Session name cannot be empty.'
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
                if (!value) return 'Session name cannot be empty.';
                if (sessions.includes(value)) return `Session name "${value}" already exists.`;
                return null;
            }
        });

        if (newName) {
            try {
                await tmuxService.newSession(newName);
                tmuxSessionProvider.refresh();
                const terminal = vscode.window.createTerminal(newName);
                terminal.sendText(`tmux attach -t "${newName}"`);
                terminal.show();
            } catch (error) {
                // Error is already shown by the service
            }
        }
    });

    const deleteCommand = vscode.commands.registerCommand('tmux-session-manager.delete', async (item: TmuxSessionTreeItem) => {
        const sessionName = item.session.name;
        if (!sessionName) return;

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

    const killWindowCommand = vscode.commands.registerCommand('tmux-session-manager.kill-window', async (item: TmuxWindowTreeItem) => {
        const { sessionName, index, name } = item.window;
        const confirmation = await vscode.window.showWarningMessage(
            `Are you sure you want to kill window "${index}:${name}"?`,
            { modal: true },
            'Kill Window'
        );

        if (confirmation === 'Kill Window') {
            await tmuxService.killWindow(sessionName, index);
            tmuxSessionProvider.refresh();
        }
    });

    const killPaneCommand = vscode.commands.registerCommand('tmux-session-manager.kill-pane', async (item: TmuxPaneTreeItem) => {
        const { sessionName, windowIndex, index, command } = item.pane;
        const confirmation = await vscode.window.showWarningMessage(
            `Are you sure you want to kill pane "${index}: ${command}"?`,
            { modal: true },
            'Kill Pane'
        );

        if (confirmation === 'Kill Pane') {
            await tmuxService.killPane(sessionName, windowIndex, index);
            tmuxSessionProvider.refresh();
        }
    });

    const newWindowCommand = vscode.commands.registerCommand('tmux-session-manager.newWindow', async (item: TmuxSessionTreeItem) => {
        await tmuxService.newWindow(item.session.name);
        tmuxSessionProvider.refresh();
    });

    const splitPaneRightCommand = vscode.commands.registerCommand('tmux-session-manager.splitPaneRight', async (item: TmuxPaneTreeItem) => {
        const targetPane = `${item.pane.sessionName}:${item.pane.windowIndex}.${item.pane.index}`;
        await tmuxService.splitPane(targetPane, 'h');
        tmuxSessionProvider.refresh();
    });

    const splitPaneDownCommand = vscode.commands.registerCommand('tmux-session-manager.splitPaneDown', async (item: TmuxPaneTreeItem) => {
        const targetPane = `${item.pane.sessionName}:${item.pane.windowIndex}.${item.pane.index}`;
        await tmuxService.splitPane(targetPane, 'v');
        tmuxSessionProvider.refresh();
    });

    const inlineNewWindowCommand = vscode.commands.registerCommand('tmux-session-manager.inline.newWindow', async (item: TmuxSessionTreeItem) => {
        await tmuxService.newWindow(item.session.name);
        tmuxSessionProvider.refresh();
    });

    const inlineSplitPaneCommand = vscode.commands.registerCommand('tmux-session-manager.inline.splitPane', async (item: TmuxPaneTreeItem) => {
        const choice = await vscode.window.showQuickPick(['Split Right', 'Split Down'], {
            placeHolder: 'Select split direction'
        });

        if (choice) {
            const direction = choice === 'Split Right' ? 'h' : 'v';
            const targetPane = `${item.pane.sessionName}:${item.pane.windowIndex}.${item.pane.index}`;
            await tmuxService.splitPane(targetPane, direction);
            tmuxSessionProvider.refresh();
        }
    });

    context.subscriptions.push(
        attachCommand,
        refreshCommand,
        renameCommand,
        newCommand,
        deleteCommand,
        killWindowCommand,
        killPaneCommand,
        newWindowCommand,
        splitPaneRightCommand,
        splitPaneDownCommand,
        inlineNewWindowCommand,
        inlineSplitPaneCommand
    );
}

export function deactivate() {}