(function waitRoot() {
  if (!window.Lampa) {
    console.log('🔴 Lampa не найдена, ждём…');
    return setTimeout(waitRoot, 300);
  }
  console.log('🟢 Lampa найдено');

  function waitModules() {
    if (!Lampa.Plugin || !Lampa.Menu || !Lampa.Controller || !Lampa.Noty) {
      console.log('🔴 Модули ещё не готовы, ждём…');
      return setTimeout(waitModules, 300);
    }
    console.log('🟢 Все модули готовы');

    const ID = 'hello_button_debug';

    // регистрируем плагин
    Lampa.Plugin.register(ID, {
      title: 'Кнопка Привет (debug)',
      version: '1.0.0',
      description: 'Debug-версия: добавляем кнопку после Торрентов',
      run() {
        console.log('▶ run() вызван');
        Lampa.Noty.show('👋 Привет! Debug-кнопка сработала.');
      }
    });
    console.log('🟢 Плагин зарегистрирован');

    // получаем текущее меню
    const items = Lampa.Menu.get();
    console.log('Меню до вставки:', items.map(i=>i.id));

    // ищем Torrents
    const idx = items.findIndex(i => i.id === 'torrents');
    console.log('Индекс "torrents" =', idx);

    const newItem = {
      title: '👋 Привет (debug)',
      component: ID,
      id: ID,
      icon: 'icon-folder',
      class: ''
    };

    if (idx >= 0) {
      items.splice(idx + 1, 0, newItem);
      console.log('🟢 Вставили новую кнопку после torrents');
    } else {
      items.push(newItem);
      console.log('⚠ Не нашли torrents, добавили в конец');
    }

    console.log('Меню после вставки:', items.map(i=>i.id));

    // контроллер для нажатия
    Lampa.Controller.add(ID, {
      toggle() {
        console.log('▶ toggle() вызван');
        Lampa.Noty.show('👋 Привет! Debug-кнопка сработала.');
      },
      back() {
        Lampa.Controller.toggle('menu');
      }
    });
    console.log('🟢 Controller добавлен');

    // запускаем run
    Lampa.Plugin.run(ID);
    console.log('▶ Plugin.run() отправлен');

  }

  waitModules();
})();
