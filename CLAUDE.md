# CalDrop 開発ガイド

## プロジェクト概要
自由な書き方のテキストから予定を解析し、Googleカレンダーに一括登録できるWebツール。

## 開発者プロフィール
- Python 経験者。HTML / CSS / JavaScript はほぼ未経験
- 実装時は「なぜそう書くのか」「Python との違いは何か」など解説を挟みながら進める
- 専門用語には補足説明を付ける

## 基本ルール
- チャットは全て日本語で行うこと
- コードのコメントも日本語で書くこと
- 不明点は必ず確認してから実装すること
- 実装前に何をするか説明してから進めること
- コードの変更点は Python との比較や背景を交えて解説すること

## 技術スタック
- HTML / CSS / JavaScript（バニラJS）
- サーバーなし・APIなし・完全フロントエンドで動作
- ホスティング：Vercel（GitHub連携で自動デプロイ）

## ディレクトリ構成
```
caldrop/
├── index.html              # メインページ
├── CLAUDE.md               # このファイル
├── .gitignore              # config.js を除外
├── css/
│   └── style.css           # スタイル
└── js/
    ├── config.js           # クライアントID（Git管理外・.gitignore）
    ├── config.example.js   # config.js のサンプル（Git管理内）
    ├── parser.js           # テキスト解析ロジック
    ├── gcal.js             # Google Calendar URL 生成（個別追加リンク用）
    ├── gcal-api.js         # Google Calendar API 連携（OAuth・一括登録）
    ├── ui.js               # 画面描画・操作
    └── main.js             # エントリーポイント
```

## 主な機能
- 日本語の自由なテキストから日付・時刻・タイトル・場所を解析
- 複数予定の一括解析
- チェックボックスで登録する予定を選択可能
- 「Googleカレンダーに登録」で全予定を一括登録（Google Calendar API 使用）
- 個別の「＋ 個別追加」リンクで1件ずつ URL 経由登録も可能

## Google Calendar API 設定
- Google Cloud Console でプロジェクト作成済み
- OAuth クライアントID を `js/config.js` に記載（Git 管理外）
- 承認済み JavaScript 生成元：`http://127.0.0.1:5500`（ローカル）、Vercel URL（本番）
- アプリは「テスト」モード。本番公開時は「本番環境」に変更が必要
- テストユーザー：`caldrop.contact@gmail.com`

## 認証の仕組み
- Google Identity Services（GIS）の OAuth トークンモデルを使用
- アクセストークンは1時間で失効（Google の仕様、変更不可）
- 2回目以降は `prompt: 'none'` でサイレント取得（ページ再読み込み後も認証画面なし）
- `localStorage` に認証済みフラグを保存。Googleにログイン中の限り永続的に動作

## 対応している入力形式
- `4月20日 10:00-15:00 散髪`
- `4/23 15時ー17時 ジム`
- `4/25-27 旅行 東京`（複数日）
- `4月14日 休み`（終日）

## デプロイ方法
```bash
git add .
git commit -m "変更内容"
git push
```
GitHubにpushするとVercelに自動反映される。

## 今後の実装予定
- 解析精度の向上
- 繰り返し予定への対応
- リマインダー設定
- スマホ対応の強化
- OGP画像の設定
- Google AdSenseの導入

## 注意事項
- ユーザーデータは一切保存しない
- サーバーサイドの処理は行わない
- 無料で運用できる構成を維持すること
