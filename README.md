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

Приложение полностью статическое: после `npm run build` содержимое `dist/` можно разместить на любом веб-сервере или статическом хостинге.

> Раньше деплой выполнялся в Cloudflare Pages через GitHub Actions по тегу. Эта схема больше не используется, но её реализация сохранена в истории:
>
> ```bash
> git show v0.0.3:.github/workflows/deploy.yml   # workflow
> git show v0.0.3:README.md                      # инструкция по настройке
> ```

### Релиз

Одной командой — проверки, bump версии, коммит с тегом и push:

```bash
npm run release:patch   # 1.0.0 → 1.0.1
npm run release:minor   # 1.0.0 → 1.1.0
npm run release:major   # 1.0.0 → 2.0.0
```

Каждая команда выполняет: `lint → test → build → bump версии → коммит + тег → push`.
