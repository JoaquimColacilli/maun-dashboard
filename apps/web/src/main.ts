import { arrancar } from '@/app';

const raiz = document.getElementById('root');
if (!raiz) throw new Error('Falta el elemento #root en index.html.');

arrancar(raiz);
