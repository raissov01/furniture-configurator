import type { BzNode } from '../../src/core/import/basisBz'
const marker = Buffer.from([1,0,0,255,0])
const u32 = (n:number) => { const b=Buffer.alloc(4);b.writeUInt32LE(n);return b }
const f64 = (n:number) => { const b=Buffer.alloc(8);b.writeDoubleLE(n);return b }
function segment(root:BzNode):Buffer {
 const names:string[]=[]
 const walk=(n:BzNode)=>{if(n.key&&!names.includes(n.key))names.push(n.key);if(n.type==='object')n.children.forEach(walk)}
 walk(root)
 const node=(n:BzNode):Buffer=>{
  let type=0, payload=Buffer.alloc(0), count=0
  if(n.type==='object'){count=n.children.length; payload=Buffer.concat(n.children.map(node))}
  else if(n.type==='bool')type=n.value?1:2
  else if(n.type==='int'){type=4;payload=Buffer.alloc(4);payload.writeInt32LE(n.value)}
  else if(n.type==='float'||n.type==='datetime'){type=n.type==='float'?5:9;payload=f64(n.value)}
  else if(n.type==='string'){type=6;const b=Buffer.from(n.value,'utf16le');payload=Buffer.concat([u32(b.length/2),b])}
  else if(n.type==='blob'){type=7;payload=Buffer.concat([u32(n.value.length),n.value])}
  else if(n.type==='nested'){type=6;let b=Buffer.concat([marker,segment(n.value)]);if(b.length%2)b=Buffer.concat([b,Buffer.from([0])]);payload=Buffer.concat([u32(b.length/2),b])}
  else type=8
  return Buffer.concat([u32(n.key?names.indexOf(n.key):0xffffffff),u32(count),Buffer.from([type]),payload])
 }
 return Buffer.concat([u32(names.length),...names.map(n=>{const b=Buffer.from(n,'latin1');return Buffer.concat([u32(b.length),b])}),node(root)])
}

export function writeBasisContainer(header: BzNode, document: BzNode): Uint8Array {
 return Buffer.concat([Buffer.from('BZ85'),marker,segment(header),marker,segment(document)])
}
