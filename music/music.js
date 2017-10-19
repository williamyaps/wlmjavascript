(function(){var hasFrame=window.parent!=window,scripts=document.getElementsByTagName('script'),current=scripts[scripts.length-1],config=current.getAttribute('data-config'),head=document.getElementsByTagName("head")[0],dest=location.href.replace(/scmplayer\=true/g,'scmplayer=false'),destHost=dest.substr(0,dest.indexOf('/',10)),scm=current.getAttribute('src').replace('scmplayer.net','scmplayer.co').replace(/script\.js.*/g,'scm.html')+'#'+dest,scmHost=scm.substr(0,scm.indexOf('/',10)),isOutside=!hasFrame||lo
argStr=(key.match(/(play|queue)/)?'new Song(':'(')+
JSON.stringify(arg)+')';postMessage('SCM.'+key+'('+argStr+')');}};for(var i=0;i<keys.length;i++){var key=keys[i];obj[key]=post(key);}},postConfig=function(config){if(!isOutside)
postMessage('SCM.config('+config+')');},addEvent=function(elm,evType,fn){if(elm.addEventListener)
elm.addEventListener(evType,fn);else if(elm.attachEvent)
elm.attachEvent('on'+ evType,fn);else
elm['on'+ evType]=fn;},isIE=(function(){var undef,v=3,div=document.createElement('div'),all=div.getElementsByTagName('i');while(div.innerHTML='<!--[if gt IE '+(++v)+']><i></i><![endif]-->',all[0]);return v>4?v:undef;})(),isMobile=navigator.userAgent.matc
if(isOutside)outside();else inside();},outside=function(){var css='html,body{overflow:hidden;} body{margin:0;padding:0;border:0;} img,a,embed,object,div,address,table,iframe,p,span,form,header,section,footer{ display:none;border:0;margin:0;padding:0; }  
return window.innerHeight;else if(document.documentElement&&document.documentElement.clientHeight)
return document.documentElement.clientHeight;else if(document.body&&document.body.clientHeight)
return document.body.clientHeight;})();};addEvent(window,'load',function(){setTimeout(function(){while(document.body.firstChild!=scmframe)
document.body.removeChild(document.body.firstChild);while(document.body.lastChild!=scmframe)
document.body.removeChild(document.body.lastChild);resize();},0);});addEvent(window,'resize',resize);var getPath=function(){return location.href.replace(/#.*/,'');},path=getPath(),hash=location.hash;setInterval(function(){if(getPath()!=path){path=getPath
if(location.hash!=hash){hash=location.hash;window.scminside.location.hash=hash;}},100);},inside=function(){window.top.document.title=document.title;var filter=function(host){host=host.replace(/blogspot.[a-z.]*/i,'blogspot.com');host=host.replace(/^(http(
tar=tar.parentNode;if(tar.tagName.match(/^(a|area)$/i)&&!tar.href.match(/.(jpg|png)$/i)&&!tar.href.match(/^javascript:/)){if(tar.href.indexOf('#')==0){if(tar.href!="#"){window.top.scminside=window;window.top.location.hash=location.hash;e.preventDefault()
if(config)postConfig(config);SCM.init=postConfig;window.SCMMusicPlayer=window.SCMMusicPlayer||SCM;window.SCM=window.SCM||SCM;})();
