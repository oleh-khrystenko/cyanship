# OAuth (Google та інші)

## Поточна реалізація: Google

1. Юзер натискає "Увійти з Google"
2. Redirect на Google consent screen
3. Google callback → `AuthService.handleGoogleAuth()`
4. Якщо юзера немає — створюється (email, profile.name, profile.avatar з Google)
5. Set `bid_refresh` cookie → redirect на callback page
6. Web: `refreshToken()` → `getMe()` → redirect на головну

## Майбутні провайдери

Facebook, Apple та інші додаються за тим самим патерном: кнопка на сторінці авторизації + Passport strategy + callback handler. Принцип "один email = один акаунт" зберігається.
