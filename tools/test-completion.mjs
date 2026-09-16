import assert from 'node:assert/strict';
import {welcomeProfile} from '../src/completion-rules.ts';
const fresh=welcomeProfile({});assert.equal(fresh.coins,1000);assert.equal(fresh.isOwner,true);assert.deepEqual(fresh.demoCoupons,['credit-ride-5-demo']);
assert.deepEqual(welcomeProfile(fresh),fresh,'Replay / refresh never grants twice');
assert.equal(welcomeProfile({coins:150,firstReward:true}).coins,1050,'Upgrade the old 100-coin grant, preserving other coins');
assert.equal(welcomeProfile({coins:75}).coins,1075,'Unrelated coins are preserved');
assert.equal(welcomeProfile(null).coins,1000);assert.equal(welcomeProfile({coins:'bad',archives:null}).coins,1000);
assert.equal(welcomeProfile({...fresh,coins:720}).coins,720,'Spent demo coins stay spent');
console.log('PASS: one-time 1000 demo coins, legacy 100-coin upgrade, replay idempotency, local-only demo coupon.');
