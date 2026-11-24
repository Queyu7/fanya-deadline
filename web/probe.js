(mode => {
  if (location.protocol !== 'https:' || !/(^|\.)chaoxing\.com$/.test(location.hostname)) return { type: 'unsupported' };
  const one = selector => document.querySelector(selector);
  const text = element => (element?.textContent || '').trim();
  const nextControl = scope => [...scope.querySelectorAll('a, button')].find(el=>/^(下一页|加载更多)$/.test(text(el) || el.title) && el.getClientRects().length && !el.closest(':disabled,.disabled,[aria-disabled=true]'));
  const paging = (scope,signature) => {
    const next=nextControl(scope);
    if (!next) return {more:false};
    const tracker=document.documentElement.dataset;
    if (tracker.keqiLast===signature) {
      if (Date.now()-Number(tracker.keqiAt)>8000) return {more:true,stuck:true};
      return {waiting:true};
    }
    tracker.keqiLast=signature;tracker.keqiAt=String(Date.now());
    setTimeout(()=>next.click(),40);return {more:true};
  };
  const safe = value => {
    try {
      if (!value || !value.trim()) return '';
      const url = new URL(value, document.baseURI || location.href);
      if (!/(^|\.)chaoxing\.com$/.test(url.hostname) || url.username || url.password || url.port) return '';
      if (url.protocol === 'http:') url.protocol='https:';
      return url.protocol === 'https:' ? url.href : '';
    } catch { return ''; }
  };
  if (/^passport\d*\.chaoxing\.com$/.test(location.hostname) && /(?:^|\/)login(?:\.[a-z]+)?\/?$/i.test(location.pathname) && document.body) return {type:'login'};
  if (!document.body) return {type:'waiting'};
  const list = one('#stuNormalCourseListDiv');
  if (list) {
    const courses = [...list.querySelectorAll('a[href]')].flatMap(anchor => {
      const name=text(anchor) || anchor.getAttribute('title');
      const url = safe(anchor.getAttribute('href'));
      if (!url || !name) return [];
      const target=new URL(url);
      if (!/\/(stucoursemiddle|mycourse\/stu)\/?$/i.test(target.pathname)) return [];
      const params=new Map([...target.searchParams].map(([key,value])=>[key.toLowerCase(),value]));
      const course=params.get('courseid'), group=params.get('clazzid') || params.get('classid');
      return course && group ? [{key:course + ':' + group, name, url}] : [];
    });
    if (courses.length) {
      if (mode==='connect') return {type:'connected'};
      const page=paging(list,courses.map(item=>item.key).join(','));return page.waiting?{type:'waiting'}:{type:'courses',courses,...page};
    }
    if (/暂无课程|还没有课程/.test(text(list))) return mode==='connect'?{type:'connected'}:{type:'courses',courses:[]};
    return {type:'waiting',stage:'course-list'};
  }
  const courseFrame=one('#frame_content');
  if (courseFrame && one('#zne_kc_icon')) {
    const url=safe(courseFrame.getAttribute('src'));
    return url && /\/visit\/interaction\/?$/.test(new URL(url).pathname) ? {type:'redirect',url} : {type:'waiting',stage:'space'};
  }
  if (mode==='connect') return {type:'waiting'};
  if (location.pathname.includes('/mycourse/stu')) {
    const frame = one('#frame_content-zy');
    const url=safe(frame?.getAttribute('src'));
    if (url && /\/work\/list\/?$/.test(new URL(url).pathname)) return {type:'redirect',url};
    const link = [...document.querySelectorAll('a')].find(anchor => text(anchor) === '作业');
    if (link && !document.documentElement.dataset.keqiOpened) {
      document.documentElement.dataset.keqiOpened = '1'; link.click();
    }
    return {type:'waiting',stage:'course-room'};
  }
  if (/\/work\/list\/?$/.test(location.pathname)) {
    const rows = [...document.querySelectorAll('.bottomList li[role=link], .bottomList li[data]')];
    const items = [], issues = [];
    for (const row of rows) {
      const status = text(row.querySelector('.status'));
      if (/已交|已提交|已完成|待批阅|待批改|已批阅|已批改|已评/.test(status) && !/未交|退回|打回|重做/.test(status)) continue;
      const title = text(row.querySelector('.right-content p:not(.status)'));
      const timer = text(row.querySelector('.time'));
      let id;
      try { id = new URL(row.getAttribute('data'), location.href).searchParams.get('workId'); } catch {}
      if (!title || !id) { issues.push('未识别的作业卡片'); continue; }
      items.push({id,title,status:status || '状态待核对',timer});
    }
    const body = document.body.innerText || text(document.body);
    if (rows.length || /暂无(?:相关)?作业|没有(?:发布)?作业|暂无数据|未发布作业/.test(body)) {
      const page=paging(document,rows.map(row=>row.getAttribute('data')).join('|'));
      return page.waiting?{type:'waiting'}:{type:'work', items, issues,...page};
    }
    return {type:'waiting',stage:'work-list'};
  }
  return {type:'waiting'};
})
