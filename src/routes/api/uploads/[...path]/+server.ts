import type { RequestHandler } from './$types';
import { getFile, getContentType } from '$lib/server/file-upload';
import { error } from '@sveltejs/kit';

export const GET: RequestHandler = async ({ params }) => {
	const relativePath = params.path;

	if (!relativePath) {
		error(400, 'Path is required');
	}

	const buffer = await getFile(relativePath);

	if (!buffer) {
		error(404, 'File not found');
	}

	const contentType = getContentType(relativePath);

	return new Response(buffer, {
		headers: {
			'Content-Type': contentType,
			'Cache-Control': 'public, max-age=31536000, immutable'
		}
	});
};
