(() => {
  try {
    if (typeof Lampa === 'undefined') return;

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
})();