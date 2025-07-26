import * as vscode from 'vscode';
import { marked } from 'marked';
import { GeminiService } from './geminiService';

let currentPanel: vscode.WebviewPanel | undefined;

export function activate(context: vscode.ExtensionContext) {
    const geminiService = new GeminiService();

    const proofreadCommand = vscode.commands.registerCommand(
        'gemini-linter.proofread',
        async () => {
            await handleTextAnalysis('proofread', geminiService);
        }
    );

    const editCommand = vscode.commands.registerCommand('gemini-linter.edit', async () => {
        await handleTextAnalysis('edit', geminiService);
    });

    const evaluateCommand = vscode.commands.registerCommand('gemini-linter.evaluate', async () => {
        await handleTextAnalysis('evaluate', geminiService);
    });

    context.subscriptions.push(proofreadCommand, editCommand, evaluateCommand);
}

async function handleTextAnalysis(
    type: 'proofread' | 'edit' | 'evaluate',
    geminiService: GeminiService
) {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
        vscode.window.showErrorMessage('アクティブなエディタがありません');
        return;
    }

    const selection = editor.selection;
    const selectedText = editor.document.getText(selection);

    if (!selectedText.trim()) {
        vscode.window.showErrorMessage('テキストを選択してください');
        return;
    }

    const config = vscode.workspace.getConfiguration('geminiLinter');
    const apiKey = config.get<string>('apiKey');

    if (!apiKey) {
        const action = await vscode.window.showErrorMessage(
            'Gemini API キーが設定されていません',
            '設定を開く'
        );
        if (action === '設定を開く') {
            vscode.commands.executeCommand('workbench.action.openSettings', 'geminiLinter.apiKey');
        }
        return;
    }

    try {
        vscode.window.withProgress(
            {
                location: vscode.ProgressLocation.Notification,
                title: `${getActionName(type)}中...`,
                cancellable: false,
            },
            async () => {
                const startLine = selection.start.line + 1;
                const result = await geminiService.analyzeText(
                    selectedText,
                    type,
                    apiKey,
                    startLine
                );
                await showResult(result, type, editor.document.uri, startLine);
            }
        );
    } catch (error) {
        vscode.window.showErrorMessage(`エラーが発生しました: ${error}`);
    }
}

function getActionName(type: 'proofread' | 'edit' | 'evaluate'): string {
    switch (type) {
        case 'proofread':
            return '校正';
        case 'edit':
            return '校閲';
        case 'evaluate':
            return '評価';
    }
}

async function showResult(
    result: string,
    type: 'proofread' | 'edit' | 'evaluate',
    documentUri?: vscode.Uri,
    startLine?: number
) {
    const config = vscode.workspace.getConfiguration('geminiLinter');
    const displayMode = config.get<string>('displayMode', 'preview');

    if (displayMode === 'output') {
        showOutputChannel(result, type);
    } else {
        await showPreviewPanel(result, type, documentUri, startLine);
    }
}

function showOutputChannel(result: string, type: 'proofread' | 'edit' | 'evaluate') {
    const outputChannel = vscode.window.createOutputChannel(`Gemini ${getActionName(type)}結果`);
    outputChannel.clear();
    outputChannel.appendLine(`=== ${getActionName(type)}結果 ===`);
    outputChannel.appendLine('');
    outputChannel.appendLine(result);
    outputChannel.show();
}

async function showPreviewPanel(
    result: string,
    type: 'proofread' | 'edit' | 'evaluate',
    documentUri?: vscode.Uri,
    _startLine?: number
) {
    if (currentPanel) {
        currentPanel.reveal(vscode.ViewColumn.Beside);
    } else {
        currentPanel = vscode.window.createWebviewPanel(
            'geminiPreview',
            `Gemini ${getActionName(type)}結果`,
            vscode.ViewColumn.Beside,
            {
                enableScripts: true,
                retainContextWhenHidden: true,
            }
        );

        currentPanel.onDidDispose(() => {
            currentPanel = undefined;
        });

        // メッセージハンドラーを設定
        currentPanel.webview.onDidReceiveMessage(async message => {
            if (message.command === 'jumpToLine' && documentUri && message.line) {
                // 既に開いているエディタを探す
                const openEditors = vscode.window.visibleTextEditors;
                let targetEditor = openEditors.find(
                    editor => editor.document.uri.toString() === documentUri.toString()
                );

                if (targetEditor) {
                    // 既に開いているエディタを使用
                    await vscode.window.showTextDocument(
                        targetEditor.document,
                        targetEditor.viewColumn
                    );
                    targetEditor = vscode.window.activeTextEditor!;
                } else {
                    // 新しく開く
                    const document = await vscode.workspace.openTextDocument(documentUri);
                    targetEditor = await vscode.window.showTextDocument(document);
                }

                const line = Math.max(0, message.line - 1);
                const position = new vscode.Position(line, 0);
                targetEditor.selection = new vscode.Selection(position, position);
                targetEditor.revealRange(new vscode.Range(position, position));
            }
        });
    }

    try {
        let htmlContent = await marked(result);
        // 行番号のリンク化（「L」を除いて「n行目」と表示）
        htmlContent = htmlContent.replace(
            /(\d+)行目/g,
            '<span class="line-link" onclick="jumpToLine($1)">$1行目</span>'
        );
        currentPanel.webview.html = getWebviewContent(htmlContent, type);
        currentPanel.title = `Gemini ${getActionName(type)}結果`;
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        currentPanel.webview.html = getWebviewContent(
            `<p>エラーが発生しました: ${errorMessage}</p>`,
            type
        );
    }
}

