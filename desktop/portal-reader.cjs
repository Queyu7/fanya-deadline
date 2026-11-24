const {isPortalURL}=require('./portal.cjs');

function createPortalReader(contents,script){
  let generation=0,committed=false,failure=null;
  const waiting={type:'waiting'};
  contents.on('did-start-navigation',details=>{
    if(details.isMainFrame && !details.isSameDocument){committed=false;failure=null;}
  });
  contents.on('did-navigate',(_event,_url,status)=>{committed=true;failure=status>=400?status:null;});
  contents.on('did-fail-load',(_event,code,_reason,_url,main)=>{if(main && code!==-3)failure=code;});
  function go(url){
    if(!isPortalURL(url))throw new Error('不支持的课程域名');
    const current=++generation;committed=false;failure=null;
    contents.loadURL(url).catch(error=>{
      if(current!==generation || committed || error.code==='ERR_ABORTED' || error.errno===-3)return;
      failure=Number.isInteger(error.errno)?error.errno:0;
    });
  }
  async function probe(expected,inspection=script){
    if(failure!==null)return {type:'network',code:failure};
    if(!committed)return waiting;
    const current=generation;
    let main,child;
    try {
      main=contents.mainFrame;
      if(!isPortalURL(main.url))return {type:'unsupported'};
      const directory=expected==='courses';
      child=main.frames.find(frame=>!frame.detached && isPortalURL(frame.url) &&
        (directory?frame.name==='frame_content' && /\/visit\/interaction\/?$/.test(new URL(frame.url).pathname):
          frame.name==='frame_content-zy' && /\/work\/list\/?$/.test(new URL(frame.url).pathname)));
      const frame=child||main,originalURL=frame.url;
      const page=await frame.executeJavaScript(inspection);
      return current===generation && committed && !frame.detached && frame.url===originalURL && page?page:waiting;
    } catch(error){
      if(!committed || main?.detached || child?.detached || /disposed|destroyed|navigat|detached/i.test(error.message))return waiting;
      throw new Error('无法读取课程页面内容');
    }
  }
  return {go,probe};
}
module.exports={createPortalReader};
