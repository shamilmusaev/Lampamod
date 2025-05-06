(function(){
  var apiKey   = '0e7b1efdd8a37c7a5227fdcf5d5ff715';    // API ключ OpenWeatherMap
  var cityId   = '524901';         // ID города (Москва)
  var pollMax  = 40;               // Увеличил количество попыток
  var pollInterval = 500;          // Интервал между попытками (мс)
  var pollCount = 0;
  var debug = true;                // Включаем подробную диагностику
  
  function log(msg){
    console.log('[Weather] ' + msg);
    if(debug && window.Lampa && Lampa.Noty) {
      Lampa.Noty.show('[Weather] ' + msg);
    }
  }
  
  function fetchWeather(el){
    log('Запрашиваем погоду для города с ID: ' + cityId);
    var url = 'https://api.openweathermap.org/data/2.5/weather'
            + '?id=' + cityId
            + '&units=metric&lang=ru'
            + '&appid=' + apiKey;
    
    fetch(url)
      .then(r => {
        log('Получен ответ от API с кодом: ' + r.status);
        if (!r.ok) throw new Error('Ошибка HTTP: ' + r.status);
        return r.json();
      })
      .then(d => {
        log('Данные получены: ' + JSON.stringify(d).substring(0, 100) + '...');
        if (d.cod && d.cod !== 200) {
          throw new Error('API вернул ошибку: ' + d.message);
        }
        
        var icon = d.weather[0].icon;
        var temp = Math.round(d.main.temp) + '°';
        var desc = d.weather[0].description;
        
        el.innerHTML = '<img src="https://openweathermap.org/img/wn/'
                     + icon + '.png" style="vertical-align:middle; height:20px;"> '
                     + temp;
        log('Погода обновлена: ' + temp + ' (' + desc + ')');
      })
      .catch(err => {
        log('Ошибка запроса: ' + err);
        el.textContent = '–°';
      });
  }
  
  function findTimeElement() {
    // Расширенный список селекторов для поиска элемента времени
    var selectors = [
      '.header__time',
      '.player-toolbar__time',
      '.time',
      '.timeline__time',
      '.panel__time',
      '[class*="time"]', // Ищем любые элементы, в классе которых есть слово "time"
      '#time',
      '.datetime',
      '.date-time'
    ];
    
    // Поиск по всем селекторам
    for (var i = 0; i < selectors.length; i++) {
      var element = document.querySelector(selectors[i]);
      if (element) {
        log('Найден элемент времени по селектору: ' + selectors[i]);
        return element;
      }
    }
    
    // Альтернативный поиск по тексту содержимого
    var allElements = document.querySelectorAll('*');
    for (var i = 0; i < allElements.length; i++) {
      var el = allElements[i];
      // Проверяем, содержит ли элемент время в формате HH:MM
      if (el.textContent && /\d{1,2}:\d{2}/.test(el.textContent) && el.children.length === 0) {
        log('Найден элемент, содержащий время по тексту: ' + el.textContent);
        return el.parentNode; // Возвращаем родительский элемент
      }
    }
    
    log('Элемент времени не найден ни по одному из селекторов');
    return null;
  }
  
  function tryInsert(){
    log('Пытаемся найти время (попытка ' + (pollCount+1) + ' из ' + pollMax + ')');
    
    var timeEl = findTimeElement();
    
    if(timeEl){
      log('Нашли блок времени, создаем виджет погоды');
      
      var existingWidget = document.querySelector('.weather-widget');
      if (existingWidget) {
        log('Виджет погоды уже существует, обновляем');
        fetchWeather(existingWidget);
        return;
      }
      
      var w = document.createElement('div');
      w.className = 'weather-widget';
      w.style.cssText = 'margin-left:8px; display:inline-flex; align-items:center; font-size:14px; color:white;';
      w.textContent = 'Загрузка...';
      
      // Вставляем после элемента времени или внутрь него
      if (timeEl.nextSibling) {
        timeEl.parentNode.insertBefore(w, timeEl.nextSibling);
      } else {
        timeEl.parentNode.appendChild(w);
      }
      
      fetchWeather(w);
      setInterval(() => fetchWeather(w), 10 * 60 * 1000); // Обновление каждые 10 минут
      log('Виджет погоды успешно добавлен');
    }
    else if(++pollCount < pollMax){
      setTimeout(tryInsert, pollInterval);
    }
    else {
      log('Не удалось найти блок времени после ' + pollMax + ' попыток (' + (pollMax * pollInterval / 1000) + ' сек)');
      // Последняя попытка - добавить в любое видимое место
      var header = document.querySelector('.header') || document.querySelector('header');
      if (header) {
        log('Найден заголовок, добавляем виджет погоды туда');
        var w = document.createElement('div');
        w.className = 'weather-widget';
        w.style.cssText = 'margin-left:8px; display:inline-flex; align-items:center; font-size:14px; color:white;';
        header.appendChild(w);
        fetchWeather(w);
        setInterval(() => fetchWeather(w), 10 * 60 * 1000);
      } else {
        log('Не удалось найти подходящее место для виджета погоды');
      }
    }
  }
  
  function inspectPage() {
    log('Анализ структуры страницы:');
    var body = document.body;
    log('- Body найден: ' + (body ? 'да' : 'нет'));
    if (body) {
      log('- Дочерние элементы body: ' + body.children.length);
    }
    
    log('- Lampa доступна: ' + (window.Lampa ? 'да' : 'нет'));
    if (window.Lampa) {
      log('- Lampa.Listener доступен: ' + (Lampa.Listener ? 'да' : 'нет'));
    }
    
    // Поиск потенциальных контейнеров
    ['header', '.header', '.player', '.wrap', '.app', '#app', '.content']
    .forEach(selector => {
      var el = document.querySelector(selector);
      log('- Элемент ' + selector + ': ' + (el ? 'найден' : 'не найден'));
    });
  }
  
  // Основной код инициализации
  log('Weather-плагин загружен. Версия: 1.1');
  
  // Регистрируем на несколько событий для большей надежности
  document.addEventListener('DOMContentLoaded', function() {
    log('DOMContentLoaded сработал');
    inspectPage();
    setTimeout(tryInsert, 1000); // Начать попытки через 1 секунду
  });
  
  window.addEventListener('load', function() {
    log('Window.load сработал');
    inspectPage();
    setTimeout(tryInsert, 1500); // Начать попытки через 1.5 секунды
  });
  
  // Для Lampa
  if(window.Lampa) {
    log('Lampa обнаружена при загрузке плагина');
    
    if(Lampa.Listener) {
      log('Подписываемся на события Lampa');
      Lampa.Listener.follow('app', function(){
        log('Событие app сработало');
        setTimeout(tryInsert, 2000);
      });
      
      Lampa.Listener.follow('init', function(){
        log('Событие init сработало');
        setTimeout(tryInsert, 2000);
      });
      
      Lampa.Listener.follow('ready', function(){
        log('Событие ready сработало');
        setTimeout(tryInsert, 2000);
      });
    }
    else {
      log('Lampa.Listener не найден');
      setTimeout(tryInsert, 2000);
    }
  }
  else {
    // Если Lampa не обнаружена сразу, пробуем через задержку
    setTimeout(function() {
      if(window.Lampa) {
        log('Lampa обнаружена после задержки');
        if(Lampa.Listener) {
          log('Подписываемся на события Lampa (после задержки)');
          Lampa.Listener.follow('app', function(){
            log('Событие app сработало (после задержки)');
            tryInsert();
          });
          Lampa.Listener.follow('init', function(){
            log('Событие init сработало (после задержки)');
            tryInsert();
          });
        }
      } else {
        log('Lampa не обнаружена даже после задержки');
        tryInsert();
      }
    }, 3000);
  }
})();
