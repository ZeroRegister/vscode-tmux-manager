import * as vscode from 'vscode';
import { TmuxSessionProvider, TmuxSessionTreeItem, TmuxWindowTreeItem, TmuxPaneTreeItem } from './treeProvider';
import { TmuxService } from './tmuxService';

export function activate(context: vscode.ExtensionContext) {
    const tmuxService = new TmuxService();
    const tmuxSessionProvider = new TmuxSessionProvider(tmuxService, context.extensionPath);

    vscode.window.registerTreeDataProvider('vscode-tmux-manager', tmuxSessionProvider);

    const attachCommand = vscode.commands.registerCommand('vscode-tmux-manager.attach', async (item: TmuxSessionTreeItem | TmuxWindowTreeItem | TmuxPaneTreeItem) => {
        if (!item) {
            vscode.window.showErrorMessage('No item selected for attach');
            return;
        }

        let sessionName: string;
        let itemType: 'session' | 'window' | 'pane' = 'session';

        if (item instanceof TmuxSessionTreeItem) {
            if (!item.session || !item.session.name) {
                vscode.window.showErrorMessage('Invalid session data');
                return;
            }
            sessionName = item.session.name;
            itemType = 'session';
        } else if (item instanceof TmuxWindowTreeItem) {
            if (!item.window || !item.window.sessionName) {
                vscode.window.showErrorMessage('Invalid window data');
                return;
            }
            sessionName = item.window.sessionName;
            itemType = 'window';
        } else if (item instanceof TmuxPaneTreeItem) {
            if (!item.pane || !item.pane.sessionName) {
                vscode.window.showErrorMessage('Invalid pane data');
                return;
            }
            sessionName = item.pane.sessionName;
            itemType = 'pane';
        } else {
            // Fallback for unknown item types
            const fallbackItem = item as any;
            if (fallbackItem && typeof fallbackItem.label === 'string') {
                sessionName = fallbackItem.label;
            } else {
                vscode.window.showErrorMessage('Unknown item type for attach operation');
                return;
            }
        }

        const existingTerminal = vscode.window.terminals.find(t => t.name === sessionName);

        if (existingTerminal) {
            // Terminal exists, show it and switch to the specific target
            existingTerminal.show();
            
            // Add a small delay to ensure terminal is focused before sending commands
            await new Promise(resolve => setTimeout(resolve, 100));
            
            if (itemType === 'window') {
                const windowItem = item as TmuxWindowTreeItem;
                await tmuxService.selectWindow(windowItem.window.sessionName, windowItem.window.index);
                vscode.window.showInformationMessage(`Switched to window ${windowItem.window.index}:${windowItem.window.name}`);
            } else if (itemType === 'pane') {
                const paneItem = item as TmuxPaneTreeItem;
                // First select the window, then the pane
                await tmuxService.selectWindow(paneItem.pane.sessionName, paneItem.pane.windowIndex);
                await tmuxService.selectPane(paneItem.pane.sessionName, paneItem.pane.windowIndex, paneItem.pane.index);
                vscode.window.showInformationMessage(`Switched to pane ${paneItem.pane.index} in window ${paneItem.pane.windowIndex}`);
            } else {
                vscode.window.showInformationMessage(`Attached to session "${sessionName}"`);
            }
        } else {
            // No existing terminal, create new one and attach
            const terminal = vscode.window.createTerminal(sessionName);
            terminal.sendText(`tmux attach -t "${sessionName}"`);
            terminal.show();
            
            // Wait a bit for the attach to complete, then switch to specific target
            await new Promise(resolve => setTimeout(resolve, 500));
            
            if (itemType === 'window') {
                const windowItem = item as TmuxWindowTreeItem;
                await tmuxService.selectWindow(windowItem.window.sessionName, windowItem.window.index);
                vscode.window.showInformationMessage(`Attached to session "${sessionName}" and switched to window ${windowItem.window.index}:${windowItem.window.name}`);
            } else if (itemType === 'pane') {
                const paneItem = item as TmuxPaneTreeItem;
                // First select the window, then the pane
                await tmuxService.selectWindow(paneItem.pane.sessionName, paneItem.pane.windowIndex);
                await tmuxService.selectPane(paneItem.pane.sessionName, paneItem.pane.windowIndex, paneItem.pane.index);
                vscode.window.showInformationMessage(`Attached to session "${sessionName}" and switched to pane ${paneItem.pane.index} in window ${paneItem.pane.windowIndex}`);
            } else {
                vscode.window.showInformationMessage(`Attached to session "${sessionName}"`);
            }
        }
    });

    const refreshCommand = vscode.commands.registerCommand('vscode-tmux-manager.refresh', async () => {
        // Force fresh data by clearing cache
        await tmuxService.getTmuxTreeFresh();
        tmuxSessionProvider.refresh();
    });

    const toggleAutoRefreshCommand = vscode.commands.registerCommand('vscode-tmux-manager.toggleAutoRefresh', () => {
        tmuxSessionProvider.toggleAutoRefresh();
    });

    const renameCommand = vscode.commands.registerCommand('vscode-tmux-manager.rename', async (item: TmuxSessionTreeItem) => {
        if (!item || !item.session || !item.session.name) {
            vscode.window.showErrorMessage('Invalid session data for rename operation');
            return;
        }
        
        const oldName = item.session.name;

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

    const renameWindowCommand = vscode.commands.registerCommand('vscode-tmux-manager.renameWindow', async (item: TmuxWindowTreeItem) => {
        if (!item || !item.window || !item.window.sessionName || !item.window.index) {
            vscode.window.showErrorMessage('Invalid window data for rename operation');
            return;
        }
        
        const { sessionName, index, name } = item.window;
        const oldName = name;

        const newName = await vscode.window.showInputBox({
            prompt: `Rename window "${index}:${oldName}" in session "${sessionName}"`,
            value: oldName,
            validateInput: value => {
                if (!value || value.trim() === '') {
                    return 'Window name cannot be empty.';
                }
                if (value === oldName) {
                    return null; // Same name is ok, just won't do anything
                }
                return null;
            }
        });

        if (newName && newName !== oldName) {
            try {
                await tmuxService.renameWindow(sessionName, index, newName);
                tmuxSessionProvider.refresh();
            } catch (error) {
                // Error is already shown by the service
            }
        }
    });

    const newCommand = vscode.commands.registerCommand('vscode-tmux-manager.new', async () => {
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

    const deleteCommand = vscode.commands.registerCommand('vscode-tmux-manager.delete', async (item: TmuxSessionTreeItem) => {
        if (!item || !item.session || !item.session.name) {
            vscode.window.showErrorMessage('Invalid session data for delete operation');
            return;
        }
        
        const sessionName = item.session.name;

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

    const killWindowCommand = vscode.commands.registerCommand('vscode-tmux-manager.kill-window', async (item: TmuxWindowTreeItem) => {
        if (!item || !item.window) {
            vscode.window.showErrorMessage('Invalid window data for kill operation');
            return;
        }
        
        const { sessionName, index, name } = item.window;
        
        if (!sessionName || !index) {
            vscode.window.showErrorMessage('Missing window information');
            return;
        }
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

    const killPaneCommand = vscode.commands.registerCommand('vscode-tmux-manager.kill-pane', async (item: TmuxPaneTreeItem) => {
        if (!item || !item.pane) {
            vscode.window.showErrorMessage('Invalid pane data for kill operation');
            return;
        }

        const { sessionName, windowIndex, index, command } = item.pane;
        
        if (!sessionName || !windowIndex || !index) {
            vscode.window.showErrorMessage('Missing pane information');
            return;
        }

        const confirmation = await vscode.window.showWarningMessage(
            `Are you sure you want to kill pane "${index}: ${command || 'unknown'}"?`,
            { modal: true },
            'Kill Pane'
        );

        if (confirmation === 'Kill Pane') {
            await tmuxService.killPane(sessionName, windowIndex, index);
            tmuxSessionProvider.refresh();
        }
    });

    const newWindowCommand = vscode.commands.registerCommand('vscode-tmux-manager.newWindow', async (item: TmuxSessionTreeItem) => {
        if (!item || !item.session || !item.session.name) {
            vscode.window.showErrorMessage('Invalid session data for new window operation');
            return;
        }
        
        const sessionName = item.session.name;
        const windowName = await vscode.window.showInputBox({
            prompt: `Enter name for new window in session "${sessionName}"`,
            placeHolder: 'Leave empty for default name',
            validateInput: value => {
                // Allow empty value for default name
                if (value && value.trim() === '') {
                    return null; // Empty is OK, will use default
                }
                return null; // Any non-empty value is OK
            }
        });

        // User cancelled the input
        if (windowName === undefined) {
            return;
        }

        try {
            const finalWindowName = windowName.trim() || undefined; // Use undefined for empty string
            await tmuxService.newWindow(sessionName, finalWindowName);
            tmuxSessionProvider.refresh();
        } catch (error) {
            // Error is already shown by the service
        }
    });

    const splitPaneRightCommand = vscode.commands.registerCommand('vscode-tmux-manager.splitPaneRight', async (item: TmuxPaneTreeItem) => {
        if (!item || !item.pane) {
            vscode.window.showErrorMessage('Invalid pane data for split operation');
            return;
        }
        
        const { sessionName, windowIndex, index } = item.pane;
        if (!sessionName || !windowIndex || !index) {
            vscode.window.showErrorMessage('Missing pane information for split');
            return;
        }
        
        const targetPane = `${sessionName}:${windowIndex}.${index}`;
        await tmuxService.splitPane(targetPane, 'h');
        tmuxSessionProvider.refresh();
    });

    const splitPaneDownCommand = vscode.commands.registerCommand('vscode-tmux-manager.splitPaneDown', async (item: TmuxPaneTreeItem) => {
        if (!item || !item.pane) {
            vscode.window.showErrorMessage('Invalid pane data for split operation');
            return;
        }
        
        const { sessionName, windowIndex, index } = item.pane;
        if (!sessionName || !windowIndex || !index) {
            vscode.window.showErrorMessage('Missing pane information for split');
            return;
        }
        
        const targetPane = `${sessionName}:${windowIndex}.${index}`;
        await tmuxService.splitPane(targetPane, 'v');
        tmuxSessionProvider.refresh();
    });

    const inlineNewWindowCommand = vscode.commands.registerCommand('vscode-tmux-manager.inline.newWindow', async (item: TmuxSessionTreeItem) => {
        if (!item || !item.session || !item.session.name) {
            vscode.window.showErrorMessage('Invalid session data for new window operation');
            return;
        }
        
        const sessionName = item.session.name;
        const windowName = await vscode.window.showInputBox({
            prompt: `Enter name for new window in session "${sessionName}"`,
            placeHolder: 'Leave empty for default name',
            validateInput: value => {
                // Allow empty value for default name
                if (value && value.trim() === '') {
                    return null; // Empty is OK, will use default
                }
                return null; // Any non-empty value is OK
            }
        });

        // User cancelled the input
        if (windowName === undefined) {
            return;
        }

        try {
            const finalWindowName = windowName.trim() || undefined; // Use undefined for empty string
            await tmuxService.newWindow(sessionName, finalWindowName);
            tmuxSessionProvider.refresh();
        } catch (error) {
            // Error is already shown by the service
        }
    });

    const inlineSplitPaneCommand = vscode.commands.registerCommand('vscode-tmux-manager.inline.splitPane', async (item: TmuxPaneTreeItem) => {
        if (!item || !item.pane) {
            vscode.window.showErrorMessage('Invalid pane data for split operation');
            return;
        }
        
        const { sessionName, windowIndex, index } = item.pane;
        if (!sessionName || !windowIndex || !index) {
            vscode.window.showErrorMessage('Missing pane information for split');
            return;
        }
        
        const choice = await vscode.window.showQuickPick(['Split Right', 'Split Down'], {
            placeHolder: 'Select split direction'
        });

        if (choice) {
            const direction = choice === 'Split Right' ? 'h' : 'v';
            const targetPane = `${sessionName}:${windowIndex}.${index}`;
            await tmuxService.splitPane(targetPane, direction);
            tmuxSessionProvider.refresh();
        }
    });

    context.subscriptions.push(
        attachCommand,
        refreshCommand,
        toggleAutoRefreshCommand,
        renameCommand,
        renameWindowCommand,
        newCommand,
        deleteCommand,
        killWindowCommand,
        killPaneCommand,
        newWindowCommand,
        splitPaneRightCommand,
        splitPaneDownCommand,
        inlineNewWindowCommand,
        inlineSplitPaneCommand,
        tmuxSessionProvider // Add provider to dispose auto-refresh on deactivation
    );
}

export function deactivate() {}