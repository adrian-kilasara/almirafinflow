
REVOKE EXECUTE ON FUNCTION public.recalculate_savings_goal_amount(uuid) FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.tg_recalculate_savings_goal_amount() FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.handle_new_user_settings() FROM anon, authenticated, PUBLIC;
