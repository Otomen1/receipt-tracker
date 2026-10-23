// Used in a subprocess (and inherited workers) to make unexpected JS networking fail.
const fail=()=>{throw new Error('NETWORK_ACCESS_FORBIDDEN_DURING_OFFLINE_TEST');};
global.fetch=fail;
for(const name of ['node:http','node:https']) {
  const mod=require(name);mod.request=fail;mod.get=fail;
}
require('node:net').Socket.prototype.connect=fail;
for(const method of ['lookup','resolve','resolve4','resolve6']) require('node:dns')[method]=fail;
