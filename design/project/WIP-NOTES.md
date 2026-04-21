# Checki.ge Redesign — Work in Progress

## Done
- Базовая структура: 3 экрана (Check / List / Settings)
- Liquid glass, dark/light, Inter типографика
- Item rows: swipe-to-delete, inline price edit, quantity stepper
- Tweaks panel: theme, screen, accent, glass, density

## Client feedback (new direction)
1. **Главный экран = Open checks / Archive (табы)** — сейчас сделан `components/screen-main.jsx` с `MainTabs`, `OpenChecksList`, `ArchiveView`, но ещё не интегрирован в `app.jsx`
2. **Убрать категорийные бейджи** в item rows — жёлтый цвет строки = только сигнал «check» при распознавании скана
3. **New check screen**: поле "Guest / table" + кнопка "Scan paper check"
4. **Settings одностраничный**: Dark/Light/Auto toggle + статы + Staff (inline) + Catalog/Supplies/Subscription
5. **Убрать дубль "Settings"**: вместо заголовка — название заведения + subtitle «Manage your bar»
6. **Add bar**: вернуть "per unit" у Price, вернуть сумму за добавляемую позицию, Price шире, Add компактнее
7. **Bounce-анимация** при +/- или добавлении позиции
8. **How-to-use stories** по ? — overlay с зелёной подложкой, кружочки прогресса, 5 шагов, визуально отличается от UI чтобы не кликали
9. **Easter-egg fish game** — сейчас есть, нужна параллакс-подложка, плавнее физика

## Next actions
- Интегрировать `screen-main.jsx` в `app.jsx`: добавить `main` как корневой screen, передать shared `checks` state, обеспечить drill-down в check detail
- Создать `screen-new-check.jsx`
- Убрать `CategoryChip` из `screen-check.jsx` — оставить только жёлтый border/glow для `needsCheck`
- Переделать `screen-settings.jsx` в single-page layout с theme switcher
- Создать `overlay-stories.jsx` — модалка по ?
- Bounce animation на ItemRow (keyframe `pop-in` уже есть — применить на qty change)

## Files
- `Checki Redesign.html` — entry, подключает компоненты
- `components/app.jsx` — нужно поменять: main screen = main, вложенные = check detail, settings, new-check
- `components/screen-main.jsx` — NEW, готов
- `components/screen-check.jsx` — удалить CategoryChip, починить add-bar
- `components/screen-settings.jsx` — переделать в single-page
- `components/screen-list.jsx` — заменяется Archive view внутри main
- `components/overlay-stories.jsx` — TODO
- `components/easter-egg.jsx` — TODO
