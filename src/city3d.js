const BLOCK = 280;
const STREET = 54;
const FOG_COLOR = [0.035, 0.075, 0.12];

const hex = (value) => [
  ((value >> 16) & 255) / 255,
  ((value >> 8) & 255) / 255,
  (value & 255) / 255
];

function shader(gl, type, source) {
  const result = gl.createShader(type);
  gl.shaderSource(result, source);
  gl.compileShader(result);
  if (!gl.getShaderParameter(result, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(result));
  return result;
}

function normalize(v) {
  const length = Math.hypot(...v) || 1;
  return v.map((value) => value / length);
}

function cross(a, b) {
  return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
}

function dot(a, b) { return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]; }

function perspective(fov, aspect, near, far) {
  const f = 1 / Math.tan(fov / 2), range = 1 / (near - far);
  return new Float32Array([
    f / aspect, 0, 0, 0,
    0, f, 0, 0,
    0, 0, (far + near) * range, -1,
    0, 0, 2 * far * near * range, 0,
  ]);
}

function viewMatrix(eye, target) {
  const z = normalize([eye[0] - target[0], eye[1] - target[1], eye[2] - target[2]]);
  const x = normalize(cross([0, 1, 0], z));
  const y = cross(z, x);
  return new Float32Array([
    x[0], y[0], z[0], 0,
    x[1], y[1], z[1], 0,
    x[2], y[2], z[2], 0,
    -dot(x, eye), -dot(y, eye), -dot(z, eye), 1,
  ]);
}

function multiply(a, b) {
  const out = new Float32Array(16);
  for (let column = 0; column < 4; column++) for (let row = 0; row < 4; row++) {
    out[column * 4 + row] = a[row] * b[column * 4] + a[4 + row] * b[column * 4 + 1] + a[8 + row] * b[column * 4 + 2] + a[12 + row] * b[column * 4 + 3];
  }
  return out;
}

const colorLerp = (a, b, t) => a.map((value, index) => value * (1 - t) + b[index] * t);
const hash = (x, z, salt = 0) => {
  let value = Math.imul(x + salt * 31, 374761393) + Math.imul(z - salt * 17, 668265263);
  value = Math.imul(value ^ (value >>> 13), 1274126177);
  return ((value ^ (value >>> 16)) >>> 0) / 4294967295;
};

function appendQuad(vertices, a, b, c, d, color) {
  for (const point of [a,b,c,a,c,d]) vertices.push(point[0],point[1],point[2],color[0],color[1],color[2]);
}

export function billboardBasis(camera, center) {
  const normal=normalize([camera[0]-center[0],camera[1]-center[1],camera[2]-center[2]]);
  let right=cross([0,1,0],normal);
  if(Math.hypot(...right)<1e-5)right=[1,0,0];else right=normalize(right);
  return {right,up:normalize(cross(normal,right)),normal};
}

function billboardPoint(center,right,up,x,y) {
  return [center[0]+right[0]*x+up[0]*y,center[1]+right[1]*x+up[1]*y,center[2]+right[2]*x+up[2]*y];
}

function appendBillboardRect(vertices,center,right,up,x,y,width,height,color) {
  const halfWidth=width/2,halfHeight=height/2;
  appendQuad(vertices,
    billboardPoint(center,right,up,x-halfWidth,y-halfHeight),
    billboardPoint(center,right,up,x+halfWidth,y-halfHeight),
    billboardPoint(center,right,up,x+halfWidth,y+halfHeight),
    billboardPoint(center,right,up,x-halfWidth,y+halfHeight),color);
}

function appendTriangle(vertices,a,b,c,color) {
  for(const point of [a,b,c])vertices.push(point[0],point[1],point[2],color[0],color[1],color[2]);
}

function billboardHexPoints(center,right,up,x,y,radiusX,radiusY) {
  return Array.from({length:6},(_,index)=>{
    const angle=Math.PI/6+index*Math.PI/3;
    return billboardPoint(center,right,up,x+Math.cos(angle)*radiusX,y+Math.sin(angle)*radiusY);
  });
}

function appendBillboardHex(vertices,center,right,up,x,y,radiusX,radiusY,color) {
  const points=billboardHexPoints(center,right,up,x,y,radiusX,radiusY),middle=billboardPoint(center,right,up,x,y);
  for(let index=0;index<6;index++)appendTriangle(vertices,middle,points[index],points[(index+1)%6],color);
}

function appendGradientQuad(vertices, a, b, c, d, lower, upper) {
  for (const [point, color] of [[a,lower],[b,lower],[c,upper],[a,lower],[c,upper],[d,upper]]) {
    vertices.push(point[0],point[1],point[2],color[0],color[1],color[2]);
  }
}

function appendGlowVertex(vertices, point, color, alpha) {
  vertices.push(point[0],point[1],point[2],color[0],color[1],color[2],alpha);
}

function appendGlowQuad(vertices, a, b, c, d, lowerColor, upperColor, lowerAlpha, upperAlpha) {
  for (const [point,color,alpha] of [[a,lowerColor,lowerAlpha],[b,lowerColor,lowerAlpha],[c,upperColor,upperAlpha],[a,lowerColor,lowerAlpha],[c,upperColor,upperAlpha],[d,upperColor,upperAlpha]]) appendGlowVertex(vertices,point,color,alpha);
}

