(function wait() {
  if (!window.Lampa) return setTimeout(wait, 300);

  function ready() {
    if (!Lampa.Plugin || !Lampa.Menu || !Lampa.Noty || !Lampa.Controller) {
      return setTimeout(ready, 300);
    }

    const ID = 'hello_button';

    Lampa.Plugin.register(ID, {
      title: 'Кнопка Привет',
      version: '1.0.0',
      description: 'Добавляет кнопку Привет после Торрентов',
      run() {
        Lampa.Noty.show('👋 Привет! Это моя первая кнопка.');
      }
    });

    const items = Lampa.Menu.get();
    const index = items.findIndex(item => item.id === 'torrents');
    const newItem = {
      title: '👋 Привет',
      component: ID,
      id: ID,
      icon: 'icon-folder',
      class: ''
    };

    if (index >= 0) {
      items.splice(index + 1, 0, newItem);
    } else {
      items.push(newItem);
    }

    Lampa.Controller.add(ID, {
      toggle() {
        Lampa.Controller.title('👋 Привет');
        Lampa.Noty.show('👋 Привет! Это моя первая кнопка.');
      },
      back() {
        Lampa.Controller.toggle('menu');
      }
    });

    Lampa.Plugin.run(ID);
  }

  ready();
})();
