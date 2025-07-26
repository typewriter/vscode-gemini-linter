#!/bin/bash

# VSCode拡張機能パッケージング用スクリプト

set -e

echo "🚀 Gemini校正・校閲ツール パッケージング開始..."

# バージョンインクリメント関数
increment_version() {
    local version=$1
    local increment_type=${2:-patch}  # デフォルトはpatch
    
    IFS='.' read -ra VERSION_PARTS <<< "$version"
    local major=${VERSION_PARTS[0]}
    local minor=${VERSION_PARTS[1]}
    local patch=${VERSION_PARTS[2]}
    
    case $increment_type in
        major)
            major=$((major + 1))
            minor=0
            patch=0
            ;;
        minor)
            minor=$((minor + 1))
            patch=0
            ;;
        patch|*)
            patch=$((patch + 1))
            ;;
    esac
    
    echo "$major.$minor.$patch"
}

# コマンドライン引数からインクリメント種別を取得
INCREMENT_TYPE=${1:-patch}

# 現在のバージョンを取得
CURRENT_VERSION=$(node -p "require('./package.json').version")
echo "📋 現在のバージョン: $CURRENT_VERSION"

# 新しいバージョンを計算
NEW_VERSION=$(increment_version "$CURRENT_VERSION" "$INCREMENT_TYPE")
echo "🔄 新しいバージョン: $NEW_VERSION ($INCREMENT_TYPE インクリメント)"

# package.json のバージョンを更新
npm version "$NEW_VERSION" --no-git-tag-version
echo "✅ package.json バージョン更新完了"

# 依存関係の確認とインストール
echo "📦 依存関係の確認..."
if ! command -v vsce &> /dev/null; then
    echo "⚠️  vsce がインストールされていません。インストール中..."
    npm install -g @vscode/vsce
fi

# TypeScript コンパイル
echo "🔨 TypeScript コンパイル中..."
npm run compile

# 既存の .vsix ファイルを削除（もしあれば）
echo "🧹 既存のパッケージファイルをクリーンアップ..."
rm -f *.vsix

# パッケージ作成
echo "📦 VSIXファイル作成中..."
vsce package --allow-missing-repository

# 結果表示
VSIX_FILE=$(ls *.vsix 2>/dev/null | head -1)
if [ -n "$VSIX_FILE" ]; then
    echo "✅ パッケージ作成完了: $VSIX_FILE (v$NEW_VERSION)"
    echo ""
    echo "🎯 インストール方法:"
    echo "  1. コマンドライン: code --install-extension $VSIX_FILE"
    echo "  2. VSCode GUI: Extensions > Install from VSIX... > $VSIX_FILE を選択"
    echo ""
    echo "⚙️  設定を忘れずに:"
    echo "  - VSCode設定で geminiLinter.apiKey にGemini API キーを設定"
    echo "  - API キー取得: https://ai.google.dev/"
    echo ""
    echo "📝 バージョン管理:"
    echo "  - patch (デフォルト): ./createPackage.sh"
    echo "  - minor: ./createPackage.sh minor"
    echo "  - major: ./createPackage.sh major"
else
    echo "❌ パッケージ作成に失敗しました"
    exit 1
fi