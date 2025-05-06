/**
 * Lampa.mx – AI‑рекомендации (v1.2, DeepSeek)
 * Автор: @your_nick, Golden Byte 2025
 *
 * Что нового v1.2
 *  – переход с OpenRouter на DeepSeek
 *  – переменная deepseekKey + обновлённый endpoint
 */

(() => {
  const cfg = {
    deepseekKey  : 'sk-2c5f081c9c324ae1948520c4fb5cca93',      // ваш ключ DeepSeek
    model        : 'deepseek-chat',                            // можно поменять на deepseek-reasoner
    tmdbKey      : '9f3911be7fa6d4b7130b52f6c6c2f7ab',
    cacheHrs     : 48,
    debug        : true,
    hdr          : {
      'Content-Type': 'application/json',
      'Authorization': ''                                      // заполняем ниже
    }
  };
  cfg.hdr.Authorization = 'Bearer ' + cfg.deepseekKey;

  const LS_KEY = 'similar_ai_cache_v12';

  /* ───── helper ───── */
  const log = (...m) => cfg.debug && (console.log('[AI‑Sim]', ...m), window.Lampa?.Noty?.show('[AI] '+m.join(' ')));

  const readCache = () => {
    try { return JSON.parse(localStorage.getItem(LS_KEY)||'{}'); } catch{return{};}
  };
  const saveCache = o => localStorage.setItem(LS_KEY, JSON.stringify(o));

  /* ───── текущий фильм ───── */
  function currentCard(){
    try{const a=Lampa?.Activity?.active();if(a?.card?.id)return a.card;}catch{}
    return null;
  }

  /* ───── запрос к DeepSeek ───── */
  async function fetchAI(card){
    const cache=readCache();
    const key=card.id+'|'+card.title;
    if(cache[key]&&Date.now()-cache[key].ts<cfg.cacheHrs*3600e3){log('cache hit');return cache[key].data;}

    const prompt=`Ты – рекомендательная система видеосервиса.
Верни ТОЛЬКО JSON‑массив из 6 фильмов:
[
 {"title":"…","orig":"…","year":"…","why":"…"}
]`;

    const rsp=await fetch('https://api.deepseek.com/chat/completions',{
      method:'POST',
      headers:cfg.hdr,
      body:JSON.stringify({
        model:cfg.model,
        messages:[{role:'user',content:prompt}],
        response_format:{type:'json_object'}
      })
    });

    if(!rsp.ok)throw new Error('DeepSeek '+rsp.status);
    const js=await rsp.json();
    const rec=JSON.parse(js.choices?.[0]?.message?.content||'[]');
    cache[key]={ts:Date.now(),data:rec};
    saveCache(cache);
    return rec;
  }

  /* ───── TMDB постер ───── */
  const posterCache={};
  async function tmdbPoster(title,year=''){
    const k=title+'|'+year;
    if(posterCache[k])return posterCache[k];
    const q=encodeURIComponent(title);
    const url=`https://api.themoviedb.org/3/search/movie?api_key=${cfg.tmdbKey}&query=${q}&year=${year}&language=ru-RU`;
    const js=await fetch(url).then(r=>r.json()).catch(()=>({results:[]}));
    const p=js.results?.[0]?.poster_path||'';
    posterCache[k]=p?`https://image.tmdb.org/t/p/w342${p}`:'';
    return posterCache[k];
  }

  /* ───── рендер карточек ───── */
  async function buildRow(recs){
    const wrap=document.createElement('div');
    wrap.className='category-full category--collection ai‑similar';
    wrap.innerHTML=`<div class="category-full__title"><h2>ИИ рекомендует</h2></div><div class="items-cards"></div>`;
    const list=wrap.querySelector('.items-cards');

    for(const r of recs){
      const poster=await tmdbPoster(r.title,r.year);
      const c=document.createElement('div');
      c.className='card card--collection';c.tabIndex=0;
      c.innerHTML=`<div class="card__view">
         <img class="card__img" loading="lazy" src="${poster}" alt="${r.title}">
         <div class="card__rating"><span>${r.year||''}</span></div>
       </div>
       <div class="card__title">${r.title}</div>`;
      c.addEventListener('click',()=>Lampa.Search?.find({query:r.title}));
      list.append(c);
    }
    return wrap;
  }

  /* ───── вставка на страницу ───── */
  async function insert(){
    const card=currentCard(); if(!card)return;
    if(document.querySelector('.ai‑similar'))return;

    const holder=document.createElement('div');
    holder.className='category-full__title';
    holder.innerHTML='<h2>ИИ рекомендует…</h2>';
    const target=document.querySelector('.full-start')||document.body;
    target.parentNode.insertBefore(holder,target.nextSibling);

    try{
      const recs=await fetchAI(card);
      holder.remove();
      const row=await buildRow(recs);
      target.parentNode.insertBefore(row,target.nextSibling);
    }catch(e){
      log(e.message);
      holder.innerHTML=`<h2>Ошибка рекомендаций</h2><div style="opacity:.7">${e.message}</div>`;
    }
  }

  /* ───── подписка ───── */
  function hook(){
    const run=()=>setTimeout(insert,800);
    Lampa.Listener?.follow('full',run);
    Lampa.Listener?.follow('activity',run);
    run();
  }

  document.readyState==='loading'
    ? document.addEventListener('DOMContentLoaded',hook)
    : hook();
})();
