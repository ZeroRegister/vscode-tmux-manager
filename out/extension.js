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
exports.activate = activate;
exports.deactivate = deactivate;
const vscode = __importStar(require("vscode"));
const treeProvider_1 = require("./treeProvider");
const tmuxService_1 = require("./tmuxService");
function activate(context) {
    const tmuxService = new tmuxService_1.TmuxService();
    const tmuxSessionProvider = new treeProvider_1.TmuxSessionProvider(tmuxService, context.extensionPath);
    vscode.window.registerTreeDataProvider('vscode-tmux-manager', tmuxSessionProvider);
    const attachCommand = vscode.commands.registerCommand('vscode-tmux-manager.attach', async (item) => {
        if (!item) {
            vscode.window.showErrorMessage('No item selected for attach');
            return;
        }
        let sessionName;
        let itemType = 'session';
        if (item instanceof treeProvider_1.TmuxSessionTreeItem) {
            if (!item.session || !item.session.name) {
                vscode.window.showErrorMessage('Invalid session data');
                return;
            }
            sessionName = item.session.name;
            itemType = 'session';
        }
        else if (item instanceof treeProvider_1.TmuxWindowTreeItem) {
            if (!item.window || !item.window.sessionName) {
                vscode.window.showErrorMessage('Invalid window data');
                return;
            }
            sessionName = item.window.sessionName;
            itemType = 'window';
        }
        else if (item instanceof treeProvider_1.TmuxPaneTreeItem) {
            if (!item.pane || !item.pane.sessionName) {
                vscode.window.showErrorMessage('Invalid pane data');
                return;
            }
            sessionName = item.pane.sessionName;
            itemType = 'pane';
        }
        else {
            // Fallback for unknown item types
            const fallbackItem = item;
            if (fallbackItem && typeof fallbackItem.label === 'string') {
                sessionName = fallbackItem.label;
            }
            else {
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
                const windowItem = item;
                await tmuxService.selectWindow(windowItem.window.sessionName, windowItem.window.index);
                vscode.window.showInformationMessage(`Switched to window ${windowItem.window.index}:${windowItem.window.name}`);
            }
            else if (itemType === 'pane') {
                const paneItem = item;
                // First select the window, then the pane
                await tmuxService.selectWindow(paneItem.pane.sessionName, paneItem.pane.windowIndex);
                await tmuxService.selectPane(paneItem.pane.sessionName, paneItem.pane.windowIndex, paneItem.pane.index);
                vscode.window.showInformationMessage(`Switched to pane ${paneItem.pane.index} in window ${paneItem.pane.windowIndex}`);
            }
            else {
                vscode.window.showInformationMessage(`Attached to session "${sessionName}"`);
            }
        }
        else {
            // No existing terminal, create new one and attach
            const terminal = vscode.window.createTerminal(sessionName);
            terminal.sendText(`tmux attach -t "${sessionName}"`);
            terminal.show();
            // Wait a bit for the attach to complete, then switch to specific target
            await new Promise(resolve => setTimeout(resolve, 500));
            if (itemType === 'window') {
                const windowItem = item;
                await tmuxService.selectWindow(windowItem.window.sessionName, windowItem.window.index);
                vscode.window.showInformationMessage(`Attached to session "${sessionName}" and switched to window ${windowItem.window.index}:${windowItem.window.name}`);
            }
            else if (itemType === 'pane') {
                const paneItem = item;
                // First select the window, then the pane
                await tmuxService.selectWindow(paneItem.pane.sessionName, paneItem.pane.windowIndex);
                await tmuxService.selectPane(paneItem.pane.sessionName, paneItem.pane.windowIndex, paneItem.pane.index);
                vscode.window.showInformationMessage(`Attached to session "${sessionName}" and switched to pane ${paneItem.pane.index} in window ${paneItem.pane.windowIndex}`);
            }
            else {
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
    const renameCommand = vscode.commands.registerCommand('vscode-tmux-manager.rename', async (item) => {
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
    const renameWindowCommand = vscode.commands.registerCommand('vscode-tmux-manager.renameWindow', async (item) => {
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
            }
            catch (error) {
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
                if (!value)
                    return 'Session name cannot be empty.';
                if (sessions.includes(value))
                    return `Session name "${value}" already exists.`;
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
            }
            catch (error) {
                // Error is already shown by the service
            }
        }
    });
    const deleteCommand = vscode.commands.registerCommand('vscode-tmux-manager.delete', async (item) => {
        if (!item || !item.session || !item.session.name) {
            vscode.window.showErrorMessage('Invalid session data for delete operation');
            return;
        }
        const sessionName = item.session.name;
        const confirmation = await vscode.window.showWarningMessage(`Are you sure you want to delete the tmux session "${sessionName}"?`, { modal: true }, 'Delete');
        if (confirmation === 'Delete') {
            await tmuxService.deleteSession(sessionName);
            tmuxSessionProvider.refresh();
        }
    });
    const killWindowCommand = vscode.commands.registerCommand('vscode-tmux-manager.kill-window', async (item) => {
        if (!item || !item.window) {
            vscode.window.showErrorMessage('Invalid window data for kill operation');
            return;
        }
        const { sessionName, index, name } = item.window;
        if (!sessionName || !index) {
            vscode.window.showErrorMessage('Missing window information');
            return;
        }
        const confirmation = await vscode.window.showWarningMessage(`Are you sure you want to kill window "${index}:${name}"?`, { modal: true }, 'Kill Window');
        if (confirmation === 'Kill Window') {
            await tmuxService.killWindow(sessionName, index);
            tmuxSessionProvider.refresh();
        }
    });
    const killPaneCommand = vscode.commands.registerCommand('vscode-tmux-manager.kill-pane', async (item) => {
        if (!item || !item.pane) {
            vscode.window.showErrorMessage('Invalid pane data for kill operation');
            return;
        }
        const { sessionName, windowIndex, index, command } = item.pane;
        if (!sessionName || !windowIndex || !index) {
            vscode.window.showErrorMessage('Missing pane information');
            return;
        }
        const confirmation = await vscode.window.showWarningMessage(`Are you sure you want to kill pane "${index}: ${command || 'unknown'}"?`, { modal: true }, 'Kill Pane');
        if (confirmation === 'Kill Pane') {
            await tmuxService.killPane(sessionName, windowIndex, index);
            tmuxSessionProvider.refresh();
        }
    });
    const newWindowCommand = vscode.commands.registerCommand('vscode-tmux-manager.newWindow', async (item) => {
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
        }
        catch (error) {
            // Error is already shown by the service
        }
    });
    const splitPaneRightCommand = vscode.commands.registerCommand('vscode-tmux-manager.splitPaneRight', async (item) => {
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
    const splitPaneDownCommand = vscode.commands.registerCommand('vscode-tmux-manager.splitPaneDown', async (item) => {
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
    const inlineNewWindowCommand = vscode.commands.registerCommand('vscode-tmux-manager.inline.newWindow', async (item) => {
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
        }
        catch (error) {
            // Error is already shown by the service
        }
    });
    const inlineSplitPaneCommand = vscode.commands.registerCommand('vscode-tmux-manager.inline.splitPane', async (item) => {
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
    context.subscriptions.push(attachCommand, refreshCommand, toggleAutoRefreshCommand, renameCommand, renameWindowCommand, newCommand, deleteCommand, killWindowCommand, killPaneCommand, newWindowCommand, splitPaneRightCommand, splitPaneDownCommand, inlineNewWindowCommand, inlineSplitPaneCommand, tmuxSessionProvider // Add provider to dispose auto-refresh on deactivation
    );
}
function deactivate() { }
//# sourceMappingURL=extension.js.map