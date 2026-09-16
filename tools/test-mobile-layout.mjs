import assert from 'node:assert/strict';
import {mobileLayout} from '../src/mobile-layout.ts';
for(const [w,h]of [[360,640],[375,667],[390,844],[393,674],[414,736],[430,932],[375,625]]){
 const l=mobileLayout(w,h);
 assert.ok(Math.abs(750*l.scale-w)<.01,'Mobile fills viewport width');
 assert.ok(900*l.stageScale>=750,'Video and ground cover the viewport together');
 assert.ok(l.caseTop>=l.stageY+484*l.stageScale,'Case stays below the actual toe-safe line');
 assert.ok(Math.abs((l.trayTop-l.caseTop)/l.boardScale-739)<.01,'8px after the visible suitcase edge, not its transparent padding');
 assert.ok(Math.abs((l.propsTop-l.trayTop)/l.boardScale-186)<.01,'4px after the tray');
 assert.ok(l.trayTop+182*l.boardScale<=l.artHeight,'All slots remain visible');
 assert.ok((l.artHeight-l.propsTop)/(126*l.boardScale)>=.5,'At least half the props remain visible');
 assert.ok(l.boardScale>=.88&&l.boardScale<=1,'Uniform, limited game-area scaling');
 console.log('PASS',w,h,'props visible',Math.min(1,(l.artHeight-l.propsTop)/(126*l.boardScale)).toFixed(2));
}
assert.equal(mobileLayout(1000,1100).artHeight,1650);
console.log('PASS: common phones, app webview, square game, protected feet, full tray and desktop frame.');
