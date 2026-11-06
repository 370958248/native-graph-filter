'use strict';
const {Plugin,Dialog,showMessage}=require('siyuan');
const Core=require('./filter'),Bridge=require('./bridge'),UI=require('./ui');
module.exports=class NativeGraphFilter extends Plugin{
  async onload(){
    this.settings=Core.empty();this.active=true;this.connectStatus={connected:false};
    try{const saved=await this.loadData('filters.json');if(saved)this.settings=Core.normalize(saved);}catch(e){showMessage('全局关系过滤设置未能读取：'+(e.message||e.msg||String(e)),7000,'error');this.settings={...Core.empty(),enabled:false};}
    if(!this.active)return;
    this.addIcons('<symbol id="iconNativeGraphFilter" viewBox="0 0 32 32"><path d="M3 5h26v3L19 19v8l-6-3v-5L3 8V5zm4 3 9 9 9-9H7z"/></symbol>');
    this.bridge=Bridge.create({core:Core,getSettings:()=>this.settings,openSettings:()=>this.openSetting(),onStatus:s=>{this.connectStatus=s;}});
    this.addCommand({langKey:'openNativeGraphFilter',langText:'设置全局关系过滤',callback:()=>this.openSetting()});
    this.scan=()=>{if(!this.active)return;try{this.bridge.scan(window.siyuan);}catch(e){this.connectStatus={connected:false,error:e.message};}};
    this.schedule=()=>{if(this.scanTimer||!this.active)return;this.scanTimer=setTimeout(()=>{this.scanTimer=null;this.scan();},80);};
    this.observer=new MutationObserver(this.schedule);this.observer.observe(document.body,{childList:true,subtree:true});
    this.interval=setInterval(this.scan,1500);this.scan();
  }
  onLayoutReady(){this.addTopBar({icon:'iconNativeGraphFilter',title:'全局关系过滤',position:'right',callback:()=>this.openSetting()});this.scan?.();}
  openSetting(){if(this.bridge)UI.open(this,{Dialog,showMessage});}
  async api(path,data){
    if(!['/api/notebook/lsNotebooks','/api/filetree/listDocsByPath'].includes(path))throw Error('不支持的目录接口');
    const response=await fetch(path,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)});
    if(!response.ok)throw Error('目录读取失败：HTTP '+response.status);
    const result=await response.json();if(result.code!==0)throw Error(result.msg||'目录读取失败');return result.data||{};
  }
  async saveSettings(value){
    if(this.saving)throw Error('设置正在保存，请稍后再试');this.saving=true;
    let timer;
    try{
      const next=Core.normalize(value);
      const result=await Promise.race([this.saveData('filters.json',next),new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('思源未确认保存，请检查连接后重新打开窗口')),12000);})]);
      if(!result||result.code!==0)throw Error(result?.msg||'思源没有返回保存成功的确认');
      if(!this.active)return;this.settings=next;this.bridge.refresh();
    }
    catch(e){throw Error('设置未能确认保存，当前仍使用原来的过滤范围：'+(e.message||e.msg||String(e)));}finally{clearTimeout(timer);this.saving=false;}
  }
  onunload(){this.active=false;clearTimeout(this.scanTimer);clearInterval(this.interval);this.observer?.disconnect();this.filterDialog?.destroy();this.bridge?.destroy();}
};
