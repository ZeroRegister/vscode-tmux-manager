export interface TmuxPane {
    sessionName: string;
    windowIndex: string;
    index: string;
    command: string;
    currentPath: string;
    isActive: boolean;
    pid: number;
}

export interface TmuxWindow {
    sessionName: string;
    index: string;
    name: string;
    isActive: boolean;
    panes: TmuxPane[];
}

export interface TmuxSession {
    name: string;
    isAttached: boolean;
    created: string;
    lastActivity: string;
    windows: TmuxWindow[];
}