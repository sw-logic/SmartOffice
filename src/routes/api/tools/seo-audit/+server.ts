import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { prisma } from '$lib/server/prisma';
import { requirePermission } from '$lib/server/access-control';
import { logCreate } from '$lib/server/audit';
import { validateUrls, runSeoAudit } from '$lib/server/seo';

export const POST: RequestHandler = async (event) => {
	const { locals } = event;
	await requirePermission(locals, 'tools', 'create');

	const userId = locals.user!.id;

	const body = await event.request.json();
	const rawUrls = body.urls as string;
	const language = typeof body.language === 'string' && body.language.trim() ? body.language.trim() : 'en';

	if (!rawUrls || typeof rawUrls !== 'string') {
		throw error(400, 'Missing or invalid "urls" field');
	}

	// Validate URLs (SSRF protection)
	const validation = await validateUrls(rawUrls);

	if (!validation.valid) {
		return json({
			success: false,
			errors: validation.errors,
			warnings: validation.warnings
		}, { status: 400 });
	}

	// Check for concurrent audits (max 1 running per user)
	const runningAudit = await prisma.seoAudit.findFirst({
		where: {
			createdById: userId,
			status: { in: ['pending', 'running'] }
		}
	});

	if (runningAudit) {
		return json({
			success: false,
			errors: ['You already have an audit in progress. Please wait for it to finish.']
		}, { status: 409 });
	}

	// Create audit record
	const audit = await prisma.seoAudit.create({
		data: {
			urls: validation.urls,
			language,
			createdById: userId,
			progress: {
				currentUrl: '',
				currentStep: 'Queued',
				completedUrls: 0,
				totalUrls: validation.urls.length
			}
		}
	});

	await logCreate(userId, 'tools', String(audit.id), 'SeoAudit', {
		urls: validation.urls,
		urlCount: validation.urls.length
	}, event);

	// Fire-and-forget — start the audit pipeline
	runSeoAudit(audit.id, userId).catch(err => {
		console.error(`SEO audit ${audit.id} failed:`, err);
	});

	return json({
		success: true,
		audit: { id: audit.id },
		warnings: validation.warnings
	}, { status: 201 });
};
