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
    vscode.window.registerTreeDataProvider('tmux-session-manager', tmuxSessionProvider);
    const attachCommand = vscode.commands.registerCommand('tmux-session-manager.attach', async (item) => {
        let sessionName;
        if (item instanceof treeProvider_1.TmuxSessionTreeItem) {
            sessionName = item.session.name;
        }
        else if (item instanceof treeProvider_1.TmuxWindowTreeItem) {
            sessionName = item.window.sessionName;
        }
        else if (item instanceof treeProvider_1.TmuxPaneTreeItem) {
            sessionName = item.pane.sessionName;
        }
        else {
            sessionName = item.label || 'tmux';
        }
        const existingTerminal = vscode.window.terminals.find(t => t.name === sessionName);
        if (existingTerminal) {
            existingTerminal.show();
            if (item instanceof treeProvider_1.TmuxWindowTreeItem) {
                await tmuxService.selectWindow(item.window.sessionName, item.window.index);
            }
            else if (item instanceof treeProvider_1.TmuxPaneTreeItem) {
                await tmuxService.selectPane(item.pane.sessionName, item.pane.windowIndex, item.pane.index);
            }
        }
        else {
            if (item instanceof treeProvider_1.TmuxWindowTreeItem) {
                await tmuxService.selectWindow(item.window.sessionName, item.window.index);
            }
            else if (item instanceof treeProvider_1.TmuxPaneTreeItem) {
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
    const renameCommand = vscode.commands.registerCommand('tmux-session-manager.rename', async (item) => {
        const oldName = item.session.name;
        if (!oldName)
            return;
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
    const deleteCommand = vscode.commands.registerCommand('tmux-session-manager.delete', async (item) => {
        const sessionName = item.session.name;
        if (!sessionName)
            return;
        const confirmation = await vscode.window.showWarningMessage(`Are you sure you want to delete the tmux session "${sessionName}"?`, { modal: true }, 'Delete');
        if (confirmation === 'Delete') {
            await tmuxService.deleteSession(sessionName);
            tmuxSessionProvider.refresh();
        }
    });
    const killWindowCommand = vscode.commands.registerCommand('tmux-session-manager.kill-window', async (item) => {
        const { sessionName, index, name } = item.window;
        const confirmation = await vscode.window.showWarningMessage(`Are you sure you want to kill window "${index}:${name}"?`, { modal: true }, 'Kill Window');
        if (confirmation === 'Kill Window') {
            await tmuxService.killWindow(sessionName, index);
            tmuxSessionProvider.refresh();
        }
    });
    const killPaneCommand = vscode.commands.registerCommand('tmux-session-manager.kill-pane', async (item) => {
        const { sessionName, windowIndex, index, command } = item.pane;
        const confirmation = await vscode.window.showWarningMessage(`Are you sure you want to kill pane "${index}: ${command}"?`, { modal: true }, 'Kill Pane');
        if (confirmation === 'Kill Pane') {
            await tmuxService.killPane(sessionName, windowIndex, index);
            tmuxSessionProvider.refresh();
        }
    });
    const newWindowCommand = vscode.commands.registerCommand('tmux-session-manager.newWindow', async (item) => {
        await tmuxService.newWindow(item.session.name);
        tmuxSessionProvider.refresh();
    });
    const splitPaneRightCommand = vscode.commands.registerCommand('tmux-session-manager.splitPaneRight', async (item) => {
        const targetPane = `${item.pane.sessionName}:${item.pane.windowIndex}.${item.pane.index}`;
        await tmuxService.splitPane(targetPane, 'h');
        tmuxSessionProvider.refresh();
    });
    const splitPaneDownCommand = vscode.commands.registerCommand('tmux-session-manager.splitPaneDown', async (item) => {
        const targetPane = `${item.pane.sessionName}:${item.pane.windowIndex}.${item.pane.index}`;
        await tmuxService.splitPane(targetPane, 'v');
        tmuxSessionProvider.refresh();
    });
    context.subscriptions.push(attachCommand, refreshCommand, renameCommand, newCommand, deleteCommand, killWindowCommand, killPaneCommand, newWindowCommand, splitPaneRightCommand, splitPaneDownCommand);
}
function deactivate() { }
//# sourceMappingURL=extension.js.map