# Clinic Research App

医療機関口コミ・予約サービスの Web アプリです。  
患者向けと医療機関向けの画面を1つのフロントで提供します。

## 機能
- メールログイン / 新規登録（Supabase有効時は本番認証）
- 医療機関会員による自院情報登録・更新
- 患者向け検索、地図表示、予約作成
- 現在地取得（ブラウザ Geolocation API）
- 口コミ通報（モデレーションキュー）
- 監査ログ保存（主要アクション）
- 利用規約 / プライバシーポリシー画面

## ローカル実行
```bash
npm install
npm run dev
```

## Supabase 本番設定
1. Supabase プロジェクトを作成
2. SQL Editor で `supabase/schema.sql` を実行
  - 既存テーブルがある場合も、同ファイルを再実行して移行します
  - 医師登録機能を使うため `clinic_doctors` テーブルも同時に作成されます
3. `.env` を作成して以下を設定

```bash
VITE_SUPABASE_URL=YOUR_SUPABASE_URL
VITE_SUPABASE_ANON_KEY=YOUR_SUPABASE_ANON_KEY
```

4. 再起動
```bash
npm run dev
```

5. Auth 設定（重要）
- Supabase `Authentication > Providers > Email`
- まずは検証のため `Confirm email` を OFF にするとログイン詰まりを避けられます
- 本番運用で ON にする場合は、確認メール文面とリダイレクトURLを設定してください

`VITE_SUPABASE_*` が未設定の場合はローカル保存モードで動作します。

## Vercel デプロイ
Vercel の Project Settings > Environment Variables に以下を登録:
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

その後 `main` へ push すると自動デプロイされます。

## 注意
- 予約・医療機関情報は Supabase 接続時に複数端末で共有されます。
- 口コミデータ本体は現状サンプル表示中心で、通報は本番DBへ保存されます。
