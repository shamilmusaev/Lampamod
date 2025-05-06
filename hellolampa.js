(function wait() {
  if (typeof Lampa === 'undefined' || typeof Lampa.Listener === 'undefined') {
    return setTimeout(wait, 300);
  }

  Lampa.Listener.follow('app', function (e) {
    if (e.type === 'ready') {
      try {
        Lampa.Plugin.register('hello_world', {
          title: 'Hello World',
          version: '1.0',
          description: 'Простой тестовый плагин для LAMPA',
          run() {
            Lampa.Noty.show('Привет из моего плагина!');
          }
        });
      } catch (e) {
        console.error('Ошибка в плагине hello_world:', e);
      }
    }
  });
})();
