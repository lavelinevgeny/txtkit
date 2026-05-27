# txtkit

Набор текстовых инструментов, работающих прямо в браузере. Без регистрации, без сервера — всё на клиенте.

## Инструменты

| Категория | Описание |
|-----------|----------|
| **JSON** | Форматирование, валидация, минификация, flatten/unflatten, YAML-конвертация, дерево |
| **Case** | 17 форматов конвертации регистра (camelCase, snake_case, kebab-case и др.) |
| **Transforms** | Реверс, обрезка, капитализация, slugify, morse, binary, leet speak |
| **Stats** | Символы, слова, строки, предложения, уникальные слова, байты, время чтения |
| **Encode** | Base64, URL encode/decode, HTML escape/unescape |

## Стек

React 19, TypeScript, Vite, Tailwind CSS 4, Zustand, Vitest

## Разработка

```bash
npm install
npm run dev
```

## Тесты и линтинг

```bash
npm run test
npm run lint
```

## Сборка

```bash
npm run build
```

Результат — в папке `dist/`.

## Деплой

Проект развёрнут на **Cloudflare Pages**. Деплой — через **GitHub Actions** по тегу.

### Первичное развёртывание (один раз)

#### 1. Создать проект в Cloudflare Pages

1. Войти на [dash.cloudflare.com](https://dash.cloudflare.com)
2. В левом сайдбаре: **Workers & Pages**
3. Переключиться на вкладку **Pages** (рядом с Workers)
4. Нажать **Create** → **Upload assets**
5. Название проекта: `txtkit`
6. Собрать и загрузить первый раз вручную:
   ```bash
   npm run build
   npx wrangler pages deploy dist/ --project-name=txtkit
   ```

#### 2. Создать API Token

1. Cloudflare dashboard → иконка профиля (справа вверху) → **My Profile** → **API Tokens**
2. **Create Token** → **Custom token**
3. Permissions: **Account** → **Cloudflare Pages** → **Edit**
4. Скопировать токен

#### 3. Добавить секреты в GitHub

1. Открыть `https://github.com/lavelinevgeny/txtkit/settings/secrets/actions`
2. Добавить:
   - `CLOUDFLARE_API_TOKEN` — токен из шага 2
   - `CLOUDFLARE_ACCOUNT_ID` — взять из URL в Cloudflare: `dash.cloudflare.com/<account-id>/...`

#### 4. Привязать домен txtkit.ru

1. Cloudflare dashboard → **Add site** → ввести `txtkit.ru` → план **Free**
2. Cloudflare покажет 2 NS-записи (вида `xxx.ns.cloudflare.com`)
3. У регистратора домена заменить NS-записи на полученные от Cloudflare
4. Дождаться делегирования DNS (до 24 часов)
5. Cloudflare Pages → проект `txtkit` → **Custom domains** → добавить `txtkit.ru`

#### 5. Включить защиту

В Cloudflare dashboard для домена `txtkit.ru`:

- **Security → WAF** → включить Managed Rules
- **Security → Bots** → включить **Bot Fight Mode**
- **Security → WAF → Rate limiting rules** → правило: 100 запросов / 10 сек / IP → Block

### Повторные деплои

После настройки пайплайна деплой происходит автоматически при пуше тега:

```bash
git tag v1.0.0
git push origin v1.0.0
```

GitHub Actions выполнит: `lint → test → build → deploy` в Cloudflare Pages.
