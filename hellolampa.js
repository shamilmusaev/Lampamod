(function wait() {
  if (!window.Lampa) return setTimeout(wait, 300);

  function ready() {
    if (!Lampa.Plugin || !Lampa.Menu || !Lampa.Noty || !Lampa.Controller) {
      return setTimeout(ready, 300);
    }

    const ID = 'hello_button';

    // Регистрируем плагин
    Lampa.Plugin.register(ID, {
      title: 'Кнопка Привет',
      version: '1.0.0',
      description: 'Добавляет кнопку в меню',
      run() {
        Lampa.Noty.show('👋 Привет! Это моя первая кнопка.');
      }
    });

    // Добавляем пункт в главное меню
    Lampa.Menu.add({
      title: '👋 Привет',
      component: ID,
      id: ID,
      icon: 'icon-folder',
      class: ''
    });

    // Добавляем контроллер для обработки нажатия
    Lampa.Controller.add(ID, {
      toggle() {
        Lampa.Controller.title('👋 Привет');
        Lampa.Noty.show('👋 Привет! Это моя первая кнопка.');
      },
      back() {
        Lampa.Controller.toggle('menu');
      }
    });

    // Активируем run() при загрузке
    Lampa.Plugin.run(ID);
  }

  ready();
})();
