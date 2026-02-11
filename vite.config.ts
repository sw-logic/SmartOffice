import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';
import mkcert from 'vite-plugin-mkcert';

export default defineConfig({
	plugins: [sveltekit(), mkcert()],
	define: {
		__ENABLE_CARTA_SSR_HIGHLIGHTER__: false
	}
});
