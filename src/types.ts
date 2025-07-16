export interface TmuxPane {
    sessionName: string;
    windowIndex: string;
    index: string;
    command: string;
}

export interface TmuxWindow {
    sessionName: string;
    index: string;
    name: string;
    panes: TmuxPane[];
}

export interface TmuxSession {
    name: string;
    windows: TmuxWindow[];
}