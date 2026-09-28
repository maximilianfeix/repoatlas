import test from 'node:test';
import assert from 'node:assert/strict';
import {activateOnKeyboard,motionAwareScrollBehavior} from '../dist/accessibility.js';

test('custom SVG buttons activate once with Enter or Space and suppress page scrolling',()=>{
  for(const key of ['Enter',' ']){
    let prevented=0,activated=0;
    const handled=activateOnKeyboard({key,preventDefault(){prevented++;}},()=>activated++);
    assert.equal(handled,true);
    assert.equal(prevented,1);
    assert.equal(activated,1);
  }
});

test('unrelated keyboard input does not activate custom SVG buttons',()=>{
  let prevented=0,activated=0;
  const handled=activateOnKeyboard({key:'ArrowDown',preventDefault(){prevented++;}},()=>activated++);
  assert.equal(handled,false);
  assert.equal(prevented,0);
  assert.equal(activated,0);
});

test('shared-edge map navigation animates unless reduced motion is requested',()=>{
  assert.equal(motionAwareScrollBehavior(false),'smooth');
  assert.equal(motionAwareScrollBehavior(true),'auto');
});
