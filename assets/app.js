/* v0.4.2 — election candidate cards and vote charts. No admin tokens or private APIs. */
(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const page = document.body.dataset.page;
  const app = $('app');
  const status = $('status');
  const qs = new URLSearchParams(location.search);
  const esc = value => String(value ?? '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  const txt = value => String(value ?? '').trim();
  const list = value => Array.isArray(value) ? value : [];
  const date = value => { const s=txt(value); return s ? esc(s.slice(0,10)) : '未提供日期'; };
  const empty = msg => `<div class="panel empty">${esc(msg)}</div>`;
  const safeUrl = value => { try { const u = new URL(txt(value), location.href); return ['https:','http:'].includes(u.protocol) ? u.href : ''; } catch { return ''; } };
  const anchor = (url,label) => { const u=safeUrl(url); return u ? `<a href="${esc(u)}" target="_blank" rel="noopener noreferrer">${esc(label)}</a>` : '<span class="subtle">尚無公開連結</span>'; };
  const panel = (heading,body) => `<section class="panel"><h2>${esc(heading)}</h2>${body}</section>`;
  const badge = s => s ? `<span class="pill">${esc(s)}</span>` : '';
  const link = (path,label) => `<a href="${path}">${esc(label)}</a>`;
  const filters = (items,render,{term=false,category=false,placeholder='搜尋關鍵字'}={}) => {
    const cats = [...new Set(items.map(i=>txt(i.category)).filter(Boolean))].sort();
    const terms = [...new Set(items.map(i=>txt(i.termId)).filter(Boolean))];
    const controls = `<div class="toolbar"><input id="search" type="search" aria-label="搜尋" placeholder="${esc(placeholder)}">${category?`<select id="category" aria-label="公告分類"><option value="">全部分類</option>${cats.map(c=>`<option value="${esc(c)}">${esc(c)}</option>`).join('')}</select>`:''}${term?`<select id="term" aria-label="選舉屆次"><option value="">全部屆次</option>${terms.map(t=>`<option value="${esc(t)}">${esc(termNames[t]||t)}</option>`).join('')}</select>`:''}</div><div id="filtered" aria-live="polite"></div>`;
    app.innerHTML = controls;
    const update = () => { const q=txt($('search').value).toLowerCase(); const c=$('category')?.value||'';const t=$('term')?.value||'';
      const selected=items.filter(i=>(!q||Object.values(i).some(v=>typeof v==='string'&&v.toLowerCase().includes(q)))&&(!c||i.category===c)&&(!t||i.termId===t));
      $('filtered').innerHTML=selected.length?`<div class="panel">${selected.map(render).join('')}</div>`:empty('沒有符合條件的公開資料。');
    };
    ['search','category','term'].forEach(id=>$(id)?.addEventListener(id==='search'?'input':'change',update)); update();
  };
  let termNames={};
  const announcementItem = a => `<article class="entry">${badge(a.category)}<span class="meta">${date(a.date)}</span><h2>${link('announcement.html?id='+encodeURIComponent(txt(a.id)),a.title||'未命名公告')}</h2><p>${esc(a.summary||'')}</p></article>`;
  const rowTable = (heads,rows) => `<div class="table-scroll"><table><thead><tr>${heads.map(h=>`<th scope="col">${esc(h)}</th>`).join('')}</tr></thead><tbody>${rows.map(r=>`<tr>${r.map(c=>`<td>${c}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
  const groupTerm = (id) => esc(termNames[txt(id)] || (id?'未指定名稱的屆次':'一般資訊'));

  // v0.4.1: election hub. Keep the existing JSON schema and legacy pages unchanged.
  const electionTabs = ['candidates','results'];
  const electionTabLabels = {candidates:'候選人資訊',results:'選舉結果'};
  // Images: accept HTTPS image URLs or same-site assets/candidates files only.
  const safePhotoUrl = value => {
    const raw=txt(value);
    if(/^assets\/candidates\/[a-zA-Z0-9_./-]+\.(?:jpg|jpeg|png|webp|svg)$/i.test(raw) && !raw.split('/').includes('..')) return raw;
    try { const u=new URL(raw); return u.protocol==='https:' && !u.username && !u.password ? u.href : ''; } catch { return ''; }
  };
  const candidatePhoto = x => {
    const url=safePhotoUrl(x.photoUrl);
    return `<div class="candidate-photo">${url?`<img src="${esc(url)}" alt="${esc(x.name||'候選人')}的公開照片" loading="lazy" decoding="async" onerror="this.hidden=true;this.nextElementSibling.hidden=false"><span class="photo-placeholder" hidden aria-hidden="true">👤</span>`:'<span class="photo-placeholder" aria-hidden="true">👤</span>'}</div>`;
  };
  const voteNumber = value => {
    const raw=txt(value).replace(/,/g,'');
    return /^\d+$/.test(raw) && Number.isSafeInteger(Number(raw)) ? Number(raw) : null;
  };
  const voteFormat = value => value===null?'未提供':value.toLocaleString('zh-TW');
  const piePalette = ['#286b93','#d27c37','#53836b','#8c64a8','#b44d64','#aa9141','#477e90','#8a725d'];
  const piePath = (start,end) => {
    const cx=110,cy=110,r=92;
    const point=a=>[cx+r*Math.cos(a-Math.PI/2),cy+r*Math.sin(a-Math.PI/2)];
    const [x1,y1]=point(start),[x2,y2]=point(end);
    return `M ${cx} ${cy} L ${x1.toFixed(3)} ${y1.toFixed(3)} A ${r} ${r} 0 ${end-start>Math.PI?1:0} 1 ${x2.toFixed(3)} ${y2.toFixed(3)} Z`;
  };
  const renderVoteGroup = (position,group,candidates) => {
    const first=group[0]||{};
    const referendum=group.every(r=>txt(r.voteMethod)==='正反決投票');
    const names=Object.fromEntries(candidates.filter(c=>c&&c.id).map(c=>[txt(c.id),txt(c.name)]));
    // Referendum votes are approvalVotes/oppositionVotes, not candidate votes.
    const entries=referendum ? [
      {label:'贊成',votes:voteNumber(first.approvalVotes),color:piePalette[0]},
      {label:'反對',votes:voteNumber(first.oppositionVotes),color:piePalette[1]}
    ] : group.map((r,i)=>({
      label:txt(r.candidateName)||names[txt(r.candidateId)]||'候選人名稱未提供',
      votes:voteNumber(r.votes),color:piePalette[i%piePalette.length]
    }));
    const valid=entries.every(e=>e.votes!==null);
    const total=valid?entries.reduce((sum,e)=>sum+e.votes,0):0;
    const reportedValid=voteNumber(first.validVotes);
    // Avoid a misleading pie chart if a referendum's yes/no totals contradict valid ballots.
    const consistent=!referendum || reportedValid===null || (valid && total===reportedValid);
    let angle=0;
    const paths=valid&&consistent&&total>0?entries.filter(e=>e.votes>0).map(e=>{
      const sweep=e.votes/total*2*Math.PI;
      const shape=sweep>=2*Math.PI-1e-9?`<circle cx="110" cy="110" r="92" fill="${e.color}"/>`:`<path d="${piePath(angle,angle+sweep)}" fill="${e.color}"/>`;
      angle+=sweep;return shape;
    }).join(''):'';
    const chartError=!consistent?'贊成票與反對票合計不等於有效票，暫不繪製圓餅圖。':valid?'目前沒有可繪製的有效得票數。':'部分得票數缺漏或格式不正確，暫不繪製圓餅圖。';
    const pie=paths?`<div class="vote-chart"><svg viewBox="0 0 220 220" role="img" aria-label="${esc(position)}${referendum?'贊成與反對':'候選人得票'}比例圓餅圖；詳細票數及百分比請參閱下方表格">${paths}</svg></div>`:`<p class="subtle vote-no-chart">${chartError}</p>`;
    const rows=entries.map(e=>`<tr><td><span class="vote-key" style="background:${e.color}" aria-hidden="true"></span>${esc(e.label)}</td><td class="number">${voteFormat(e.votes)}</td><td class="number">${valid&&total>0?((e.votes/total)*100).toFixed(1)+'%':'—'}</td></tr>`).join('');
    const stats=[['有效票',first.validVotes],['無效票',first.invalidVotes],['總投票數',first.totalVotes],['投票率',first.turnout]]
      .filter(([_,v])=>txt(v)!=='')
      .map(([label,value])=>`<div><dt>${esc(label)}</dt><dd>${esc(value)}</dd></div>`).join('');
    const note=valid&&consistent&&total>0?(referendum?'圓餅圖以贊成票與反對票合計計算比例。':'圓餅圖百分比以本表列出的候選人得票合計計算，不含無效票。'):'';
    const heading=referendum?'投票選項':'候選人';
    const votesHeading=referendum?'票數':'得票數';
    const candidateNote=referendum?`<p class="meta">候選人：${esc(txt(first.candidateName)||names[txt(first.candidateId)]||'未提供')}</p>`:'';
    return `<section class="vote-group" aria-label="${esc(position)}選舉結果"><h3>${esc(position)}</h3>${candidateNote}${pie}<div class="table-scroll"><table class="vote-table"><thead><tr><th scope="col">${heading}</th><th scope="col">${votesHeading}</th><th scope="col">得票比例</th></tr></thead><tbody>${rows}</tbody></table></div>${note?`<p class="meta">${note}</p>`:''}${stats?`<dl class="vote-stats">${stats}</dl>`:''}${first.date?`<p class="meta">發布日期：${date(first.date)}</p>`:''}</section>`;
  };

  const electionHub = (archives,candidates,results) => {
    const terms = archives.filter(x=>x && txt(x.id));
    // 最新學年度優先；同學年度依自治屆次名稱排序。進行狀態不影響新舊順序。
    const sorted = [...terms].sort((a,b)=>
      txt(b.year).localeCompare(txt(a.year),'zh-Hant',{numeric:true}) ||
      txt(b.term||b.name).localeCompare(txt(a.term||a.name),'zh-Hant',{numeric:true}));
    if(!sorted.length) { app.innerHTML=empty('目前沒有可供查詢的選舉屆次。'); return; }
    const requestedTerm=txt(qs.get('term'));
    const initialTerm=sorted.some(x=>txt(x.id)===requestedTerm)?requestedTerm:txt(sorted[0].id);
    const requestedTab=txt(qs.get('tab'));
    const initialTab=electionTabs.includes(requestedTab)?requestedTab:'candidates';
    const renderCandidate = x => `<article class="candidate-card">${candidatePhoto(x)}<div class="candidate-details"><h3>${esc(x.name)}</h3><p class="candidate-position">${esc(x.position||'未提供職務')}</p><p class="meta">資格審查：${esc(x.reviewStatus||'未提供')}</p><p>${x.platformUrl?anchor(x.platformUrl,'查看政見資料'):'<span class="subtle">尚無公開政見連結</span>'}</p></div></article>`;
    const renderResults = rows => {
      const byPosition = new Map();
      rows.forEach(r => { const key=txt(r.position)||'未指定職務'; if(!byPosition.has(key))byPosition.set(key,[]);byPosition.get(key).push(r); });
      return [...byPosition].map(([position,group]) => renderVoteGroup(position,group,candidates)).join('');
    };
    app.innerHTML=`<section class="panel election-picker"><label for="election-term">選擇選舉屆次（共 ${sorted.length} 屆）</label><select id="election-term" aria-label="選擇選舉屆次">${sorted.map(x=>`<option value="${esc(x.id)}">${esc(x.term||x.name||'未命名屆次')}（${esc(x.year||'學年度未提供')}）</option>`).join('')}</select><div id="election-summary" class="election-summary" aria-live="polite"></div></section>
      <section class="election-section" aria-label="該屆選舉資料"><div class="election-tabs" role="tablist" aria-label="選舉資訊分頁">${electionTabs.map((t,i)=>`<button type="button" id="tab-${t}" class="election-tab" role="tab" aria-controls="election-content" aria-selected="false" tabindex="-1" data-election-tab="${t}">${electionTabLabels[t]}</button>`).join('')}</div><div class="panel election-content" id="election-content" role="tabpanel" tabindex="0" aria-labelledby="tab-candidates"><div class="toolbar"><input type="search" id="election-search" aria-label="搜尋本屆選舉資料" placeholder="搜尋候選人資訊"></div><div id="election-list" aria-live="polite"></div></div></section>`;
    const selector=$('election-term');
    selector.value=initialTerm;
    let activeTab=initialTab;
    const update = () => {
      const termId=selector.value;
      const term=sorted.find(x=>txt(x.id)===termId);
      $('election-summary').innerHTML=term?`<h2>${esc(term.term||term.name||'未命名屆次')}</h2><p class="meta">學年度：${esc(term.year||'未提供')}　${badge(term.status)}</p>`:'';
      const collections={candidates:candidates.filter(x=>x&&x.name),results:results.filter(x=>x)};
      const collection=collections[activeTab].filter(x=>txt(x.termId)===termId);
      const query=txt($('election-search').value).toLowerCase();
      const visible=collection.filter(x=>!query||Object.values(x).some(v=>typeof v==='string'&&v.toLowerCase().includes(query)));
      const renderer={candidates:renderCandidate}[activeTab];
      $('election-list').innerHTML=visible.length?(activeTab==='results'?renderResults(visible):activeTab==='candidates'?`<div class="candidate-grid">${visible.map(renderer).join('')}</div>`:visible.map(renderer).join('')):empty(query?'沒有符合條件的公開資料。':'本屆目前沒有已公開的'+electionTabLabels[activeTab]+'。');
      electionTabs.forEach(t=>{
        const button=$('tab-'+t);const selected=t===activeTab;
        button.setAttribute('aria-selected',String(selected));button.tabIndex=selected?0:-1;
      });
      $('election-content').setAttribute('aria-labelledby','tab-'+activeTab);
      $('election-search').placeholder='搜尋'+electionTabLabels[activeTab];
      const url=new URL(location.href);
      url.searchParams.set('term',termId);
      url.searchParams.set('tab',activeTab);
      history.replaceState(null,'',url.pathname+url.search+url.hash);
    };
    selector.addEventListener('change',()=>{$('election-search').value='';update();});
    $('election-search').addEventListener('input',update);
    electionTabs.forEach((t,i)=>{
      const button=$('tab-'+t);
      button.addEventListener('click',()=>{activeTab=t;$('election-search').value='';update();});
      button.addEventListener('keydown',event=>{
        if(!['ArrowLeft','ArrowRight','Home','End'].includes(event.key))return;
        event.preventDefault();
        const next=event.key==='Home'?0:event.key==='End'?electionTabs.length-1:(i+(event.key==='ArrowRight'?1:-1)+electionTabs.length)%electionTabs.length;
        $('tab-'+electionTabs[next]).click();$('tab-'+electionTabs[next]).focus();
      });
    });
    update();
  };

  const render = data => {
    const announcements=list(data.announcements).filter(a=>a&&a.id);
    const attachments=list(data.attachments);
    const archives=list(data.archives);
    termNames=Object.fromEntries(archives.filter(x=>x?.id).map(x=>[txt(x.id),txt(x.term)||txt(x.name)]));
    const candidates=list(data.candidates),results=list(data.results),regulations=list(data.regulations),documents=list(data.documents);
    const intros={home:'最新公告與選舉資訊一站查詢。',announcements:'查詢選舉委員會已發布的公告。',announcement:'正式公告內容及經審核公開的附件。',archives:'依選舉屆次瀏覽歷屆資料。',candidates:'候選人及參選職務等公開資訊。',results:'查詢已發布的選舉結果。',regulations:'公開的選舉法規及相關規範。',documents:'已公開的選舉文件與表單。',elections:'依選舉屆次查看候選人及選舉結果。'};
    $('page-intro').textContent=intros[page]||'';
    $('last-updated').textContent=data.updatedAt?'資料更新：'+txt(data.updatedAt).replace('T',' ').slice(0,16):'尚未匯入正式資料';
    if(page==='home'||page==='index') {
      const quick=[['announcements','公告中心','已發布公告及公開附件'],['elections','選舉專區','歷屆選舉、候選人及結果'],['regulations','法規專區','選舉相關規範'],['documents','文件下載','公開表單及文件']];
      app.innerHTML=`<section class="hero"><h2>公開、透明的選舉資訊</h2><p>公告、候選人與歷屆選舉資訊。</p><a href="announcements.html">查看最新公告</a></section>${panel('最新公告',announcements.length?announcements.slice(0,5).map(announcementItem).join(''): '<p class="empty">目前沒有已發布的公告。</p>')}<section class="grid" aria-label="快速導覽">${quick.map(([id,title,desc])=>`<a class="quick-link" href="${id}.html"><strong>${title}</strong><span>${desc}</span></a>`).join('')}</section>`;
    } else if(page==='elections') electionHub(archives,candidates,results);
    else if(page==='announcements') filters(announcements,announcementItem,{category:true,term:true,placeholder:'搜尋公告標題、摘要或內文'});
    else if(page==='announcement') {
      const id=qs.get('id'); const a=announcements.find(x=>txt(x.id)===id);
      if(!a){app.innerHTML=empty('找不到這則公開公告，可能已下架或連結有誤。');return;}
      const files=attachments.filter(f=>txt(f.announcementId)===id);
      const content=`<a class="back-link" href="announcements.html">← 返回公告中心</a><article class="panel">${badge(a.category)}<span class="meta">${date(a.date)} · ${groupTerm(a.termId)}</span><h2>${esc(a.title)}</h2><div class="article-body">${esc(a.content||a.summary||'（無公告內文）')}</div></article>`;
      app.innerHTML=content+panel('公開附件',files.length?`<ul class="attachment-list">${files.map(f=>`<li>📎 ${anchor(f.url,f.name||'附件')} <span class="meta">${esc(f.mime||'')}</span></li>`).join('')}</ul>`:'<p class="empty">本公告沒有已公開的附件。</p>');
    } else if(page==='archives') filters(archives.map(x=>({...x,category:x.status,termId:x.id})),x=>`<article class="entry"><h2>${esc(x.term||x.name||'未命名屆次')}</h2><p class="meta">學年度：${esc(x.year||'未提供')} · 狀態：${esc(x.status||'未提供')}</p><p>${link('elections.html?term='+encodeURIComponent(txt(x.id))+'&tab=candidates','查看該屆候選人')}　${link('elections.html?term='+encodeURIComponent(txt(x.id))+'&tab=candidates','候選人')}　${link('elections.html?term='+encodeURIComponent(txt(x.id))+'&tab=results','選舉結果')}</p></article>`,{placeholder:'搜尋屆次或學年度'});
    else if(page==='candidates') filters(candidates.filter(x=>x&&x.name),x=>`<article class="entry legacy-candidate">${candidatePhoto(x)}<div><h3>${esc(x.name)}</h3><p class="meta">${groupTerm(x.termId)} · ${esc(x.position||'未提供職務')}</p><p>資格審查：${esc(x.reviewStatus||'未提供')}　${x.platformUrl?anchor(x.platformUrl,'政見資料'):''}</p></div></article>`,{term:true,placeholder:'搜尋候選人或參選職務'});
    else if(page==='results') filters(results,x=>`<article class="entry"><h3>${esc(x.position||'選舉結果')}</h3><p class="meta">${groupTerm(x.termId)} · ${date(x.date)} · ${esc(x.status||'')}</p><p>候選人：${esc(x.candidateName||x.candidateId||'未提供')}　${txt(x.voteMethod)==='正反決投票'?`贊成票：${esc(x.approvalVotes??'未提供')}　反對票：${esc(x.oppositionVotes??'未提供')}`:`得票數：${esc(x.votes??'未提供')}`}　投票率：${esc(x.turnout||'未提供')}</p></article>`,{term:true,placeholder:'搜尋選舉結果'});
    else if(page==='regulations') filters(regulations,x=>`<article class="entry">${badge(x.category)}<h3>${esc(x.title||'未命名法規')}</h3><p class="meta">版本：${esc(x.version||'未提供')}</p>${anchor(x.url,'檢視法規文件')}</article>`,{category:true,placeholder:'搜尋法規名稱'});
    else if(page==='documents') filters(documents,x=>`<article class="entry">${badge(x.category)}<h3>${esc(x.title||'未命名文件')}</h3><p class="meta">${groupTerm(x.termId)}</p>${anchor(x.url,'開啟文件')}</article>`,{category:true,term:true,placeholder:'搜尋文件名稱'});
    // Allow pre-selected term when navigating from archive.
    if(qs.get('term')&&$('term')){$('term').value=qs.get('term');$('term').dispatchEvent(new Event('change'));}
  };
  $('nav-toggle')?.addEventListener('click',()=>{const n=$('site-nav');const open=n.classList.toggle('open');$('nav-toggle').setAttribute('aria-expanded',String(open));});
  const url=window.NTCU_SITE_CONFIG?.dataUrl||'data/public.json';
  fetch(url,{cache:'no-store'}).then(async response=>{if(!response.ok)throw new Error('HTTP '+response.status);return response.json();}).then(data=>{if(!data||data.ok!==true)throw new Error('資料格式不正確');render(data);status.hidden=true;}).catch(error=>{status.classList.add('error');status.textContent='公開資料載入失敗。請確認網站已部署、資料檔存在，並稍後重新整理。';app.innerHTML=empty('目前無法顯示資料。');console.error('Public data error:',error);});
})();
