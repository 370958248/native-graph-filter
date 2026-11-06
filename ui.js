'use strict';
const Core=require('./filter');
function open(plugin,{Dialog,showMessage}){
  if(plugin.filterDialog){plugin.filterDialog.element.focus();return;}
  const dialog=new Dialog({title:'全局关系过滤',width:'760px',content:'<div class="ngf-settings"></div>',destroyCallback:()=>{closed=true;plugin.filterDialog=null;}});
  plugin.filterDialog=dialog;let closed=false,draft=Core.normalize(plugin.settings),roots=[],saving=false;
  const host=dialog.element.querySelector('.ngf-settings');
  function el(tag,cls,text){const x=document.createElement(tag);if(cls)x.className=cls;if(text!==undefined)x.textContent=text;return x;}
  const intro=el('p','ngf-intro','勾选不想出现在思源自带全局关系图中的内容。文档勾选后会包含下级；原文和真实引用保留。');
  const enabledLabel=el('label','ngf-enabled'),enabled=el('input');enabled.type='checkbox';enabled.checked=draft.enabled;enabledLabel.append(enabled,el('span','','启用过滤'));
  const status=el('p','ngf-status'),scope=el('p','ngf-note','仅过滤原生已加载的节点，不改变原生节点上限。只影响全局关系图，不影响局部关系图。');
  const search=el('input','b3-text-field ngf-search');search.type='search';search.placeholder='搜索笔记本或已展开的目录';search.setAttribute('aria-label',search.placeholder);
  const tree=el('div','ngf-tree'),empty=el('p','ngf-note','正在读取笔记本列表…');tree.append(empty);
  const ruleTitle=el('h3','','已选隐藏范围'),ruleList=el('div','ngf-rules'),error=el('p','ngf-error');error.setAttribute('role','alert');
  const actions=el('div','ngf-actions'),clear=el('button','b3-button b3-button--outline','清空隐藏项'),cancel=el('button','b3-button b3-button--outline','取消'),apply=el('button','b3-button','应用');
  actions.append(clear,el('span','ngf-spacer'),cancel,apply);host.append(intro,enabledLabel,status,scope,search,tree,ruleTitle,ruleList,error,actions);
  const key=r=>r.kind+':'+r.box+':'+(r.id||'');
  function ruleFor(n){return n.kind==='notebook'?{kind:'notebook',box:n.id,label:n.title}:{kind:'branch',box:n.box,id:n.id,path:n.path,label:n.title};}
  function own(n){return draft.rules.some(r=>key(r)===key(ruleFor(n)));}
  function ancestor(n){return draft.rules.some(r=>r.kind==='notebook'?r.box===n.box&&n.kind!=='notebook':r.kind==='branch'&&r.box===n.box&&n.path!==r.path&&n.path.startsWith(r.path.slice(0,-3)+'/'));}
  function preview(){
    const values=plugin.bridge.preview(draft),latest=values[values.length-1];
    status.textContent=!draft.enabled?'过滤已暂停，应用后恢复全部原生节点。':latest?'当前已加载 '+latest.total+' 个节点，应用后隐藏 '+latest.hidden+' 个，显示 '+(latest.total-latest.hidden)+' 个。':'打开思源自带全局关系图后，隐藏范围会自动生效。';
  }
  async function expand(n){
    if(n.busy)return;
    if(n.children){n.expanded=!n.expanded;render();return;}
    n.busy=true;render();
    try{
      const path=n.kind==='notebook'?'/':n.path;
      const data=await plugin.api('/api/filetree/listDocsByPath',{notebook:n.box,path});
      if(closed)return;
      n.children=(data.files||[]).filter(f=>Core.validId(f.id)).map(f=>({id:f.id,box:n.box,title:String(f.name||f.id).replace(/\.sy$/,''),kind:'branch',path:typeof f.path==='string'?f.path:(n.kind==='notebook'?'/':n.path.slice(0,-3)+'/')+f.id+'.sy',expanded:false,busy:false}));
      n.expanded=true;
    }catch(e){error.textContent=e.message;}finally{n.busy=false;if(!closed)render();}
  }
  function render(){
    if(closed)return;tree.replaceChildren();const query=search.value.trim().toLowerCase();let count=0;
    const contains=n=>n.title.toLowerCase().includes(query)||(n.children||[]).some(contains);
    function row(n,depth){
      if(query&&!contains(n))return;
      count++;
      const line=el('div','ngf-row');line.style.paddingLeft=(depth*18+4)+'px';
      const arrow=el('button','ngf-expand',n.busy?'…':n.expanded?'▾':'▸');arrow.type='button';arrow.disabled=n.busy||saving;arrow.setAttribute('aria-label',(n.expanded?'收起':'展开')+n.title);arrow.setAttribute('aria-expanded',String(n.expanded));arrow.addEventListener('click',()=>expand(n));
      const label=el('label','ngf-label'),check=el('input');check.type='checkbox';const inherited=ancestor(n);check.checked=own(n)||inherited;check.disabled=inherited||saving;
      check.setAttribute('aria-label','隐藏'+n.title);
      check.addEventListener('change',()=>{const r=ruleFor(n);draft.rules=draft.rules.filter(x=>key(x)!==key(r));if(check.checked)draft.rules.push(r);render();});
      label.append(check,el('span','ngf-name',n.title));if(inherited)label.append(el('small','ngf-note','随上级隐藏'));line.append(arrow,label);tree.append(line);
      if(n.expanded||query)for(const child of n.children||[])row(child,depth+1);
    }
    for(const root of roots)row(root,0);
    if(!count)tree.append(el('p','ngf-note',roots.length?'没有匹配的已载入目录。':'没有可用的打开笔记本。'));
    ruleList.replaceChildren();
    if(!draft.rules.length)ruleList.append(el('p','ngf-note','没有隐藏任何内容。'));
    for(const r of draft.rules){const row=el('div','ngf-rule');row.append(el('span','',r.label||r.id||r.box),el('small','ngf-note',r.kind==='notebook'?'整个笔记本':r.kind==='branch'?'文档及下级':'仅此文档'));const remove=el('button','b3-button b3-button--outline','移除');remove.type='button';remove.disabled=saving;remove.addEventListener('click',()=>{draft.rules=draft.rules.filter(x=>key(x)!==key(r));render();});row.append(remove);ruleList.append(row);}
    preview();
  }
  enabled.addEventListener('change',()=>{draft.enabled=enabled.checked;preview();});search.addEventListener('input',render);
  clear.addEventListener('click',()=>{draft.rules=[];render();});cancel.addEventListener('click',()=>dialog.destroy());
  apply.addEventListener('click',async()=>{if(saving)return;saving=true;error.textContent='';apply.disabled=cancel.disabled=clear.disabled=enabled.disabled=true;render();try{await plugin.saveSettings(draft);if(!closed)dialog.destroy();showMessage('原生全局关系图的过滤范围已更新');}catch(e){error.textContent=e.message;}finally{saving=false;if(!closed){apply.disabled=cancel.disabled=clear.disabled=enabled.disabled=false;render();}}});
  plugin.api('/api/notebook/lsNotebooks',{}).then(data=>{if(closed)return;roots=(data.notebooks||[]).filter(b=>Core.validId(b.id)&&!b.closed&&!b.encrypted&&!b.locked).map(b=>({kind:'notebook',box:b.id,id:b.id,path:'/',title:b.name||b.id,expanded:false,busy:false}));render();}).catch(e=>{if(!closed){tree.replaceChildren();error.textContent=e.message;}});
  preview();
}
module.exports={open};
