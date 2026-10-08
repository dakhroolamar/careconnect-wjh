import {defineConfig} from 'vite';
import {createApi} from './server/api.js';
export default defineConfig({plugins:[{name:'facility-pilot-api',configureServer(server){const api=createApi();server.middlewares.use(api.handler);server.httpServer?.once('close',()=>api.close());}}]});
