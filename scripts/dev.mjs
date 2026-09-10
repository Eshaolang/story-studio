import './build.mjs';
import {createServer} from '../server/local.mjs';
const port=Number(process.env.PORT || 8787),host=process.env.HOST || '127.0.0.1';
createServer().listen(port,host,()=>console.log(`Story Studio: http://${host}:${port}`));
