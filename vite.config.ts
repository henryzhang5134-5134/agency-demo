import {defineConfig} from 'vite';
export default defineConfig(({mode})=>({
 base:mode==='github'?'/agency-demo/':'/',
 build:{outDir:mode==='github'?'dist-github':'dist',rollupOptions:{input:{game:'index.html',home:'home.html'}}},
}));