function appendGlowTriangle(vertices,a,b,c,color,alpha) {
  for(const point of [a,b,c])appendGlowVertex(vertices,point,color,alpha);
}

function appendGlowBillboardHex(vertices,center,right,up,x,y,radiusX,radiusY,color,alpha) {
  const points=billboardHexPoints(center,right,up,x,y,radiusX,radiusY),middle=billboardPoint(center,right,up,x,y);
  for(let index=0;index<6;index++)appendGlowTriangle(vertices,middle,points[index],points[(index+1)%6],color,alpha);
}

function appendGlowBillboardRect(vertices,center,right,up,x,y,width,height,color,alpha) {
  const halfWidth=width/2,halfHeight=height/2;
  appendGlowQuad(vertices,
    billboardPoint(center,right,up,x-halfWidth,y-halfHeight),
    billboardPoint(center,right,up,x+halfWidth,y-halfHeight),
    billboardPoint(center,right,up,x+halfWidth,y+halfHeight),
    billboardPoint(center,right,up,x-halfWidth,y+halfHeight),color,color,alpha,alpha);
}

export function lootSignGlyph(drop) {
  if(drop.itemKind==='active')return 'weapon';
  if(drop.kind==='kit'&&drop.itemId==='shieldKit')return 'shield-kit';
  if(drop.kind==='kit')return 'repair-kit';
  return 'passive-chip';
}

export function lootSignWorldCenter(camera,drop,bob=0) {
  const anchor=[drop.x,drop.signHeight??drop.pickupHeight+260,drop.y+bob],right=billboardBasis(camera,anchor).right;
  return anchor.map((value,index)=>value+right[index]*54);
}

function appendLootSignIcon(vertices,drop,center,right,up,color) {
  const glyph=lootSignGlyph(drop);
  if(glyph==='weapon') {
    for(const [x,y,w,h] of [[0,0,25,11],[-5,-9,7,10],[17,3,16,3],[5,8,8,2]])appendBillboardRect(vertices,center,right,up,x,y,w,h,color);
  } else if(glyph==='passive-chip') {
    appendBillboardHex(vertices,center,right,up,0,0,14,12,color);
    for(const [x,y,w,h] of [[-14,0,6,2],[14,0,6,2],[0,13,2,5],[0,-13,2,5],[-6,0,2,8],[6,0,2,8]])appendBillboardRect(vertices,center,right,up,x,y,w,h,color);
  } else if(glyph==='shield-kit') {
    appendBillboardHex(vertices,center,right,up,0,0,12,15,color);
    appendBillboardRect(vertices,center,right,up,0,0,3,14,colorLerp(color,hex(0x06111b),.35));
    appendBillboardRect(vertices,center,right,up,0,0,13,3,colorLerp(color,hex(0x06111b),.35));
  } else {
    appendBillboardRect(vertices,center,right,up,0,0,5,20,color);
    appendBillboardRect(vertices,center,right,up,0,0,20,5,color);
  }
}

function appendGlowLootSignIcon(vertices,drop,center,right,up,color,alpha) {
  const glyph=lootSignGlyph(drop);
  if(glyph==='passive-chip'||glyph==='shield-kit')appendGlowBillboardHex(vertices,center,right,up,0,0,glyph==='passive-chip'?14:12,glyph==='passive-chip'?12:15,color,alpha);
  const rects=glyph==='weapon'?[[0,0,25,11],[-5,-9,7,10],[17,3,16,3],[5,8,8,2]]:glyph==='passive-chip'?[[-14,0,6,2],[14,0,6,2],[0,13,2,5],[0,-13,2,5],[-6,0,2,8],[6,0,2,8]]:glyph==='shield-kit'?[[0,0,3,14],[0,0,13,3]]:[[0,0,5,20],[0,0,20,5]];
  for(const [x,y,w,h] of rects)appendGlowBillboardRect(vertices,center,right,up,x,y,w,h,color,alpha);
}

function appendGlowPrism(vertices, x, z, profiles, color, sides=8, tint=hex(0x09131c)) {
  for(let band=0;band<profiles.length-1;band++) {
    const low=profiles[band],high=profiles[band+1];
    for(let side=0;side<sides;side++) {
      const a=side*Math.PI*2/sides-Math.PI/8,b=(side+1)*Math.PI*2/sides-Math.PI/8;
      const lowerA=[x+Math.cos(a)*low.radius,low.y,z+Math.sin(a)*low.radius];
      const lowerB=[x+Math.cos(b)*low.radius,low.y,z+Math.sin(b)*low.radius];
      const upperB=[x+Math.cos(b)*high.radius,high.y,z+Math.sin(b)*high.radius];
      const upperA=[x+Math.cos(a)*high.radius,high.y,z+Math.sin(a)*high.radius];
      const face=side%2?.78:1;
      const bottomColor=colorLerp(tint,color,.62*face),topColor=colorLerp(color,hex(0xffffff),.36*face);
      appendGlowQuad(vertices,lowerA,lowerB,upperB,upperA,bottomColor,topColor,low.alpha,high.alpha);
    }
  }
}

