import test from 'node:test';
import assert from 'node:assert/strict';
import {validateFirebaseEnvironment} from '../lib/firebase-admin';
test('Firebase production configuration accepts a real project without opening a network connection',()=>{
 assert.deepEqual(validateFirebaseEnvironment({FIREBASE_PROJECT_ID:'shadowui-real',NEXT_PUBLIC_FIREBASE_PROJECT_ID:'shadowui-real'}),{projectId:'shadowui-real',emulator:false});
});
test('Firebase demo environments require paired loopback emulators and matching browser project',()=>{
 const env={FIREBASE_PROJECT_ID:'demo-shadowui',FIRESTORE_EMULATOR_HOST:'127.0.0.1:8080',FIREBASE_AUTH_EMULATOR_HOST:'127.0.0.1:9099'};
 assert.equal(validateFirebaseEnvironment(env).emulator,true);
 for(const invalid of [{...env,FIREBASE_PROJECT_ID:'production-project'},{...env,FIREBASE_AUTH_EMULATOR_HOST:undefined},{...env,FIRESTORE_EMULATOR_HOST:'remote.example:8080'},{...env,NEXT_PUBLIC_FIREBASE_PROJECT_ID:'different-project'},{FIREBASE_PROJECT_ID:'demo-shadowui'},{}])assert.throws(()=>validateFirebaseEnvironment(invalid));
});
