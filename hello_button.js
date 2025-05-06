(function(){
  // Необходимо объявить версию и название, если Lampa поддерживает манифест
  var manifest = { name: "Weather", version: "1.0.0" };
  
  // Функция инициализации
  function initWeather() {
    // Ищем элемент, где Lampa показывает время
    var timeEl = document.querySelector('.header .time');
    if(!timeEl) return;
    
    // Создаем контейнер для погоды
    var weatherEl = document.createElement('div');
    weatherEl.className = 'weather-widget';
    weatherEl.style.marginLeft = '8px';
    timeEl.parentNode.insertBefore(weatherEl, timeEl.nextSibling);
    
    // Запрашиваем и отображаем погоду
    fetchWeather(weatherEl);
  }
  
  function fetchWeather(container) {
    var apiKey = '0e7b1efdd8a37c7a5227fdcf5d5ff715';
    var cityId = '524901'; // пример: Москва
    var url = `https://api.openweathermap.org/data/2.5/weather?id=${cityId}&units=metric&appid=${apiKey}`;
    
    fetch(url)
      .then(r => r.json())
      .then(data => {
        var icon = data.weather[0].icon;
        var temp = Math.round(data.main.temp) + '°C';
        container.innerHTML = `<img src="https://openweathermap.org/img/wn/${icon}.png" alt="" style="vertical-align:middle; height:20px;"> ${temp}`;
      })
      .catch(() => container.textContent = '–°');
  }
  
  // Подписка на событие инициализации интерфейса Lampa
  if(window.Lampa && Lampa.Listener) {
    Lampa.Listener.follow('init', initWeather);
  } else {
    // На случай, если плагин загружается раньше
    document.addEventListener('DOMContentLoaded', initWeather);
  }
})();
