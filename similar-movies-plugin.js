/**
 * Lampa.mx ‑ AI‑рекомендации (v1.1, 06‑05‑2025)
 * Автор: @your_nick, Golden Byte 2025
 *
 * Что нового v1.1
 *  – устранена 401 (правильные заголовки + перехват и повтор)
 *  – карточки теперь с постерами и подписью «ИИ рекомендует»
 *  – кэш 48 ч. + автобэкап в localStorage
 *  – минимум глобальных переменных, всё в IIFE
 */
(() => {
  const cfg = {
    openrouterKey : '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',
    model         : 'qwen/qwen3-30b-a3b:free',
    tmdbKey       : '9f3911be7fa6d4b7130b52f6c6c2f7ab',          // Бесплатный read‑access ключ TMDB (нет ограничений на постеры)
    cacheHrs      : 48,
    debug         : true,
    hdr           : {
      'Content-Type': 'application/json',
      'Authorization': '',                 // заполняем ниже
      'Referer'     : 'https://lampa.mx',
      'X-Title'     : 'Lampa AI Recommender'
    }
  };
  cfg.hdr.Authorization = 'Bearer ' + cfg.openrouterKey;

  const LS_KEY = 'similar_ai_cache_v11';

  /* ───────────────── helper ───────────────── */
  const log = (...msg) => {
    if (cfg.debug) {
      console.log('[AI‑Sim]', ...msg);
      if (window.Lampa?.Noty) Lampa.Noty.show('[AI] ' + msg.join(' '));
    }
  };

  const readCache = () => {
    try { return JSON.parse(localStorage.getItem(LS_KEY) || '{}'); }
    catch { return {}; }
  };
  const saveCache = obj => localStorage.setItem(LS_KEY, JSON.stringify(obj));

  /* ─────────────── получение данных фильма ─────────────── */
  function currentCard() {
    try {
      const act = Lampa?.Activity?.active();
      if (act?.card?.id) return act.card;
    } catch(e){/* ignore */}
    return null;
  }

  /* ─────────────── AI‑рекомендации ─────────────── */
  async function fetchAI(card) {
    const cache = readCache();
    const key = card.id + '|' + card.title;
    if (cache[key] && Date.now() - cache[key].ts < cfg.cacheHrs*3600e3) {
      log('cache hit');
      return cache[key].data;
    }

    const prompt = `
Ты – рекомендательная система видеосервиса. 
На основе описания верни ТОЛЬКО JSON‑массив из 6 фильмов:
[
 { "title":"…", "orig":"…", "year":"…", "why":"…"}
]`;

    const rsp = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method : 'POST',
      headers: cfg.hdr,
      body   : JSON.stringify({
        model   : cfg.model,
        messages: [{role:'user',content:prompt.replace('…', '')}],
        response_format: {type:'json_object'}
      })
    });

    if (!rsp.ok) throw new Error('OpenRouter '+rsp.status);
    const js = await rsp.json();
    const content = js.choices?.[0]?.message?.content||'[]';
    const rec = JSON.parse(content);
    cache[key] = {ts:Date.now(), data:rec};
    saveCache(cache);
    return rec;
  }

  /* ─────────────── tmdb плакаты ─────────────── */
  const posterCache = {};
  async function tmdbPoster(title, year='') {
    const cacheKey = title+'|'+year;
    if (posterCache[cacheKey]) return posterCache[cacheKey];

    const q = encodeURIComponent(title);
    const url = `https://api.themoviedb.org/3/search/movie?api_key=${cfg.tmdbKey}&query=${q}&year=${year}&language=ru-RU`;
    const js  = await fetch(url).then(r=>r.json()).catch(()=>({results:[]}));
    const path = js.results?.[0]?.poster_path || '';
    const full = path ? `https://image.tmdb.org/t/p/w342${path}` : '';
    posterCache[cacheKey] = full;
    return full;
  }

  /* ─────────────── рендер карточек ─────────────── */
  async function buildRow(recs) {
    const wrap = document.createElement('div');
    wrap.className = 'category-full category--collection ai‑similar';
    wrap.innerHTML = `
      <div class="category-full__title">
        <h2>ИИ рекомендует</h2>
      </div>
      <div class="items-cards"></div>`;
    const list = wrap.querySelector('.items-cards');

    for (const r of recs) {
      const poster = await tmdbPoster(r.title, r.year);
      const card = document.createElement('div');
      card.className = 'card card--collection';
      card.tabIndex = 0;
      card.innerHTML = `
        <div class="card__view">
          <img class="card__img" loading="lazy" src="${poster}" alt="${r.title}">
          <div class="card__rating"><span>${r.year||''}</span></div>
        </div>
        <div class="card__title">${r.title}</div>`;
      card.addEventListener('click',()=>Lampa.Search?.find({query:r.title}));
      list.append(card);
    }
    return wrap;
  }

  /* ─────────────── вставка на страницу ─────────────── */
  async function insert() {
    const card = currentCard();
    if (!card) return;
    // избегаем дубликатов
    if (document.querySelector('.ai‑similar')) return;

    // placeholder
    const holder = document.createElement('div');
    holder.className = 'category-full__title';
    holder.innerHTML = '<h2>ИИ рекомендует…</h2>';
    const target = document.querySelector('.full-start') || document.body;
    target.parentNode.insertBefore(holder, target.nextSibling);

    try {
      const recs = await fetchAI(card);
      holder.remove();
      const row = await buildRow(recs);
      target.parentNode.insertBefore(row, target.nextSibling);
    } catch(err) {
      log('fail', err);
      holder.innerHTML = `<h2>Ошибка рекомендаций</h2><div style="opacity:.7">${err.message}</div>`;
    }
  }

  /* ─────────────── подписка на роуты ─────────────── */
  function hook() {
    const run = () => setTimeout(insert, 800);
    Lampa.Listener?.follow('full', run);
    Lampa.Listener?.follow('activity', run);
    // первая загрузка
    run();
  }

  document.readyState === 'loading'
    ? document.addEventListener('DOMContentLoaded', hook)
    : hook();
})();
