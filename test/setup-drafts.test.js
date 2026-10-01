import test from 'node:test';
import assert from 'node:assert/strict';
import {createSetup} from '../src/settings.js';
import {createSetupDrafts} from '../src/browser/setup-drafts.js';

test('draft validation preserves invalid values without committing them; correction clears errors',()=>{
 const setup=createSetup(); const drafts=createSetupDrafts(setup);
 drafts.edit('from','25');
 const invalid=drafts.read(setup);
 assert.equal(invalid.valid,false); assert.deepEqual(invalid.setup.fretRange,{from:0,to:12});
 assert.equal(drafts.values.from,'25'); assert.ok(drafts.errors.fretRange);
 drafts.edit('from','3');
 const corrected=drafts.read(setup);
 assert.equal(corrected.valid,true); assert.deepEqual(corrected.setup.fretRange,{from:3,to:12});
 assert.equal(drafts.errors.fretRange,'');
});
test('unchanged tuning preserves preset identity and string subset',()=>{
 const setup=createSetup({selectedStringIndexes:[1,2,3,4,5]});
 const drafts=createSetupDrafts(setup); drafts.edit('tuning','  E A D G B e  ');
 assert.deepEqual(drafts.read(setup).setup,setup);
 drafts.edit('tuning','D A D G B e');
 const changed=drafts.read(setup).setup;
 assert.equal(changed.tuning.id,'custom');assert.deepEqual(changed.selectedStringIndexes,[0,1,2,3,4,5]);
});
test('presets replace only their own drafts and invalid tuning is never committed',()=>{
 const setup=createSetup(); const drafts=createSetupDrafts(setup);
 drafts.edit('bpm','9'); drafts.edit('from','25');drafts.edit('tuning','garbage');
 assert.equal(drafts.read(setup).valid,false);
 drafts.reset({...setup,fretRange:{from:5,to:9}},['fretRange']);
 assert.equal(drafts.values.from,'5');assert.equal(drafts.values.bpm,'9');assert.equal(drafts.values.tuning,'garbage');
 const result=drafts.read(setup);
 assert.deepEqual(result.setup.tuning,setup.tuning);assert.equal(result.setup.bpm,40);
 assert.ok(drafts.errors.bpm);assert.ok(drafts.errors.tuning);
});
