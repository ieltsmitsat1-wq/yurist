# Yurist AI LegalTech Bot

AI-Powered, Sales-Oriented, Undetectable LegalTech Telegram Bot & Web CRM System for Uzbekistan.

## Instagram Meta ulash

1. Railway `Project -> Service -> Settings -> Networking` bo'limida public HTTPS domen yarating.
2. Railway environment sozlamalariga quyidagilarni qo'ying:
   - `ENVIRONMENT=production`
   - `INSTAGRAM_PAGE_ID=<Meta Page yoki Instagram Professional Account ID>`
   - `INSTAGRAM_BUSINESS_ACCOUNT_ID=<Instagram Professional Account ID, agar mavjud bo‘lsa>`
   - `INSTAGRAM_ACCESS_TOKEN=<Meta token>`
   - `INSTAGRAM_APP_SECRET=<Meta App Secret>`
   - `INSTAGRAM_VERIFY_TOKEN=<Metada callback uchun belgilangan tasodifiy token>`
   - `INSTAGRAM_GRAPH_API_VERSION=v21.0`
3. Meta Developer App callback URL sifatida quyidagini sozlang:
   `https://<railway-public-domain>/api/v1/instagram/webhook`
4. Meta App Review/Instagram webhook subscription'da `messages` va `messaging_postbacks` maydonlarini ulang.
5. Sozlamalarni tekshirish uchun oching:
   `https://<railway-public-domain>/api/v1/health/instagram`
