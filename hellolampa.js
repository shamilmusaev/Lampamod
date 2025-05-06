// hello.js — минимальный рабочий плагин
(() => {
    if (typeof Lampa === 'undefined') return;
  
    Lampa.Plugin.register('hello_world', {
      title: 'Hello World',
      version: '1.0',
      description: 'Простой тестовый плагин для LAMPA',
      run() {
        Lampa.Noty.show('Привет из моего плагина!');
      }
    });
  })();