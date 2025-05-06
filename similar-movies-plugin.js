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
    if (!window.Lampa || !Lampa.Activity || !Lampa.Activity.active) {
      log('Не удалось получить активное activity');
      return null;
    }
    
    try {
      var activity = Lampa.Activity.active();
      if (!activity.card || !activity.card.id) {
        log('В активном activity нет данных о карточке');
        return null;
      }
      
      var info = {
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
      
      log('Получены данные о медиа: ' + info.title + ' (' + info.year + ')');
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
    if (!activity || !activity.activity || activity.activity.component !== 'full') {
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
    
    // Находим контейнер для вставки
    var insertContainer = document.querySelector('.full-start__buttons');
    if (!insertContainer) {
      insertContainer = document.querySelector('.full-start__title');
      if (!insertContainer) {
        log('Не удалось найти контейнер для вставки рекомендаций');
        return;
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
      // Слушаем событие открытия карточки фильма/сериала
      Lampa.Listener.follow('full', function(e) {
        log('Событие full сработало');
        setTimeout(insertRecommendations, 1000);
      });
      
      // Также проверяем при смене активности
      Lampa.Listener.follow('activity', function(e) {
        if (e.component === 'full') {
          log('Событие activity сработало (full)');
          setTimeout(insertRecommendations, 1000);
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
  if (window.Lampa) {
    setTimeout(init, 1000);
  } else {
    document.addEventListener('DOMContentLoaded', function() {
      setTimeout(function() {
        if (window.Lampa) {
          init();
        } else {
          log('Lampa не обнаружена даже после загрузки DOM');
        }
      }, 2000);
    });
  }
  
  log('Плагин рекомендаций похожих фильмов загружен');
})();