function appendGlowBeam(vertices,x,z,profiles,color) {
  const corners=[[-1,-1],[1,-1],[1,1],[-1,1]];
  for(let band=0;band<profiles.length-1;band++) {
    const low=profiles[band],high=profiles[band+1];
    for(let side=0;side<4;side++) {
      const a=corners[side],b=corners[(side+1)%4];
      const lowerA=[x+a[0]*low.radiusX,low.y,z+a[1]*low.radiusZ],lowerB=[x+b[0]*low.radiusX,low.y,z+b[1]*low.radiusZ];
      const upperB=[x+b[0]*high.radiusX,high.y,z+b[1]*high.radiusZ],upperA=[x+a[0]*high.radiusX,high.y,z+a[1]*high.radiusZ];
      const face=side===0?.95:side===1?.72:side===2?.5:.82;
      appendGlowQuad(vertices,lowerA,lowerB,upperB,upperA,colorLerp(hex(0x08111a),color,.76*face),colorLerp(color,hex(0xffffff),.56*face),low.alpha,high.alpha);
    }
  }
}

function appendGlowRing(vertices,x,y,z,inner,outer,color,alpha,sides=24) {
  for(let side=0;side<sides;side++) {
    const a=side*Math.PI*2/sides,b=(side+1)*Math.PI*2/sides;
    appendGlowQuad(vertices,[x+Math.cos(a)*inner,y,z+Math.sin(a)*inner],[x+Math.cos(a)*outer,y,z+Math.sin(a)*outer],[x+Math.cos(b)*outer,y,z+Math.sin(b)*outer],[x+Math.cos(b)*inner,y,z+Math.sin(b)*inner],color,color,alpha,alpha);
  }
}

function appendBox(vertices, x, y, z, w, h, d, palette) {
  const x0=x,x1=x+w,y0=y,y1=y+h,z0=z,z1=z+d;
  appendQuad(vertices,[x0,y1,z0],[x1,y1,z0],[x1,y1,z1],[x0,y1,z1],palette.top);
  appendQuad(vertices,[x0,y0,z1],[x1,y0,z1],[x1,y1,z1],[x0,y1,z1],palette.front);
  appendQuad(vertices,[x1,y0,z0],[x0,y0,z0],[x0,y1,z0],[x1,y1,z0],palette.back);
  appendQuad(vertices,[x1,y0,z1],[x1,y0,z0],[x1,y1,z0],[x1,y1,z1],palette.right);
  appendQuad(vertices,[x0,y0,z0],[x0,y0,z1],[x0,y1,z1],[x0,y1,z0],palette.left);
}

export class CityBackdrop {
  constructor(container, phaserCanvas) {
    this.canvas = document.createElement('canvas');
    this.canvas.id = 'city-3d';
    this.canvas.setAttribute('aria-hidden', 'true');
    this.canvas.width = 1200;
    this.canvas.height = 800;
    container.insertBefore(this.canvas, phaserCanvas);
    const gl = this.canvas.getContext('webgl', { alpha: true, antialias: true, depth: true, premultipliedAlpha: false });
    if (!gl) throw new Error('WebGL is unavailable for the 3D city backdrop');
    this.gl = gl;
    const program = gl.createProgram();
    gl.attachShader(program, shader(gl, gl.VERTEX_SHADER, `
      attribute vec3 aPosition;
      attribute vec3 aColor;
      uniform mat4 uViewProjection;
      varying vec3 vColor;
      varying float vDistance;
      void main() {
        vec4 viewPosition = uViewProjection * vec4(aPosition, 1.0);
        gl_Position = viewPosition;
        vColor = aColor;
        vDistance = abs(viewPosition.w);
      }
    `));
    gl.attachShader(program, shader(gl, gl.FRAGMENT_SHADER, `
      precision mediump float;
      varying vec3 vColor;
      varying float vDistance;
      void main() {
        float haze = smoothstep(1100.0, 3600.0, vDistance) * 0.7;
        gl_FragColor = vec4(mix(vColor, vec3(${FOG_COLOR.join(',')}), haze), 1.0);
      }
    `));
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(program));
    this.program = program;
    this.position = gl.getAttribLocation(program, 'aPosition');
    this.color = gl.getAttribLocation(program, 'aColor');
    this.matrix = gl.getUniformLocation(program, 'uViewProjection');
    this.buffer = gl.createBuffer();
    this.dynamicBuffer = gl.createBuffer();
    const glowProgram=gl.createProgram();
    gl.attachShader(glowProgram,shader(gl,gl.VERTEX_SHADER,`
      attribute vec3 aPosition;
      attribute vec3 aColor;
      attribute float aAlpha;
      uniform mat4 uViewProjection;
      varying vec3 vColor;
      varying float vAlpha;
      void main(){ gl_Position=uViewProjection*vec4(aPosition,1.0); vColor=aColor; vAlpha=aAlpha; }
    `));
    gl.attachShader(glowProgram,shader(gl,gl.FRAGMENT_SHADER,`
      precision mediump float;
      varying vec3 vColor;
      varying float vAlpha;
      void main(){ gl_FragColor=vec4(vColor,vAlpha); }
    `));
    gl.linkProgram(glowProgram);
    if(!gl.getProgramParameter(glowProgram,gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(glowProgram));
    this.glowProgram=glowProgram;
    this.glowPosition=gl.getAttribLocation(glowProgram,'aPosition');
    this.glowColor=gl.getAttribLocation(glowProgram,'aColor');
    this.glowAlpha=gl.getAttribLocation(glowProgram,'aAlpha');
    this.glowMatrix=gl.getUniformLocation(glowProgram,'uViewProjection');
    this.glowBuffer=gl.createBuffer();
    this.meshCenter = null;
    this.mesh = new Float32Array();
    this.viewProjection = null;
    this.referenceDepth = Math.hypot(1600, 620);
    this.actorTime = 0;
    this.actorAnchor = null;
    this.vehicles = [];
    this.people = [];
    this.loot = [];
    gl.enable(gl.DEPTH_TEST);
    gl.depthFunc(gl.LEQUAL);
    gl.disable(gl.CULL_FACE);
    gl.clearColor(...FOG_COLOR, 1);
    this.render(0, 0);
  }

