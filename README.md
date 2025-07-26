# Gemini校正・校閲ツール

Gemini AIを使用したテキストの校正、校閲、評価を行うVSCode拡張機能です。

## 機能

- **校正**: 誤字脱字、文法ミス、表記統一をチェック
- **校閲**: 文章構造、論理の流れ、読みやすさを改善
- **評価**: 内容の質、説得力、表現力を総合評価

## 使用方法

1. テキストエディタでテキストを選択
2. 右クリックメニューから「校正」「校閲」「評価」を選択
3. 結果が出力欄に表示されます

## 設定

1. VSCodeの設定で `geminiLinter.apiKey` にGemini API キーを設定
2. 必要に応じて `geminiLinter.model` でモデルを選択

### API キーの取得

[Google AI Studio](https://ai.google.dev/) でAPI キーを取得してください。

## 開発

```bash
npm install
npm run compile
```

## 技術スタック

- TypeScript
- VSCode Extension API
- @google/genai (Gemini 2.5 Flash)