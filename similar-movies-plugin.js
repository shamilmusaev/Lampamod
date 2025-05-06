(function(){
  /**
   * Плагин для Lampa.mx, добавляющий рекомендации похожих фильмов с помощью ИИ
   * Использует API openrouter с моделью qwen/qwen3-30b-a3b:free
   * 
   * Версия: 1.0
   */
  
  // Настройки плагина
  var config = {
    apiKey: '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', // Замените на ваш API ключ от openrouter.ai
    modelName: 'qwen/qwen3-30b-a3b:free',
    debug: true,
    maxRetries: 3,
    cacheTime: 24 * 60 * 60 * 1000 // 24 часа кэширования результатов
  };
  
  // Кэш рекомендаций для уменьшения количества запросов к API
  var recommendationsCache = {};
  
  // Логирование с префиксом
  function log(msg) {
    console.log('[SimilarMovies] ' + msg);
    if (config.debug && window.Lampa && Lampa.Noty) {
      Lampa.Noty.show('[SimilarMovies] ' + msg);
    }
  }
  
  // Получение данных о текущем фильме/сериале
  function getCurrentMediaInfo() {
    if (!window.Lampa) {
      log('Объект Lampa не найден');
      return null;
    }
    
    try {
      // Несколько способов получить информацию о фильме
      var info = null;
      
      // Способ 1: через активное Activity
      if (Lampa.Activity && Lampa.Activity.active) {
        var activity = Lampa.Activity.active();
        if (activity && activity.card && activity.card.id) {
          log('Получаем данные через Activity.active()');
          info = {
            id: activity.card.id,
            title: activity.card.title || '',
            original_title: activity.card.original_title || '',
            overview: activity.card.overview || '',
            description: activity.card.description || '',
            year: activity.card.year || '',
            genres: (activity.card.genres || []).map(g => (typeof g === 'object' ? g.name : g)).join(', '),
            countries: (activity.card.countries || []).map(c => (typeof c === 'object' ? c.name : c)).join(', '),
            directors: (activity.card.directors || []).join(', '),
            actors: (activity.card.actors || []).slice(0, 5).join(', '),
            type: activity.card.type || 'movie'
          };
        }
      }
      
      // Способ 2: через текущий Controller (во многих версиях Lampa)
      if (!info && Lampa.Controller && Lampa.Controller.enabled()) {
        var controller = Lampa.Controller.enabled();
        if (controller && controller.card) {
          log('Получаем данные через Controller.enabled()');
          info = {
            id: controller.card.id || '',
            title: controller.card.title || '',
            original_title: controller.card.original_title || '',
            overview: controller.card.overview || '',
            description: controller.card.description || '',
            year: controller.card.year || '',
            genres: (controller.card.genres || []).map(g => (typeof g === 'object' ? g.name : g)).join(', '),
            countries: (controller.card.countries || []).map(c => (typeof c === 'object' ? c.name : c)).join(', '),
            directors: (controller.card.directors || []).join(', '),
            actors: (controller.card.actors || []).slice(0, 5).join(', '),
            type: controller.card.type || 'movie'
          };
        }
      }
      
      // Способ 3: через DOM
      if (!info) {
        log('Пытаемся извлечь информацию из DOM');
        
        var title = '';
        var year = '';
        var description = '';
        
        // Ищем заголовок
        var titleElements = document.querySelectorAll('h1, h2, .title, .card__title, .full-start__title, [class*="title"]');
        if (titleElements.length > 0) {
          title = titleElements[0].textContent.trim();
          
          // Пытаемся извлечь год из заголовка, если он там есть в формате "Название (2023)"
          var yearMatch = title.match(/\((\d{4})\)$/);
          if (yearMatch) {
            year = yearMatch[1];
            title = title.replace(/\s*\(\d{4}\)$/, '').trim();  // Удаляем год из заголовка
          }
        }
        
        // Ищем описание
        var descElements = document.querySelectorAll('.description, .card__description, .full-start__descr, [class*="descr"], [class*="overview"]');
        if (descElements.length > 0) {
          description = descElements[0].textContent.trim();
        }
        
        // Если не нашли год в заголовке, ищем отдельно
        if (!year) {
          var yearElements = document.querySelectorAll('.year, .card__year, .info__year, [class*="year"]');
          if (yearElements.length > 0) {
            var yearText = yearElements[0].textContent.trim();
            var yearMatch = yearText.match(/\d{4}/);
            if (yearMatch) {
              year = yearMatch[0];
            }
          }
        }
        
        // Если нашли хотя бы название
        if (title) {
          info = {
            id: 'dom_extracted',
            title: title,
            original_title: '',
            overview: description,
            description: description,
            year: year,
            genres: '',
            countries: '',
            directors: '',
            actors: '',
            type: 'movie'
          };
        }
      }
      
      if (!info) {
        log('Не удалось получить информацию о фильме ни одним из способов');
        return null;
      }
      
      log('Получены данные о медиа: ' + info.title + (info.year ? ' (' + info.year + ')' : ''));
      return info;
    } catch (e) {
      log('Ошибка при получении информации о медиа: ' + e.message);
      return null;
    }
  }
  
  // Генерация рекомендаций с помощью ИИ
  function generateRecommendations(mediaInfo, callback) {
    if (!mediaInfo) {
      callback(null, 'Не удалось получить информацию о текущем медиа');
      return;
    }
    
    // Проверяем кэш
    var cacheKey = mediaInfo.id + '-' + mediaInfo.title;
    if (recommendationsCache[cacheKey] && recommendationsCache[cacheKey].timestamp > Date.now() - config.cacheTime) {
      log('Используем кэшированные рекомендации для: ' + mediaInfo.title);
      callback(recommendationsCache[cacheKey].recommendations);
      return;
    }
    
    // Формируем промпт для ИИ
    var prompt = `Ты - эксперт по фильмам и сериалам. Твоя задача - предложить 5 наиболее похожих фильмов или сериалов на основе предоставленной информации.

Информация о ${mediaInfo.type === 'tv' ? 'сериале' : 'фильме'}:
- Название: ${mediaInfo.title}${mediaInfo.original_title ? ' (' + mediaInfo.original_title + ')' : ''}
- Год: ${mediaInfo.year}
- Жанры: ${mediaInfo.genres}
- Страны: ${mediaInfo.countries}
${mediaInfo.directors ? '- Режиссеры: ' + mediaInfo.directors : ''}
${mediaInfo.actors ? '- Актеры: ' + mediaInfo.actors : ''}
- Описание: ${mediaInfo.overview || mediaInfo.description}

Пожалуйста, предложи 5 наиболее похожих ${mediaInfo.type === 'tv' ? 'сериалов' : 'фильмов'} в формате JSON:
[
  {"title": "Название фильма на русском", "original_title": "Оригинальное название", "year": "Год выхода", "similarity": "Краткое объяснение схожести (1 предложение)"},
  ...
]

Возвращай ТОЛЬКО JSON без дополнительного текста или обрамления.`;

    log('Отправляем запрос к OpenRouter API...');

    // Формируем запрос к API
    fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + config.apiKey,
        'HTTP-Referer': 'https://lampa.mx',
        'X-Title': 'Lampa Similar Movies Plugin'
      },
      body: JSON.stringify({
        model: config.modelName,
        messages: [
          {
            role: 'user',
            content: prompt
          }
        ],
        response_format: { type: "json_object" }
      })
    })
    .then(response => {
      if (!response.ok) {
        throw new Error('API вернул ошибку: ' + response.status);
      }
      return response.json();
    })
    .then(data => {
      try {
        if (!data.choices || !data.choices[0] || !data.choices[0].message || !data.choices[0].message.content) {
          throw new Error('Неверный формат ответа от API');
        }
        
        // Извлекаем JSON из ответа
        var content = data.choices[0].message.content;
        var recommendations;
        
        try {
          // Если ответ содержит только JSON
          recommendations = JSON.parse(content);
        } catch (e) {
          // Попытка извлечь JSON из текста
          var match = content.match(/\[[\s\S]*\]/);
          if (match) {
            recommendations = JSON.parse(match[0]);
          } else {
            throw new Error('Не удалось распарсить JSON из ответа');
          }
        }
        
        // Проверка формата рекомендаций
        if (!Array.isArray(recommendations)) {
          throw new Error('Результат не является массивом');
        }
        
        log('Получены рекомендации: ' + recommendations.length + ' фильмов');
        
        // Сохраняем в кэш
        recommendationsCache[cacheKey] = {
          timestamp: Date.now(),
          recommendations: recommendations
        };
        
        callback(recommendations);
      } catch (e) {
        log('Ошибка при обработке ответа: ' + e.message);
        callback(null, 'Ошибка при обработке ответа: ' + e.message);
      }
    })
    .catch(error => {
      log('Ошибка запроса: ' + error.message);
      callback(null, 'Ошибка запроса: ' + error.message);
    });
  }
  
  // Создание элемента для отображения рекомендаций
  function createRecommendationsElement(recommendations) {
    var container = document.createElement('div');
    container.className = 'simlar-movies-container category--collection';
    container.style.cssText = 'margin-top: 1.5em; padding-bottom: 1em;';
    
    // Заголовок секции
    var header = document.createElement('div');
    header.className = 'category-full__title';
    header.innerHTML = '<h2 style="font-size: 1.2em; margin-bottom: 0.8em;">Похожие фильмы (ИИ)</h2>';
    container.appendChild(header);
    
    // Список рекомендаций
    var list = document.createElement('div');
    list.className = 'items-cards';
    list.style.cssText = 'display: flex; overflow-x: auto; gap: 1em; padding-bottom: 0.5em;';
    
    recommendations.forEach(function(item) {
      var card = document.createElement('div');
      card.className = 'items-cards__item ai-recommendation-card';
      card.style.cssText = 'min-width: 12em; width: 12em; cursor: pointer;';
      
      var cardImg = document.createElement('div');
      cardImg.className = 'card__img';
      cardImg.style.cssText = 'position: relative; padding-bottom: 150%; border-radius: 0.3em; background: #3a3a3a; overflow: hidden;';
      
      // Создаем элемент для текста
      var textContainer = document.createElement('div');
      textContainer.style.cssText = 'position: absolute; top: 0; left: 0; right: 0; bottom: 0; padding: 0.7em; display: flex; flex-direction: column; justify-content: center; text-align: center;';
      
      var titleEl = document.createElement('div');
      titleEl.style.cssText = 'font-weight: bold; margin-bottom: 0.3em; font-size: 1em;';
      titleEl.textContent = item.title;
      
      var origTitleEl = document.createElement('div');
      origTitleEl.style.cssText = 'font-size: 0.8em; opacity: 0.7; margin-bottom: 0.3em;';
      origTitleEl.textContent = item.original_title;
      
      var yearEl = document.createElement('div');
      yearEl.style.cssText = 'font-size: 0.8em; opacity: 0.7; margin-bottom: 0.5em;';
      yearEl.textContent = item.year;
      
      var similarityEl = document.createElement('div');
      similarityEl.style.cssText = 'font-size: 0.75em; opacity: 0.5; font-style: italic;';
      similarityEl.textContent = item.similarity;
      
      textContainer.appendChild(titleEl);
      textContainer.appendChild(origTitleEl);
      textContainer.appendChild(yearEl);
      textContainer.appendChild(similarityEl);
      
      cardImg.appendChild(textContainer);
      card.appendChild(cardImg);
      
      // Обработчик клика по карточке для поиска
      card.addEventListener('click', function() {
        if (window.Lampa && Lampa.Search) {
          Lampa.Search.find({
            query: item.title
          });
        }
      });
      
      list.appendChild(card);
    });
    
    container.appendChild(list);
    return container;
  }
  
  // Функция для добавления рекомендаций на страницу
  function insertRecommendations() {
    // Проверяем, что мы на странице с фильмом/сериалом
    if (!window.Lampa || !Lampa.Activity || !Lampa.Activity.active) {
      log('Не на странице активности');
      return;
    }
    
    var activity = Lampa.Activity.active();
    log('Текущая активность: ' + (activity ? JSON.stringify({
      url: activity.url,
      component: activity.component,
      id: activity.id,
      method: activity.method,
      params: JSON.stringify(activity.params)
    }) : 'нет активности'));
    
    // Расширенная проверка на страницу фильма (проверяем несколько вариантов)
    var isFilmPage = false;
    
    if (activity) {
      // Проверка через component
      if (activity.component === 'full' || activity.component === 'movie' || activity.component === 'full_start') {
        isFilmPage = true;
      }
      // Проверка через URL
      else if (activity.url && (
        activity.url.indexOf('/view') >= 0 || 
        activity.url.indexOf('/movie') >= 0 || 
        activity.url.indexOf('/film') >= 0 ||
        activity.url.indexOf('/detail') >= 0
      )) {
        isFilmPage = true;
      }
      // Проверка через наличие card
      else if (activity.card && activity.card.id) {
        isFilmPage = true;
      }
    }
    
    if (!isFilmPage) {
      log('Не на странице просмотра фильма/сериала');
      return;
    }
    
    // Удаляем предыдущий блок рекомендаций, если он есть
    var existingRecommendations = document.querySelector('.simlar-movies-container');
    if (existingRecommendations) {
      existingRecommendations.remove();
    }
    
    // Получаем данные о текущем фильме
    var mediaInfo = getCurrentMediaInfo();
    if (!mediaInfo) {
      log('Не удалось получить информацию о текущем медиа');
      return;
    }
    
    log('Загружаем рекомендации для: ' + mediaInfo.title);
    
    // Находим контейнер для вставки (проверяем несколько возможных селекторов)
    var possibleSelectors = [
      '.full-start__buttons',
      '.full-start__title',
      '.card__buttons',
      '.card--button',
      '.card--details',
      '.details__wrap',
      '.card__view',
      '.full__detail',
      '.full-details__buttons',
      '.full-start',
      '.view--torrent',
      '.card__description',
      '.watch',
      '.full-info__descr',
      '.full-info'
    ];
    
    var insertContainer = null;
    
    for(var i = 0; i < possibleSelectors.length; i++) {
      var container = document.querySelector(possibleSelectors[i]);
      if(container) {
        log('Найден контейнер: ' + possibleSelectors[i]);
        insertContainer = container;
        break;
      }
    }
    
    if (!insertContainer) {
      // Если не нашли ни один из контейнеров, ищем элемент, содержащий описание
      var allElements = document.querySelectorAll('div, section');
      for(var i = 0; i < allElements.length; i++) {
        var el = allElements[i];
        if(el.textContent && el.textContent.length > 100 && el.children.length > 0) {
          // Вероятно это может быть контейнер с описанием фильма
          insertContainer = el;
          log('Найден контейнер по содержанию текста');
          break;
        }
      }
      
      if(!insertContainer) {
        // Последний вариант - добавляем в body
        insertContainer = document.body;
        log('Не удалось найти подходящий контейнер, вставляем в body');
      }
    }
    
    // Показываем плейсхолдер
    var placeholder = document.createElement('div');
    placeholder.className = 'simlar-movies-container category--collection';
    placeholder.innerHTML = '<div class="category-full__title"><h2 style="font-size: 1.2em; margin-bottom: 0.8em;">Загрузка похожих фильмов...</h2></div>';
    insertContainer.parentNode.insertBefore(placeholder, insertContainer.nextSibling);
    
    // Получаем рекомендации
    generateRecommendations(mediaInfo, function(recommendations, error) {
      // Удаляем плейсхолдер
      placeholder.remove();
      
      if (error || !recommendations) {
        log('Ошибка при получении рекомендаций: ' + (error || 'неизвестная ошибка'));
        
        // Показываем ошибку
        var errorEl = document.createElement('div');
        errorEl.className = 'simlar-movies-container category--collection';
        errorEl.innerHTML = '<div class="category-full__title"><h2 style="font-size: 1.2em; margin-bottom: 0.8em;">Не удалось загрузить рекомендации</h2><div style="opacity: 0.7;">' + (error || 'неизвестная ошибка') + '</div></div>';
        insertContainer.parentNode.insertBefore(errorEl, insertContainer.nextSibling);
        return;
      }
      
      // Создаем и вставляем элемент с рекомендациями
      var recommendationsEl = createRecommendationsElement(recommendations);
      insertContainer.parentNode.insertBefore(recommendationsEl, insertContainer.nextSibling);
      
      log('Рекомендации успешно добавлены');
    });
  }
  
  // Инициализация плагина
  function init() {
    log('Инициализация плагина рекомендаций похожих фильмов');
    
    if (window.Lampa && Lampa.Listener) {
      // Слушаем различные события, которые могут означать открытие фильма/сериала
      var events = ['full', 'activity', 'mount', 'ready', 'app', 'view', 
                    'controller', 'download', 'render', 'loading', 'open',
                    'route', 'navigate', 'display', 'content', 'card', 'movie'];
      
      events.forEach(function(event) {
        try {
          Lampa.Listener.follow(event, function(e) {
            log('Событие ' + event + ' сработало');
            setTimeout(function() {
              // Проверяем, если это страница фильма
              if (window.Lampa.Activity && Lampa.Activity.active()) {
                var activity = Lampa.Activity.active();
                if (activity) {
                  // Проверяем по нескольким признакам, что это страница фильма
                  var isFilmPage = false;
                  
                  // Проверка по component
                  if (activity.component === 'full' || activity.component === 'movie') {
                    isFilmPage = true;
                  }
                  // Проверка по наличию card
                  else if (activity.card && activity.card.id) {
                    isFilmPage = true;
                  }
                  // Проверка по URL
                  else if (activity.url && (
                    activity.url.indexOf('/view') >= 0 || 
                    activity.url.indexOf('/movie') >= 0 || 
                    activity.url.indexOf('/film') >= 0
                  )) {
                    isFilmPage = true;
                  }
                  
                  if (isFilmPage) {
                    log('Событие ' + event + ' привело к странице фильма');
                    insertRecommendations();
                  }
                }
              } else {
                // Попробуем понять по DOM, что это страница фильма
                var selectors = ['.full-start__buttons', '.full-start__title', '.card__buttons', 
                                '.card--details', '.full-details__buttons'];
                var found = false;
                selectors.forEach(function(sel) {
                  if (document.querySelector(sel)) {
                    found = true;
                  }
                });
                
                if (found) {
                  log('Определили страницу фильма по DOM после события ' + event);
                  insertRecommendations();
                }
              }
            }, 1000);
          });
        } catch (e) {
          log('Ошибка при подписке на событие ' + event + ': ' + e.message);
        }
      });
    } else {
      log('Lampa.Listener не найден');
    }
    
    // Добавляем хук для отслеживания переходов
    if (window.Lampa && Lampa.Activity) {
      var originalStart = Lampa.Activity.start;
      Lampa.Activity.start = function() {
        var result = originalStart.apply(this, arguments);
        var activity = Lampa.Activity.active();
        if (activity && activity.component === 'full') {
          log('Перехватчик Activity.start сработал (full)');
          setTimeout(insertRecommendations, 1000);
        }
        return result;
      };
    }
    
    // Также пытаемся вставить на текущей странице, если она уже открыта
    setTimeout(insertRecommendations, 2000);
  }
  
  // Отложенная инициализация для уверенности, что Lampa полностью загружена
  function checkAndInit() {
    if (window.Lampa) {
      log('Lampa обнаружена, запускаем инициализацию');
      init();
      
      // Установим интервал для периодической проверки страницы фильма
      setInterval(function() {
        if (document.querySelector('.simlar-movies-container')) {
          // Рекомендации уже добавлены, пропускаем
          return;
        }
        
        // Проверяем, находимся ли мы на странице фильма
        var isFilmPage = false;
        
        // Проверка через DOM
        var domIndicators = [
          '.full-start__buttons', '.full-start__title', '.card__buttons', 
          '.card--details', '.full-details__buttons', '.card__view'
        ];
        
        for (var i = 0; i < domIndicators.length; i++) {
          if (document.querySelector(domIndicators[i])) {
            isFilmPage = true;
            break;
          }
        }
        
        // Проверка через Lampa API
        if (!isFilmPage && window.Lampa.Activity && Lampa.Activity.active()) {
          var activity = Lampa.Activity.active();
          if (activity && (
            (activity.component === 'full' || activity.component === 'movie') ||
            (activity.card && activity.card.id) ||
            (activity.url && (
              activity.url.indexOf('/view') >= 0 || 
              activity.url.indexOf('/movie') >= 0 || 
              activity.url.indexOf('/film') >= 0
            ))
          )) {
            isFilmPage = true;
          }
        }
        
        if (isFilmPage) {
          log('Обнаружена страница фильма при периодической проверке');
          insertRecommendations();
        }
      }, 5000); // Проверка каждые 5 секунд
    } else {
      log('Lampa не обнаружена, повторяем через 2 секунды');
      setTimeout(checkAndInit, 2000);
    }
  }
  
  // Запускаем проверку наличия Lampa
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function() {
      setTimeout(checkAndInit, 1000);
    });
  } else {
    setTimeout(checkAndInit, 1000);
  }
  
  // Также подписываемся на изменения URL, это может означать переход на новую страницу
  var lastUrl = window.location.href;
  setInterval(function() {
    if (lastUrl !== window.location.href) {
      lastUrl = window.location.href;
      log('Обнаружено изменение URL: ' + lastUrl);
      setTimeout(insertRecommendations, 2000);
    }
  }, 2000);
  
  log('Плагин рекомендаций похожих фильмов загружен');
})();
