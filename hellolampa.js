// 👉 hellolampa.js  — финальная версия
(function waitRoot() {
  /* 1. Дожидаемся, пока сам объект Lampa появится */
  if (!window.Lampa) return setTimeout(waitRoot, 300);

  /* 2. Ждём инициализации внутренних модулей */
  function waitModules() {
    const ready = Lampa.Plugin && Lampa.Noty;

    if (!ready) return setTimeout(waitModules, 300);

    /* 3. Регистрируемся как плагин */
    Lampa.Plugin.register('hello_world', {
      title:       'Hello World',
      version:     '1.0.0',
      description: 'Минимальный рабочий пример',
      run() {
        Lampa.Noty.show(' 👋 Привет из моего плагина!');
      }
    });

    /* 4. Запускаем свой run() вручную */
    Lampa.Plugin.run('hello_world');
  }

  waitModules();
})();
