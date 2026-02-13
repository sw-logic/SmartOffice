import { writeFile, mkdir, unlink, readFile, access, rm } from 'fs/promises';
import { join, extname, resolve } from 'path';
import { randomUUID } from 'crypto';

const UPLOAD_DIR = process.env.UPLOAD_DIR || '/var/uploads';
const MAX_FILE_SIZE = parseInt(process.env.MAX_FILE_SIZE || '10485760'); // 10MB default

/**
 * Resolve a relative path within UPLOAD_DIR and validate it doesn't escape via directory traversal.
 * Throws if the resolved path is outside the upload directory.
 */
function resolveSecurePath(relativePath: string): string {
	const fullPath = resolve(UPLOAD_DIR, relativePath);
	if (!fullPath.startsWith(resolve(UPLOAD_DIR))) {
		throw new Error('Invalid path: directory traversal detected');
	}
	return fullPath;
}

const ALLOWED_MIME_TYPES: Record<string, string[]> = {
	image: ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/aiff'],
	document: ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
	spreadsheet: ['application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'text/csv']
};

const ALL_ALLOWED_TYPES = Object.values(ALLOWED_MIME_TYPES).flat();

export type FileCategory = 'receipts' | 'documents' | 'offers' | 'avatars' | 'logos' | 'seo-audits';

export interface UploadResult {
	success: boolean;
	path?: string;
	filename?: string;
	originalName?: string;
	size?: number;
	error?: string;
}

/**
 * Save an uploaded file to the server
 * @param file - The file to save
 * @param category - The category/subdirectory for the file
 * @param allowedTypes - Optional array of allowed MIME types
 * @returns Upload result with file path or error
 */
export async function saveFile(
	file: File,
	category: FileCategory,
	allowedTypes: string[] = ALL_ALLOWED_TYPES
): Promise<UploadResult> {
	// Validate file size
	if (file.size > MAX_FILE_SIZE) {
		return {
			success: false,
			error: `File too large. Maximum size is ${MAX_FILE_SIZE / 1024 / 1024}MB`
		};
	}

	// Validate file type
	if (!allowedTypes.includes(file.type)) {
		return {
			success: false,
			error: `Invalid file type: ${file.type}. Allowed types: ${allowedTypes.join(', ')}`
		};
	}

	try {
		const date = new Date();
		const year = date.getFullYear();
		const month = String(date.getMonth() + 1).padStart(2, '0');

		// Create directory structure: /uploads/{category}/{year}/{month}/
		const dir = join(UPLOAD_DIR, category, String(year), month);
		await mkdir(dir, { recursive: true });

		// Generate unique filename
		const ext = extname(file.name) || getExtensionFromMime(file.type);
		const filename = `${randomUUID()}${ext}`;
		const filepath = join(dir, filename);

		// Save file
		const buffer = Buffer.from(await file.arrayBuffer());
		await writeFile(filepath, buffer);

		// Return relative path for database storage
		const relativePath = `${category}/${year}/${month}/${filename}`;

		return {
			success: true,
			path: relativePath,
			filename,
			originalName: file.name,
			size: file.size
		};
	} catch (error) {
		console.error('File upload error:', error);
		return {
			success: false,
			error: error instanceof Error ? error.message : 'Unknown error during file upload'
		};
	}
}

/**
 * Delete a file from the server
 * @param relativePath - The relative path of the file to delete
 * @returns True if deleted successfully
 */
export async function deleteFile(relativePath: string): Promise<boolean> {
	try {
		const fullPath = resolveSecurePath(relativePath);
		await unlink(fullPath);
		return true;
	} catch (error) {
		console.error('File deletion error:', error);
		return false;
	}
}

/**
 * Check if a file exists
 * @param relativePath - The relative path of the file
 * @returns True if file exists
 */
export async function fileExists(relativePath: string): Promise<boolean> {
	try {
		const fullPath = resolveSecurePath(relativePath);
		await access(fullPath);
		return true;
	} catch {
		return false;
	}
}

/**
 * Read a file from the server
 * @param relativePath - The relative path of the file
 * @returns File buffer or null if not found
 */
export async function getFile(relativePath: string): Promise<Buffer | null> {
	try {
		const fullPath = resolveSecurePath(relativePath);
		return await readFile(fullPath);
	} catch {
		return null;
	}
}

/**
 * Get the full path for a file
 * @param relativePath - The relative path of the file
 * @returns Full filesystem path
 */
export function getFullPath(relativePath: string): string {
	return resolveSecurePath(relativePath);
}

/**
 * Get file extension from MIME type
 */
function getExtensionFromMime(mimeType: string): string {
	const mimeToExt: Record<string, string> = {
		'image/jpeg': '.jpg',
		'image/png': '.png',
		'image/gif': '.gif',
		'image/webp': '.webp',
		'image/aiff': '.aiff',
		'application/pdf': '.pdf',
		'application/msword': '.doc',
		'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '.docx',
		'application/vnd.ms-excel': '.xls',
		'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': '.xlsx',
		'text/csv': '.csv'
	};
	return mimeToExt[mimeType] || '.bin';
}

/**
 * Get content type from file extension
 */
export function getContentType(filename: string): string {
	const ext = extname(filename).toLowerCase();
	const extToMime: Record<string, string> = {
		'.jpg': 'image/jpeg',
		'.jpeg': 'image/jpeg',
		'.png': 'image/png',
		'.gif': 'image/gif',
		'.webp': 'image/webp',
		'.aiff': 'image/aiff',
		'.pdf': 'application/pdf',
		'.doc': 'application/msword',
		'.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
		'.xls': 'application/vnd.ms-excel',
		'.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
		'.csv': 'text/csv'
	};
	return extToMime[ext] || 'application/octet-stream';
}

/**
 * Validate image dimensions (for avatars/logos)
 * Note: This is a basic implementation - for production, consider using sharp or similar
 */
export function isValidImage(mimeType: string): boolean {
	return ALLOWED_MIME_TYPES.image.includes(mimeType);
}

// Avatar-specific upload
export const AVATAR_ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/aiff'];
export const AVATAR_MAX_SIZE = 2 * 1024 * 1024; // 2MB

export async function saveAvatar(file: File): Promise<UploadResult> {
	if (file.size > AVATAR_MAX_SIZE) {
		return { success: false, error: 'Avatar file too large. Maximum size is 2MB' };
	}
	return saveFile(file, 'avatars', AVATAR_ALLOWED_TYPES);
}

/**
 * Delete a directory and all its contents within UPLOAD_DIR
 * @param relativePath - The relative directory path to delete
 * @returns True if deleted successfully
 */
export async function deleteDirectory(relativePath: string): Promise<boolean> {
	try {
		const fullPath = resolveSecurePath(relativePath);
		await rm(fullPath, { recursive: true, force: true });
		return true;
	} catch (error) {
		console.error('Directory deletion error:', error);
		return false;
	}
}
