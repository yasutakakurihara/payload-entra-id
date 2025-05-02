# payload-entra-id

### 準備
Entra IDのテナントを作成
記事を参考にアプリ登録

##### 参考記事
Microsoft Entra ID × Next.jsで実装する認証機能（Auth.js + @azure/msal-node）
https://zenn.dev/frontendflat/articles/dd07c7ebc797cc

### .envに下記を追記
```
# Auth.js
AUTH_TRUST_HOST=true
AUTH_URL=http://localhost:3000
AUTH_SECRET=your_random_secret

# Entra ID
AUTH_MICROSOFT_ENTRA_ID_TENANT_ID=your_tenant_id
AUTH_MICROSOFT_ENTRA_ID_CLIENT_ID=your_client_id
AUTH_MICROSOFT_ENTRA_ID_SECRET=your_client_secret
```

### インストール
`% pnpm i`

### 起動
`% pnpm dev`

### 備考
ログアウト処理は入れてません