'use strict';
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.NativeGraphFilterBridge=api;})(typeof globalThis!=='undefined'?globalThis:this,()=>{
  function findModels(siyuan){
    const found=new Set(),seen=new WeakSet();
    function visit(value,depth){
      if(!value||typeof value!=='object'||depth>8||seen.has(value)||value.nodeType||value===globalThis)return;
      seen.add(value);
      if(typeof value.onGraph==='function'&&typeof value.searchGraph==='function'&&['global','local','pin'].includes(value.type)){found.add(value);return;}
      for(const key of ['layout','centerLayout','leftDock','rightDock','bottomDock','layouts','children','models','model','data','items','tabs','tab']){
        const child=value[key];if(Array.isArray(child))child.forEach(x=>visit(x,depth+1));else if(child&&typeof child==='object'){
          visit(child,depth+1);
          if(key==='data')for(const entry of Object.values(child))visit(entry,depth+1);
        }
      }
    }
    visit(siyuan?.layout,0);visit(siyuan?.layout?.centerLayout,0);
    return [...found];
  }
  function create({core,getSettings,onStats,openSettings,onStatus}){
    let active=true,revision=0;
    const patches=new Map(),models=new Set(),buttons=new Map();let cache=new WeakMap();
    function filtered(raw){const old=raw&&cache.get(raw);if(old?.revision===revision)return old.value;const value=core.project(raw,getSettings());if(raw)cache.set(raw,{revision,value});return value;}
    function attach(model){
      if(!model||model.type!=='global'||typeof model.onGraph!=='function'||typeof model.searchGraph!=='function')return false;
      const proto=Object.getPrototypeOf(model);if(!proto||typeof proto.onGraph!=='function')return false;
      models.add(model);
      if(!patches.has(proto)){
        const original=proto.onGraph;
        function wrapper(...args){
          if(!active||this.type!=='global')return original.apply(this,args);
          models.add(this);const raw=this.graphData,result=filtered(raw);this.graphData=result.data;
          try{return original.apply(this,args);}
          finally{if(this.graphData===result.data)this.graphData=raw;try{decorate(this,result);onStats?.(this,result);}catch{}}
        }
        proto.onGraph=wrapper;patches.set(proto,{original,wrapper});
      }
      return true;
    }
    function decorate(model,result){
      const element=model.element;
      if(!element?.querySelector||element.isConnected===false)return;
      let button=buttons.get(element);
      if(!button||!button.isConnected){
        const bar=element.querySelector('.block__icons'),anchor=bar?.querySelector('[data-type="refresh"]');if(!bar||!anchor)return;
        button=element.ownerDocument.createElement('span');button.className='block__icon ariaLabel native-graph-filter-button';button.setAttribute('data-position','south');button.setAttribute('role','button');button.tabIndex=0;
        button.innerHTML='<svg><use xlink:href="#iconNativeGraphFilter"></use></svg>';
        button.addEventListener('click',e=>{e.stopPropagation();openSettings?.();});
        button.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();openSettings?.();}});
        anchor.before(button);buttons.set(element,button);
      }
      const enabled=getSettings().enabled,hidden=result?.hidden||0;
      const text='全局关系过滤'+(enabled?'：已隐藏 '+hidden+' 个节点':'：已暂停');
      if(button.getAttribute('aria-label')!==text){button.setAttribute('aria-label',text);button.title=text;button.classList.toggle('native-graph-filter-active',enabled&&hidden>0);}
    }
    function scan(siyuan){
      if(!active)return;
      const current=findModels(siyuan);let count=0;
      for(const model of current)if(model.type==='global'){
        const existed=models.has(model);if(attach(model)){count++;if(!existed&&model.graphData)model.onGraph();else decorate(model,filtered(model.graphData));}
      }
      for(const model of models)if(model.element?.isConnected===false)models.delete(model);
      onStatus?.(count>0?{connected:true,count}:{connected:false,count:0});
    }
    function refresh(){revision++;cache=new WeakMap();for(const model of models){if(model.element?.isConnected===false)continue;try{model.onGraph();}catch(error){onStatus?.({error:error.message});}}}
    function destroy(){
      active=false;
      for(const [proto,p] of patches)if(proto.onGraph===p.wrapper)proto.onGraph=p.original;
      for(const model of models)if(model.element?.isConnected!==false){try{model.onGraph();}catch{}}
      for(const b of buttons.values())b.remove();buttons.clear();models.clear();patches.clear();cache=new WeakMap();
    }
    return {scan,refresh,destroy,attach,findModels,stats:()=>[...models].filter(m=>m.type==='global'&&m.graphData).map(m=>filtered(m.graphData)),preview:settings=>[...models].filter(m=>m.type==='global'&&m.graphData).map(m=>core.project(m.graphData,settings))};
  }
  return {findModels,create};
});
