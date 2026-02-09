import type { PageServerLoad, Actions } from './$types';
import { prisma } from '$lib/server/prisma';
import { requirePermission, checkPermission } from '$lib/server/access-control';
import { fail, redirect } from '@sveltejs/kit';
import { logCreate } from '$lib/server/audit';
import bcrypt from 'bcryptjs';

export const load: PageServerLoad = async ({ locals }) => {
	await requirePermission(locals, 'settings', 'users');

	const canManageSalary = checkPermission(locals, 'employees', 'salary');

	const [userGroups, company] = await Promise.all([
		prisma.userGroup.findMany({
			orderBy: { name: 'asc' },
			select: {
				id: true,
				name: true,
				description: true
			}
		}),
		prisma.company.findFirst({
			select: { id: true, name: true }
		})
	]);

	return { userGroups, canManageSalary, companyId: company?.id || null };
};

export const actions: Actions = {
	default: async ({ locals, request }) => {
		await requirePermission(locals, 'settings', 'users');

		const canManageSalary = checkPermission(locals, 'employees', 'salary');

		const formData = await request.formData();

		// Account fields
		const name = formData.get('name') as string;
		const email = formData.get('email') as string;
		const password = formData.get('password') as string;
		const groupIds = formData.getAll('groups') as string[];

		// Personal info
		const firstName = formData.get('firstName') as string;
		const lastName = formData.get('lastName') as string;
		const phone = formData.get('phone') as string;
		const mobile = formData.get('mobile') as string;
		const dateOfBirth = formData.get('dateOfBirth') as string;

		// Address
		const street = formData.get('street') as string;
		const city = formData.get('city') as string;
		const postalCode = formData.get('postalCode') as string;
		const country = formData.get('country') as string;

		// Employment
		const companyId = formData.get('companyId') as string;
		const hireDate = formData.get('hireDate') as string;
		const employmentType = formData.get('employmentType') as string;
		const department = formData.get('department') as string;
		const jobTitle = formData.get('jobTitle') as string;
		const employeeStatus = formData.get('employeeStatus') as string;

		// Salary (only if permitted)
		const salaryStr = formData.get('salary') as string;
		const salaryTaxStr = formData.get('salary_tax') as string;
		const salaryBonusStr = formData.get('salary_bonus') as string;

		// Validation
		const errors: Record<string, string> = {};

		if (!name?.trim()) {
			errors.name = 'Name is required';
		}

		if (!email?.trim()) {
			errors.email = 'Email is required';
		} else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
			errors.email = 'Invalid email format';
		}

		if (!password?.trim()) {
			errors.password = 'Password is required';
		} else if (password.length < 6) {
			errors.password = 'Password must be at least 6 characters';
		}

		if (Object.keys(errors).length > 0) {
			return fail(400, {
				errors,
				values: {
					name,
					email,
					groupIds,
					firstName,
					lastName,
					phone,
					mobile,
					dateOfBirth,
					street,
					city,
					postalCode,
					country,
					companyId,
					hireDate,
					employmentType,
					department,
					jobTitle,
					employeeStatus,
					salary: salaryStr,
					salary_tax: salaryTaxStr,
					salary_bonus: salaryBonusStr
				}
			});
		}

		// Check if email already exists
		const existingUser = await prisma.user.findUnique({
			where: { email }
		});

		if (existingUser) {
			return fail(400, {
				errors: { email: 'A user with this email already exists' },
				values: {
					name,
					email,
					groupIds,
					firstName,
					lastName,
					phone,
					mobile,
					dateOfBirth,
					street,
					city,
					postalCode,
					country,
					companyId,
					hireDate,
					employmentType,
					department,
					jobTitle,
					employeeStatus,
					salary: salaryStr,
					salary_tax: salaryTaxStr,
					salary_bonus: salaryBonusStr
				}
			});
		}

		// Hash password
		const hashedPassword = await bcrypt.hash(password, 10);

		// Build data object
		const data: Record<string, unknown> = {
			name,
			email,
			password: hashedPassword,
			firstName: firstName?.trim() || null,
			lastName: lastName?.trim() || null,
			phone: phone?.trim() || null,
			mobile: mobile?.trim() || null,
			dateOfBirth: dateOfBirth ? new Date(dateOfBirth) : null,
			street: street?.trim() || null,
			city: city?.trim() || null,
			postalCode: postalCode?.trim() || null,
			country: country?.trim() || null,
			companyId: companyId ? parseInt(companyId) : null,
			hireDate: hireDate ? new Date(hireDate) : null,
			employmentType: employmentType || null,
			department: department || null,
			jobTitle: jobTitle?.trim() || null,
			employeeStatus: employeeStatus || null,
			userGroups: {
				create: groupIds.map((groupId) => ({
					userGroupId: parseInt(groupId)
				}))
			}
		};

		// Only set salary fields if user has permission
		if (canManageSalary) {
			data.salary = salaryStr ? parseFloat(salaryStr) : null;
			data.salary_tax = salaryTaxStr ? parseFloat(salaryTaxStr) : null;
			data.salary_bonus = salaryBonusStr ? parseFloat(salaryBonusStr) : null;
		}

		// Create user
		const user = await prisma.user.create({
			data: data as Parameters<typeof prisma.user.create>[0]['data']
		});

		await logCreate(locals.user!.id, 'users', String(user.id), 'User', {
			name,
			email,
			firstName: firstName || null,
			lastName: lastName || null,
			department: department || null,
			jobTitle: jobTitle || null,
			employeeStatus: employeeStatus || null,
			groups: groupIds
		});

		redirect(303, '/users');
	}
};
