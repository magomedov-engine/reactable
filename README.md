# reactable

Учебный курс «Слесарь механосборочных работ: сборка V12-дизеля» для старта с нуля и сайт для его изучения.

```
SLESAR/
├── vault/      ← хранилище Obsidian: уроки, глоссарий, схемы (открывать в Obsidian)
├── site/       ← сайт на Vue: собирается из vault, публикуется на GitHub Pages
└── .github/    ← автоматическая публикация сайта
```

## Как работать

- **Писать и править уроки** — в Obsidian: «Открыть папку как хранилище» → `SLESAR/vault`.
  Obsidian видит только эту папку, служебные файлы сайта его не задевают.
- **Посмотреть сайт локально** — в папке `site`:
  ```bash
  npm install
  npm run dev
  ```
  Перед запуском скрипт сам забирает свежие материалы из `vault`.
- **Опубликовать** — закоммитить и запушить в `main`. GitHub Actions соберёт сайт из `vault` и выложит на Pages.

Подробности про устройство сайта: [site/README.md](site/README.md).

## Первая публикация

1. Создайте пустой репозиторий на GitHub.
2. В папке `SLESAR`:
   ```bash
   git init && git add . && git commit -m "Курс и сайт" && git branch -M main
   git remote add origin https://github.com/<логин>/<репозиторий>.git
   git push -u origin main
   ```
3. В репозитории: **Settings → Pages → Build and deployment → Source: GitHub Actions**.

Адрес будет вида `https://<логин>.github.io/<репозиторий>/`.
