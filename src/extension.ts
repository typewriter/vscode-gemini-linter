import * as vscode from 'vscode';
import { GeminiService } from './geminiService';

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
                const result = await geminiService.analyzeText(selectedText, type, apiKey);
                await showResult(result, type);
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

async function showResult(result: string, type: 'proofread' | 'edit' | 'evaluate') {
    const outputChannel = vscode.window.createOutputChannel(`Gemini ${getActionName(type)}結果`);
    outputChannel.clear();
    outputChannel.appendLine(`=== ${getActionName(type)}結果 ===`);
    outputChannel.appendLine('');
    outputChannel.appendLine(result);
    outputChannel.show();
}

export function deactivate() {}
