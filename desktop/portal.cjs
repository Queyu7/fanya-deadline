const home='https://i.mooc.chaoxing.com/space/index';
const loginURL=new URL('https://passport2.chaoxing.com/login');
loginURL.search=new URLSearchParams({fid:'12',refer:home,space:'2'}).toString();
function isLegacyReturn(value){
  try{const url=new URL(value);return url.origin==='http://i.mooc.chaoxing.com' && url.pathname==='/space/index' && !url.username && !url.password;}catch{return false;}
}
function isPortalURL(value){
  try{const url=new URL(value);return url.protocol==='https:' && /(^|\.)chaoxing\.com$/.test(url.hostname) && !url.port && !url.username && !url.password;}catch{return false;}
}
module.exports={home,loginURL:loginURL.href,isLegacyReturn,isPortalURL};
