const test=require('node:test'),assert=require('node:assert/strict'),path=require('node:path');
require('reflect-metadata');require('ts-node').register({project:path.resolve(__dirname,'../apps/api/tsconfig.json'),transpileOnly:true});
const {SsoController}=require('../apps/api/src/auth/sso.controller.ts');
test('actual SSO controller keeps public identity while proxying both endpoints internally',async()=>{
 const values={AUTH_SSO_BASE_URL:'https://test.auth.gismalink.art',AUTH_SSO_INTERNAL_BASE_URL:'http://auth-sso-api-test:3000/'};const c=new SsoController({get:k=>values[k]});const original=global.fetch,calls=[];
 const req={headers:{cookie:'qa=fixture','user-agent':'qa'}},res={status(s){this.code=s}};
 try{global.fetch=async(url,options)=>{calls.push({url,options});return new Response('{"authenticated":true}',{headers:{'content-type':'application/json'}})};
 assert.equal((await c.getToken(req,res)).authenticated,true);assert.equal((await c.currentUser(req,res)).authenticated,true);
 assert.deepEqual(calls.map(c=>c.url),['http://auth-sso-api-test:3000/auth/get-token','http://auth-sso-api-test:3000/auth/current-user']);assert.equal(calls[0].options.headers['x-forwarded-host'],'test.auth.gismalink.art');assert.equal(calls[0].options.headers.cookie,'qa=fixture');assert.equal(calls[0].options.headers['x-forwarded-proto'],'https');assert.equal(calls[0].options.redirect,'manual');
 delete values.AUTH_SSO_INTERNAL_BASE_URL;global.fetch=async(url)=>{assert.equal(url,'https://test.auth.gismalink.art/auth/current-user');return new Response('{}')};await c.currentUser(req,res);
 values.AUTH_SSO_INTERNAL_BASE_URL='http://auth-sso-api-test:3000';let count=0;global.fetch=async(url)=>{count++;assert.equal(url,'http://auth-sso-api-test:3000/auth/current-user');throw new Error('fixture offline')};await c.currentUser(req,res);assert.equal(res.code,503);assert.equal(count,1);
 }finally{global.fetch=original;}
});
