import { GoogleGenAI } from '@google/genai';
import * as vscode from 'vscode';

export class GeminiService {
    private getPrompt(type: 'proofread' | 'edit' | 'evaluate', text: string): string {
        const prompts = {
            proofread: `あなたは経験豊富な校正者です。以下のテキストを校正してください。

【校正観点】
- 誤字脱字の修正
- 文法ミスの指摘
- 表記統一（漢字・ひらがな・カタカナ）
- 句読点の適切な使用

【出力形式】
修正箇所を具体的に示し、修正理由も簡潔に説明してください。

テキスト:
${text}`,

            edit: `あなたは経験豊富な編集者です。以下のテキストを校閲してください。

【校閲観点】
- 文章構造と論理の流れ
- 読みやすさと文体の統一
- 冗長な表現の簡潔化
- より適切な語彙の提案

【出力形式】
改善提案を具体例とともに示してください。

テキスト:
${text}`,

            evaluate: `あなたは文章評価の専門家です。以下のテキストを総合的に評価してください。

【評価観点】
- 内容の質と説得力
- 表現力と文章技術
- 読み手への配慮
- 目的達成度

【出力形式】
・強み（3点以内）
・改善点（3点以内）
・総合評価（5段階）
・具体的な改善提案

テキスト:
${text}`,
        };

        return prompts[type];
    }

    async analyzeText(
        text: string,
        type: 'proofread' | 'edit' | 'evaluate',
        apiKey: string
    ): Promise<string> {
        const config = vscode.workspace.getConfiguration('geminiLinter');
        const model = config.get<string>('model') || 'gemini-2.5-flash';

        const ai = new GoogleGenAI({ apiKey });
        const prompt = this.getPrompt(type, text);

        try {
            const response = await ai.models.generateContent({
                model: model,
                contents: prompt,
            });

            return response.text || 'レスポンスを取得できませんでした。';
        } catch (error: unknown) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            if (errorMessage.includes('API_KEY_INVALID')) {
                throw new Error('無効なAPI キーです。設定を確認してください。');
            } else if (errorMessage.includes('QUOTA_EXCEEDED')) {
                throw new Error('API使用量の上限に達しました。');
            } else {
                throw new Error(`API呼び出しエラー: ${errorMessage}`);
            }
        }
    }
}
