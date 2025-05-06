(function(){
  var apiKey   = 'ВАШ_API_KEY';    // ← замените на ваш ключ
  var cityId   = '524901';         // ← ID города (Москва)
  var pollMax  = 20;               // сколько раз опрашивать DOM (по 0.5 с)
  var pollCount = 0;

  function log(msg){
    console.log('[Weather] ' + msg);
  }

  function fetchWeather(el){
    var url = 'https://api.openweathermap.org/data/2.5/weather'
            + '?id=' + cityId
            + '&units=metric&lang=ru'
            + '&appid=' + apiKey;
    fetch(url)
      .then(r => r.json())
      .then(d => {
        var icon = d.weather[0].icon;
        var temp = Math.round(d.main.temp) + '°';
        el.innerHTML = '<img src="https://openweathermap.org/img/wn/'
                     + icon + '.png" style="vertical-align:middle; height:20px;"> '
                     + temp;
        log('Погода обновлена: ' + temp);
      })
      .catch(err => {
        log('Ошибка запроса: ' + err);
        el.textContent = '–°';
      });
  }

  function tryInsert(){
    log('Пытаемся найти время (попытка ' + (pollCount+1) + ')');
    // перечисляем все возможные селекторы
    var sel = [
      '.header__time',
      '.player-toolbar__time',
      '.time',
      // вставьте сюда свой скопированный селектор, если есть
    ].join(', ');
    var timeEl = document.querySelector(sel);
    if(timeEl){
      log('Нашли блок времени: ' + sel);
      var w = document.createElement('div');
      w.className = 'weather-widget';
      w.style.cssText = 'margin-left:8px; display:inline-flex; align-items:center; font-size:14px;';
      timeEl.parentNode.insertBefore(w, timeEl.nextSibling);
      fetchWeather(w);
      setInterval(() => fetchWeather(w), 10 * 60 * 1000);
    }
    else if(++pollCount < pollMax){
      setTimeout(tryInsert, 500);
    }
    else {
      log('Не удалось найти блок времени после ' + pollMax + ' попыток');
    }
  }

  log('Weather-плагин загружен');
  document.addEventListener('DOMContentLoaded', tryInsert);
  if(window.Lampa && Lampa.Listener){
    Lampa.Listener.follow('init', tryInsert);
  }
})();
