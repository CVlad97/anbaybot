-- Scoped scheduler credential. Secret is generated and remains in Vault.
do $$
begin
  if not exists (select 1 from vault.secrets where name='anbaybot_revenue_scan_token') then
    perform vault.create_secret(encode(extensions.gen_random_bytes(32),'hex'),'anbaybot_revenue_scan_token','Only for the research revenue scanner');
  end if;
end $$;
create or replace function public.authorize_revenue_scan(p_token text)
returns boolean language sql stable security definer set search_path = ''
as $$
  select length(p_token) between 32 and 512 and exists (
    select 1 from vault.decrypted_secrets
    where name='anbaybot_revenue_scan_token'
    and extensions.digest(decrypted_secret,'sha256')=extensions.digest(p_token,'sha256')
  );
$$;
revoke all on function public.authorize_revenue_scan(text) from public, anon, authenticated;
grant execute on function public.authorize_revenue_scan(text) to service_role;
