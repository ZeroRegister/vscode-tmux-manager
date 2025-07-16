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
    const tmuxSessionProvider = new treeProvider_1.TmuxSessionProvider(tmuxService);
    vscode.window.registerTreeDataProvider('tmux-session-manager', tmuxSessionProvider);
    const attachCommand = vscode.commands.registerCommand('tmux-session-manager.attach', (sessionName) => {
        const terminal = vscode.window.createTerminal(sessionName);
        terminal.sendText(`tmux attach -t "${sessionName}"`);
        terminal.show();
    });
    const refreshCommand = vscode.commands.registerCommand('tmux-session-manager.refresh', () => {
        tmuxSessionProvider.refresh();
    });
    const renameCommand = vscode.commands.registerCommand('tmux-session-manager.rename', async (item) => {
        const oldName = item.label;
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
            }
            catch (error) {
                // Error is already shown by the service
            }
        }
    });
    const deleteCommand = vscode.commands.registerCommand('tmux-session-manager.delete', async (item) => {
        const sessionName = item.label;
        if (!sessionName) {
            return;
        }
        const confirmation = await vscode.window.showWarningMessage(`Are you sure you want to delete the tmux session "${sessionName}"?`, { modal: true }, 'Delete');
        if (confirmation === 'Delete') {
            await tmuxService.deleteSession(sessionName);
            tmuxSessionProvider.refresh();
        }
    });
    context.subscriptions.push(attachCommand, refreshCommand, renameCommand, newCommand, deleteCommand);
}
function deactivate() { }
//# sourceMappingURL=extension.js.map