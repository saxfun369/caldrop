# CalDrop

自由な書き方のテキストから予定を解析し、Googleカレンダーに一括登録できるWebツール。

## 使い方

1. テキストエリアに予定を入力（1行1予定）
2. 「解析する」をクリック
3. 解析結果を確認してチェックを調整
4. 「Googleカレンダーに登録」→ 初回のみ Google 認証

## 対応している入力形式

```
4月20日 10:00-15:00 散髪
4月23日 11:00〜14:00 ランチ
4/23 15時ー17時 ジム
4/25-27 旅行 東京
4月14日 休み
```

| 形式 | 例 |
|------|----|
| 漢字日付 + コロン時刻 | `4月20日 10:00-15:00 散髪` |
| スラッシュ日付 | `4/23 15時ー17時 ジム` |
| 日付範囲（複数日） | `4/25-27 旅行 東京` |
| 終日イベント | `4月14日 休み` |
| 場所あり | `5月1日 10:00-12:00 会議 東京` |

## 特徴

- **完全フロントエンド** — サーバーなし・API キーなし・データ保存なし
- **無料で運用** — Vercel 無料プランでホスティング
- **認証の永続化** — 初回のみ Google 認証。以後はページ再読み込み後も認証画面なし
- **一括登録** — チェックした予定をワンクリックで全件 Google カレンダーに登録

## セットアップ（ローカル開発）

### 1. Google Cloud Console の設定

1. [Google Cloud Console](https://console.cloud.google.com/) でプロジェクトを作成
2. 「APIとサービス」→「OAuth 同意画面」を設定
3. 「認証情報」→「OAuth 2.0 クライアント ID」を作成
   - アプリケーションの種類：ウェブアプリケーション
   - 承認済み JavaScript 生成元：`http://127.0.0.1:5500`（ローカル）
4. 発行されたクライアント ID をコピー

### 2. 設定ファイルの作成

```bash
cp js/config.example.js js/config.js
```

`js/config.js` を開き、クライアント ID を貼り付ける：

```javascript
const GOOGLE_CLIENT_ID = 'あなたのクライアントID.apps.googleusercontent.com';
```

> `js/config.js` は `.gitignore` で除外済み。Git にコミットしないこと。

### 3. ローカルサーバーで開く

VS Code の Live Server（`http://127.0.0.1:5500`）などで `index.html` を開く。

## デプロイ（Vercel）

1. このリポジトリを GitHub に push
2. [Vercel](https://vercel.com/) でリポジトリを連携
3. Google Cloud Console の「承認済み JavaScript 生成元」に Vercel の URL を追加

## 技術スタック

- HTML / CSS / JavaScript（バニラJS・フレームワークなし）
- [Google Identity Services](https://developers.google.com/identity) — OAuth 認証
- [Google Calendar API v3](https://developers.google.com/calendar/api) — 予定の登録
- Vercel — ホスティング
