/**
 * Lampa.mx – AI‑рекомендации (v1.3, DeepSeek, 06‑05‑2025)
 * Автор: @your_nick, Golden Byte 2025
 *
 * Изменения v1.3
 *  • Переезд на DeepSeek API (endpoint + ключ)
 *  • Нормализация ответа — всегда массив, никаких «rec is not iterable»
 *  • LS‑кэш v13 (48 ч) + in‑memory
 */

(() => {
  /*─────────────────── CONFIG ───────────────────*/
  const cfg = {
    deepseekKey: 'sk-2c5f081c9c324ae1948520c4fb5cca93',
    model      : 'deepseek-chat',              // при желании 'deepseek-reasoner'
    tmdbKey    : '9f3911be7fa6d4b7130b52f6c6c2f7ab',
    cacheHrs   : 48,
    debug      : true,
    hdr        : {
      'Content-Type': 'application/json',
      'Authorization': ''                      // ниже дополним
    }
  };
  cfg.hdr.Authorization = 'Bearer ' + cfg.deepseekKey;
  const LS_KEY = 'similar_ai_cache_v13';

  /*─────────────────── HELPERS ──────────────────*/
  const log = (...m) => cfg.debug &&
    (console.log('[AI‑Sim]', ...m), window.Lampa?.Noty?.show('[AI] '+m.join(' ')));

  const readCache = () => {
    try { return JSON.parse(localStorage.getItem(LS_KEY) || '{}'); }
    catch { return {}; }
  };
  const saveCache = o => localStorage.setItem(LS_KEY, JSON.stringify(o));

  /*───────── ДАННЫЕ ТЕКУЩЕГО ФИЛЬМА/СЕРИАЛА ─────────*/
  function currentCard () {
    try {
      const act = Lampa?.Activity?.active();
      if (act?.card?.id) return act.card;
    } catch {}
    return null;
  }

  /*─────────────────── AI‑ЗАПРОС ──────────────────*/
  async function fetchAI (card) {
    const cache = readCache();
    const cKey  = card.id + '|' + card.title;
    if (cache[cKey] && Date.now() - cache[cKey].ts < cfg.cacheHrs * 3600e3) {
      log('cache hit');
      return cache[cKey].data;
    }

    /* промпт с описанием фильма для лучшего совпадения */
    const prompt = `Ты — рекомендательная система видеосервиса.
На основе описания фильма верни ТОЛЬКО JSON‑массив из 6 похожих фильмов:
[
 {"title":"…","orig":"…","year":"…","why":"…"}
]`;

    const rsp = await fetch('https://api.deepseek.com/chat/completions', {
      method : 'POST',
      headers: cfg.hdr,
      body   : JSON.stringify({
        model: cfg.model,
        messages: [{ role: 'user', content: prompt }],
        response_format: { type: 'json_object' }
      })
    });

    if (!rsp.ok) throw new Error('DeepSeek ' + rsp.status);
    const js   = await rsp.json();
    let raw    = js.choices?.[0]?.message?.content || '[]';

    /* парсим и нормализуем до массива */
    let parsed;
    try { parsed = JSON.parse(raw); }
    catch {
      const m = raw.match(/\[[\s\S]*]/);        // вытаскиваем первый JSON‑массив
      parsed  = m ? JSON.parse(m[0]) : [];
    }

    let list = [];
    if      (Array.isArray(parsed))         list = parsed;
    else if (Array.isArray(parsed.movies))  list = parsed.movies;
    else if (Array.isArray(parsed.result))  list = parsed.result;
    else {
      const firstArr = Object.values(parsed).find(Array.isArray);
      if (firstArr) list = firstArr;
    }
    if (!Array.isArray(list)) list = [];

    /* запись в кэш */
    cache[cKey] = { ts: Date.now(), data: list };
    saveCache(cache);
    return list;
  }

  /*─────────────────── TMDB ПОСТЕРЫ ───────────────*/
  const posterCache = {};
  async function tmdbPoster (title, year = '') {
    const k = title + '|' + year;
    if (posterCache[k]) return posterCache[k];

    const q   = encodeURIComponent(title);
    const url = `https://api.themoviedb.org/3/search/movie?api_key=${cfg.tmdbKey}&query=${q}&year=${year}&language=ru-RU`;
    const js  = await fetch(url).then(r => r.json()).catch(() => ({ results: [] }));
    const p   = js.results?.[0]?.poster_path || '';
    posterCache[k] = p ? `https://image.tmdb.org/t/p/w342${p}` : '';
    return posterCache[k];
  }

  /*───────────── РЕНДЕР КАРТОЧЕК ─────────────*/
  async function buildRow (recs) {
    if (!Array.isArray(recs) || !recs.length) {
      throw new Error('Список рекомендаций пуст');
    }

    const wrap = document.createElement('div');
    wrap.className = 'category-full category--collection ai‑similar';
    wrap.innerHTML = `
      <div class="category-full__title"><h2>ИИ рекомендует</h2></div>
      <div class="items-cards"></div>`;
    const list = wrap.querySelector('.items-cards');

    for (const r of recs) {
      const poster = await tmdbPoster(r.title, r.year);
      const card   = document.createElement('div');
      card.className = 'card card--collection';
      card.tabIndex  = 0;
      card.innerHTML = `
        <div class="card__view">
          <img class="card__img" loading="lazy" src="${poster}" alt="${r.title}">
          <div class="card__rating"><span>${r.year || ''}</span></div>
        </div>
        <div class="card__title">${r.title}</div>`;
      card.addEventListener('click', () => Lampa.Search?.find({ query: r.title }));
      list.append(card);
    }
    return wrap;
  }

  /*─────────── ВСТАВКА НА СТРАНИЦУ ──────────*/
  async function insert () {
    const card = currentCard();
    if (!card) return;
    if (document.querySelector('.ai‑similar')) return;   // уже вставили

    const holder = document.createElement('div');
    holder.className = 'category-full__title';
    holder.innerHTML = '<h2>ИИ рекомендует…</h2>';
    const target = document.querySelector('.full-start') || document.body;
    target.parentNode.insertBefore(holder, target.nextSibling);

    try {
      const recs = await fetchAI(card);
      holder.remove();
      const row  = await buildRow(recs);
      target.parentNode.insertBefore(row, target.nextSibling);
    } catch (e) {
      log(e.message);
      holder.innerHTML = `<h2>Ошибка рекомендаций</h2><div style="opacity:.7">${e.message}</div>`;
    }
  }

  /*────────── ПОДПИСКИ НА СОБЫТИЯ ──────────*/
  function hook () {
    const run = () => setTimeout(insert, 800);
    Lampa.Listener?.follow('full',     run);
    Lampa.Listener?.follow('activity', run);
    run();        // первая загрузка
  }

  document.readyState === 'loading'
    ? document.addEventListener('DOMContentLoaded', hook)
    : hook();
})();
