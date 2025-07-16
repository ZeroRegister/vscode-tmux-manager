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
const path = __importStar(require("path"));
class TmuxSessionProvider {
    constructor(tmuxService, extensionPath) {
        this.tmuxService = tmuxService;
        this.extensionPath = extensionPath;
        this._onDidChangeTreeData = new vscode.EventEmitter();
        this.onDidChangeTreeData = this._onDidChangeTreeData.event;
    }
    refresh() {
        this._onDidChangeTreeData.fire();
    }
    getTreeItem(element) {
        return element;
    }
    async getChildren(element) {
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
        super(session.name, vscode.TreeItemCollapsibleState.Expanded);
        this.session = session;
        this.contextValue = 'tmuxSession';
        this.iconPath = new vscode.ThemeIcon('server-process');
    }
}
exports.TmuxSessionTreeItem = TmuxSessionTreeItem;
class TmuxWindowTreeItem extends vscode.TreeItem {
    constructor(window, extensionPath) {
        super(`${window.index}:${window.name}`, vscode.TreeItemCollapsibleState.Expanded);
        this.window = window;
        this.contextValue = 'tmuxWindow';
        this.iconPath = {
            light: vscode.Uri.file(path.join(extensionPath, 'resources', 'window.svg')),
            dark: vscode.Uri.file(path.join(extensionPath, 'resources', 'window.svg'))
        };
    }
}
exports.TmuxWindowTreeItem = TmuxWindowTreeItem;
class TmuxPaneTreeItem extends vscode.TreeItem {
    constructor(pane, extensionPath) {
        super(`${pane.index}: ${pane.command}`, vscode.TreeItemCollapsibleState.None);
        this.pane = pane;
        this.contextValue = 'tmuxPane';
        this.iconPath = {
            light: vscode.Uri.file(path.join(extensionPath, 'resources', 'pane.svg')),
            dark: vscode.Uri.file(path.join(extensionPath, 'resources', 'pane.svg'))
        };
    }
}
exports.TmuxPaneTreeItem = TmuxPaneTreeItem;
//# sourceMappingURL=treeProvider.js.map