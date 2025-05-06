(function wait() {
  if (typeof Lampa === 'undefined') {
    return setTimeout(wait, 300);
  }

  function checkPluginReady() {
    if (typeof Lampa.Plugin === 'undefined' || typeof Lampa.Noty === 'undefined') {
      return setTimeout(checkPluginReady, 300);
    }

    try {
      Lampa.Plugin.register('hello_world', {
        title: 'Hello World',
        version: '1.0',
        description: 'Простой тестовый плагин для LAMPA',
        run() {
          Lampa.Noty.show('Привет из моего плагина!');
        }
      });

      Lampa.Plugin.run('hello_world');

    } catch (e) {
      console.error('Ошибка в плагине hello_world:', e);
    }
  }

  checkPluginReady();
})();
