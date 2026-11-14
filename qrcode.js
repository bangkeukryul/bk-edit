/*! qrcode.js — QR 그리기만 (BK에딧 나눠 주기용 · shorts/qr.js에서 QR 만드는 부분만 가져옴) */
(function(){
'use strict';

/* ═════════ QR 만들기 (바이트 모드 · 오류 보정 M · 1~40형) ═════════ */
var ECC_M=[-1,10,16,26,18,24,16,18,22,22,26,30,22,22,24,24,28,28,26,26,26,26,28,28,28,28,28,28,28,28,28,28,28,28,28,28,28,28,28,28,28];
var BLK_M=[-1,1,1,1,2,2,4,4,4,5,5,5,8,9,9,10,10,11,13,14,16,17,17,18,20,21,23,25,26,28,29,31,33,35,37,38,40,43,45,47,49];
function rawModules(v){var r=(16*v+128)*v+64;if(v>=2){var n=Math.floor(v/7)+2;r-=(25*n-10)*n-55;if(v>=7)r-=36}return r}
function dataCodewords(v){return Math.floor(rawModules(v)/8)-ECC_M[v]*BLK_M[v]}
function gfMul(x,y){var z=0;for(var i=7;i>=0;i--){z=(z<<1)^((z>>>7)*0x11D);z^=((y>>>i)&1)*x}return z&255}
function rsDivisor(deg){var r=[];for(var i=0;i<deg-1;i++)r.push(0);r.push(1);var root=1;
 for(var i=0;i<deg;i++){for(var j=0;j<r.length;j++){r[j]=gfMul(r[j],root);if(j+1<r.length)r[j]^=r[j+1]}root=gfMul(root,2)}return r}
function rsRemainder(data,div){var r=div.map(function(){return 0});
 data.forEach(function(b){var f=b^r.shift();r.push(0);div.forEach(function(c,i){r[i]^=gfMul(c,f)})});return r}
function alignPos(v,size){if(v===1)return [];var n=Math.floor(v/7)+2,step=v===32?26:Math.ceil((v*4+4)/(n*2-2))*2,r=[6];
 for(var p=size-7;r.length<n;p-=step)r.splice(1,0,p);return r}

function encode(text){
 var bytes=Array.prototype.slice.call(new TextEncoder().encode(text)),v,cap;
 for(v=1;v<=40;v++){cap=dataCodewords(v)*8;if(4+(v<10?8:16)+bytes.length*8<=cap)break}
 if(v>40)throw new Error('주소가 너무 길어요');
 /* 데이터 비트 */
 var bits=[];function put(val,len){for(var i=len-1;i>=0;i--)bits.push((val>>>i)&1)}
 put(4,4);put(bytes.length,v<10?8:16);bytes.forEach(function(b){put(b,8)});
 put(0,Math.min(4,cap-bits.length));put(0,(8-bits.length%8)%8);
 for(var pad=0xEC;bits.length<cap;pad^=0xEC^0x11)put(pad,8);
 var data=[];for(var i=0;i<bits.length;i+=8){var b=0;for(var j=0;j<8;j++)b=(b<<1)|bits[i+j];data.push(b)}
 /* 오류 보정 + 섞기 */
 var nb=BLK_M[v],el=ECC_M[v],raw=Math.floor(rawModules(v)/8),nShort=nb-raw%nb,sLen=Math.floor(raw/nb),div=rsDivisor(el),blocks=[],k=0;
 for(var i=0;i<nb;i++){var d=data.slice(k,k+sLen-el+(i<nShort?0:1));k+=d.length;var e=rsRemainder(d,div);if(i<nShort)d.push(0);blocks.push(d.concat(e))}
 var cw=[];for(var i=0;i<blocks[0].length;i++)for(var j=0;j<nb;j++)if(i!==sLen-el||j>=nShort)cw.push(blocks[j][i]);
 /* 판 그리기 */
 var size=v*4+17,M=[],F=[];for(var y=0;y<size;y++){M.push(new Array(size).fill(false));F.push(new Array(size).fill(false))}
 function fn(x,y,dark){M[y][x]=dark;F[y][x]=true}
 for(var i=0;i<size;i++){fn(6,i,i%2===0);fn(i,6,i%2===0)}
 [[3,3],[size-4,3],[3,size-4]].forEach(function(c){for(var dy=-4;dy<=4;dy++)for(var dx=-4;dx<=4;dx++){var x=c[0]+dx,y=c[1]+dy,dist=Math.max(Math.abs(dx),Math.abs(dy));
  if(x>=0&&x<size&&y>=0&&y<size)fn(x,y,dist!==2&&dist!==4)}});
 var ap=alignPos(v,size);ap.forEach(function(a,i){ap.forEach(function(b,j){if((i===0&&j===0)||(i===0&&j===ap.length-1)||(i===ap.length-1&&j===0))return;
  for(var dy=-2;dy<=2;dy++)for(var dx=-2;dx<=2;dx++)fn(a+dx,b+dy,Math.max(Math.abs(dx),Math.abs(dy))!==1)})});
 function formatBits(mask){var d=(0<<3)|mask,r=d;for(var i=0;i<10;i++)r=(r<<1)^((r>>>9)*0x537);var b=((d<<10)|r)^0x5412;
  function g(i){return ((b>>>i)&1)!==0}
  for(var i=0;i<=5;i++)fn(8,i,g(i));fn(8,7,g(6));fn(8,8,g(7));fn(7,8,g(8));for(var i=9;i<15;i++)fn(14-i,8,g(i));
  for(var i=0;i<8;i++)fn(size-1-i,8,g(i));for(var i=8;i<15;i++)fn(8,size-15+i,g(i));fn(8,size-8,true)}
 formatBits(0);
 if(v>=7){var r=v;for(var i=0;i<12;i++)r=(r<<1)^((r>>>11)*0x1F25);var vb=(v<<12)|r;
  for(var i=0;i<18;i++){var bit=((vb>>>i)&1)!==0,a=size-11+i%3,c=Math.floor(i/3);fn(a,c,bit);fn(c,a,bit)}}
 var n=0;for(var right=size-1;right>=1;right-=2){if(right===6)right=5;
  for(var vert=0;vert<size;vert++)for(var j=0;j<2;j++){var x=right-j,up=((right+1)&2)===0,y=up?size-1-vert:vert;
   if(!F[y][x]&&n<cw.length*8){M[y][x]=((cw[n>>>3]>>>(7-(n&7)))&1)!==0;n++}}}
 /* 가리개 8가지 중 가장 읽기 좋은 것 */
 function maskOn(m,x,y){switch(m){case 0:return (x+y)%2===0;case 1:return y%2===0;case 2:return x%3===0;case 3:return (x+y)%3===0;
  case 4:return (Math.floor(x/3)+Math.floor(y/2))%2===0;case 5:return x*y%2+x*y%3===0;case 6:return (x*y%2+x*y%3)%2===0;default:return ((x+y)%2+x*y%3)%2===0}}
 function apply(m){for(var y=0;y<size;y++)for(var x=0;x<size;x++)if(!F[y][x]&&maskOn(m,x,y))M[y][x]=!M[y][x]}
 function runPen(a){var p=0,run=1;for(var i=1;i<a.length;i++){if(a[i]===a[i-1])run++;else{if(run>=5)p+=run-2;run=1}}if(run>=5)p+=run-2;return p}
 function penalty(){var p=0,dark=0;
  for(var i=0;i<size;i++){p+=runPen(M[i]);p+=runPen(M.map(function(r){return r[i]}))}
  for(var y=0;y<size-1;y++)for(var x=0;x<size-1;x++){var c=M[y][x];if(c===M[y][x+1]&&c===M[y+1][x]&&c===M[y+1][x+1])p+=3}
  for(var y=0;y<size;y++)for(var x=0;x<size;x++)if(M[y][x])dark++;
  return p+Math.floor(Math.abs(dark*20-size*size*10)/(size*size))*10}
 var best=0,bestP=Infinity;for(var m=0;m<8;m++){apply(m);formatBits(m);var pp=penalty();if(pp<bestP){bestP=pp;best=m}apply(m)}
 apply(best);formatBits(best);
 return {size:size,version:v,dark:function(x,y){return M[y][x]}}}

window.BKQR={encode:encode};
})();
