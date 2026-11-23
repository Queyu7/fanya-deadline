(() => {
  if (location.protocol !== 'https:' || !/(^|\.)chaoxing\.com$/.test(location.hostname)) return { type: 'unsupported' };
  const one = selector => document.querySelector(selector);
  const text = element => (element?.textContent || '').trim();
  const safe = value => {
    try {
      const url = new URL(value, location.href);
      return url.protocol === 'https:' && /(^|\.)chaoxing\.com$/.test(url.hostname) ? url.href : '';
    } catch { return ''; }
  };
  if (location.hostname.startsWith('passport') || one('input[type=password]')) return { type: 'login' };
  if (one('#frame_content') && one('#zne_kc_icon')) {
    return { type: 'redirect', url: safe(one('#frame_content').src) };
  }
  const list = one('#stuNormalCourseListDiv');
  if (list) {
    const courses = [...list.querySelectorAll('h3 a[href]')].flatMap(anchor => {
      const url = safe(anchor.href);
      if (!url) return [];
      const params = new URL(url).searchParams;
      const course = params.get('courseid'), group = params.get('clazzid');
      return course && group ? [{key:course + ':' + group, name:text(anchor), url}] : [];
    });
    if (courses.length) return {type:'courses', courses, more:!![...list.querySelectorAll('a')].find(el=>/下一页|加载更多/.test(text(el)))};
    if (/暂无课程|还没有课程/.test(text(list))) return {type:'courses', courses:[]};
  }
  if (location.pathname.includes('/mycourse/stu')) {
    const frame = one('#frame_content-zy');
    if (frame?.getAttribute('src') && /\/work\/list/.test(frame.src)) return {type:'redirect', url:safe(frame.src)};
    const link = [...document.querySelectorAll('a')].find(anchor => text(anchor) === '作业');
    if (link && !document.documentElement.dataset.keqiOpened) {
      document.documentElement.dataset.keqiOpened = '1'; link.click();
    }
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
    const body = text(document.body);
    if (rows.length || /暂无作业|没有作业|暂无数据|还没有作业/.test(body)) {
      const next = [...document.querySelectorAll('a,button')].find(el=>/^(下一页|加载更多)$/.test(text(el)) && el.getClientRects().length && !el.matches(':disabled,.disabled,[aria-disabled=true]'));
      if (next) issues.push('平台还有未读取的分页');
      return {type:'work', items, issues};
    }
  }
  return {type:'waiting'};
})()
