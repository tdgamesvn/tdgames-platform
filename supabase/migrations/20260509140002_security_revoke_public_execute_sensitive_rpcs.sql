-- Remove PUBLIC EXECUTE so anonymous clients cannot call sensitive RPCs via implicit grant.

REVOKE EXECUTE ON FUNCTION public.get_jwt_role() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.is_staff() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.is_admin_or_ke_toan() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.sync_payroll_to_expense() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.sync_invoice_to_expense() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.sync_settlement_to_expense() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_my_role() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_my_company_id() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_my_visible_task_ids() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_my_visible_project_ids() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.transition_task_status(uuid, task_status, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.update_clickup_sync_schedule(text[], boolean) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.rls_auto_enable() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.hr_generate_employee_code() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.handle_updated_at() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.log_invoice_change() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.refresh_payroll_expense_for_sheet(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.trg_payroll_records_touch_expense() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.pay_payroll_sheets_before_upd() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.sync_hr_employee_auth_user() FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.get_jwt_role() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_staff() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_admin_or_ke_toan() TO authenticated;
GRANT EXECUTE ON FUNCTION public.sync_payroll_to_expense() TO authenticated;
GRANT EXECUTE ON FUNCTION public.sync_invoice_to_expense() TO authenticated;
GRANT EXECUTE ON FUNCTION public.sync_settlement_to_expense() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_my_role() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_my_company_id() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_my_visible_task_ids() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_my_visible_project_ids() TO authenticated;
GRANT EXECUTE ON FUNCTION public.transition_task_status(uuid, task_status, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_clickup_sync_schedule(text[], boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.rls_auto_enable() TO authenticated;
GRANT EXECUTE ON FUNCTION public.hr_generate_employee_code() TO authenticated;
GRANT EXECUTE ON FUNCTION public.handle_updated_at() TO authenticated;
GRANT EXECUTE ON FUNCTION public.log_invoice_change() TO authenticated;

REVOKE EXECUTE ON FUNCTION public.find_auth_user_by_email(text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.invoice_verify_login(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.find_auth_user_by_email(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.invoice_verify_login(text, text) TO anon, authenticated;
