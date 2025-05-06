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

        // 💥 вызывать run() вручную!
        Lampa.Plugin.run('hello_world');

      } catch (e) {
        console.error('Ошибка в плагине hello_world:', e);
      }
    }
  });
})();
