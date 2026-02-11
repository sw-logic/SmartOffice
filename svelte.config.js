import adapter from '@sveltejs/adapter-node';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

/** @type {import('@sveltejs/kit').Config} */
const config = {
	// Consult https://svelte.dev/docs/kit/integrations
	// for more information about preprocessors
	preprocess: vitePreprocess(),

	kit: {
		// adapter-auto only supports some environments, see https://svelte.dev/docs/kit/adapter-auto for a list.
		// If your environment is not supported, or you settled on a specific environment, switch out the adapter.
		// See https://svelte.dev/docs/kit/adapters for more information about adapters.
		adapter: adapter(),

		alias: {
			$components: 'src/lib/components',
			'$components/*': 'src/lib/components/*',
			$server: 'src/lib/server',
			'$server/*': 'src/lib/server/*',
			$stores: 'src/lib/stores',
			'$stores/*': 'src/lib/stores/*',
			$config: 'src/lib/config',
			'$config/*': 'src/lib/config/*',
			$utils: 'src/lib/utils',
			'$utils/*': 'src/lib/utils/*',
			$modules: 'src/lib/modules',
			'$modules/*': 'src/lib/modules/*'
		}
	}
};

export default config;
