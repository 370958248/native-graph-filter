'use strict';
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.NativeGraphFilterCore=api;})(typeof globalThis!=='undefined'?globalThis:this,()=>{
  const ID=/^\d{14}-[a-z0-9]{7}$/;
  const validId=x=>typeof x==='string'&&ID.test(x);
  const endpoint=x=>typeof x==='string'?x:(x&&typeof x.id==='string'?x.id:'');
  function normalize(value){
    if(!value||typeof value!=='object'||Array.isArray(value))throw Error('过滤设置格式不正确');
    if(value.version!==1||!Array.isArray(value.rules)||value.rules.length>500)throw Error('过滤设置版本或数量不正确');
    const seen=new Set(),rules=[];
    for(const item of value.rules){
      if(!item||!['notebook','branch','document'].includes(item.kind)||!validId(item.box))throw Error('隐藏范围无效');
      const rule={kind:item.kind,box:item.box,label:typeof item.label==='string'?item.label.slice(0,200):''};
      if(item.kind!=='notebook'){
        if(!validId(item.id)||typeof item.path!=='string'||item.path.length>4096||!/^\/(?:\d{14}-[a-z0-9]{7}\/)*\d{14}-[a-z0-9]{7}\.sy$/.test(item.path)||!item.path.endsWith('/'+item.id+'.sy'))throw Error('文档路径无效');
        rule.id=item.id;rule.path=item.path;
      }
      const key=rule.kind+':'+rule.box+':'+(rule.id||'');
      if(!seen.has(key)){seen.add(key);rules.push(rule);}
    }
    return {version:1,enabled:value.enabled!==false,rules};
  }
  const empty=()=>({version:1,enabled:true,rules:[]});
  function project(data,settings){
    if(!data||!Array.isArray(data.nodes)||!Array.isArray(data.links)||!settings.enabled||!settings.rules.length)return {data,hidden:0,total:data?.nodes?.length||0,linksHidden:0};
    const byId=new Map(data.nodes.map(n=>[n.id,n])),books=new Set(),paths=new Map();
    for(const saved of settings.rules){
      if(saved.kind==='notebook'){books.add(saved.box);continue;}
      const current=byId.get(saved.id);
      const moved=current&&validId(current.box)&&typeof current.path==='string'&&current.path.endsWith('/'+saved.id+'.sy');
      const rule=moved?{...saved,box:current.box,path:current.path}:saved;
      if(!paths.has(rule.box))paths.set(rule.box,[]);
      paths.get(rule.box).push(rule);
    }
    const hidden=new Set();
    for(const node of data.nodes){
      if(books.has(node.box)){hidden.add(node.id);continue;}
      for(const rule of paths.get(node.box)||[]){
        if(node.id===rule.id||node.path===rule.path||(rule.kind==='branch'&&typeof node.path==='string'&&node.path.startsWith(rule.path.slice(0,-3)+'/'))){hidden.add(node.id);break;}
      }
    }
    // Remove a tag only when all of its originally linked neighbours were hidden.
    const neighbours=new Map();
    for(const link of data.links){const a=endpoint(link.from??link.source),b=endpoint(link.to??link.target);for(const [x,y] of [[a,b],[b,a]]){if(!neighbours.has(x))neighbours.set(x,new Set());neighbours.get(x).add(y);}}
    for(const n of data.nodes){const peers=neighbours.get(n.id);if(String(n.type).includes('tag')&&peers?.size&&[...peers].every(id=>hidden.has(id)))hidden.add(n.id);}
    if(!hidden.size)return {data,hidden:0,total:data.nodes.length,linksHidden:0};
    const nodes=data.nodes.filter(n=>!hidden.has(n.id)),visible=new Set(nodes.map(n=>n.id));
    const links=data.links.filter(l=>visible.has(endpoint(l.from??l.source))&&visible.has(endpoint(l.to??l.target)));
    return {data:{...data,nodes,links},hidden:hidden.size,total:data.nodes.length,linksHidden:data.links.length-links.length};
  }
  return {normalize,empty,project,validId,endpoint};
});