  render(px, pz) {
    const gl = this.gl;
    const cx = Math.floor(px / BLOCK), cz = Math.floor(pz / BLOCK);
    if (!this.meshCenter || this.meshCenter[0] !== cx || this.meshCenter[1] !== cz) this.rebuild(cx, cz);
    const eye = this.cameraPosition = [px, 1600, pz + 620];
    const target = [px, 0, pz];
    const vp = this.viewProjection = multiply(perspective(55 * Math.PI / 180, 1200 / 800, 8, 6000), viewMatrix(eye, target));
    gl.viewport(0, 0, this.canvas.width, this.canvas.height);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.useProgram(this.program);
    gl.uniformMatrix4fv(this.matrix, false, vp);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.buffer);
    gl.enableVertexAttribArray(this.position);
    gl.vertexAttribPointer(this.position, 3, gl.FLOAT, false, 24, 0);
    gl.enableVertexAttribArray(this.color);
    gl.vertexAttribPointer(this.color, 3, gl.FLOAT, false, 24, 12);
    gl.drawArrays(gl.TRIANGLES, 0, this.mesh.length / 6);
    this.renderActors(px,pz);
    this.renderLootGlow();
  }

  setLoot(loot) { this.loot = loot; }

  project(x, z, y = 0) {
    const m=this.viewProjection;
    const clipX=m[0]*x+m[4]*y+m[8]*z+m[12], clipY=m[1]*x+m[5]*y+m[9]*z+m[13], clipW=m[3]*x+m[7]*y+m[11]*z+m[15];
    if(clipW<=1) return {x:0,y:0,scale:.5,visible:false};
    const ndcX=clipX/clipW, ndcY=clipY/clipW;
    return {x:(ndcX*.5+.5)*1200,y:(1-(ndcY*.5+.5))*800,scale:Math.max(.42,Math.min(1.45,this.referenceDepth/clipW)),visible:Math.abs(ndcX)<1.2&&Math.abs(ndcY)<1.2};
  }

  projectLootSign(drop,bob=0) {
    const center=lootSignWorldCenter(this.cameraPosition,drop,bob);
    return this.project(center[0],center[2],center[1]);
  }

  personPosition(person) {
    const ix=person.gx*BLOCK, iz=person.gz*BLOCK;
    return {x:person.axis==='x'?ix-42+person.progress:ix+person.side*42,z:person.axis==='z'?iz-42+person.progress:iz+person.side*42};
  }

  seedActors(px,pz) {
    const gx=Math.round(px/BLOCK),gz=Math.round(pz/BLOCK);
    const carOffsets=[[-1,-1.8],[-1,.5],[0,1.8],[1,-.6],[1,1.1],[-2,.9]];
    this.vehicles=carOffsets.map(([line,along],i)=>{
      const axis=i<4?'z':'x',direction=i%2?1:-1,lane=i%2?13:-13;
      return {axis,direction,lane,color:hex([0x4a9299,0x9a754e,0x4d7195,0x8e557e,0x397d7a,0x78694f][i]),x:axis==='z'?(gx+line)*BLOCK+lane:px+along*BLOCK,z:axis==='z'?pz+along*BLOCK:(gz+line)*BLOCK+lane,speed:48+(i%3)*18};
    });
    const pedOffsets=[[-3,-2],[-2,2],[-1,-1],[0,3],[1,-3],[2,1],[3,-1],[0,0]];
    this.people=pedOffsets.map(([dx,dz],i)=>({gx:gx+dx,gz:gz+dz,axis:i%2?'x':'z',side:i%4<2?-1:1,progress:hash(gx+dx,gz+dz,i)*76,direction:i%2?1:-1,wait:hash(gx,gz,i+13)*1.7,color:hex([0x46c3c2,0xe3b76d,0xd06bb0,0x7ba5d6,0xc2cbd0,0x89c477,0xe08a71,0x66b3d0][i])}));
    this.actorAnchor=[px,pz];
  }

  renderActors(px,pz) {
    const gl=this.gl, vertices=[], dim=hex(0x152a34), body=hex(0x2b6270), window=hex(0x79d3d1), lamp=hex(0xffd392);
    if(!this.actorAnchor||Math.abs(px-this.actorAnchor[0])>BLOCK*4||Math.abs(pz-this.actorAnchor[1])>BLOCK*4)this.seedActors(px,pz);
    const dt=Math.min(this.lastDelta??16,40)/1000; this.actorTime+=dt;
    for(const car of this.vehicles) {
      if(car.axis==='z') {
        car.z+=car.direction*car.speed*dt;
        if(car.z>pz+BLOCK*7)car.z=pz-BLOCK*7;
        if(car.z<pz-BLOCK*7)car.z=pz+BLOCK*7;
        if(Math.abs(car.x-px)>BLOCK*6)car.x=Math.round(px/BLOCK)*BLOCK+car.lane;
      } else {
        car.x+=car.direction*car.speed*dt;
        if(car.x>px+BLOCK*7)car.x=px-BLOCK*7;
        if(car.x<px-BLOCK*7)car.x=px+BLOCK*7;
        if(Math.abs(car.z-pz)>BLOCK*6)car.z=Math.round(pz/BLOCK)*BLOCK+car.lane;
      }
      const alongZ=car.axis==='z', w=alongZ?15:27, d=alongZ?27:15, x=car.x-w/2,z=car.z-d/2;
      appendQuad(vertices,[x,1,z],[x+w,1,z],[x+w,1,z+d],[x,1,z+d],hex(0x07121a));
      appendBox(vertices,x,2,z,w,6,d,{top:colorLerp(dim,car.color,.34),front:colorLerp(body,car.color,.2),right:dim,left:body,back:dim});
      appendBox(vertices,x+w*.19,8,z+d*.22,w*.62,4,d*.52,{top:window,front:hex(0x20414d),right:hex(0x17313d),left:hex(0x1d3a46),back:hex(0x152b37)});
      const frontZ=car.direction>0?z+d:z-2, frontX=car.direction>0?x+w:x-2;
      if(alongZ) for(const offset of [.22,.68]) appendBox(vertices,x+w*offset,3,frontZ,2,2,2,lampBox(lamp));
      else for(const offset of [.22,.68]) appendBox(vertices,frontX,3,z+d*offset,2,2,2,lampBox(lamp));
    }
    for(const person of this.people) {
      person.progress+=person.direction*15*dt;
      if(person.wait>0){person.wait-=dt;person.progress-=person.direction*15*dt;}
      if(person.progress>84){person.progress=84;person.direction=-1;person.wait=.6+hash(person.gx,person.gz,4)*1.3;}
      if(person.progress<0){person.progress=0;person.direction=1;person.wait=.7+hash(person.gx,person.gz,5)*1.4;}
      const {x,z}=this.personPosition(person);
      const bob=Math.abs(Math.sin(this.actorTime*8+person.progress))*.8;
      const skin=hex(0xe4b996), shoe=hex(0x263444);
      appendQuad(vertices,[x-5,1,z-4],[x+5,1,z-4],[x+5,1,z+4],[x-5,1,z+4],hex(0x061018));
      appendBox(vertices,x-3,2,z-2,2,5,3,monochrome(shoe));
      appendBox(vertices,x+1,2,z-2,2,5,3,monochrome(shoe));
      appendBox(vertices,x-3,7+bob,z-3,6,11,6,{top:person.color,front:person.color,right:colorLerp(person.color,dim,.36),left:colorLerp(person.color,hex(0x6abec4),.18),back:dim});
      appendBox(vertices,x-2.5,18+bob,z-2.5,5,5,5,{top:skin,front:skin,right:colorLerp(skin,dim,.25),left:skin,back:dim});
    }
    for(const drop of this.loot) {
      const x=drop.x,z=drop.y,tint=hex(drop.tint),pulse=.86+Math.sin(this.actorTime*5+drop.phase)*.14;
      const core=colorLerp(hex(0x101927),tint,.82);
      appendBox(vertices,x-11,5,z-11,22,6,22,{top:core,front:colorLerp(core,hex(0x08111a),.38),right:colorLerp(core,hex(0x08111a),.55),left:colorLerp(core,hex(0x08111a),.25),back:colorLerp(core,hex(0x08111a),.45)});
      for(let side=0;side<8;side++) {
        const a=side*Math.PI*2/8,b=(side+1)*Math.PI*2/8,inner=20,outer=24;
        appendQuad(vertices,[x+Math.cos(a)*inner,5,z+Math.sin(a)*inner],[x+Math.cos(a)*outer,5,z+Math.sin(a)*outer],[x+Math.cos(b)*outer,5,z+Math.sin(b)*outer],[x+Math.cos(b)*inner,5,z+Math.sin(b)*inner],colorLerp(hex(0x101927),tint,.7*pulse));
      }
      // A camera-facing rectangular holo sign replaces the old floating diamond.
      const bob=Math.sin(this.actorTime*3.5+drop.phase)*4;
      const camera=[px,1600,pz+620],center=lootSignWorldCenter(camera,drop,bob),{right,up}=billboardBasis(camera,center);
      const frame=colorLerp(tint,hex(0xffffff),.2+pulse*.24),plate=colorLerp(hex(0x06111b),tint,.12);
      appendBillboardHex(vertices,center,right,up,0,0,38,28,plate);
      appendBillboardHex(vertices,center,right,up,0,0,35,25,frame);
      appendBillboardHex(vertices,center,right,up,0,0,32,22,plate);
      appendLootSignIcon(vertices,drop,center,right,up,frame);
    }
    gl.bindBuffer(gl.ARRAY_BUFFER,this.dynamicBuffer);
    gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(vertices),gl.DYNAMIC_DRAW);
    gl.vertexAttribPointer(this.position,3,gl.FLOAT,false,24,0);
    gl.vertexAttribPointer(this.color,3,gl.FLOAT,false,24,12);
    gl.drawArrays(gl.TRIANGLES,0,vertices.length/6);
    this.lastDelta=null;
  }

  renderLootGlow() {
    if(!this.loot.length) return;
    const gl=this.gl,vertices=[];
    for(const drop of this.loot) {
      const x=drop.x,z=drop.y,tint=hex(drop.tint),pulse=.82+Math.sin(this.actorTime*4.2+drop.phase)*.18;
      const rarity=drop.rarity??'common',height=rarity==='legendary'?1580:1480;
      const ringCount={common:0,rare:6,epic:9,legendary:0}[rarity]??0;
      const legendary=rarity==='legendary';
      if(legendary) {
        const fire=hex(0xff9d42),hot=hex(0xffe5a0);
        appendGlowBeam(vertices,x,z,[
          {y:5,radiusX:148,radiusZ:46,alpha:.1*pulse},
          {y:drop.pickupHeight,radiusX:86,radiusZ:28,alpha:.13*pulse},
          {y:height*.58,radiusX:52,radiusZ:17,alpha:.1*pulse},
          {y:height*.84,radiusX:30,radiusZ:10,alpha:.07*pulse},
          {y:height,radiusX:8,radiusZ:3,alpha:.012},
        ],fire);
        appendGlowBeam(vertices,x,z,[
          {y:8,radiusX:21,radiusZ:8,alpha:.72*pulse},
          {y:drop.pickupHeight,radiusX:13,radiusZ:5,alpha:.9*pulse},
          {y:height*.7,radiusX:9,radiusZ:4,alpha:.72*pulse},
          {y:height,radiusX:1.5,radiusZ:1,alpha:.12},
        ],hot);
        for(let tongue=0;tongue<4;tongue++) {
          const phase=this.actorTime*2.4+drop.phase+tongue*Math.PI*.5;
          const offsetX=Math.sin(phase)*11,offsetZ=Math.cos(phase*1.13)*7;
          const tip=height*(.72+((Math.sin(phase*1.7)+1)*.09));
          appendGlowPrism(vertices,x+offsetX,z+offsetZ,[
            {y:drop.pickupHeight*.72,radius:5,alpha:.3*pulse},
            {y:tip*.52,radius:10+Math.sin(phase)*2,alpha:.42*pulse},
            {y:tip,radius:1,alpha:.015},
          ],tongue%2?hot:fire,6,hex(0x2a1116));
        }
      }
      appendGlowBeam(vertices,x,z,[
        {y:5,radiusX:118,radiusZ:34,alpha:.06*pulse},
        {y:drop.pickupHeight,radiusX:74,radiusZ:22,alpha:.08*pulse},
        {y:height*.72,radiusX:42,radiusZ:14,alpha:.055*pulse},
        {y:height,radiusX:12,radiusZ:5,alpha:.018},
      ],tint);
      appendGlowBeam(vertices,x,z,[
        {y:8,radiusX:52,radiusZ:18,alpha:.2*pulse},
        {y:drop.pickupHeight,radiusX:34,radiusZ:12,alpha:.3*pulse},
        {y:height*.72,radiusX:19,radiusZ:7,alpha:.18*pulse},
        {y:height,radiusX:5,radiusZ:2.5,alpha:.045},
      ],colorLerp(tint,hex(0xffffff),.22));
      appendGlowBeam(vertices,x,z,[
        {y:10,radiusX:4,radiusZ:2.5,alpha:.72*pulse},
        {y:drop.pickupHeight,radiusX:3,radiusZ:2,alpha:.9*pulse},
        {y:height*.72,radiusX:2,radiusZ:1.5,alpha:.75*pulse},
        {y:height,radiusX:1,radiusZ:1,alpha:.25},
      ],colorLerp(tint,hex(0xffffff),.82));
      for(let band=0;band<ringCount;band++) {
        const fraction=ringCount===1?0:band/(ringCount-1),baseY=70+fraction*(height-140);
        const y=baseY+Math.sin(this.actorTime*1.6+drop.phase+band*.7)*4;
        const inner=18+(1-fraction)*22,outer=inner+10;
        const alpha=(.58+.16*Math.sin(this.actorTime*3+drop.phase+band*.8))*pulse;
        appendGlowRing(vertices,x,y,z,inner,outer,colorLerp(tint,hex(0xffffff),.3),alpha,28);
      }
      for(let mote=0;mote<4;mote++) {
        const phase=(this.actorTime*.24+drop.phase/(Math.PI*2)+mote*.27)%1;
        const y=80+phase*(height-160),angle=this.actorTime*1.1+drop.phase+mote*Math.PI*.5,radius=12+Math.sin(this.actorTime*2+mote)*5;
        const mx=x+Math.cos(angle)*radius,mz=z+Math.sin(angle)*radius,size=3+Math.sin(this.actorTime*5+mote)*1.2;
        appendGlowPrism(vertices,mx,mz,[{y:y-size*2,radius:size,alpha:.55*(1-phase*.45)},{y:y+size*2,radius:size*.35,alpha:.8*(1-phase*.45)}],colorLerp(tint,hex(0xffffff),.65),6);
      }
      const bob=Math.sin(this.actorTime*3.5+drop.phase)*4,center=lootSignWorldCenter(this.cameraPosition,drop,bob);
      const {right,up}=billboardBasis(this.cameraPosition,center),frame=colorLerp(tint,hex(0xffffff),.3+pulse*.25);
      appendGlowBillboardHex(vertices,center,right,up,0,0,42,32,frame,.1*pulse);
      appendGlowLootSignIcon(vertices,drop,center,right,up,frame,.82*pulse);
    }
    gl.useProgram(this.glowProgram);
    gl.uniformMatrix4fv(this.glowMatrix,false,this.viewProjection);
    gl.bindBuffer(gl.ARRAY_BUFFER,this.glowBuffer);
    gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(vertices),gl.DYNAMIC_DRAW);
    gl.enableVertexAttribArray(this.glowPosition);
    gl.vertexAttribPointer(this.glowPosition,3,gl.FLOAT,false,28,0);
    gl.enableVertexAttribArray(this.glowColor);
    gl.vertexAttribPointer(this.glowColor,3,gl.FLOAT,false,28,12);
    gl.enableVertexAttribArray(this.glowAlpha);
    gl.vertexAttribPointer(this.glowAlpha,1,gl.FLOAT,false,28,24);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA,gl.ONE);
    gl.depthMask(false);
    gl.drawArrays(gl.TRIANGLES,0,vertices.length/7);
    gl.depthMask(true);
    gl.disable(gl.BLEND);
  }

  rebuild(cx, cz) {
    const vertices = [];
    const push = (point, color) => vertices.push(point[0], point[1], point[2], color[0], color[1], color[2]);
    const tri = (a, b, c, color) => { push(a, color); push(b, color); push(c, color); };
    const quad = (a, b, c, d, color) => { tri(a, b, c, color); tri(a, c, d, color); };
    const box = (x, y, z, w, h, d, palette) => {
      const x0=x, x1=x+w, y0=y, y1=y+h, z0=z, z1=z+d;
      quad([x0,y1,z0],[x1,y1,z0],[x1,y1,z1],[x0,y1,z1],palette.top);
      quad([x0,y0,z1],[x1,y0,z1],[x1,y1,z1],[x0,y1,z1],palette.front);
      quad([x1,y0,z0],[x0,y0,z0],[x0,y1,z0],[x1,y1,z0],palette.back);
      quad([x1,y0,z1],[x1,y0,z0],[x1,y1,z0],[x1,y1,z1],palette.right);
      quad([x0,y0,z0],[x0,y0,z1],[x0,y1,z1],[x0,y1,z0],palette.left);
    };
    const block = 6;
    const startX = cx - block, endX = cx + block, startZ = cz - block - 1, endZ = cz + block + 2;
    const district = hex(0x101b2a), asphalt = hex(0x0b1420), curb = hex(0x31404d);
    for (let gx=startX; gx<endX; gx++) for(let gz=startZ; gz<endZ; gz++) {
      const x=gx*BLOCK, z=gz*BLOCK, variation=(hash(gx,gz)*.035);
      const ground=colorLerp(district,hex(0x192635),variation);
      quad([x,0,z],[x+BLOCK,0,z],[x+BLOCK,0,z+BLOCK],[x,0,z+BLOCK],ground);
    }

    // Straight, repeating avenues and cross streets make a legible city grid.
    for(let gx=startX; gx<=endX; gx++) {
      const x=gx*BLOCK;
      quad([x-STREET/2,.8,startZ*BLOCK],[x+STREET/2,.8,startZ*BLOCK],[x+STREET/2,.8,endZ*BLOCK],[x-STREET/2,.8,endZ*BLOCK],asphalt);
      quad([x-STREET/2,.95,startZ*BLOCK],[x-STREET/2+2,.95,startZ*BLOCK],[x-STREET/2+2,.95,endZ*BLOCK],[x-STREET/2,.95,endZ*BLOCK],hex(0x25717e));
      quad([x+STREET/2-2,.95,startZ*BLOCK],[x+STREET/2,.95,startZ*BLOCK],[x+STREET/2,.95,endZ*BLOCK],[x+STREET/2-2,.95,endZ*BLOCK],hex(0x72516c));
      for(let gz=startZ; gz<endZ; gz++) for(let dash=0;dash<4;dash++) {
        const dz=gz*BLOCK+48+dash*58;
        quad([x-1,1,dz],[x+1,1,dz],[x+1,1,dz+23],[x-1,1,dz+23],hex(0x778b90));
      }
    }
    for(let gz=startZ; gz<=endZ; gz++) {
      const z=gz*BLOCK;
      quad([startX*BLOCK,.8,z-STREET/2],[endX*BLOCK,.8,z-STREET/2],[endX*BLOCK,.8,z+STREET/2],[startX*BLOCK,.8,z+STREET/2],asphalt);
      quad([startX*BLOCK,.95,z-STREET/2],[endX*BLOCK,.95,z-STREET/2],[endX*BLOCK,.95,z-STREET/2+2],[startX*BLOCK,.95,z-STREET/2+2],hex(0x25717e));
      quad([startX*BLOCK,.95,z+STREET/2-2],[endX*BLOCK,.95,z+STREET/2-2],[endX*BLOCK,.95,z+STREET/2],[startX*BLOCK,.95,z+STREET/2],hex(0x72516c));
      for(let gx=startX; gx<endX; gx++) for(let dash=0;dash<4;dash++) {
        const dx=gx*BLOCK+48+dash*58;
        quad([dx,1,z-1],[dx+23,1,z-1],[dx+23,1,z+1],[dx,1,z+1],hex(0x778b90));
      }
    }
    // Four zebra crossings surround every junction, one on each street approach.
    for(let gx=startX;gx<=endX;gx++) for(let gz=startZ;gz<=endZ;gz++) {
      const ix=gx*BLOCK, iz=gz*BLOCK;
      for(let i=0;i<4;i++) {
        const offset=-24+i*13;
        for(const zSide of [-1,1]) {
          const z0=iz+zSide*(STREET/2+5);
          quad([ix+offset,1.2,z0],[ix+offset+6,1.2,z0],[ix+offset+6,1.2,z0+zSide*12],[ix+offset,1.2,z0+zSide*12],hex(0x83969a));
        }
        for(const xSide of [-1,1]) {
          const x0=ix+xSide*(STREET/2+5);
          quad([x0,1.2,iz+offset],[x0+xSide*12,1.2,iz+offset],[x0+xSide*12,1.2,iz+offset+6],[x0,1.2,iz+offset+6],hex(0x83969a));
        }
      }
    }

    const wallFront=[...hex(0x173246)], wallRight=[...hex(0x0d1d2c)], wallLeft=[...hex(0x102638)], roofBase=[...hex(0x2a3a48)];
    for(let gx=startX;gx<endX;gx++) for(let gz=startZ;gz<endZ;gz++) {
      const rx=hash(gx,gz,1), rz=hash(gx,gz,2), x=gx*BLOCK+STREET/2+16, z=gz*BLOCK+STREET/2+16;
        const available=BLOCK-STREET-32, count=1+(hash(gx,gz,3)>.78?1:0);
      for(let n=0;n<count;n++) {
        const seed=hash(gx,gz,n+4), w=available*(count===1 ? .55+rx*.34 : .34+seed*.16), d=available*(count===1 ? .52+rz*.36 : .31+hash(gx,gz,n+6)*.14);
        const bx=x+(available-w)*(count===1 ? .5 : seed), bz=z+(available-d)*(count===1 ? .5 : hash(gx,gz,n+7));
        const height=300+Math.floor(hash(gx,gz,n+9)*690), palette={
          top:colorLerp(roofBase,hex(n%2?0x3b4053:0x294958),seed*.45),
          front:colorLerp(wallFront,hex(0x214557),seed*.24), right:colorLerp(wallRight,hex(0x1b283e),seed*.24),
          left:colorLerp(wallLeft,hex(0x1b3542),seed*.18), back:hex(0x0a1724),
        };
        box(bx,0,bz,w,height,d,palette);
        // Dense, individually lit windows wrap the visible tower facades.
        const frontCols=Math.max(3,Math.floor(w/19)), sideCols=Math.max(3,Math.floor(d/19)), rows=Math.floor(height/31);
        for(let row=0;row<rows;row++) {
          const wy=15+row*31;
          for(let col=0;col<frontCols;col++) {
            const wx=bx+9+col*((w-18)/frontCols), light=hash(gx+col,gz+row,n+11);
            const windowColor=light>.76?hex(0xe7bd76):light>.47?hex(0x45bec5):hex(0x1d4b5a);
            const win=colorLerp(palette.front,windowColor,light>.47?.66:.36);
            quad([wx,wy,bz+d+.8],[wx+6,wy,bz+d+.8],[wx+6,wy+12,bz+d+.8],[wx,wy+12,bz+d+.8],win);
          }
          for(let col=0;col<sideCols;col++) {
            const wz=bz+8+col*((d-16)/sideCols), light=hash(gx+row,gz+col,n+17);
            const windowColor=light>.78?hex(0xe7bd76):light>.48?hex(0x45bec5):hex(0x1d4b5a);
            const win=colorLerp(palette.right,windowColor,light>.48?.65:.33);
            quad([bx+w+.8,wy,wz],[bx+w+.8,wy,wz+6],[bx+w+.8,wy+12,wz+6],[bx+w+.8,wy+12,wz],win);
          }
        }
        // Neon roof trims, rooftop machinery, and a small lit landing pad.
        const trim=n%2?hex(0x49cbd2):hex(0xd874c4);
        quad([bx, height+1,bz+d],[bx+w,height+1,bz+d],[bx+w,height+1,bz+d-2],[bx,height+1,bz+d-2],trim);
        const hvacW=Math.max(24,w*.24), hvacD=Math.max(24,d*.22);
        box(bx+w*.31,height+2,bz+d*.32,hvacW,18,hvacD,{top:hex(0x50606b),front:hex(0x263943),right:hex(0x1e303d),left:hex(0x334550),back:hex(0x1e303d)});
        if(seed>.35) {
          const hx=bx+w*.63, hz=bz+d*.63, hs=Math.min(28,w*.18,d*.18);
          quad([hx, height+1,hz],[hx+hs,height+1,hz],[hx+hs,height+1,hz+hs],[hx,height+1,hz+hs],hex(0x253d48));
          quad([hx+hs*.46,height+2,hz+hs*.46],[hx+hs*.54,height+2,hz+hs*.46],[hx+hs*.54,height+2,hz+hs*.54],[hx+hs*.46,height+2,hz+hs*.54],trim);
        }
        if(seed>.68) box(bx+w*.72,height+2,bz+d*.72,3,35+seed*40,3,{top:trim,front:trim,right:trim,left:trim,back:trim});
      }
    }
    this.mesh = new Float32Array(vertices);
    this.meshCenter = [cx,cz];
    this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.buffer);
    this.gl.bufferData(this.gl.ARRAY_BUFFER, this.mesh, this.gl.STATIC_DRAW);
  }

  update(px, pz, delta=16) { this.lastDelta=delta; this.render(px, pz); }
}

function lampBox(color) { return {top:color,front:color,right:color,left:color,back:color}; }

function monochrome(color) { return {top:color,front:color,right:color,left:color,back:color}; }
