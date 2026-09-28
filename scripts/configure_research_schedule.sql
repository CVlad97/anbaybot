
select cron.alter_job(
  (select jobid from cron.job where jobname='anbaybot-revenue-scan-hourly'),
  command := $job$
    select net.http_post(
      url := (select decrypted_secret from vault.decrypted_secrets where name='anbaybot_project_url') || '/functions/v1/revenue-scanner',
      headers := jsonb_build_object('Content-Type','application/json','X-Anbaybot-Scan-Token',
        (select decrypted_secret from vault.decrypted_secrets where name='anbaybot_revenue_scan_token')),
      body := jsonb_build_object('scheduled_at',now()),
      timeout_milliseconds := 20000
    );
  $job$
);
