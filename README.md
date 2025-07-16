# Tmux Session Manager for VS Code

[![VS Code Marketplace Version](https://img.shields.io/visual-studio-marketplace/v/ZeroRegister.vscode-tmux-manager?style=flat-square&label=Marketplace)](https://marketplace.visualstudio.com/items?itemName=ZeroRegister.vscode-tmux-manager)

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

在 VS Code 侧边栏中轻松管理您的 Tmux 会话、窗口和窗格，带来前所未有的流畅体验。

![插件截图](https://raw.githubusercontent.com/YOUR_USERNAME/YOUR_REPO/main/screenshot.png)  
*(建议您替换为自己的截图或 GIF 动图)*

## ✨ 功能特性

-   **🌲 树状视图**: 以 "会话 -> 窗口 -> 窗格" 的清晰树状结构展示所有 Tmux 元素。
-   **🖱️ 一键操作**:
    -   **快速附加**: 点击任意会话、窗口或窗格旁的启动图标 (▶) 即可在 VS Code 内置终端中附加。
    -   **智能终端复用**: 自动复用已打开的终端，避免窗口泛滥。
-   **⚡ 高效管理**:
    -   **会话**: 新建、重命名、删除。
    -   **窗口**: 通过行内图标或右键菜单快速新建窗口。
    -   **窗格**: 通过行内图标或右键菜单进行水平/垂直分割，或关闭窗格。
-   ** intuitive UI**:
    -   **行内图标**: 在每个项目上悬停即可看到常用操作图标，操作更直接。
    -   **右键菜单**: 提供所有管理功能的完整上下文菜单。

## 🚀 安装

### 方式一：从 VS Code Marketplace (推荐)

1.  打开 VS Code。
2.  进入扩展视图 (`Ctrl+Shift+X`)。
3.  搜索 `Tmux Session Manager`。
4.  点击 **Install**。

### 方式二：从 `.vsix` 文件手动安装

1.  从 [Releases 页面](https://github.com/YOUR_USERNAME/YOUR_REPO/releases) 下载最新的 `.vsix` 文件。
2.  在 VS Code 中，打开扩展视图。
3.  点击视图顶部的 `...` (更多操作) 按钮。
4.  选择 **从 VSIX 安装...** (`Install from VSIX...`)。
5.  选择您下载的 `.vsix` 文件进行安装。

## 📖 使用说明

1.  **打开视图**: 点击 VS Code 左侧活动栏的 **Tmux 图标**，即可看到所有正在运行的 Tmux 会话。
2.  **刷新**: 点击视图标题栏的刷新按钮可以手动同步 Tmux 状态。

### 会话 (Session) 操作
-   **附加**: 点击会话项右侧的 **▶** 图标。
-   **新建窗口**: 点击会-话项右侧的 **+** 图标，或右键选择 "New Window"。
-   **重命名**: 右键点击会话，选择 "Rename Session"。
-   **删除**: 右键点击会话，选择 "Delete Session"。

### 窗口 (Window) 操作
-   **附加**: 点击窗口项右侧的 **▶** 图标，将自动切换到该窗口。
-   **关闭**: 右键点击窗口，选择 "Kill Window"。

### 窗格 (Pane) 操作
-   **附加**: 点击窗格项右侧的 **▶** 图标，将自动切换到该窗格。
-   **分割窗格**: 点击窗格项右侧的 **+** 图标，然后选择分割方向（向右或向下）。也可以通过右键菜单选择。
-   **关闭**: 右键点击窗格，选择 "Kill Pane"。

## 🎒打包插件
```shell
npm install vsce
vsce package
```

## 📋 依赖要求

-   您的系统中必须已安装 **`tmux`**。

## 📄 许可证

本项目采用 [MIT](https://opensource.org/licenses/MIT) 许可证。