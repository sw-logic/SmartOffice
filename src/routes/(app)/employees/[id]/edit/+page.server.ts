import type { PageServerLoad, Actions } from './$types';
import { prisma } from '$lib/server/prisma';
import { requirePermission, checkPermission } from '$lib/server/access-control';
import { fail, redirect, error } from '@sveltejs/kit';
import { logUpdate } from '$lib/server/audit';

export const load: PageServerLoad = async ({ locals, params }) => {
	await requirePermission(locals, 'employees', 'update');

	// Check if user can manage salary
	const canManageSalary = checkPermission(locals, 'employees', 'salary');

	// Check if current user is admin (can edit deleted employees)
	const isAdmin = checkPermission(locals, '*', '*');

	// Parse employee ID
	const employeeId = parseInt(params.id);
	if (isNaN(employeeId)) {
		error(400, 'Invalid employee ID');
	}

	// Salary select fields based on permission
	const salarySelect = canManageSalary
		? {
				salary: true,
				salary_tax: true,
				salary_bonus: true
			}
		: {};

	const employee = await prisma.person.findFirst({
		where: {
			id: employeeId,
			personType: 'company_employee'
		},
		select: {
			id: true,
			firstName: true,
			lastName: true,
			email: true,
			phone: true,
			mobile: true,
			dateOfBirth: true,
			street: true,
			city: true,
			postalCode: true,
			country: true,
			hireDate: true,
			employmentType: true,
			department: true,
			jobTitle: true,
			employeeStatus: true,
			emergencyContact: true,
			notes: true,
			deletedAt: true,
			...salarySelect
		}
	});

	if (!employee) {
		error(404, 'Employee not found');
	}

	// If employee is deleted and user is not admin, deny access
	if (employee.deletedAt && !isAdmin) {
		error(403, 'Only administrators can edit deleted employees');
	}

	// Convert Decimal fields to numbers for serialization
	return {
		employee: {
			...employee,
			salary: employee.salary ? Number(employee.salary) : null,
			salary_tax: employee.salary_tax ? Number(employee.salary_tax) : null,
			salary_bonus: employee.salary_bonus ? Number(employee.salary_bonus) : null,
			isDeleted: employee.deletedAt !== null,
			// Format dates for input fields
			dateOfBirth: employee.dateOfBirth
				? new Date(employee.dateOfBirth).toISOString().split('T')[0]
				: '',
			hireDate: employee.hireDate ? new Date(employee.hireDate).toISOString().split('T')[0] : ''
		},
		canManageSalary,
		isAdmin
	};
};

export const actions: Actions = {
	default: async ({ locals, request, params }) => {
		await requirePermission(locals, 'employees', 'update');

		// Parse employee ID
		const employeeId = parseInt(params.id);
		if (isNaN(employeeId)) {
			return fail(400, { error: 'Invalid employee ID' });
		}

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
		const salary = canManageSalary ? (formData.get('salary') as string) : undefined;
		const salaryTax = canManageSalary ? (formData.get('salaryTax') as string) : undefined;
		const salaryBonus = canManageSalary ? (formData.get('salaryBonus') as string) : undefined;

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

		// Check for duplicate email (excluding current employee)
		if (email) {
			const existingEmployee = await prisma.person.findFirst({
				where: {
					email: email.trim(),
					personType: 'company_employee',
					deletedAt: null,
					id: { not: employeeId }
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

		// Get old values for audit
		const oldEmployee = await prisma.person.findUnique({
			where: { id: employeeId },
			select: {
				firstName: true,
				lastName: true,
				email: true,
				phone: true,
				mobile: true,
				dateOfBirth: true,
				street: true,
				city: true,
				postalCode: true,
				country: true,
				hireDate: true,
				employmentType: true,
				department: true,
				jobTitle: true,
				employeeStatus: true,
				emergencyContact: true,
				notes: true,
				salary: true,
				salary_tax: true,
				salary_bonus: true
			}
		});

		// Build update data
		const updateData: any = {
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
			hireDate: hireDate ? new Date(hireDate) : null,
			employmentType: employmentType || null,
			department: department?.trim() || null,
			jobTitle: jobTitle?.trim() || null,
			employeeStatus,
			emergencyContact: emergencyContact?.trim() || null,
			notes: notes?.trim() || null
		};

		// Only update salary if user has permission
		if (canManageSalary) {
			updateData.salary = salary ? parseFloat(salary) : null;
			updateData.salary_tax = salaryTax ? parseFloat(salaryTax) : null;
			updateData.salary_bonus = salaryBonus ? parseFloat(salaryBonus) : null;
		}

		// Update employee
		const updatedEmployee = await prisma.person.update({
			where: { id: employeeId },
			data: updateData
		});

		// Prepare audit new values (exclude salary if not allowed)
		const auditNewValues: any = {
			firstName: updatedEmployee.firstName,
			lastName: updatedEmployee.lastName,
			email: updatedEmployee.email,
			phone: updatedEmployee.phone,
			mobile: updatedEmployee.mobile,
			dateOfBirth: updatedEmployee.dateOfBirth,
			street: updatedEmployee.street,
			city: updatedEmployee.city,
			postalCode: updatedEmployee.postalCode,
			country: updatedEmployee.country,
			hireDate: updatedEmployee.hireDate,
			employmentType: updatedEmployee.employmentType,
			department: updatedEmployee.department,
			jobTitle: updatedEmployee.jobTitle,
			employeeStatus: updatedEmployee.employeeStatus,
			emergencyContact: updatedEmployee.emergencyContact,
			notes: updatedEmployee.notes
		};

		// Exclude salary from audit old values if not allowed
		const auditOldValues: any = { ...oldEmployee };
		if (!canManageSalary) {
			delete auditOldValues.salary;
			delete auditOldValues.salary_tax;
			delete auditOldValues.salary_bonus;
		}

		await logUpdate(locals.user!.id, 'employees', String(employeeId), 'Person', auditOldValues, auditNewValues);

		redirect(303, `/employees/${params.id}`);
	}
};
