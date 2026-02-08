import type { PageServerLoad, Actions } from './$types';
import { prisma } from '$lib/server/prisma';
import { requirePermission, checkPermission } from '$lib/server/access-control';
import { fail, redirect } from '@sveltejs/kit';
import { logCreate } from '$lib/server/audit';

export const load: PageServerLoad = async ({ locals }) => {
	await requirePermission(locals, 'employees', 'create');

	// Check if user can manage salary
	const canManageSalary = checkPermission(locals, 'employees', 'salary');

	return {
		canManageSalary
	};
};

export const actions: Actions = {
	default: async ({ locals, request }) => {
		await requirePermission(locals, 'employees', 'create');

		const canManageSalary = checkPermission(locals, 'employees', 'salary');

		const formData = await request.formData();

		const firstName = formData.get('firstName') as string;
		const lastName = formData.get('lastName') as string;
		const email = formData.get('email') as string;
		const phone = formData.get('phone') as string;
		const mobile = formData.get('mobile') as string;
		const dateOfBirth = formData.get('dateOfBirth') as string;
		const street = formData.get('street') as string;
		const city = formData.get('city') as string;
		const postalCode = formData.get('postalCode') as string;
		const country = formData.get('country') as string;
		const hireDate = formData.get('hireDate') as string;
		const employmentType = formData.get('employmentType') as string;
		const department = formData.get('department') as string;
		const jobTitle = formData.get('jobTitle') as string;
		const employeeStatus = (formData.get('employeeStatus') as string) || 'active';
		const emergencyContact = formData.get('emergencyContact') as string;
		const notes = formData.get('notes') as string;

		// Salary fields (only if user has permission)
		const salary = canManageSalary ? (formData.get('salary') as string) : null;
		const salaryTax = canManageSalary ? (formData.get('salaryTax') as string) : null;
		const salaryBonus = canManageSalary ? (formData.get('salaryBonus') as string) : null;

		// Validation
		const errors: Record<string, string> = {};

		if (!firstName?.trim()) {
			errors.firstName = 'First name is required';
		}

		if (!lastName?.trim()) {
			errors.lastName = 'Last name is required';
		}

		if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
			errors.email = 'Please enter a valid email address';
		}

		// Check for duplicate email
		if (email) {
			const existingEmployee = await prisma.person.findFirst({
				where: {
					email: email.trim(),
					personType: 'company_employee',
					deletedAt: null
				}
			});
			if (existingEmployee) {
				errors.email = 'An employee with this email already exists';
			}
		}

		if (Object.keys(errors).length > 0) {
			return fail(400, {
				errors,
				values: {
					firstName,
					lastName,
					email,
					phone,
					mobile,
					dateOfBirth,
					street,
					city,
					postalCode,
					country,
					hireDate,
					employmentType,
					department,
					jobTitle,
					employeeStatus,
					emergencyContact,
					notes,
					salary,
					salaryTax,
					salaryBonus
				}
			});
		}

		// Create employee
		const employee = await prisma.person.create({
			data: {
				firstName: firstName.trim(),
				lastName: lastName.trim(),
				email: email?.trim() || null,
				phone: phone?.trim() || null,
				mobile: mobile?.trim() || null,
				dateOfBirth: dateOfBirth ? new Date(dateOfBirth) : null,
				street: street?.trim() || null,
				city: city?.trim() || null,
				postalCode: postalCode?.trim() || null,
				country: country?.trim() || null,
				personType: 'company_employee',
				hireDate: hireDate ? new Date(hireDate) : null,
				employmentType: employmentType || null,
				department: department?.trim() || null,
				jobTitle: jobTitle?.trim() || null,
				employeeStatus,
				emergencyContact: emergencyContact?.trim() || null,
				notes: notes?.trim() || null,
				salary: salary ? parseFloat(salary) : null,
				salary_tax: salaryTax ? parseFloat(salaryTax) : null,
				salary_bonus: salaryBonus ? parseFloat(salaryBonus) : null
			}
		});

		await logCreate(locals.user!.id, 'employees', String(employee.id), 'Person', {
			firstName: employee.firstName,
			lastName: employee.lastName,
			email: employee.email,
			jobTitle: employee.jobTitle,
			department: employee.department
		});

		redirect(303, `/employees/${employee.id}`);
	}
};