function getWebviewContent(htmlContent: string, type: 'proofread' | 'edit' | 'evaluate'): string {
    const typeIcon = getTypeIcon(type);
    const typeName = getActionName(type);

    return `<!DOCTYPE html>
<html lang="ja">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Gemini ${typeName}結果</title>
    <style>
        body {
            font-family: var(--vscode-font-family);
            font-size: var(--vscode-font-size);
            color: var(--vscode-foreground);
            background-color: var(--vscode-editor-background);
            padding: 20px;
            line-height: 1.6;
            margin: 0;
        }
        
        .header {
            border-bottom: 2px solid var(--vscode-panel-border);
            padding-bottom: 15px;
            margin-bottom: 20px;
        }
        
        .header h1 {
            margin: 0;
            color: var(--vscode-textLink-foreground);
            display: flex;
            align-items: center;
            gap: 10px;
        }
        
        .content {
            max-width: none;
        }
        
        /* Markdown スタイル */
        h1, h2, h3, h4, h5, h6 {
            color: var(--vscode-textLink-foreground);
            margin-top: 1.5em;
            margin-bottom: 0.5em;
            border-bottom: 1px solid var(--vscode-panel-border);
            padding-bottom: 0.3em;
        }
        
        h1 { font-size: 1.8em; }
        h2 { font-size: 1.5em; }
        h3 { font-size: 1.3em; }
        
        p {
            margin: 1em 0;
        }
        
        ul, ol {
            padding-left: 1.5em;
            margin: 1em 0;
        }
        
        li {
            margin: 0.5em 0;
        }
        
        blockquote {
            border-left: 4px solid var(--vscode-textBlockQuote-border);
            background-color: var(--vscode-textBlockQuote-background);
            padding: 10px 15px;
            margin: 1em 0;
            font-style: italic;
        }
        
        code {
            background-color: var(--vscode-textCodeBlock-background);
            color: var(--vscode-textPreformat-foreground);
            padding: 2px 4px;
            border-radius: 3px;
            font-family: var(--vscode-editor-font-family);
        }
        
        pre {
            background-color: var(--vscode-textCodeBlock-background);
            color: var(--vscode-textPreformat-foreground);
            padding: 15px;
            border-radius: 5px;
            overflow-x: auto;
            border: 1px solid var(--vscode-panel-border);
        }
        
        pre code {
            background-color: transparent;
            padding: 0;
        }
        
        table {
            border-collapse: collapse;
            width: 100%;
            margin: 1em 0;
        }
        
        th, td {
            border: 1px solid var(--vscode-panel-border);
            padding: 8px 12px;
            text-align: left;
        }
        
        th {
            background-color: var(--vscode-textBlockQuote-background);
            font-weight: bold;
        }
        
        strong {
            color: var(--vscode-textLink-foreground);
            font-weight: bold;
        }
        
        em {
            font-style: italic;
            color: var(--vscode-textPreformat-foreground);
        }
        
        a {
            color: var(--vscode-textLink-foreground);
            text-decoration: none;
        }
        
        a:hover {
            text-decoration: underline;
        }
        
        hr {
            border: none;
            border-top: 1px solid var(--vscode-panel-border);
            margin: 2em 0;
        }
        
        .line-link {
            background-color: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
            padding: 2px 6px;
            border-radius: 3px;
            text-decoration: none;
            font-family: var(--vscode-editor-font-family);
            font-size: 0.9em;
            font-weight: bold;
            cursor: pointer;
            border: 1px solid var(--vscode-button-border);
        }
        
        .line-link:hover {
            background-color: var(--vscode-button-hoverBackground);
            text-decoration: none;
        }
    </style>
</head>
<body>
    <div class="header">
        <h1>${typeIcon} ${typeName}結果</h1>
    </div>
    
    <div class="content">
        ${htmlContent}
    </div>
    
    <script>
        const vscode = acquireVsCodeApi();
        
        window.jumpToLine = function(lineNumber) {
            vscode.postMessage({
                command: 'jumpToLine',
                line: parseInt(lineNumber)
            });
        };
    </script>
</body>
</html>`;
}

function getTypeIcon(type: 'proofread' | 'edit' | 'evaluate'): string {
    switch (type) {
        case 'proofread':
            return '🔍';
        case 'edit':
            return '✏️';
        case 'evaluate':
            return '📊';
    }
}

export function deactivate() {
    if (currentPanel) {
        currentPanel.dispose();
    }
}
